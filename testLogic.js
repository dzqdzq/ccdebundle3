const { decompileTs } = require('./ts-decompiler');
const fs = require('fs');
const path = require('path');

// 测试用例
const testCases = [
  {
    name: 'basic-test',
    input: `
import { applyDecoratedDescriptor, inheritsLoose, initializerDefineProperty, assertThisInitialized } from "./rollupPluginModLoBabelHelpers.js";
import { cclegacy, _decorator, Node, Component } from "cc";
let s;
let l;
let p;
let f;
let y;
let d;
const {
  ccclass,
  property
} = _decorator;
export const MyTest = (s = ccclass("MyTest"), l = property({
  type: Node,
  tooltip: "test_node"
}), s((y = applyDecoratedDescriptor((f = (t => {
  class e {
    constructor(...args) {
      for (var e, n = args.length, i = new Array(n), u = 0; u < n; u++) {
        i[u] = args[u];
      }
      e = t.call(...[this].concat(e_prototype)) || this;
      initializerDefineProperty(e, "node", y, assertThisInitialized(e));
      initializerDefineProperty(e, "test", d, assertThisInitialized(e));
      e._count = 5;
      e.count22 = 10;
      return e;
    }
    static getCount2() {
      return 5;
    }
  }
  inheritsLoose(e, t);
  const e_prototype = e.prototype;
  e_prototype.onLoad = function () {
    console.log("onLoad", this._count);
  };
  e_prototype.getCount1 = function () {
    return this._count;
  };
  return e;
})(Component)).prototype, "node", [l], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer() {
    return null;
  }
}), d = applyDecoratedDescriptor(f.prototype, "test", [property], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer() {
    return 100;
  }
}), p = f)) || p);
    `
  }
];

// 运行测试
testCases.forEach((testCase, index) => {
  console.log(`\n==== 运行测试 ${index + 1}: ${testCase.name} ====`);
  
  try {
    const result = decompileTs(testCase.input);
    
    // 输出结果到文件
    const outputPath = path.join(__dirname, `test-output/${testCase.name}.ts`);
    fs.writeFileSync(outputPath, result, 'utf8');
    
    console.log(`✓ 测试成功，结果已保存到 ${outputPath}`);
  } catch (error) {
    console.error(`✗ 测试失败:`, error.message);
    console.error(error.stack);
  }
});    