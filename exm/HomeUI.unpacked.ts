import {
  applyDecoratedDescriptor as n,
  inheritsLoose as t,
  initializerDefineProperty as i,
  assertThisInitialized as o,
} from './rollupPluginModLoBabelHelpers.js';
import {
  cclegacy as r,
  _decorator as a,
  Animation as c,
  Component as l,
} from 'cc';
import { BackPackUI as u } from './BackPackUI.ts';
import { ShopUI as s } from './ShopUI.ts';
import { ChallengeUI as h } from './ChallengeUI.ts';
import { PanelType as p } from './PanelType.ts';

var f, m, I, U, b, g, y, P, k, d;
r._RF.push({}, 'edc2a7itdpDQ5BDY+sVWkwJ', 'HomeUI', void 0);
var v = a.ccclass,
  H = a.property;
e(
  'HomeUI',
  ((f = H(c)),
  (m = H(u)),
  (I = H(s)),
  (U = H(h)),
  v(
    ((y = n(
      (g = (function (e) {
        function n() {
          for (var n, t = arguments.length, r = new Array(t), a = 0; a < t; a++)
            r[a] = arguments[a];
          return (
            (n = e.call.apply(e, [this].concat(r)) || this),
            i(n, 'menuAnim', y, o(n)),
            i(n, 'backPackUI', P, o(n)),
            i(n, 'shopUI', k, o(n)),
            i(n, 'challengeUI', d, o(n)),
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
            (this.backPackUI.init(this),
              this.shopUI.init(this, p.Shop),
              this.challengeUI.init(this),
              this.scheduleOnce(function () {
                e.menuAnim.play('menu_intro');
              }, 0.5));
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
      'menuAnim',
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
    (P = n(g.prototype, 'backPackUI', [m], {
      configurable: !0,
      enumerable: !0,
      writable: !0,
      initializer: function () {
        return null;
      },
    })),
    (k = n(g.prototype, 'shopUI', [I], {
      configurable: !0,
      enumerable: !0,
      writable: !0,
      initializer: function () {
        return null;
      },
    })),
    (d = n(g.prototype, 'challengeUI', [U], {
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
