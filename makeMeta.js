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

module.exports = { makeMeta };