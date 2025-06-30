const fs = require('fs').promises;
const path = require('path');
const { saveMeta } = require('./saveMeta');
const {clearRFPush} = require('./clearRFPush');
const {transformerSystemjs} = require('./transformerSystemjs');
const {analyzeCode} = require('./analyzeCode');
const {decompressCode} = require('./decompressCode');
async function processBundle(bundlePath, outputDir = 'output') {
  try {
    const bundleContent = await fs.readFile(bundlePath, 'utf-8');
    const { fileName, code:requirejs } = transformerSystemjs(bundleContent);
    const {shortUUID, code:noRFCode} = clearRFPush(requirejs);
    console.log('fileName:', fileName);
    console.log('shortUUID:', shortUUID);
    saveMeta(shortUUID, fileName, outputDir);
    const deCode = decompressCode(noRFCode);
    console.log('decompressCode:', deCode);

    // const analysis = analyzeCode(noRFCode);
    // console.log('提取到的classes:', JSON.stringify(analysis, null, 2));
  } catch (error) {
    console.error(`Error processing ${bundlePath}:`, error);
  }
}

if(require.main === module){
  // processBundle('exm/BackPackUI-bundle.js');
  // processBundle('exm/HeroSlot-bundle.js');
  // processBundle('exm/HomeUI-bundle.js');
  // processBundle('exm/Loader-bundle.js');
  processBundle('exm/MyTest-bundle.js');
  // processBundle('exm/SceneList-bundle.js');
}

module.exports = { processBundle };