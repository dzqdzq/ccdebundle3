const t = require("@babel/types");
const generate = require("@babel/generator").default;
const parser = require("@babel/parser");

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
    const argExpressions = parser.parseExpression(
      argsStr.split(",").join(", ")
    );
    expression = t.callExpression(
      t.identifier(name),
      Array.isArray(argExpressions) ? argExpressions : [argExpressions]
    );
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
  const {
    name,
    extends: superClassName,
    decorators = [],
    properties = [],
    methods = [],
  } = classObj;

  // Class identifier
  const classId = t.identifier(name);

  // Super class identifier
  const superClassId = superClassName ? t.identifier(superClassName) : null;

  // Class decorators
  const classDecorators = decorators.map(parseDecorator);

  // Class body
  const classBodyMembers = [];

  // Properties
  properties.forEach((prop) => {
    const propDecorators = (prop.decorators || []).map(parseDecorator);
    let valueNode;
    if (propDecorators.length > 0 && String(prop.value) === "null") {
      valueNode = t.tsNonNullExpression(t.nullLiteral());
    } else if (prop.value) {
      valueNode = parser.parseExpression(String(prop.value));
    } else {
      valueNode = null;
    }

    const classProperty = t.classProperty(
      t.identifier(prop.name),
      valueNode,
      prop.type
        ? t.tsTypeAnnotation(t.tsTypeReference(t.identifier(prop.type)))
        : null,
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
  methods.forEach((method) => {
    const {
      name,
      args = "",
      body,
      decorators = [],
      static: isStatic = false,
      accessibility,
      async: isAsync = false,
    } = method;
    const methodDecorators = (decorators || []).map(parseDecorator);

    // Parse arguments string into AST nodes
    const params = args
      ? parser.parse(`(${args}) => {}`).program.body[0].expression.params
      : [];

    const bodyAst = (() => {
      if (!body) return [];
      if (name === "constructor") {
        // For constructor with super(), parse inside a dummy class context.
        const dummyClass = `class __DUMMY__ extends __SUPER__ { constructor(${args}) { ${body} } }`;
        const parsed = parser.parse(dummyClass);
        return parsed.program.body[0].body.body[0].body.body;
      }

      // For async methods, parse inside an async function context
      if (isAsync) {
        const asyncWrapper = `async function __TEMP__(${args}) { ${body} }`;
        const parsed = parser.parse(asyncWrapper);
        return parsed.program.body[0].body.body;
      }

      return parser.parse(body, { allowReturnOutsideFunction: true }).program
        .body;
    })();

    const classMethod = t.classMethod(
      name === "constructor" ? "constructor" : "method",
      t.identifier(name),
      params,
      t.blockStatement(bodyAst),
      false,
      isStatic,
      false, // generator
      isAsync
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

  return classDeclaration;
}

function makeClassCode(ast) {
  return generate(ast, { jsescOption: { minimal: true } }).code;
}
module.exports = {
  makeClassAst,
  makeClassCode,
};

if (require.main === module) {
  const myClassInfo = {
    name: "main",
    extends: "Component",
    decorators: ['ccclass("main")'],
    properties: [
      {
        name: "isLoaded",
        value: "false",
        static: true,
      },
      {
        name: "loadNode",
        value: null,
        type: "Node",
        decorators: ["property(Node)"],
        static: false,
      },
      {
        name: "uiNode",
        value: null,
        type: "Node",
        decorators: ["property(Node)"],
        static: false,
      },
      {
        name: "menu",
        value: null,
        type: "Prefab",
        decorators: ["property(Prefab)"],
        static: false,
      },
      {
        name: "progBar",
        value: null,
        type: "ProgressBar",
        decorators: ["property(ProgressBar)"],
        static: false,
      },
    ],
    methods: [
      {
        name: "start",
        args: "",
        body: "profiler.hideStats();\nif (t.menuNode) {\n  t.menuNode.active = false;\n}\nthis.loadNode.active = !t.isLoaded;\nthis.uiNode.active = false;\nt.isLoaded = true;\nthis.loading();",
        async: false,
      },
      {
        name: "loading",
        args: "",
        body: 'let t, r, n;\n  this.progBar.progress = 0;\n  t = await ResLoader.loadBundle("TestBullet");\n  this.progBar.progress = 0.1;\n  this.sBullet = await ResLoader.loadScene("TestBullet", t);\n  this.progBar.progress = 0.3;\n  r = await ResLoader.loadBundle("TestList");\n  this.progBar.progress = 0.4;\n  this.sList = await ResLoader.loadScene("TestList", r);\n  this.progBar.progress = 0.6;\n  n = await ResLoader.loadBundle("TestUI");\n  this.progBar.progress = 0.7;\n  this.sUI = await ResLoader.loadScene("TestUI", n);\n  this.progBar.progress = 1;\n  this.loadNode.active = false;\n  this.uiNode.active = true;',
        async: true,
      },
      {
        name: "btUI",
        args: "",
        body: "if (this.sUI) {\n  director.runScene(this.sUI);\n}",
        async: false,
      },
      {
        name: "btList",
        args: "",
        body: "if (this.sList) {\n  director.runScene(this.sList);\n}",
        async: false,
      },
      {
        name: "btBullet",
        args: "",
        body: "if (this.sBullet) {\n  director.runScene(this.sBullet);\n}",
        async: false,
      },
    ],
  };

  console.log(makeClassCode(makeClassAst(myClassInfo)));
}
