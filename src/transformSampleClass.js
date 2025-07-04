const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const { makeClassAst, makeClassCode } = require('./makeClassAst');
const t = require('@babel/types');
const {replaceClass} = require('./replaceClass');

function transformSampleClass(match) {
    const code = match[0];
    const className = match[1];
    const constructorArgs = match[2];
    const extendsName = match[3];
    const ast = parser.parse(code, { allowReturnOutsideFunction: true });

    traverse(ast, {
        NewExpression(path) {
            if (t.isIdentifier(path.node.callee, { name: 'Promise' })) {
                const callback = path.get('arguments.0');
                if (callback.isFunction()) {
                    const param1 = callback.get('params.0');
                    if (param1) {
                        callback.scope.rename(param1.node.name, 'resolve');
                    }
                    const param2 = callback.get('params.1');
                    if (param2) {
                        callback.scope.rename(param2.node.name, 'reject');
                    }
                }
            }
        }
    });

    let prototypeVarName;
    const methodsInfo = [];
    let constructorNode = null;

    // Find class name and prototype variable name
    traverse(ast, {
        FunctionDeclaration(path) {
            if (!constructorNode && className === path.node.id.name) {
                constructorNode = path.node.body;
            }
        },
        VariableDeclarator(path) {
            if (
                path.node.init &&
                t.isMemberExpression(path.node.init) &&
                path.node.init.object.name === className &&
                path.node.init.property.name === 'prototype'
            ) {
                prototypeVarName = path.node.id.name;
            }
        }
    });

    if (!className || !prototypeVarName) {
        throw new Error('Could not determine class name or prototype variable.');
    }

    // Find methods assigned to the prototype and static methods
    traverse(ast, {
        AssignmentExpression(path) {
            const { left, right } = path.node;
            if (t.isMemberExpression(left)) {
                const isInstanceMethod = t.isIdentifier(left.object, { name: prototypeVarName });
                const isStaticMethod = t.isIdentifier(left.object, { name: className });

                if (isInstanceMethod || isStaticMethod) {
                    const methodName = left.property.name;
                    let params = [];
                    let body;

                    if (t.isArrowFunctionExpression(right) || t.isFunctionExpression(right)) {
                        params = right.params;
                        body = t.isBlockStatement(right.body)
                            ? right.body
                            : t.blockStatement([t.returnStatement(right.body)]);
                    }

                    if (body) {
                        const methodInfo = {
                            name: methodName,
                            args: params.map(p => generator(p).code).join(', '),
                            body: generator(body).code.slice(1, -1), // remove brackets
                            static: isStaticMethod
                        };
                        methodsInfo.push(methodInfo);
                    }
                }
            }
        }
    });

    let constructorBody = generator(constructorNode).code.slice(1, -1);
    if (extendsName) {
        const superCall = `super(${constructorArgs});`;
        constructorBody = `${superCall}\n${constructorBody}`;
    }

    const constructorInfo = {
        name: 'constructor',
        args: constructorArgs,
        body: constructorBody
    };

    const classInfo = {
        name: className,
        extends: extendsName,
        decorators: [],
        properties: [],
        methods: [constructorInfo, ...methodsInfo]
    };

    const classAst = makeClassAst(classInfo);
    const classCode = makeClassCode(classAst);

    return {
        newName: className,
        newBody: classCode,
    };
}


function transform(code){
    const pattern = /\(\(\w+?\) => \{\s*function\s+(\w+)\((.*?)\)\s*\{[\s\S]*?\.prototype;[\s\S]*?return\s+\1;\s*\}\)\((.*?)\)/;
    // console.log(code.match(pattern)[0]);
    // console.log(code.match(pattern)[1]);
    // console.log(code.match(pattern)[2]);
    // console.log(code.match(pattern)[3]);
    // return code;
    return replaceClass(code, pattern, transformSampleClass);
}

module.exports = { transform };

if (require.main === module) {
    const fs = require('fs');
    const path = require('path');

    const codePath = path.join(__dirname, '../demo2.js');
    let code = fs.readFileSync(codePath, 'utf-8');
    let newCode = transform(code);
    console.log(newCode);
    // if(newCode !== code){
    //     console.log(`Successfully transformed ${codePath}`);
    //     fs.writeFileSync(codePath, newCode, 'utf-8');
    // }
}
