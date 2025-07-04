const fs = require('fs').promises;
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');
const { saveMeta } = require('./saveMeta');
const {getTsCode} = require('./analyzeCode');
const vm = require('vm');
const { runDefaultTransformationRules } = require('@wakaru/unminify');
const { makeClassCode } = require('./makeClassAst');
function parseSystemRegister(jsCode) {
    // 存储提取的参数
    let extractedModuleName, extractedDeps, extractedModule;

    // 创建一个沙箱环境
    const sandbox = {
        System: {
            register(moduleName, deps, module) {
                // 保存参数值
                extractedModuleName = moduleName;
                extractedDeps = deps;
                extractedModule = module;
            }
        }
    };

    try {
        // 在沙箱中运行代码
        vm.runInNewContext(jsCode, sandbox);
    } catch (error) {
        console.error('解析代码时出错:', error.message);
        return null;
    }

    // 返回提取的参数
    return {
        moduleName: extractedModuleName,
        dependencies: extractedDeps,
        moduleFactory: extractedModule
    };
}

function getImportsInfo(functionCode) {
    // 提取函数参数
    const paramMatch = functionCode.match(/function\s*\(([^)]*)\)/);
    const moduleName = paramMatch ? paramMatch[1].trim() : '';
    if(!moduleName){
        throw new Error('getImportsInfo get moduleName error');
    }
    // 提取函数体内容
    const bodyMatch = functionCode.match(/\{([\s\S]*?)\}/);
    if (!bodyMatch) return { moduleName, imports: {} };
    
    const functionBody = bodyMatch[1].replace(/\s+/g, '');
    
    // 预处理：提取所有 ((alias = module.property)) 格式的赋值
    const assignmentPattern = /(\w+)=(\w+)\.(\w+)/g;
    const assignments = [];
    let match;
    
    while ((match = assignmentPattern.exec(functionBody)) !== null) {
        assignments.push({
            alias: match[1],
            module: match[2],
            property: match[3]
        });
    }
    
    const imports = {};
    assignments.forEach(assignment => {
        if (assignment.module === moduleName) {
            imports[assignment.property] = assignment.alias;
        }
    });
    
    return { moduleName, imports };
}

// 重命名函数参数
function renameFuncArgs(functionCode) {
    // 将函数表达式包装成可解析的程序
    const ast = parser.parse(`const temp = ${functionCode}`);

    const functionExpression = ast.program.body[0].declarations[0].init;
    if (functionExpression && functionExpression.type === 'FunctionExpression' && functionExpression.params.length > 0) {
        const oldName = functionExpression.params[0].name;
        // 需要一个 scope 对象来执行重命名，因此仍然需要 traverse，但可以限定范围
        traverse(ast, {
            FunctionExpression(path) {
                if (path.node === functionExpression) {
                    path.scope.rename(oldName, "_M_exports");
                    path.stop(); // 找到并处理后立即停止遍历
                }
            }
        });
    }

    const { code } = generator(ast);
    return code;
}

function transExports(code) {
    const prefix = '_M_exports(';
    let result = '';
    let lastIndex = 0;

    while (true) {
        const startIndex = code.indexOf(prefix, lastIndex);
        if (startIndex === -1) {
            result += code.substring(lastIndex);
            break;
        }

        result += code.substring(lastIndex, startIndex);

        let openParens = 1;
        let searchIndex = startIndex + prefix.length;

        // Find key
        let keyEndIndex = -1;
        let key = '';
        if (code[searchIndex] === '"' || code[searchIndex] === "'") {
            const quote = code[searchIndex];
            keyEndIndex = code.indexOf(quote, searchIndex + 1);
            key = code.substring(searchIndex + 1, keyEndIndex);
        } else {
            // Fallback for non-string keys, might need adjustment for complex cases
            keyEndIndex = code.indexOf(',', searchIndex);
            key = code.substring(searchIndex, keyEndIndex).trim();
        }

        const commaIndex = code.indexOf(',', keyEndIndex);
        let valueStartIndex = commaIndex + 1;
        while(code[valueStartIndex] === ' ') valueStartIndex++; // trim leading space

        // Find matching closing parenthesis
        let endIndex = -1;
        for (let i = searchIndex; i < code.length; i++) {
            if (code[i] === '(') {
                openParens++;
            } else if (code[i] === ')') {
                openParens--;
            }
            if (openParens === 0) {
                endIndex = i;
                break;
            }
        }

        if (endIndex === -1) {
            // Malformed, append rest of string and stop
            result += code.substring(startIndex);
            break;
        }

        const value = code.substring(valueStartIndex, endIndex).trim();
        result += `module.exports["${key}"] = ${value}`;
        lastIndex = endIndex + 1;
        if (code[lastIndex] === ';') {
            lastIndex++;
        }
    }

    return result;
}

