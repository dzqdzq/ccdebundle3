System.register(
  "chunks:///_virtual/main.ts",
  ["./rollupPluginModLoBabelHelpers.js", "cc", "./Loader.ts"],
  function (e) {
    var t, r, n, i, s, o, a, l, u, c, p, d, h, g, f;
    return {
      setters: [
        function (e) {
          ((t = e.applyDecoratedDescriptor),
            (r = e.inheritsLoose),
            (n = e.initializerDefineProperty),
            (i = e.assertThisInitialized),
            (s = e.asyncToGenerator),
            (o = e.regeneratorRuntime));
        },
        function (e) {
          ((a = e.cclegacy),
            (l = e._decorator),
            (u = e.Node),
            (c = e.Prefab),
            (p = e.ProgressBar),
            (d = e.profiler),
            (h = e.director),
            (g = e.Component));
        },
        function (e) {
          f = e.ResLoader;
        },
      ],
      execute: function () {
        var B, b, m, v, y, L, N, x, S, T, w, I;
        a._RF.push({}, "b2490MCc5RG3q1lnKDd/tjQ", "main", void 0);
        var z = l.ccclass,
          U = l.property;
        e(
          "main",
          ((B = z("main")),
          (b = U(u)),
          (m = U(u)),
          (v = U(c)),
          (y = U(p)),
          B(
            (((I = (function (e) {
              function t() {
                for (
                  var t, r = arguments.length, s = new Array(r), o = 0;
                  o < r;
                  o++
                )
                  s[o] = arguments[o];
                return (
                  (t = e.call.apply(e, [this].concat(s)) || this),
                  n(t, "loadNode", x, i(t)),
                  n(t, "uiNode", S, i(t)),
                  n(t, "menu", T, i(t)),
                  n(t, "progBar", w, i(t)),
                  t
                );
              }
              r(t, e);
              var a = t.prototype;
              return (
                (a.start = function () {
                  (d.hideStats(),
                    t.menuNode && (t.menuNode.active = !1),
                    (this.loadNode.active = !t.isLoaded),
                    (this.uiNode.active = !1),
                    (t.isLoaded = !0),
                    this.loading());
                }),
                (a.loading = (function () {
                  var e = s(
                    o().mark(function e() {
                      var t, r, n;
                      return o().wrap(
                        function (e) {
                          for (;;)
                            switch ((e.prev = e.next)) {
                              case 0:
                                return (
                                  (this.progBar.progress = 0),
                                  (e.next = 3),
                                  f.loadBundle("TestBullet")
                                );
                              case 3:
                                return (
                                  (t = e.sent),
                                  (this.progBar.progress = 0.1),
                                  (e.next = 7),
                                  f.loadScene("TestBullet", t)
                                );
                              case 7:
                                return (
                                  (this.sBullet = e.sent),
                                  (this.progBar.progress = 0.3),
                                  (e.next = 11),
                                  f.loadBundle("TestList")
                                );
                              case 11:
                                return (
                                  (r = e.sent),
                                  (this.progBar.progress = 0.4),
                                  (e.next = 15),
                                  f.loadScene("TestList", r)
                                );
                              case 15:
                                return (
                                  (this.sList = e.sent),
                                  (this.progBar.progress = 0.6),
                                  (e.next = 19),
                                  f.loadBundle("TestUI")
                                );
                              case 19:
                                return (
                                  (n = e.sent),
                                  (this.progBar.progress = 0.7),
                                  (e.next = 23),
                                  f.loadScene("TestUI", n)
                                );
                              case 23:
                                ((this.sUI = e.sent),
                                  (this.progBar.progress = 1),
                                  (this.loadNode.active = !1),
                                  (this.uiNode.active = !0));
                              case 27:
                              case "end":
                                return e.stop();
                            }
                        },
                        e,
                        this
                      );
                    })
                  );
                  return function () {
                    return e.apply(this, arguments);
                  };
                })()),
                (a.btUI = function () {
                  this.sUI && h.runScene(this.sUI);
                }),
                (a.btList = function () {
                  this.sList && h.runScene(this.sList);
                }),
                (a.btBullet = function () {
                  this.sBullet && h.runScene(this.sBullet);
                }),
                t
              );
            })(g)).isLoaded = !1),
            (x = t((N = I).prototype, "loadNode", [b], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: null,
            })),
            (S = t(N.prototype, "uiNode", [m], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: null,
            })),
            (T = t(N.prototype, "menu", [v], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: null,
            })),
            (w = t(N.prototype, "progBar", [y], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: null,
            })),
            (L = N))
          ) || L)
        );
        a._RF.pop();
      },
    };
  }
);
