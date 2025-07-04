const fs = require("fs");
const path = require("path");
const {getLongUUID} = require('./uuid-utils');

function makeMeta(uuid, fileName) {
  return {
    ver: "4.0.24",
    importer: "typescript",
    imported: true,
    uuid,
    files: [],
    subMetas: {},
    userData: {
      moduleId: `project:///assets/scripts/${fileName}`,
      simulateGlobals: [],
    },
  };
}

function saveMeta(shortUUID, fileName, outputDir) {
  const longUUID = getLongUUID(shortUUID);
  const metaContent = makeMeta(longUUID, fileName);
  const metaFileName = fileName.replace(/\.ts$/, ".ts.meta");
  const metaPath = path.join(outputDir, metaFileName);

  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2));
  console.log(`Meta file saved to ${metaPath}`);
}

module.exports = {
  saveMeta,
};
