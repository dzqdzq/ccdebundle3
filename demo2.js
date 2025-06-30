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

var {
  ccclass,
  property
} = _decorator;

u = property(Node);
s = e((c = function () {
  function t() {
    initializerDefineProperty(this, "node", s, this), initializerDefineProperty(this, "test", a, this), this._count = 5, this.count22 = 10;
  }
  var e = t.prototype;
  return e.onLoad = function () {
    console.log("onLoad", this._count);
  }, e.getCount1 = function (ad, dbf, ...atgs) {
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
a = e(c.prototype, "test", [property], {
  configurable: !0,
  enumerable: !0,
  writable: !0,
  initializer: function () {
    return 100;
  }
});
module.exports["MyTest"] = c;