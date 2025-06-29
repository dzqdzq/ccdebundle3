const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');

const { runDefaultTransformationRules } = require('@wakaru/unminify');
const { getLongUUID } = require('./uuid-utils');
const { makeMeta } = require('./makeMeta');

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


}

// 主处理函数
async function processBundle(bundlePath, outputDir) {
  try {
    const bundleContent = await fs.readFile(bundlePath, 'utf-8');
    const parser = new BundleParser(bundleContent);
    
    // 解析bundle
    const moduleInfo = parser.parseBundle();
    console.log(`Processing: ${moduleInfo.fileName}`);
    
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


// 导出函数供其他脚本使用
module.exports = { processBundle, BundleParser };