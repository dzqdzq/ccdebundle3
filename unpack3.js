const fs = require('fs');

function analyzeClassCode(classCode, classInfo) {
    console.log(`\n=== 分析类代码: ${classInfo.classType} ===`);
    
    // 查找所有function关键字
    const functionMatches = [...classCode.matchAll(/function/g)];
    console.log(`找到 ${functionMatches.length} 个function关键字`);
    
    if (functionMatches.length >= 2) {
        const secondFunctionIndex = functionMatches[1].index;
        console.log(`第二个function关键字位置: ${secondFunctionIndex}`);
        
        // 从第二个function开始，提取构造函数体
        // 构造函数通常是 function t() { ... } 的形式
        const constructorPattern = /function\s+\w+\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/;
        const constructorMatch = classCode.slice(secondFunctionIndex).match(constructorPattern);
        
        if (constructorMatch) {
            const constructorBody = constructorMatch[1].trim();
            console.log(`构造函数体内容: ${constructorBody}`);
            
            // 解析构造函数体中的赋值语句
            parseAssignments(constructorBody, classInfo);
        } else {
            console.log('未找到构造函数体');
        }
    } else {
        console.log('未找到足够的function关键字');
    }
}

function parseAssignments(constructorBody, classInfo) {
    console.log('\n=== 解析赋值语句 ===');
    
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
        
        console.log(`发现赋值: this.${propertyName} = ${valueStr} (存储为: ${initValue})`);
    }
}



function analyzeCode(code) {
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
    // 模式1: applyDecoratedDescriptor格式
    const decoratorPattern1 = /(\w+)\s*=\s*(\w+)\s*\(\s*(\w+)?\.prototype,\s*["']([^"']+)["'],\s*\[([^\]]+)\],\s*\{[^}]*initializer\s*:\s*function\s*\(\)\s*\{[^}]*return\s*([^;}]+)[^}]*\}[^}]*\}/g;
    
    // 模式2: 直接在prototype上定义的格式
    const decoratorPattern2 = /\.prototype,\s*["']([^"']+)["'],\s*\[([^\]]+)\],\s*\{[^}]*initializer\s*:\s*function\s*\(\)\s*\{[^}]*return\s*([^;}]+)[^}]*\}/g;
    
    // 处理模式1: applyDecoratedDescriptor格式
    let decoratorMatch1;
    while ((decoratorMatch1 = decoratorPattern1.exec(simplifiedCode)) !== null) {
      const [, varName, funcName, target, propName, decoratorArray, initValue] = decoratorMatch1;
      
      let cleanInitValue = initValue.trim();

      // 判断type - 如果装饰器数组包含Node相关的引用，则type为Node
      let type = '';
      if (decoratorArray.includes('u') || decoratorArray.includes('Node')) {
        type = 'Node';
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
      
      // 判断type - 如果装饰器数组包含相关的引用
      let type = '';
      if (decoratorArray.includes('c') || decoratorArray.includes('Node')) {
        type = 'Node';
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
        console.log(`\n=== 分析类 ${className} ===`);
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
    
    console.log('开始分析代码结构...');
    const analysis = analyzeCode(code);
    
    console.log('提取到的UUID:', analysis.uuid);
    console.log('提取到的classes:', JSON.stringify(analysis.classes, null, 2));
     
  } catch (error) {
    console.error('读取文件时出错:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeCode };