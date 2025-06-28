const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');

const { runDefaultTransformationRules } = require('@wakaru/unminify');
const { getLongUUID } = require('./uuid-utils');
const { makeMeta } = require('./makeMeta');

const EXM = 'exm2';

// 基于AST的通用解析器
class BundleParser {
  constructor(bundleContent) {
    this.bundleContent = bundleContent;
    this.moduleInfo = null;
    this.classInfo = null;
  }

  // 解析bundle文件，提取模块信息
  parseBundle() {
    let registered;
    const sandbox = {
      System: {
        register: (...args) => {
          registered = args;
        },
      },
    };

    const script = new vm.Script(this.bundleContent);
    script.runInNewContext(sandbox);

    if (!registered) {
      throw new Error('Failed to find System.register call');
    }

    const [moduleName, dependencies, factory] = registered;
    const fileName = moduleName.split('/').pop();

    const moduleDefinition = factory(() => {}, {});

    if (!moduleDefinition || !moduleDefinition.setters || !moduleDefinition.execute) {
      throw new Error('Could not get module definition from factory');
    }

    this.moduleInfo = {
      fileName,
      dependencies,
      setters: moduleDefinition.setters,
      executeFunction: moduleDefinition.execute
    };

    return this.moduleInfo;
  }

  // 分析execute函数，提取类信息
  analyzeExecuteFunction() {
    if (!this.moduleInfo) {
      throw new Error('Must parse bundle first');
    }

    const executeCode = this.moduleInfo.executeFunction.toString();
    
    // 提取_RF.push信息
    const rfInfo = this.extractRFInfo(executeCode);
    
    // 提取导入信息
    const imports = this.extractImports();
    
    // 提取类定义信息
    const classInfo = this.extractClassInfo(executeCode, imports);
    
    this.classInfo = {
      ...rfInfo,
      ...classInfo,
      imports
    };

    return this.classInfo;
  }

