const fs = require('fs');
const jscodeshift = require('jscodeshift');

function decompressCode(code) {
  // 解析所有的解构赋值导入语句
  const importMappings = new Map();
  
  // 找到所有的 require 语句
  const requirePattern = /var\s*\{([^}]+)\}\s*=\s*require\([^)]+\);/g;
  let match;
  
  while ((match = requirePattern.exec(code)) !== null) {
    const destructureContent = match[1];
    const fullMatch = match[0];
    
    // 解析解构内容
    const assignments = parseDestructureAssignments(destructureContent);
    
    // 记录映射关系
    for (const [compressedName, originalName] of assignments) {
      importMappings.set(compressedName, originalName);
    }
  }
  
  // 使用 jscodeshift 进行 AST 级别的变量替换
  let decompressedCode = code;
  
  try {
    const ast = jscodeshift(code);
    
    // 首先处理解构赋值：移除重命名，直接使用原始名称
    ast.find(jscodeshift.VariableDeclarator).forEach(path => {
      if (path.value.id && path.value.id.type === 'ObjectPattern') {
        path.value.id.properties.forEach(prop => {
          if (prop.type === 'Property' && prop.key && prop.value && 
              prop.key.type === 'Identifier' && prop.value.type === 'Identifier') {
            // 检查是否是重命名的解构赋值（originalName: compressedName）
            // 在demo2.js中格式是 applyDecoratedDescriptor: e，所以key是原始名，value是压缩名
            if (importMappings.has(prop.value.name) && prop.key.name !== prop.value.name) {
              // 将 originalName: compressedName 改为 shorthand 形式
              prop.value.name = prop.key.name;
              prop.shorthand = true;
            }
          }
        });
      }
    });

    // 收集所有局部变量声明
    const localVariables = new Set();
    
    // 收集所有变量声明
    ast.find(jscodeshift.VariableDeclarator).forEach(path => {
      if (path.value.id && path.value.id.type === 'Identifier') {
        localVariables.add(path.value.id.name);
      }
    });
    
    // 收集函数参数
    ast.find(jscodeshift.Function).forEach(path => {
      if (path.value.params) {
        path.value.params.forEach(param => {
          if (param.type === 'Identifier') {
            localVariables.add(param.name);
          }
        });
      }
    });

    // 然后遍历所有标识符并替换
    ast.find(jscodeshift.Identifier).forEach(path => {
      const name = path.value.name;
      if (importMappings.has(name) && !localVariables.has(name)) {
        // 检查是否在对象属性键位置，如果是则不替换
        const parent = path.parent;
        if (parent.value.type === 'Property' && parent.value.key === path.value) {
          return; // 跳过对象属性键
        }
        if (parent.value.type === 'MemberExpression' && parent.value.property === path.value && !parent.value.computed) {
          return; // 跳过成员表达式的属性部分
        }
        
        // 检查是否是变量声明，如果是则不替换（避免替换局部变量）
        if (parent.value.type === 'VariableDeclarator' && parent.value.id === path.value) {
          return; // 跳过变量声明中的标识符
        }
        
        // 检查是否是函数参数，如果是则不替换
        if (parent.value.type === 'FunctionDeclaration' || parent.value.type === 'FunctionExpression') {
          return; // 跳过函数声明中的标识符
        }
        
        path.value.name = importMappings.get(name);
      }
    });
    
    // 优化属性访问模式：将 obj.prop1; var x = obj.prop2; 转换为 var {prop1, prop2} = obj;
    optimizePropertyAccess(ast);
    
    decompressedCode = ast.toSource();
    
  } catch (error) {
    console.warn('AST 解析失败，回退到原始代码:', error.message);
    decompressedCode = code;
  }
  
  return decompressedCode;
}

