const { processBundle } = require('./unpack');
const path = require('path');

async function testBoth() {
  console.log('=== Testing exm/bundle.js ===');
  for(let i=1; i<=4; i++){
    console.log(`=== Testing exm${i}/bundle.js ===`);
    await processBundle(
      path.join(__dirname, `exm${i}`, 'bundle.js'),
      path.join(__dirname, `exm${i}`)
    );
  }
}

testBoth().catch(console.error);