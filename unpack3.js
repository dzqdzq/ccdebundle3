const fs = require('fs');

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
      if (cleanInitValue === 'null') {
        cleanInitValue = 'null';
      } else if (cleanInitValue.match(/^\d+$/)) {
        cleanInitValue = parseInt(cleanInitValue);
      }
      
      // 判断type - 如果装饰器数组包含Node相关的引用，则type为Node
      let type = '';
      if (decoratorArray.includes('u') || decoratorArray.includes('Node')) {
        type = 'Node';
      }
      
      const propInfo = {
        init: cleanInitValue,
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
      if (cleanInitValue === 'null') {
        cleanInitValue = 'null';
      } else if (cleanInitValue.match(/^\d+$/)) {
        cleanInitValue = parseInt(cleanInitValue);
      }
      
      // 判断type - 如果装饰器数组包含相关的引用
      let type = '';
      if (decoratorArray.includes('c') || decoratorArray.includes('Node')) {
        type = 'Node';
      }
      
      const propInfo = {
        init: cleanInitValue,
        isdecorated: true,
        isStatic: false,
        type: type
      };
      
      // 将属性添加到所有导出的类中
      for (const className of exportedClasses) {
        analysis.classes[className].props[propName] = propInfo;
      }
    }
     
    // 为每个导出的类设置classCode
    for (const className of exportedClasses) {
      if (classCodeMatch) {
        analysis.classes[className].classCode = classCodeMatch[0];
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