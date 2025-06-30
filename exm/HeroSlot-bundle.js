System.register(
  "chunks:///_virtual/HeroSlot.ts",
  ["./rollupPluginModLoBabelHelpers.js", "cc"],
  function (e) {
    var r, t, i, n, s, o, a, l, u, p, f;
    return {
      setters: [
        function (e) {
          ((r = e.applyDecoratedDescriptor),
            (t = e.inheritsLoose),
            (i = e.initializerDefineProperty),
            (n = e.assertThisInitialized));
        },
        function (e) {
          ((s = e.cclegacy),
            (o = e._decorator),
            (a = e.SpriteFrame),
            (l = e.Label),
            (u = e.Sprite),
            (p = e.Component),
            (f = e.randomRangeInt));
        },
      ],
      execute: function () {
        var c, b, h, g, m, y, d, v, S, z, w, H, B, L, R, k, A, F, x, D, _, j;
        s._RF.push({}, "57d15BvDjxLBLxQT6h/Vxab", "HeroSlot", void 0);
        var I = o.ccclass,
          P = o.property,
          T = f,
          V = 0;
        e(
          "HeroSlot",
          ((c = P([a])),
          (b = P([a])),
          (h = P([a])),
          (g = P([a])),
          (m = P(l)),
          (y = P(u)),
          (d = P(u)),
          (v = P(u)),
          (S = P(u)),
          (z = P([u])),
          I(
            ((B = r(
              (H = (function (e) {
                function r() {
                  for (
                    var r, t = arguments.length, s = new Array(t), o = 0;
                    o < t;
                    o++
                  )
                    s[o] = arguments[o];
                  return (
                    (r = e.call.apply(e, [this].concat(s)) || this),
                    i(r, "sfAttributes", B, n(r)),
                    i(r, "sfRanks", L, n(r)),
                    i(r, "sfHeroes", R, n(r)),
                    i(r, "sfBorders", k, n(r)),
                    i(r, "labelLevel", A, n(r)),
                    i(r, "spHero", F, n(r)),
                    i(r, "spRank", x, n(r)),
                    i(r, "spAttribute", D, n(r)),
                    i(r, "spBorder", _, n(r)),
                    i(r, "spStars", j, n(r)),
                    r
                  );
                }
                t(r, e);
                var s = r.prototype;
                return (
                  (s.onLoad = function () {
                    this.refresh();
                  }),
                  (s.refresh = function () {
                    var e = T(0, this.sfBorders.length),
                      r = T(0, this.sfHeroes.length),
                      t = T(0, this.spStars.length),
                      i = T(0, this.sfRanks.length),
                      n = T(0, this.sfAttributes.length);
                    T(0, 100);
                    ((this.labelLevel.string = "LV." + V++),
                      (this.spRank.spriteFrame = this.sfRanks[i]),
                      this.refreshStars(t),
                      (this.spBorder.spriteFrame = this.sfBorders[e]),
                      (this.spAttribute.spriteFrame = this.sfAttributes[n]),
                      (this.spHero.spriteFrame = this.sfHeroes[r]));
                  }),
                  (s.refreshStars = function (e) {
                    for (var r = 0; r < this.spStars.length; ++r)
                      this.spStars[r].enabled = r <= e;
                  }),
                  r
                );
              })(p)).prototype,
              "sfAttributes",
              [c],
              {
                configurable: !0,
                enumerable: !0,
                writable: !0,
                initializer: function () {
                  return [];
                },
              }
            )),
            (L = r(H.prototype, "sfRanks", [b], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return [];
              },
            })),
            (R = r(H.prototype, "sfHeroes", [h], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return [];
              },
            })),
            (k = r(H.prototype, "sfBorders", [g], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return [];
              },
            })),
            (A = r(H.prototype, "labelLevel", [m], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            })),
            (F = r(H.prototype, "spHero", [y], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            })),
            (x = r(H.prototype, "spRank", [d], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            })),
            (D = r(H.prototype, "spAttribute", [v], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            })),
            (_ = r(H.prototype, "spBorder", [S], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return null;
              },
            })),
            (j = r(H.prototype, "spStars", [z], {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              initializer: function () {
                return [];
              },
            })),
            (w = H))
          ) || w)
        );
        s._RF.pop();
      },
    };
  }
);
