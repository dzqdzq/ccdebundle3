const { replaceClass} = require('./src/replaceClass');
const str = `
var ttt = 1;

export const ResLoader = new (function test(){
})()
`
const str2 = `
var ttt = 1;

function test(){
}
export const ResLoader = new (test)()
`

function trans(match0){
    return {
        newBody:match0,
        newName: 'test'
    }
}


const reg = /function\s+([\w$]+)\(([^)]*)\)\s*\{([\s\S]*?)\}/;
console.log(replaceClass(str, reg, trans));
