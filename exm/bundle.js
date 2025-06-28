System.register(
  "chunks:///_virtual/HomeUI.ts",
  [
    "./rollupPluginModLoBabelHelpers.js",
    "cc",
    "./BackPackUI.ts",
    "./ShopUI.ts",
    "./ChallengeUI.ts",
    "./PanelType.ts",
  ],
  function (e) {
    var n, t, i, o, r, a, c, l, u, s, h, p;
    return {
      setters: [
        function (e) {
          (n = e.applyDecoratedDescriptor),
            (t = e.inheritsLoose),
            (i = e.initializerDefineProperty),
            (o = e.assertThisInitialized);
        },
        function (e) {
          (r = e.cclegacy),
            (a = e._decorator),
            (c = e.Animation),
            (l = e.Component);
        },
        function (e) {
          u = e.BackPackUI;
        },
        function (e) {
          s = e.ShopUI;
        },
        function (e) {
          h = e.ChallengeUI;
        },
        function (e) {
          p = e.PanelType;
        },
      ],
      execute: function () {
        var f, m, I, U, b, g, y, P, k, d;
        r._RF.push({}, "edc2a7itdpDQ5BDY+sVWkwJ", "HomeUI", void 0);
        var v = a.ccclass,
          H = a.property;
        e(
          "HomeUI",
          ((f = H(c)),
          (m = H(u)),
          (I = H(s)),
          (U = H(h)),
          v(
            ((y = n(
              (g = (function (e) {
                function n() {
                  for (
                    var n, t = arguments.length, r = new Array(t), a = 0;
                    a < t;
                    a++
                  )
                    r[a] = arguments[a];
                  return (
                    (n = e.call.apply(e, [this].concat(r)) || this),
                    i(n, "menuAnim", y, o(n)),
                    i(n, "backPackUI", P, o(n)),
                    i(n, "shopUI", k, o(n)),
                    i(n, "challengeUI", d, o(n)),
                    (n.curPanel = p.Home),
                    n
                  );
                }
                t(n, e);
                var r = n.prototype;
                return (
                  (r.onLoad = function () {
                    this.curPanel = p.Home;
                  }),
                  (r.start = function () {
                    var e = this;
                    this.backPackUI.init(this),
                      this.shopUI.init(this, p.Shop),
                      this.challengeUI.init(this),
                      this.scheduleOnce(function () {
                        e.menuAnim.play("menu_intro");
                      }, 0.5);
                  }),
                  (r.gotoShop = function () {
                    this.curPanel !== p.Shop && this.shopUI.show();
                  }),
                  (r.gotoHome = function () {
                    this.curPanel === p.Shop &&
                      (this.shopUI.hide(), (this.curPanel = p.Home));
                  }),
                  n
                );
              })(l)).prototype,
              "menuAnim",
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
            (P = n(g.prototype, "backPackUI", [m], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            })),
            (k = n(g.prototype, "shopUI", [I], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            })),
            (d = n(g.prototype, "challengeUI", [U], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            })),
            (b = g))
          ) || b)
        );
        r._RF.pop();
      },
    };
  }
);
