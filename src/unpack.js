const fs = require('fs').promises;
const path = require('path');
const { saveMeta } = require('./saveMeta');
const {clearRFPush} = require('./clearRFPush');
const {transformerSystemjs} = require('./transformerSystemjs');
const {getTsCode} = require('./analyzeCode');
const {decompressCode} = require('./decompressCode');
const { runDefaultTransformationRules } = require('@wakaru/unminify');


async function processBundle(bundlePath, outputDir = 'output') {
  try {
    const bundleContent = await fs.readFile(bundlePath, 'utf-8');
    const { fileName, code:requirejs } = transformerSystemjs(bundleContent);
    const {code:unminifiedCode} = await runDefaultTransformationRules({source:requirejs});
    const {shortUUID, code:noRFCode} = clearRFPush(unminifiedCode);
    console.log('fileName:', fileName);
    console.log('shortUUID:', shortUUID);
    saveMeta(shortUUID, fileName, outputDir);
    await fs.writeFile(path.join(outputDir, fileName.replace(".ts", ".norf.ts")), noRFCode);

    console.log('===== tsCode =====');
    const tsCode = getTsCode(noRFCode);
    console.log(tsCode);
    await fs.writeFile(path.join(outputDir, fileName), tsCode, 'utf-8');
  } catch (error) {
    console.error(`Error processing ${bundlePath}:`, error);
  }
}

if(require.main === module){
  // processBundle('exm/BackPackUI-bundle.js');
  // processBundle('exm/HeroSlot-bundle.js');
  // processBundle('exm/HomeUI-bundle.js');
  processBundle('exm/Loader-bundle.js');
  // processBundle('exm/MyTest-bundle.js');
  // processBundle('exm/SceneList-bundle.js');
}

module.exports = { processBundle };