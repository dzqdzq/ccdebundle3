System.register(
  "chunks:///_virtual/AdapterContent.ts",
  ["./rollupPluginModLoBabelHelpers.js", "cc"],
  function (t) {
    var e, n, r, o, i, s, a, c, l, p;
    return {
      setters: [
        function (t) {
          ((e = t.applyDecoratedDescriptor),
            (n = t.inheritsLoose),
            (r = t.initializerDefineProperty),
            (o = t.assertThisInitialized));
        },
        function (t) {
          ((i = t.cclegacy),
            (s = t._decorator),
            (a = t.Node),
            (c = t.UITransform),
            (l = t.Vec3),
            (p = t.Component));
        },
      ],
      execute: function () {
        var u, h, d, f, y;
        i._RF.push({}, "b7e58W4jq9D568mZxKnWRGk", "AdapterContent", void 0);
        var g = s.ccclass,
          C = (s.property, s.type);
        t(
          "AdapterContent",
          ((u = g("AdapterContent")),
          (h = C(a)),
          u(
            ((y = e(
              (f = (function (t) {
                function e() {
                  for (
                    var e, n = arguments.length, i = new Array(n), s = 0;
                    s < n;
                    s++
                  )
                    i[s] = arguments[s];
                  return (
                    (e = t.call.apply(t, [this].concat(i)) || this),
                    r(e, "scroll", y, o(e)),
                    e
                  );
                }
                n(e, t);
                var i = e.prototype;
                return (
                  (i.start = function () {
                    (this.sizeChanged(),
                      this.scroll.on(
                        a.EventType.SIZE_CHANGED,
                        this.sizeChanged,
                        this
                      ));
                  }),
                  (i.sizeChanged = function () {
                    var t = this.scroll.getComponent(c).contentSize,
                      e = this.node.position;
                    this.node.setPosition(new l(e.x, t.height / 2));
                  }),
                  e
                );
              })(p)).prototype,
              "scroll",
              [h],
              {
                configurable: !0,
                enumerable: !0,
                writable: !0,
                initializer: function () {
                  return null;
                },
              }
            )),
            (d = f))
          ) || d)
        );
        i._RF.pop();
      },
    };
  }
);
