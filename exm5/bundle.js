System.register(
  "chunks:///_virtual/SceneList.ts",
  ["./rollupPluginModLoBabelHelpers.js", "cc"],
  function (e) {
    var t, r, n, i, a, o, c, s, l;
    return {
      setters: [
        function (e) {
          ((t = e.applyDecoratedDescriptor),
            (r = e.inheritsLoose),
            (n = e.initializerDefineProperty),
            (i = e.assertThisInitialized));
        },
        function (e) {
          ((a = e.cclegacy),
            (o = e._decorator),
            (c = e.Prefab),
            (s = e.instantiate),
            (l = e.Component));
        },
      ],
      execute: function () {
        var u, f, p, h, y;
        a._RF.push({}, "56ce0MAdDJH2qBewyMuTQnW", "SceneList", void 0);
        var d = o.ccclass,
          b = o.property,
          v = e("sceneArray", []);
        e(
          "SceneManager",
          ((u = d("SceneManager")),
          (f = b({ type: c })),
          u(
            ((y = t(
              (h = (function (e) {
                function t() {
                  for (
                    var t, r = arguments.length, a = new Array(r), o = 0;
                    o < r;
                    o++
                  )
                    a[o] = arguments[o];
                  return (
                    (t = e.call.apply(e, [this].concat(a)) || this),
                    n(t, "itemPrefab", y, i(t)),
                    t
                  );
                }
                r(t, e);
                var a = t.prototype;
                return (
                  (a.onLoad = function () {
                    if (this.itemPrefab)
                      for (var e = 0; e < v.length; e++) {
                        var t = s(this.itemPrefab);
                        this.node.addChild(t);
                      }
                  }),
                  (a.start = function () {}),
                  t
                );
              })(l)).prototype,
              "itemPrefab",
              [f],
              {
                configurable: !0,
                enumerable: !0,
                writable: !0,
                initializer: function () {
                  return null;
                },
              }
            )),
            (p = h))
          ) || p)
        );
        a._RF.pop();
      },
    };
  }
);
