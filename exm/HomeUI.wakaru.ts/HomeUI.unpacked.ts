import {
  applyDecoratedDescriptor,
  inheritsLoose,
  initializerDefineProperty,
  assertThisInitialized,
} from "./rollupPluginModLoBabelHelpers.js";

import { cclegacy, _decorator, Animation, Component } from "cc";
import { BackPackUI } from "./BackPackUI.ts";
import { ShopUI } from "./ShopUI.ts";
import { ChallengeUI } from "./ChallengeUI.ts";
import { PanelType } from "./PanelType.ts";
let f;
let m;
let I;
let U;
let b;
let g;
let y;
let P;
let k;
let d;
cclegacy._RF.push({}, "edc2a7itdpDQ5BDY+sVWkwJ", "HomeUI", undefined);
const v = _decorator.ccclass;
const H = _decorator.property;
e(
  "HomeUI",
  ((f = H(Animation)),
  (m = H(BackPackUI)),
  (I = H(ShopUI)),
  (U = H(ChallengeUI)),
  v(
    ((y = applyDecoratedDescriptor(
      (g = ((e) => {
        function n() {
          for (
            var n, t = arguments.length, r = new Array(t), a = 0;
            a < t;
            a++
          ) {
            r[a] = arguments[a];
          }
          n = e.call(...[this].concat(r)) || this;
          initializerDefineProperty(n, "menuAnim", y, assertThisInitialized(n));
          initializerDefineProperty(
            n,
            "backPackUI",
            P,
            assertThisInitialized(n)
          );
          initializerDefineProperty(n, "shopUI", k, assertThisInitialized(n));
          initializerDefineProperty(
            n,
            "challengeUI",
            d,
            assertThisInitialized(n)
          );
          n.curPanel = PanelType.Home;
          return n;
        }
        inheritsLoose(n, e);
        const r = n.prototype;

        r.onLoad = function () {
          this.curPanel = PanelType.Home;
        };

        r.start = function () {
          const e = this;
          this.backPackUI.init(this);
          this.shopUI.init(this, PanelType.Shop);
          this.challengeUI.init(this);

          this.scheduleOnce(() => {
            e.menuAnim.play("menu_intro");
          }, 0.5);
        };

        r.gotoShop = function () {
          if (this.curPanel !== PanelType.Shop) {
            this.shopUI.show();
          }
        };

        r.gotoHome = function () {
          if (this.curPanel === PanelType.Shop) {
            this.shopUI.hide();
            this.curPanel = PanelType.Home;
          }
        };

        return n;
      })(Component)).prototype,
      "menuAnim",
      [f],
      {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() {
          return null;
        },
      }
    )),
    (P = applyDecoratedDescriptor(g.prototype, "backPackUI", [m], {
      configurable: true,
      enumerable: true,
      writable: true,
      initializer() {
        return null;
      },
    })),
    (k = applyDecoratedDescriptor(g.prototype, "shopUI", [I], {
      configurable: true,
      enumerable: true,
      writable: true,
      initializer() {
        return null;
      },
    })),
    (d = applyDecoratedDescriptor(g.prototype, "challengeUI", [U], {
      configurable: true,
      enumerable: true,
      writable: true,
      initializer() {
        return null;
      },
    })),
    (b = g))
  ) || b)
);
cclegacy._RF.pop();
