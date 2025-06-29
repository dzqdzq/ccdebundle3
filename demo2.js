var {
  applyDecoratedDescriptor: e,
initializerDefineProperty: n,
} = require('./rollupPluginModLoBabelHelpers.js');
var {
  cclegacy: o,
_decorator: r,
Node: i,
} = require('cc');

var u, c, s, a;
o._RF.push({}, "c9025RMpFVDG5QFQK6u/eAk", "MyTest", void 0);
r.ccclass;
var l = r.property;
o._RF.pop();
u = l(i);
s = e((c = function () {
  function t() {
    n(this, "node", s, this), n(this, "test", a, this), this._count = 5, this.count22 = "node";
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
a = e(c.prototype, "test", [l], {
  configurable: !0,
  enumerable: !0,
  writable: !0,
  initializer: function () {
    return 100;
  }
});
module.exports["MyTest"] = c;