import { inheritsLoose } from "./rollupPluginModLoBabelHelpers.js";
import { cclegacy, assetManager, Prefab } from "cc";
import { LoaderBase } from "./LoaderBase.ts";

export const ResLoader = new (((n) => {
  function o() {
    for (var e, o = arguments.length, t = new Array(o), r = 0; r < o; r++)
      t[r] = arguments[r];
    return (
      ((e = n.call.apply(n, [this].concat(t)) || this).hello = "hello"),
      e
    );
  }
  const o_prototype = o.prototype;

  o_prototype.loadBundle = (n) =>
    new Promise((e) => {
      assetManager.loadBundle(n, (n, o) => {
        e(o);
      });
    });

  o_prototype.loadPrefab = (n, e) =>
    new Promise((o) => {
      e.load(n, Prefab, (n, e) => {
        o(e);
      });
    });

  o_prototype.loadScene = (n, e) =>
    new Promise((o) => {
      e.loadScene(n, (n, e) => {
        o(e);
      });
    });

  o_prototype.loadSpriteFrame = (n, e) =>
    new Promise((o) => {
      e.load(n, (n, e) => {
        o(e);
      });
    });

  return o;
})(LoaderBase))();
