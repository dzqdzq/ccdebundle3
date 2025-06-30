System.register("chunks:///_virtual/Loader.ts", ["cc"], function (n) {
  var e, o, t;
  return {
    setters: [
      function (n) {
        ((e = n.cclegacy), (o = n.assetManager), (t = n.Prefab));
      },
    ],
    execute: function () {
      e._RF.push({}, "478b6cnei1LH7QE2U681HBh", "Loader", void 0);
      n(
        "ResLoader",
        new ((function () {
          function n() {}
          var e = n.prototype;
          return (
            (e.loadBundle = function (n) {
              return new Promise(function (e) {
                o.loadBundle(n, function (n, o) {
                  e(o);
                });
              });
            }),
            (e.loadPrefab = function (n, e) {
              return new Promise(function (o) {
                e.load(n, t, function (n, e) {
                  o(e);
                });
              });
            }),
            (e.loadScene = function (n, e) {
              return new Promise(function (o) {
                e.loadScene(n, function (n, e) {
                  o(e);
                });
              });
            }),
            (e.loadSpriteFrame = function (n, e) {
              return new Promise(function (o) {
                e.load(n, function (n, e) {
                  o(e);
                });
              });
            }),
            n
          );
        })())()
      );
      e._RF.pop();
    },
  };
});