function optimizePropertyAccess(ast) {
  // 收集所有的属性访问模式
  const propertyAccessMap = new Map(); // object -> Set of properties
  const variableAssignments = new Map(); // variable -> {object, property}
  const expressionStatements = []; // 存储需要删除的表达式语句
  
  // 第一遍：收集特定对象的属性访问表达式
  ast.find(jscodeshift.ExpressionStatement).forEach(path => {
    const expr = path.value.expression;
    if (expr.type === 'MemberExpression' && !expr.computed) {
      const objectName = expr.object.name;
      const propertyName = expr.property.name;
      
      // 只处理特定对象的属性访问（如 _decorator, cc 等框架对象）
      const targetObjects = ['_decorator', 'cc', 'cclegacy'];
      if (objectName && propertyName && targetObjects.includes(objectName)) {
        if (!propertyAccessMap.has(objectName)) {
          propertyAccessMap.set(objectName, new Set());
        }
        propertyAccessMap.get(objectName).add(propertyName);
        expressionStatements.push(path);
      }
    }
  });
  
  // 收集变量赋值：var x = obj.prop（只处理特定对象如 _decorator）
  ast.find(jscodeshift.VariableDeclarator).forEach(path => {
    const init = path.value.init;
    if (init && init.type === 'MemberExpression' && !init.computed) {
      const objectName = init.object.name;
      const propertyName = init.property.name;
      const variableName = path.value.id.name;
      
      // 只处理特定对象的属性访问（如 _decorator, cc 等框架对象）
      const targetObjects = ['_decorator', 'cc', 'cclegacy'];
      if (objectName && propertyName && variableName && targetObjects.includes(objectName)) {
        if (!propertyAccessMap.has(objectName)) {
          propertyAccessMap.set(objectName, new Set());
        }
        propertyAccessMap.get(objectName).add(propertyName);
        variableAssignments.set(variableName, {object: objectName, property: propertyName});
      }
    }
  });
  
  // 为每个对象创建解构赋值
  for (const [objectName, properties] of propertyAccessMap) {
    if (properties.size > 0) {
      // 创建解构赋值声明
      const destructureProperties = Array.from(properties).map(prop => {
        return jscodeshift.property.from({
          kind: 'init',
          key: jscodeshift.identifier(prop),
          value: jscodeshift.identifier(prop),
          shorthand: true
        });
      });
      
      const destructureDeclaration = jscodeshift.variableDeclaration('var', [
        jscodeshift.variableDeclarator(
          jscodeshift.objectPattern(destructureProperties),
          jscodeshift.identifier(objectName)
        )
      ]);
      
      // 找到第一个相关的语句位置来插入解构赋值
      let insertPosition = null;
      
      // 查找第一个属性访问语句
      ast.find(jscodeshift.ExpressionStatement).forEach(path => {
        const expr = path.value.expression;
        if (expr.type === 'MemberExpression' && expr.object.name === objectName) {
          if (!insertPosition) {
            insertPosition = path;
          }
        }
      });
      
      // 查找第一个变量赋值语句
      ast.find(jscodeshift.VariableDeclaration).forEach(path => {
        path.value.declarations.forEach(decl => {
          if (decl.init && decl.init.type === 'MemberExpression' && 
              decl.init.object.name === objectName) {
            if (!insertPosition) {
              insertPosition = path;
            }
          }
        });
      });
      
      if (insertPosition) {
        // 在找到的位置前插入解构赋值
        insertPosition.insertBefore(destructureDeclaration);
      }
    }
  }
  
  // 删除原始的表达式语句（obj.prop;）
  expressionStatements.forEach(path => {
    path.prune();
  });
  
  // 删除原始的变量赋值并替换所有使用
  for (const [variableName, {object, property}] of variableAssignments) {
    // 替换所有对这个变量的引用为属性名
    ast.find(jscodeshift.Identifier).forEach(path => {
      if (path.value.name === variableName) {
        // 确保不是在变量声明中
        const parent = path.parent;
        if (!(parent.value.type === 'VariableDeclarator' && parent.value.id === path.value)) {
          path.value.name = property;
        }
      }
    });
    
    // 删除原始的变量声明
    ast.find(jscodeshift.VariableDeclarator).forEach(path => {
      if (path.value.id.name === variableName && 
          path.value.init && path.value.init.type === 'MemberExpression') {
        const parentDeclaration = path.parent;
        if (parentDeclaration.value.declarations.length === 1) {
          // 如果这是声明中唯一的变量，删除整个声明
          parentDeclaration.prune();
        } else {
          // 否则只删除这个声明器
          path.prune();
        }
      }
    });
  }
}

function parseDestructureAssignments(destructureContent) {
  const assignments = new Map();
  
  // 分割并解析每个赋值
  const items = destructureContent.split(',');
  
  for (const item of items) {
    const trimmed = item.trim();
    
    // 匹配 originalName: compressedName 格式
    const colonMatch = trimmed.match(/^(\w+):\s*(\w+)$/);
    if (colonMatch) {
      const originalName = colonMatch[1];
      const compressedName = colonMatch[2];
      assignments.set(compressedName, originalName); // 修正：压缩名 -> 原始名
    }
    // 匹配简单的 name 格式（没有重命名）
    else {
      const simpleMatch = trimmed.match(/^(\w+)$/);
      if (simpleMatch) {
        const name = simpleMatch[1];
        assignments.set(name, name);
      }
    }
  }
  
  return assignments;
}

