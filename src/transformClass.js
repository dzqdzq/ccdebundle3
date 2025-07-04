const fs = require('fs-extra');
const babel = require('@babel/core');
const t = require('@babel/types');
const generate = require('@babel/generator').default;



/**
 * Transforms a compiled class-like AST node into a standard ClassDeclaration AST node.
 * @param {string} className The name for the new class.
 * @param {t.Node} initNode The AST node for the variable initializer.
 * @returns {t.ClassDeclaration | null}
 */
function isCompiledClass(initNode) {
    let isCompiled = false;
    if (!initNode) return false;
    babel.traverse(initNode, {
        noScope: true,
        Identifier(path) {
            if (path.node.name === 'applyDecoratedDescriptor') {
                isCompiled = true;
                path.stop();
            }
        }
    });
    return isCompiled;
}

async function transformCodeToClass(className, initNode) {
    try {
        console.log(JSON.stringify(initNode, (key, value) => (key === 'parent' || key === 'scope') ? undefined : value, 2));
        let classExpr = null;
        const astToTraverse = t.file(t.program([t.expressionStatement(initNode)]));
        babel.traverse(astToTraverse, {
            ClassExpression(path) {
                classExpr = path.node;
                path.stop();
            }
        });

        if (!classExpr) {
            return null;
        }

        const newClass = t.classDeclaration(
            t.identifier(className),
            classExpr.superClass,
            classExpr.body,
            classExpr.decorators || []
        );

        return newClass;
    } catch (e) {
        console.error(`Failed to transform ${className}: ${e.message}`);
        return null;
    }
}

/**
 * Transforms a file by converting compiled class-like structures into standard classes.
 * @param {string} filePath The path to the file to transform.
 */
async function transformFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = await babel.parseAsync(content, {
        sourceType: 'module',
        plugins: [["@babel/plugin-proposal-decorators", { "legacy": true }]]
    });

    const newBody = [];
    let transformed = false;

    for (const node of ast.program.body) {
        if (t.isExportNamedDeclaration(node) && node.declaration && t.isVariableDeclaration(node.declaration)) {
            const declaration = node.declaration.declarations[0];
            if (isCompiledClass(declaration.init)) {
                console.log(`Transforming ${declaration.id.name}...`);
                const classAstNode = await transformCodeToClass(declaration.id.name, declaration.init);
                if (classAstNode) {
                    newBody.push(t.exportNamedDeclaration(classAstNode, []));
                    transformed = true;
                } else {
                    console.log(`Failed to transform ${declaration.id.name}, keeping original.`);
                    newBody.push(node);
                }
            } else {
                newBody.push(node);
            }
        } else {
            newBody.push(node);
        }
    }

    if (transformed) {
        const newAst = t.file(t.program(newBody, ast.comments, ast.tokens));
        const { code: newCode } = generate(newAst, { decoratorsBeforeExport: true });
        const newFilePath = filePath.replace(/\.ts$/, '.trans.ts');
        await fs.writeFile(newFilePath, newCode, 'utf-8');
        console.log(`Successfully transformed ${filePath} to ${newFilePath}`);
    } else {
        console.log(`No transformable classes found in ${filePath}`);
    }
}

if (require.main === module) {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Please provide a file path.');
        process.exit(1);
    }
    transformFile(filePath).catch(err => console.error(err));
}

module.exports = { transformFile };