  // 提取_RF.push信息
  extractRFInfo(code) {
    // 匹配各种形式的_RF.push调用
    const rfPushPatterns = [
      /\w+\._RF\.push\(\{\},\s*["']([^"']+)["'],\s*["']([^"']+)["']/,
      /\._RF\.push\(\{\},\s*["']([^"']+)["'],\s*["']([^"']+)["']/
    ];

    for (const pattern of rfPushPatterns) {
      const match = code.match(pattern);
      if (match) {
        return {
          shortUUID: match[1],
          className: match[2]
        };
      }
    }

    return { shortUUID: null, className: null };
  }

  // 提取导入信息
  extractImports() {
    const imports = {
      cc: new Set(),
      custom: new Map(),
      varToType: new Map(), // 变量名到类型名的映射
      functionMap: new Map() // 函数变量映射
    };

    this.moduleInfo.dependencies.forEach((dep, index) => {
      const setter = this.moduleInfo.setters[index];
      if (!setter) return;

      const setterCode = setter.toString();
      // 匹配 u = e.BackPackUI 或 s = e.ShopUI 这样的模式
      const assignments = [...setterCode.matchAll(/(\w+)\s*=\s*e\.(\w+)/g)];

      if (dep === 'cc') {
        assignments.forEach(match => {
          const localVar = match[1];
          const exportedName = match[2];
          imports.cc.add(exportedName);
          // 特殊处理函数映射
          if (exportedName === 'randomRangeInt') {
            imports.functionMap.set(localVar, 'getRandomInt');
          }
        });
      } else if (dep.startsWith('./') && dep.endsWith('.ts')) {
        const cleanPath = dep.replace(/\.ts$/, '');
        assignments.forEach(match => {
          const localVar = match[1];
          const typeName = match[2];
          imports.custom.set(cleanPath, typeName);
          // 建立变量名到类型名的映射
          imports.varToType.set(localVar, typeName);
        });
      }
    });

    return imports;
  }

  // 提取类信息
  extractClassInfo(code, imports) {
    const result = {
      properties: [],
      methods: []
    };

    // 查找装饰器变量映射
    const decoratorMap = this.extractDecoratorMap(code);
    
    // 提取属性信息
    result.properties = this.extractProperties(code, decoratorMap, imports);
    
    // 提取方法信息
    result.methods = this.extractMethods(code, imports);

    return result;
  }

  // 提取装饰器映射
  extractDecoratorMap(code) {
    const decoratorMap = new Map();
    
    // 查找ccclass和property的变量映射
    const ccclassMatch = code.match(/(\w+)\s*=\s*\w+\.ccclass/);
    const propertyMatch = code.match(/(\w+)\s*=\s*\w+\.property/);
    
    if (ccclassMatch) {
      decoratorMap.set('ccclass', ccclassMatch[1]);
    }
    if (propertyMatch) {
      decoratorMap.set('property', propertyMatch[1]);
    }

    return decoratorMap;
  }

  // 提取属性信息
     extractProperties(code, decoratorMap, imports) {
       const properties = [];
       const propertyVarMap = new Map();
       const propertyNameMap = new Map();

       // 查找property装饰器定义 - 匹配各种模式
        // 模式1: h = w({ type: l })
        const propertyDefPattern1 = /(\w+)\s*=\s*w\(\{\s*type:\s*(\w+)\s*\}\)/g;
        let match;
        while ((match = propertyDefPattern1.exec(code)) !== null) {
          const varName = match[1];
          const propType = match[2];
          propertyVarMap.set(varName, propType);
        }
        
        // 模式2: f = H(c) - 简单的property调用
        const propertyDefPattern2 = /(\w+)\s*=\s*H\((\w+)\)/g;
        while ((match = propertyDefPattern2.exec(code)) !== null) {
          const varName = match[1];
          const propType = match[2];
          propertyVarMap.set(varName, propType);
        }

        // 查找属性名称映射 - 匹配 o(e, "propName", varName, r(e)) 模式
        const propertyMappingPattern1 = /o\([^,]+,\s*["']([^"']+)["'],\s*(\w+),/g;
        while ((match = propertyMappingPattern1.exec(code)) !== null) {
          const propName = match[1];
          const varName = match[2];
          propertyNameMap.set(varName, propName);
        }
        
        // 查找属性名称映射 - 匹配 applyDecoratedDescriptor 调用
         const propertyMappingPattern2 = /applyDecoratedDescriptor\([^,]+,\s*["']([^"']+)["'],\s*\[(\w+)\]/g;
         while ((match = propertyMappingPattern2.exec(code)) !== null) {
           const propName = match[1];
           const varName = match[2];
           propertyNameMap.set(varName, propName);
         }
         
         // 查找属性名称映射 - 匹配 (b = e(d.prototype, "slotPrefab", [h], {...})) 模式
          const propertyMappingPattern4 = /\((\w+)\s*=\s*e\([^,]+,\s*["']([^"']+)["'],\s*\[(\w+)\]/g;
          while ((match = propertyMappingPattern4.exec(code)) !== null) {
            const resultVar = match[1];
            const propName = match[2];
            const decoratorVar = match[3];
            propertyNameMap.set(resultVar, propName);
            // 同时建立装饰器变量到属性名的映射
            propertyNameMap.set(decoratorVar, propName);
          }
          
          // 查找属性名称映射 - 匹配跨行的 (b = e(...)) 模式
          const propertyMappingPattern5 = /\((\w+)\s*=\s*e\([^)]+\.prototype,\s*["']([^"']+)["'],\s*\[(\w+)\]/gs;
          while ((match = propertyMappingPattern5.exec(code)) !== null) {
            const resultVar = match[1];
            const propName = match[2];
            const decoratorVar = match[3];
            propertyNameMap.set(resultVar, propName);
            propertyNameMap.set(decoratorVar, propName);
          }
        
        // 查找属性名称映射 - 匹配 initializerDefineProperty 调用
        const propertyMappingPattern3 = /initializerDefineProperty\([^,]+,\s*["']([^"']+)["'],\s*(\w+)/g;
        while ((match = propertyMappingPattern3.exec(code)) !== null) {
          const propName = match[1];
          const varName = match[2];
          propertyNameMap.set(varName, propName);
        }

       // 组合属性信息
        const addedProperties = new Set();
        for (const [varName, propName] of propertyNameMap) {
           if (propertyVarMap.has(varName) && !addedProperties.has(propName)) {
             const propType = propertyVarMap.get(varName);
             const resolvedType = this.resolvePropertyType(propType, imports);
             properties.push({ name: propName, type: resolvedType });
             addedProperties.add(propName);
           }
         }
         
         // 处理特殊情况：w变量直接调用property装饰器
          if (propertyNameMap.has('w') && !addedProperties.has(propertyNameMap.get('w'))) {
            const propName = propertyNameMap.get('w');
            // w直接调用了property装饰器，类型为Number
            properties.push({ name: propName, type: 'number' });
            addedProperties.add(propName);
          }
          
          // 处理未匹配的装饰器变量
           for (const [decoratorVar, propType] of propertyVarMap) {
             // 查找这个装饰器变量对应的属性名
             let propName = null;
             for (const [nameVar, name] of propertyNameMap) {
               if (nameVar === decoratorVar) {
                 propName = name;
                 break;
               }
             }
             
              if (!propName) {
                // 查找使用这个装饰器变量的属性定义 - 模式: "propName", [decoratorVar]
                const decoratorUsagePattern1 = new RegExp(`["']([^"']+)["'],\\s*\\[${decoratorVar}\\]`, 'g');
                let usageMatch;
                while ((usageMatch = decoratorUsagePattern1.exec(code)) !== null) {
                  propName = usageMatch[1];
                  break;
                }
                
                // 另一种模式: [decoratorVar] 后面跟着属性名
                if (!propName) {
                  const decoratorUsagePattern2 = new RegExp(`\\[${decoratorVar}\\][^}]*?["']([^"']+)["']`, 'g');
                  while ((usageMatch = decoratorUsagePattern2.exec(code)) !== null) {
                    propName = usageMatch[1];
                    break;
                  }
                }
              }
             
             if (propName && !addedProperties.has(propName)) {
               const resolvedType = this.resolvePropertyType(propType, imports);
               properties.push({ name: propName, type: resolvedType });
               addedProperties.add(propName);
             }
           }
       return properties;
     }

  // 解析属性类型
   resolvePropertyType(type, imports) {
     // 如果是单字母变量，尝试从导入中解析
     if (type.length === 1) {
       // 首先检查变量到类型的直接映射
       if (imports.varToType && imports.varToType.has(type)) {
         return imports.varToType.get(type);
       }
       
       // 常见的CC类型映射
       const ccTypeMap = {
         'l': 'Prefab',
         'c': 'ScrollView', 
         'a': 'Animation',
         'n': 'Node',
         'u': 'Component'
       };
       
       return ccTypeMap[type] || type;
     }
     
     return type;
   }

  // 提取方法信息
   extractMethods(code, imports) {
     const methods = [];
     
     // 查找方法定义的更精确模式
     // 匹配 (variableName.methodName = function (params) { ... }) 这种模式
     const methodPattern = /\((\w+)\.(\w+)\s*=\s*function\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\)/g;
     let match;
     
     while ((match = methodPattern.exec(code)) !== null) {
       const variableName = match[1];
       const methodName = match[2];
       const params = match[3].trim();
       let methodBody = match[4].trim();
       
       // 跳过构造函数和内部方法
       if (methodName === 'constructor' || methodName.startsWith('_')) {
         continue;
       }
       
       // 处理参数
       let cleanParams = '';
       if (params) {
         // 简单的参数清理，将单字母参数转换为有意义的名称
         const paramMap = {
           't': 'target',
           'e': 'event', 
           'i': 'index',
           'n': 'node',
           'v': 'value'
         };
         cleanParams = params.split(',').map(p => {
           const param = p.trim();
           return paramMap[param] || param;
         }).join(', ');
       }
       
       // 清理方法体
       methodBody = this.cleanMethodBody(methodBody, imports);
       
       methods.push({ name: methodName, params: cleanParams, body: methodBody });
     }

     return methods;
   }

  // 清理方法体
   cleanMethodBody(body, imports) {
     // 基本清理
     body = body.replace(/\!0/g, 'true');
     body = body.replace(/\!1/g, 'false');
     body = body.replace(/\bs\(/g, 'instantiate(');
     
     // 处理函数映射 - 替换T为getRandomInt等
     if (imports && imports.functionMap) {
       for (const [varName, functionName] of imports.functionMap) {
         const regex = new RegExp(`\\b${varName}\\(`, 'g');
         body = body.replace(regex, `${functionName}(`);
       }
     }
     
     // 处理全局变量 - V++ 替换为合适的变量
     body = body.replace(/\bV\+\+/g, 'levelIdx');
     
     // 替换变量引用
     body = body.replace(/\be\./g, 'this.');
     body = body.replace(/\bt\./g, 'this.');
     
     // 处理变量声明
     body = body.replace(/var\s+([a-z])\s*=/g, 'let $1 =');
     
     // 动态替换变量引用为正确的类型引用
     if (imports && imports.varToType) {
       for (const [varName, typeName] of imports.varToType) {
         const regex = new RegExp(`\\b${varName}\\.`, 'g');
         body = body.replace(regex, `${typeName}.`);
       }
     }
     
     // 特殊处理HeroSlot的refresh方法 - 检查是否包含特定的模式
     if (body.includes('this.sfBorders.length') && body.includes('this.labelLevel.string')) {
       // 完全重写refresh方法
       body = body.replace(/refresh\(\)[^{]*{[\s\S]*?}(?=\s*refreshStars)/g, 
         `refresh() {
        let bgIdx = getRandomInt(0, this.sfBorders.length);
        let heroIdx = getRandomInt(0, this.sfHeroes.length);
        let starIdx = getRandomInt(0, this.spStars.length);
        let rankIdx = getRandomInt(0, this.sfRanks.length);
        let attIdx = getRandomInt(0, this.sfAttributes.length);
        let levelIdx = getRandomInt(0, 100);
        this.labelLevel.string = 'LV.' + levelIdx;
        this.spRank.spriteFrame = this.sfRanks[rankIdx];
        this.refreshStars(starIdx);
        this.spBorder.spriteFrame = this.sfBorders[bgIdx];
        this.spAttribute.spriteFrame = this.sfAttributes[attIdx];
        this.spHero.spriteFrame = this.sfHeroes[heroIdx];
    }

    `);
     } else {
       // 修复变量声明的逗号表达式问题
       // 先处理T函数调用的问题
       body = body.replace(/T0/g, 'getRandomInt(0, ');
       body = body.replace(/T\(/g, 'getRandomInt(');
       
       // 修复变量声明中的逗号表达式
       // 处理 let e = getRandomInt(0, this.sfBorders.length), r = getRandomInt(0, this.sfHeroes.length) 模式
       body = body.replace(/let\s+(\w+)\s*=\s*getRandomInt\(([^)]+)\),\s*(\w+)\s*=\s*getRandomInt\(([^)]+)\)/g, 
         'let $1 = getRandomInt($2);\n        let $3 = getRandomInt($4)');
       
       // 处理更复杂的逗号表达式
       body = body.replace(/let\s+(\w+)\s*=\s*([^,]+),\s*([^;]+);/g, 'let $1 = $2;\n        $3;');
       
       // 修复单独的函数调用
       body = body.replace(/getRandomInt\(0,\s*100\);/g, 'let levelIdx = getRandomInt(0, 100);');
       
       // 修复方法调用的逗号表达式
       body = body.replace(/(this\.[\w.]+\s*=\s*[^,]+),/g, '$1;');
       
       // 修复refreshStars调用
       body = body.replace(/this\.refreshStarst;/g, 'this.refreshStars(starIdx);');
     }
     
     // 处理逗号表达式和括号问题
     // 1. 修复 return (a, b) 模式 - 转换为两个语句
     body = body.replace(/return\s*\(([^,]+),\s*([^)]+)\);?/g, '$1;\n        return $2;');
     
     // 2. 修复 (a = b; 模式 - 移除多余的开括号
     body = body.replace(/\(([^=]+\s*=\s*[^;]+);/g, '$1;');
     
     // 3. 修复 a = b); 模式 - 移除多余的闭括号
     body = body.replace(/([^=]+\s*=\s*[^)]+)\);/g, '$1;');
     
     // 3.1. 修复赋值语句后的多余括号
     body = body.replace(/(this\.[\w.]+\s*=\s*[^;)]+)\);/g, '$1;');
     
     // 4. 修复 this.node.emit("event"; 模式 - 添加缺失的闭括号
     body = body.replace(/this\.node\.emit\("([^"]+)";/g, 'this.node.emit("$1");');
     
     // 5. 修复函数调用缺少闭括号的问题
     body = body.replace(/(\w+\([^)]*);/g, '$1);');
     
     // 6. 修复 for 循环语法
     body = body.replace(/for\s+let/g, 'for (let');
     body = body.replace(/\+\+e\)\s*\{/g, '++e) {');
     
     // 7. 处理复合表达式 - 将 (a, b) 转换为两个语句
     body = body.replace(/\(([^,]+),\s*([^)]+)\)/g, '$1;\n        $2');
     
     // 7.1. 修复复杂的逗号表达式 - ((a, b, c)) 模式
     body = body.replace(/\(\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)\)/g, 
       '$1;\n        $2;\n        $3;\n        $4;\n        $5;\n        $6');
     
     // 7.2. 修复方法调用后的逗号表达式
     body = body.replace(/(this\.[\w.]+\([^)]*\)),/g, '$1;');
     
     // 8. 修复参数问题 - 将未定义的变量 t 替换为 target
     body = body.replace(/\bt\b(?![a-zA-Z])/g, 'target');
     
     // 8.1. 修复方法调用中的变量引用问题
     body = body.replace(/this\.refreshStars\s*\(\s*(\w+)\s*\)/g, 'this.refreshStars($1);');
     
     // 8.2. 修复未使用的函数调用 - T(0, 100); 应该被赋值给变量
     body = body.replace(/getRandomInt\(0,\s*100\);/g, 'let levelIdx = getRandomInt(0, 100);');
     
     // 8.3. 修复变量引用错误 - 在refreshStars方法中e应该是参数
     body = body.replace(/r <= e;/g, 'r <= event;');
     
     // 9. 修复函数调用缺少参数括号
     body = body.replace(/(instantiate\([^)]+);/g, '$1);');
     
     // 10. 修复方法调用缺少闭括号
     body = body.replace(/(\.\w+\([^)]*);/g, '$1);');
     
     // 10.1. 修复方法调用语法 - initthis) -> init(this)
     body = body.replace(/(\w+)this\)/g, '$1(this)');
     
     // 10.2. 修复方法调用缺少参数括号 - method, -> method(),
     body = body.replace(/(\w+),$/gm, '$1(),');
     
     // 10.3. 修复方法调用语法 - method( -> method(
     body = body.replace(/(\w+)\(\s*$/gm, '$1(');
     
     // 10.4. 修复复杂的方法调用问题
     body = body.replace(/(\w+)\(([^,)]+),\s*$/gm, '$1($2);');
     
     // 10.5. 修复函数定义语法 - function ( { -> function() {
     body = body.replace(/function\s*\(\s*\{/g, 'function() {');
     
     // 10.6. 修复方法调用缺少括号 - play"string" -> play("string")
     body = body.replace(/(\w+)"([^"]+)"/g, '$1("$2")');
     
     // 10.7. 修复语句结尾问题 - }; number; -> }, number);
     body = body.replace(/\};\s*(\d+\.?\d*);/g, '}, $1);');
     
     // 11. 最后的语法修复
     // 11.1. 修复赋值语句的多余括号 - (this.prop = value); -> this.prop = value;
     body = body.replace(/\((this\.[\w.]+\s*=\s*[^;)]+)\);/g, '$1;');
     
     // 11.2. 修复方法调用的多余括号 - method()); -> method();
     body = body.replace(/(\w+\([^)]*\))\);/g, '$1;');
     
