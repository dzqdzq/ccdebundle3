System.register(
  "chunks:///_virtual/MyTest.ts",
  ["./rollupPluginModLoBabelHelpers.js", "cc"],
  function (t) {
    var e, n, o, r, i;
    return {
      setters: [
        function (t) {
          ((e = t.applyDecoratedDescriptor), (n = t.initializerDefineProperty));
        },
        function (t) {
          ((o = t.cclegacy), (r = t._decorator), (i = t.Node));
        },
      ],
      execute: function () {
        var u, c, s, a;
        o._RF.push({}, "c9025RMpFVDG5QFQK6u/eAk", "MyTest", void 0);
        r.ccclass;
        var l = r.property;
        t(
          "MyTest",
          ((u = l(i)),
          (s = e(
            (c = (function () {
              function t() {
                (n(this, "node", s, this),
                  n(this, "test", a, this),
                  (this._count = 5),
                  (this.count22 = 10));
              }
              var e = t.prototype;
              return (
                (e.onLoad = function () {
                  console.log("onLoad", this._count);
                }),
                (e.getCount1 = function () {
                  return this._count;
                }),
                (t.getCount2 = function () {
                  return 5;
                }),
                t
              );
            })()).prototype,
            "node",
            [u],
            {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            }
          )),
          (a = e(c.prototype, "test", [l], {
            configurable: !0,
            enumerable: !0,
            writable: !0,
            initializer: function () {
              return 100;
            },
          })),
          c)
        );
        o._RF.pop();
      },
    };
  }
);
