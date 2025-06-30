const fs = require('fs');

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

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function analyzeClassCode(classCode, classInfo) {
    console.log('Analyzing class code...');
    // 提取构造函数名和原型变量名
    const protoMatch = classCode.match(/var\s+(\w+)\s*=\s*(\w+)\.prototype/);
    if (!protoMatch) {
        console.log('Could not find prototype match.');
        return;
    }

    const protoVar = protoMatch[1]; // e.g., e
    const constructorName = protoMatch[2]; // e.g., t
    console.log(`constructorName: ${constructorName}, protoVar: ${protoVar}`);

    // 提取方法
    const methodPattern = new RegExp(`(?:${escapeRegExp(constructorName)}|${escapeRegExp(protoVar)})\\.(\\w+)\\s*=\\s*(function\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\})`, 'g');
    let match;
    while ((match = methodPattern.exec(classCode)) !== null) {
        const methodName = match[1];
        const methodCode = match[2];
        const isStatic = match[0].startsWith(constructorName + '.');

        classInfo.methods[methodName] = {
            code: methodCode,
            isStatic: isStatic
        };
    }

    // 查找所有function关键字
    const functionMatches = [...classCode.matchAll(/function/g)];
    
    if (functionMatches.length >= 2) {
        const secondFunctionIndex = functionMatches[1].index;
        
        // 从第二个function开始，提取构造函数体
        // 构造函数通常是 function t() { ... } 的形式
        const constructorPattern = new RegExp(`function\\s+${escapeRegExp(constructorName)}\\s*\\([^)]*\\)\\s*\\{([^}]*(?:\\{[^}]*\\}[^}]*)*)\\}`);
        const constructorMatch = classCode.match(constructorPattern);
        console.log('Constructor match:', constructorMatch);

        if (constructorMatch) {
            const constructorBody = constructorMatch[1];
            
            // 解析构造函数体中的赋值语句
            parseAssignments(constructorBody, classInfo);

            // 清理构造函数体
            let cleanedConstructorBody = constructorBody.replace(/initializerDefineProperty\([^)]+\),?/g, '');
            cleanedConstructorBody = cleanedConstructorBody.replace(/this\.(\w+)\s*=\s*[^;\n]+[;\n]?/g, '');
            cleanedConstructorBody = cleanedConstructorBody.trim();

            if (cleanedConstructorBody) {
                classInfo.constructor = cleanedConstructorBody;
                console.log('Cleaned constructor body:', cleanedConstructorBody);
            }
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
    classes: {}
  };

  try {
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
          methods: {},
          constructor: '',
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
    console.log('用法: node analyzeCode.js <filename>');
    return;
  }
  
  const filename = args[0];
  
  try {
    const decompressedCode = fs.readFileSync(filename, 'utf8');
    // console.log(decompressedCode);
    console.log('开始分析代码结构...');
    const analysis = analyzeCode(decompressedCode);

    console.log('提取到的classes:', JSON.stringify(analysis.classes, null, 2));
     
  } catch (error) {
    console.error('读取文件时出错:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeCode };