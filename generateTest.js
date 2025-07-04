const t = require('@babel/types');
const generate = require('@babel/generator').default;
const parser = require('@babel/parser');

/**
 * Parses a decorator string like 'decoratorName(arg1, arg2)' into a Babel AST node.
 * @param {string} decStr 
 * @returns {t.Decorator}
 */
function parseDecorator(decStr) {
    const match = decStr.match(/(\w+)(?:\((.*)\))?/);
    if (!match) {
        throw new Error(`Invalid decorator string: ${decStr}`);
    }
    const name = match[1];
    const argsStr = match[2];
    
    let expression;
    if (argsStr) {
        // If there are arguments, parse them as an expression
        const argExpressions = parser.parseExpression(argsStr.split(',').join(', '));
        expression = t.callExpression(t.identifier(name), Array.isArray(argExpressions) ? argExpressions : [argExpressions]);
    } else {
        expression = t.identifier(name);
    }
    
    return t.decorator(expression);
}

/**
 * Creates a Babel AST for a class based on a descriptive object.
 * @param {object} classObj - The object describing the class.
 * @returns {t.File}
 */
function makeClassAst(classObj) {
    const { name, extends: superClassName, decorators = [], properties = [], methods = [] } = classObj;

    // Class identifier
    const classId = t.identifier(name);

    // Super class identifier
    const superClassId = superClassName ? t.identifier(superClassName) : null;

    // Class decorators
    const classDecorators = decorators.map(parseDecorator);

    // Class body
    const classBodyMembers = [];

    // Properties
    properties.forEach(prop => {
        const propDecorators = (prop.decorators || []).map(parseDecorator);
        const valueNode = prop.value ? parser.parseExpression(String(prop.value)) : null;

        const classProperty = t.classProperty(
            t.identifier(prop.name),
            valueNode,
            prop.type ? t.tsTypeAnnotation(t.tsTypeReference(t.identifier(prop.type))) : null,
            propDecorators,
            false,
            prop.static || false
        );
        
        if (prop.accessibility) {
            classProperty.accessibility = prop.accessibility;
        }

        classBodyMembers.push(classProperty);
    });

    // Methods
    methods.forEach(method => {
        const { name, args = '', body, decorators = [], static: isStatic = false, accessibility } = method;
        const methodDecorators = (decorators || []).map(parseDecorator);

        // Parse arguments string into AST nodes
        const params = args ? parser.parse(`(${args}) => {}`).program.body[0].expression.params : [];

        const bodyAst = (() => {
            if (!body) return [];
            if (name === 'constructor') {
                // For constructor with super(), parse inside a dummy class context.
                const dummyClass = `class __DUMMY__ extends __SUPER__ { constructor(${args}) { ${body} } }`;
                const parsed = parser.parse(dummyClass);
                return parsed.program.body[0].body.body[0].body.body;
            }
            return parser.parse(body, { allowReturnOutsideFunction: true }).program.body;
        })();

        const classMethod = t.classMethod(
            name === 'constructor' ? 'constructor' : 'method',
            t.identifier(name),
            params,
            t.blockStatement(bodyAst),
            false,
            isStatic
        );
        classMethod.decorators = methodDecorators;

        if (accessibility) {
            classMethod.accessibility = accessibility;
        }

        classBodyMembers.push(classMethod);
    });

    // Class declaration
    const classDeclaration = t.classDeclaration(
        classId,
        superClassId,
        t.classBody(classBodyMembers),
        classDecorators
    );

    return t.file(t.program([classDeclaration]));
}

// --- Example Usage ---

const myClassInfo = {
    name: 'Test',
    extends: 'Component',
    decorators: ['ccclass'],
    properties: [
        { name: 'node', value: 'null', type: 'Node', static: false, accessibility: 'public', decorators: ['property(Node)'] },
        { name: 'flag', value: "'Test'",  accessibility: 'public', static: false },
        { name: 'NAME', value: "'Test'", static: true }
    ],
    methods: [
        { name: 'constructor', args: 'a,b,c', body: 'super(a,b,c);'},
        { name: 'show', args: 'a,b,c', body: 'return a + b;', accessibility: 'public', decorators: ['log("show")']},
        { name: 'getName', body: 'return "Test";', static: true }
    ]
};

const ast = makeClassAst(myClassInfo);

const { code } = generate(ast, { jsescOption: { minimal: true } });

console.log(code);