function replaceVariableInScope(code, oldVar, newVar) {
  // 使用词边界来确保只替换完整的变量名
  // 避免替换字符串字面量和注释中的内容
  
  let result = code;
  
  // 创建正则表达式，匹配词边界
  const regex = new RegExp(`\\b${escapeRegExp(oldVar)}\\b`, 'g');
  
  // 简单的上下文检查：避免在字符串字面量中替换
  const lines = code.split('\n');
  const processedLines = [];
  
  for (const line of lines) {
    let processedLine = line;
    
    // 检查是否在字符串字面量中
    if (!isInStringLiteral(line, oldVar)) {
      processedLine = line.replace(regex, newVar);
    }
    
    processedLines.push(processedLine);
  }
  
  return processedLines.join('\n');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isInStringLiteral(line, variable) {
  // 简单检查：如果变量出现在引号内，则认为是字符串字面量
  const singleQuoteRegex = /'[^']*'/g;
  const doubleQuoteRegex = /"[^"]*"/g;
  
  let match;
  
  // 检查单引号字符串
  while ((match = singleQuoteRegex.exec(line)) !== null) {
    if (match[0].includes(variable)) {
      return true;
    }
  }
  
  // 检查双引号字符串
  while ((match = doubleQuoteRegex.exec(line)) !== null) {
    if (match[0].includes(variable)) {
      return true;
    }
  }
  
  return false;
}

function buildVariableMap(code) {
  const variableMap = new Map();
  
  // 解析导入语句
  const importPattern = /var\s*\{([^}]+)\}\s*=\s*require\([^)]+\);/g;
  let match;
  
  while ((match = importPattern.exec(code)) !== null) {
    const destructureContent = match[1];
    
    // 解析解构内容
    const items = destructureContent.split(',');
    for (const item of items) {
      const trimmed = item.trim();
      
      // 匹配 originalName: compressedName 格式
      const colonMatch = trimmed.match(/^(\w+):\s*(\w+)$/);
      if (colonMatch) {
        const originalName = colonMatch[1];
        const compressedName = colonMatch[2];
        variableMap.set(compressedName, originalName);
      }
      // 匹配简单的 name 格式（没有重命名）
      else {
        const simpleMatch = trimmed.match(/^(\w+)$/);
        if (simpleMatch) {
          const name = simpleMatch[1];
          variableMap.set(name, name);
        }
      }
    }
  }
  
  // 解析变量赋值 - 支持多种模式
  
  // 模式1: var = func(arg) - 处理 u = property(Node)
  const assignmentPattern1 = /(\w+)\s*=\s*(\w+)\s*\(\s*(\w+)\s*\)/g;
  while ((match = assignmentPattern1.exec(code)) !== null) {
    const [, varName, funcName, argName] = match;
    
    // 如果funcName在映射中，则建立引用链
    if (variableMap.has(funcName) && variableMap.has(argName)) {
      const resolvedFunc = variableMap.get(funcName);
      const resolvedArg = variableMap.get(argName);
      
      // 如果是property(Node)这样的调用，则varName指向Node
      if (resolvedFunc === 'property') {
        variableMap.set(varName, resolvedArg);
      }
    }
  }
  
  // 模式2: var = func(literal) - 处理 u = property(Node) 其中Node是字面量
  const assignmentPattern2 = /(\w+)\s*=\s*(\w+)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g;
  while ((match = assignmentPattern2.exec(code)) !== null) {
    const [, varName, funcName, argName] = match;
    
    // 如果funcName在映射中
    if (variableMap.has(funcName)) {
      const resolvedFunc = variableMap.get(funcName);
      
      // 如果是property(Node)这样的调用，则varName指向Node（字面量）
      if (resolvedFunc === 'property') {
        variableMap.set(varName, argName);
      }
    }
  }
  
  // 模式3: var = resolvedFunc(arg) - 处理已解析的函数调用
  const assignmentPattern3 = /(\w+)\s*=\s*property\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g;
  while ((match = assignmentPattern3.exec(code)) !== null) {
    const [, varName, argName] = match;
    variableMap.set(varName, argName);
  }
  
  return variableMap;
}

function resolveVariableType(variable, variableMap) {
  // 递归解析变量引用
  let current = variable;
  const visited = new Set();
  
  while (variableMap.has(current) && !visited.has(current)) {
    visited.add(current);
    current = variableMap.get(current);
  }
  
  return current;
}

