const { processBundle } = require('./unpack');
const path = require('path');

async function testBoth() {
  console.log('=== Testing exm/bundle.js ===');
  await processBundle(
    path.join(__dirname, 'exm', 'bundle.js'),
    path.join(__dirname, 'exm')
  );
  
  console.log('\n=== Testing exm2/bundle.js ===');
  await processBundle(
    path.join(__dirname, 'exm2', 'bundle.js'),
    path.join(__dirname, 'exm2')
  );

  console.log('\n=== Testing exm3/bundle.js ===');
  await processBundle(
    path.join(__dirname, 'exm3', 'bundle.js'),
    path.join(__dirname, 'exm3')
  );
}

testBoth().catch(console.error);