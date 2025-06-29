var {
  applyDecoratedDescriptor,
initializerDefineProperty,
} = require('./rollupPluginModLoBabelHelpers.js');
var {
  cclegacy,
_decorator,
Node,
} = require('cc');

var u, c, s, a;
cclegacy._RF.push({}, "c9025RMpFVDG5QFQK6u/eAk", "MyTest", void 0);
_decorator.ccclass;
var l = _decorator.property;
cclegacy._RF.pop();
u = l(Node);
s = applyDecoratedDescriptor((c = function () {
  function t() {
    initializerDefineProperty(this, "node", s, this), initializerDefineProperty(this, "test", a, this), this._count = 5, this.count22 = "node";
  }
  var e = t.prototype;
  return e.onLoad = function () {
    console.log("onLoad", this._count);
  }, e.getCount1 = function () {
    return this._count;
  }, t.getCount2 = function () {
    return 5;
  }, t;
}()).prototype, "node", [u], {
  configurable: !0,
  enumerable: !0,
  writable: !0,
  initializer: function () {
    return null;
  }
});
a = applyDecoratedDescriptor(c.prototype, "test", [l], {
  configurable: !0,
  enumerable: !0,
  writable: !0,
  initializer: function () {
    return 100;
  }
});
module.exports["MyTest"] = c;