function systemjs2require(dependencies, moduleFactory) { 
  // console.log(renameFuncArgs(moduleFactory.toString()));
  let moduleFactory2;
  eval(renameFuncArgs(moduleFactory.toString()).replace("const temp", "moduleFactory2"));
  const {setters, execute} = moduleFactory2();
  let importsTotals = setters.map((setter,i)=>{
    const ret = getImportsInfo(setter.toString());
    ret.moduleName = dependencies[i].replace('.ts','');
    return ret;
  });
  const requireInfos = importsTotals.map(importsInfo=>{
      const {moduleName, imports} = importsInfo;
      const info = [];
      for(let key in imports){
        info.push(`${key}:${imports[key]}`);
      }

      return `var { ${info.join(', ')} } = require('${moduleName}');`
  })

  let executeBody = execute.toString().split("\n");
  let idx = executeBody.findIndex(line => line.includes(`_RF.push`));
  const shortUUID = executeBody[idx].match(/\w+\._RF\.push\(.*?\s*,\s*["']([^"']+)["'],\s*(.*?)\);/s)[1];
  executeBody[idx] = "";
  executeBody = executeBody.slice(1, -2).join('\n');

  // 将_M_exports替换为module.exports
  return {
    shortUUID,
    requirejs: requireInfos.join("\n") + "\n" + transExports(executeBody),
  }
}

function fixVarName(code) {
    const ast = parser.parse(code, { sourceType: 'module' });

    traverse(ast, {
        Program(path) {
          const scope = path.scope;
          const renameMap = new Map();
          const declarationsToRemove = [];

          path.get('body').forEach(nodePath => {
              if (nodePath.isVariableDeclaration()) {
                  if (nodePath.node.declarations.length === 1) {
                      const declaration = nodePath.node.declarations[0];
                      if (t.isIdentifier(declaration.id) && declaration.id.name.length === 1 && t.isIdentifier(declaration.init)) {
                          const oldName = declaration.id.name;
                          const newName = declaration.init.name;
                          // Ensure the new name is not the same and is a valid identifier
                          if (oldName !== newName && t.isValidIdentifier(newName)) {
                              renameMap.set(oldName, newName);
                              declarationsToRemove.push(nodePath);
                          }
                      }
                  }
              }
          });

          renameMap.forEach((newName, oldName) => {
              if (scope.hasBinding(oldName)) {
                  scope.rename(oldName, newName);
              }
          });

          declarationsToRemove.forEach(declarationPath => {
              if (!declarationPath.removed) {
                  declarationPath.remove();
              }
          });
        }
    });

    return makeClassCode(ast);
}

async function processBundle(bundlePath, outputDir = 'output') {
  try {
    const bundleContent = await fs.readFile(bundlePath, 'utf-8');
    const {moduleName, dependencies, moduleFactory} = parseSystemRegister(bundleContent);
    if(!moduleName.endsWith('.ts')){
      return;
    }
    fileName = moduleName.split('/').pop();
    const {requirejs, shortUUID} = systemjs2require(dependencies, moduleFactory);
    const {code:unminifiedCode} = await runDefaultTransformationRules({source:requirejs});
    console.log('fileName:', fileName);
    console.log('shortUUID:', shortUUID);
    saveMeta(shortUUID, fileName, outputDir);

    const unminifiedCode_fix = fixVarName(unminifiedCode);

    // await fs.writeFile(path.join(outputDir, fileName.replace(".ts", ".norf.ts")), unminifiedCode_fix);

    console.log('===== tsCode =====');
    const tsCode = getTsCode(unminifiedCode_fix);
    console.log(tsCode);
    await fs.writeFile(path.join(outputDir, fileName), tsCode, 'utf-8');
  } catch (error) {
    console.error(`Error processing ${bundlePath}:`, error);
  }
}

if(require.main === module){
  processBundle('exm/BackPackUI-bundle.js');
  processBundle('exm/AdapterContent-bundle.js');
  processBundle('exm/HeroSlot-bundle.js');
  processBundle('exm/HomeUI-bundle.js');
  processBundle('exm/Loader-bundle.js');
  processBundle('exm/MyTest-bundle.js');
  processBundle('exm/main-bundle.js');
  processBundle('exm/SceneList-bundle.js');
}

module.exports = { processBundle };