function analyzeClassCode(classCode, classInfo) {
    // 查找所有function关键字
    const functionMatches = [...classCode.matchAll(/function/g)];
    
    if (functionMatches.length >= 2) {
        const secondFunctionIndex = functionMatches[1].index;
        
        // 从第二个function开始，提取构造函数体
        // 构造函数通常是 function t() { ... } 的形式
        const constructorPattern = /function\s+\w+\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/;
        const constructorMatch = classCode.slice(secondFunctionIndex).match(constructorPattern);
        
        if (constructorMatch) {
            const constructorBody = constructorMatch[1].trim();
            
            // 解析构造函数体中的赋值语句
            parseAssignments(constructorBody, classInfo);
        }
    }
}

function parseAssignments(constructorBody, classInfo) {
    // 匹配 this.propertyName = value 的模式
    const assignmentPattern = /this\.(\w+)\s*=\s*([^,;]+)/g;
    
    let match;
    while ((match = assignmentPattern.exec(constructorBody)) !== null) {
        const propertyName = match[1];
        const valueStr = match[2].trim();
        
        // init字段的格式是："${提取的内容}"
        const initValue = `${valueStr}`;
        
        // 存储到classInfo.props中
        classInfo.props[propertyName] = {
            "init": initValue,
            "isdecorated": false,
            "isStatic": false,
            "type": ""
        };
    }
}