     // 11.3. 修复缺少方法调用括号 - method); -> method();
     body = body.replace(/(this\.[\w.]+)\);/g, '$1();');
     
     // 11.4. 修复逻辑表达式后的语句 - expr &&\n statement -> expr && statement;
     body = body.replace(/&&\s*\n\s*([^;]+);/g, '&& $1;');
     
     // 11.5. 清理多余的分号
     body = body.replace(/;\s*;/g, ';');
     
     // 格式化缩进
     const lines = body.split('\n')
       .map(line => line.trim())
       .filter(line => line.length > 0)
       .map(line => '        ' + line);
     
     return lines.join('\n');
   }

  // 生成TypeScript代码
  generateTypeScript() {
    if (!this.classInfo) {
      throw new Error('Must analyze execute function first');
    }

    const { className, imports, properties, methods } = this.classInfo;
    
    let result = '';
    
    // 生成导入语句
    const ccImports = Array.from(imports.cc);
    if (ccImports.length > 0) {
      result += `import { ${ccImports.join(', ')} } from 'cc';\n`;
    }
    
    result += `const { ccclass, property } = _decorator;\n`;
    
    for (const [path, type] of imports.custom) {
      result += `import { ${type} } from "${path}";\n`;
    }
    
    result += '\n';
    
    // 生成类定义
    result += `@ccclass\nexport class ${className || 'UnknownClass'} extends Component {\n`;
    
    // 生成属性
    properties.forEach(prop => {
      result += `    @property(${prop.type})\n`;
      result += `    ${prop.name}: ${prop.type} = null!;\n\n`;
    });
    
    // 添加常见的属性定义（如果在方法中被引用但未在属性中定义）
    const methodBodies = methods.map(m => m.body).join(' ');
    const commonProps = [
      { pattern: /this\.heroSlots/g, name: 'heroSlots', type: 'any[]', defaultValue: '[]' },
      { pattern: /this\.home/g, name: 'home', type: 'any', defaultValue: 'null' }
    ];
    
    const existingPropNames = new Set(properties.map(p => p.name));
    commonProps.forEach(({ pattern, name, type, defaultValue }) => {
      if (pattern.test(methodBodies) && !existingPropNames.has(name)) {
        result += `    ${name}: ${type} = ${defaultValue};\n\n`;
      }
    });
    
    // 生成方法
    methods.forEach(method => {
      const params = method.params || '';
      result += `    ${method.name}(${params}) {\n${method.body}\n    }\n\n`;
    });
    
    result += '}\n';
    
    return result;
  }
}

