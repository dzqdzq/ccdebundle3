const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');
const {replaceClass} = require('./replaceClass');

function transformSampleClass(code) {
    const ast = parser.parse(code, { allowReturnOutsideFunction: true });

    traverse(ast, {
        ReturnStatement(path) {
            if (path.getFunctionParent() === null) {
                path.remove();
            }
        }
    });

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

    let className;
    let prototypeVarName;
    const methods = [];
    const staticMethods = [];
    let constructorNode = t.blockStatement([]);

    // Find class name and prototype variable name
    traverse(ast, {
        FunctionDeclaration(path) {
            if (!className) {
                className = path.node.id.name;
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
                        const method = t.classMethod(
                            'method',
                            t.identifier(methodName),
                            params,
                            body,
                            false, // computed
                            isStaticMethod // static
                        );
                        if (isStaticMethod) {
                            staticMethods.push(method);
                        } else {
                            methods.push(method);
                        }
                    }
                }
            }
        }
    });

    const classConstructor = t.classMethod(
        'constructor',
        t.identifier('constructor'),
        [],
        constructorNode
    );

    const classBody = t.classBody([classConstructor, ...methods, ...staticMethods]);
    const classDeclaration = t.classDeclaration(
        t.identifier(className),
        null,
        classBody,
        []
    );
    
    const newAst = t.file(t.program([classDeclaration]));

    const { code: classCode } = generator(newAst);

    return {
        newName: className,
        newBody: classCode,
    };
}


function transform(code){
    const pattern = /\(\(\) => \{\s*function\s+(\w+)\(\)\s*\{[\s\S]*?n_prototype[\s\S]*?return\s+\1;\s*\}\)\(\)/;

    return replaceClass(code, pattern, transformSampleClass);
}

module.exports = { transform };

if (require.main === module) {
    const fs = require('fs');
    const path = require('path');

    const codePath = path.join(__dirname, '../demo2.js');
    let code = fs.readFileSync(codePath, 'utf-8');
    let newCode = transform(code);
    if(newCode !== code){
        console.log(`Successfully transformed ${codePath}`);
        fs.writeFileSync(codePath, newCode, 'utf-8');
    }
}