function analyzeCode(code) {
  // 构建变量映射表
  const variableMap = buildVariableMap(code);
  
  const analysis = {
    uuid: '',
    classes: {}
  };

  try {
    // 提取UUID
    const uuidMatch = code.match(/_RF\.push\(\w+,\s*["']([^"']+)["']/);
    if (uuidMatch) {
      analysis.uuid = uuidMatch[1];
    } else {
      // 尝试其他UUID模式
      const altUuidMatch = code.match(/["']([a-zA-Z0-9+/]{20,})["']/);
      if (altUuidMatch) {
        analysis.uuid = altUuidMatch[1];
      }
    }

    // 从module.exports语句中提取类导出（排除简单的数值/字符串赋值）
    const moduleExportsPattern = /module\.exports\["([^"]+)"\]\s*=\s*([^;]+);/g;
    let exportMatch;
    const exportedClasses = [];
    
    while ((exportMatch = moduleExportsPattern.exec(code)) !== null) {
      const exportedName = exportMatch[1];
      const exportedValue = exportMatch[2].trim();
      
      // 只有当导出的是复杂表达式（如函数调用、装饰器等）时才认为是类
      // 排除简单的数字、字符串等
      if (!exportedValue.match(/^\d+$/) && !exportedValue.match(/^["'][^"']*["']$/)) {
        exportedClasses.push(exportedName);
        
        // 初始化类结构
        analysis.classes[exportedName] = {
          classCode: '',
          props: {},
          isccclass: false,
          classType: ''
        };
      }
    }
    
    // 识别ccclass装饰器定义
    // 匹配形如: d = o.ccclass
    const ccclassDefMatch = code.match(/(\w+)\s*=\s*(\w+)\.ccclass/);
    let ccclassFunc = null;
    if (ccclassDefMatch) {
      ccclassFunc = ccclassDefMatch[1]; // 例如: d
    }
    
    // 为每个导出的类检查是否有ccclass装饰器
    for (const className of exportedClasses) {
      if (ccclassFunc) {
        // 匹配形如: u = d("SceneManager") 或 u = d()
        const classDecoratorPattern1 = new RegExp(`(\\w+)\\s*=\\s*${ccclassFunc}\\s*\\(\\s*["']([^"']+)["']\\s*\\)`);
        const classDecoratorPattern2 = new RegExp(`(\\w+)\\s*=\\s*${ccclassFunc}\\s*\\(\\s*\\)`);
        const classDecoratorPattern3 = new RegExp(`(\\w+)\\s*=\\s*${ccclassFunc}`);
        
        const match1 = code.match(classDecoratorPattern1);
        const match2 = code.match(classDecoratorPattern2);
        const match3 = code.match(classDecoratorPattern3);
        
        if (match1) {
          analysis.classes[className].isccclass = true;
          analysis.classes[className].classType = match1[2];
        } else if (match2) {
          analysis.classes[className].isccclass = true;
          analysis.classes[className].classType = '';
        } else if (match3) {
          analysis.classes[className].isccclass = true;
          analysis.classes[className].classType = '';
        }
      }
    }

    // 第一步：提取classCode并用空字符串替换
    // 匹配多种类定义格式
    const classCodePattern1 = /\(([^)]+\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]*?\})\(\)\)/;
    const classCodePattern2 = /(h\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]*?\}\([^)]*\))/;
    const classCodePattern3 = /(function\s*\([^)]*\)\s*\{[\s\S]*?return\s+[^;]+;[\s\S]*?\})/;
    
    let classCodeMatch = code.match(classCodePattern1) || code.match(classCodePattern2) || code.match(classCodePattern3);
    let simplifiedCode = code;
    if (classCodeMatch) {
      simplifiedCode = code.replace(classCodeMatch[0], '');
    }

    // 第三步：匹配装饰器属性的多种模式
    console.log('\n=== 简化后的代码片段 ===');
    console.log(simplifiedCode.substring(0, 500));
    
    // 模式1: applyDecoratedDescriptor格式
    const decoratorPattern1 = /(\w+)\s*=\s*(\w+)\s*\(\s*(\w+)?\.prototype,\s*["']([^"']+)["'],\s*\[([^\]]+)\],\s*\{[^}]*initializer\s*:\s*function\s*\(\)\s*\{[^}]*return\s*([^;}]+)[^}]*\}[^}]*\}/g;
    
    // 模式2: 直接在prototype上定义的格式
    const decoratorPattern2 = /\.prototype,\s*["']([^"']+)["'],\s*\[([^\]]+)\],\s*\{[^}]*initializer\s*:\s*function\s*\(\)\s*\{[^}]*return\s*([^;}]+)[^}]*\}/g;
    
    // 处理模式1: applyDecoratedDescriptor格式
    let decoratorMatch1;
    while ((decoratorMatch1 = decoratorPattern1.exec(simplifiedCode)) !== null) {
      const [, varName, funcName, target, propName, decoratorArray, initValue] = decoratorMatch1;
      
      let cleanInitValue = initValue.trim();

      // 判断type - 使用动态类型推断
      let type = '';
      const decorators = decoratorArray.split(',').map(d => d.trim());
      for (const decorator of decorators) {
        const resolvedType = resolveVariableType(decorator, variableMap);
        // 检查是否是已知的类型（以大写字母开头的标识符通常是类型）
        if (resolvedType && /^[A-Z][A-Za-z0-9_]*$/.test(resolvedType)) {
          type = resolvedType;
          break;
        }
      }
      
      const propInfo = {
        init: `${cleanInitValue}`,
        isdecorated: true,
        isStatic: false,
        type: type
      };
      
      // 将属性添加到所有导出的类中
      for (const className of exportedClasses) {
        analysis.classes[className].props[propName] = propInfo;
      }
    }
    
    // 处理模式2: 直接在prototype上定义的格式
    let decoratorMatch2;
    while ((decoratorMatch2 = decoratorPattern2.exec(simplifiedCode)) !== null) {
      const [, propName, decoratorArray, initValue] = decoratorMatch2;
      
      let cleanInitValue = initValue.trim();
      
      // 判断type - 使用动态类型推断
      let type = '';
      const decorators = decoratorArray.split(',').map(d => d.trim());
      for (const decorator of decorators) {
        const resolvedType = resolveVariableType(decorator, variableMap);
        // 检查是否是已知的类型（以大写字母开头的标识符通常是类型）
        if (resolvedType && /^[A-Z][A-Za-z0-9_]*$/.test(resolvedType)) {
          type = resolvedType;
          break;
        }
      }
      
      const propInfo = {
        init: `${cleanInitValue}`,
        isdecorated: true,
        isStatic: false,
        type: type
      };
      
      // 将属性添加到所有导出的类中
      for (const className of exportedClasses) {
        analysis.classes[className].props[propName] = propInfo;
      }
    }
     
    // 为每个导出的类设置classCode并进行详细分析
    for (const className of exportedClasses) {
      if (classCodeMatch) {
        analysis.classes[className].classCode = classCodeMatch[0];
        
        // 调用analyzeClassCode方法进行详细分析
    
        analyzeClassCode(analysis.classes[className].classCode, analysis.classes[className]);
      }
    }

  } catch (error) {
    console.error('解析代码时出错:', error.message);
  }

  return analysis;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node unpack3.js <filename>');
    return;
  }
  
  const filename = args[0];
  
  try {
    const code = fs.readFileSync(filename, 'utf8');
    const decompressedCode = decompressCode(code);
    // console.log(decompressedCode);
    console.log('开始分析代码结构...');
    const analysis = analyzeCode(decompressedCode);

    console.log('提取到的UUID:', analysis.uuid);
    console.log('提取到的classes:', JSON.stringify(analysis.classes, null, 2));
     
  } catch (error) {
    console.error('读取文件时出错:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeCode, decompressCode };