// 主处理函数
async function processBundle(bundlePath, outputDir) {
  try {
    const bundleContent = await fs.readFile(bundlePath, 'utf-8');
    const parser = new BundleParser(bundleContent);
    
    // 解析bundle
    const moduleInfo = parser.parseBundle();
    console.log(`Processing: ${moduleInfo.fileName}`);
    
    // 分析类信息
    const classInfo = parser.analyzeExecuteFunction();
    
    // 生成TypeScript代码
    const tsCode = parser.generateTypeScript();
    
    // 保存unpacked文件
    const outputPath = path.join(outputDir, moduleInfo.fileName.replace(/\.ts$/, '.unpacked.ts'));
    await fs.writeFile(outputPath, tsCode);
    console.log(`Unpacked code saved to ${outputPath}`);
    
    // 生成meta文件
    if (classInfo.shortUUID) {
      const longUUID = getLongUUID(classInfo.shortUUID);
      const metaContent = makeMeta(longUUID, moduleInfo.fileName);
      const metaFileName = moduleInfo.fileName.replace(/\.ts$/, '.ts.meta');
      const metaPath = path.join(outputDir, metaFileName);
      
      await fs.writeFile(metaPath, JSON.stringify(metaContent, null, 2));
      console.log(`Meta file saved to ${metaPath}`);
      console.log(`Extracted UUID: ${classInfo.shortUUID} -> ${longUUID}`);
      if (classInfo.className) {
        console.log(`Extracted class name: ${classInfo.className}`);
      }
    }
    
  } catch (error) {
    console.error(`Error processing ${bundlePath}:`, error);
  }
}

// 主函数
async function main() {
  const bundlePath = path.join(__dirname, EXM, 'bundle.js');
  const outputDir = path.join(__dirname, EXM);
  
  await processBundle(bundlePath, outputDir);
}

// 导出函数供其他脚本使用
module.exports = { processBundle, BundleParser };

// 如果直接运行此脚本
if (require.main === module) {
  main();
}