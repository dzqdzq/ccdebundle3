const fs = require("fs");
const parser = require("@babel/parser");
const t = require("@babel/types");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const { makeClassAst, makeClassCode } = require("./makeClassAst");

function getTypeFromDecorators(decorators) {
  if (!decorators || !Array.isArray(decorators)) {
    return null;
  }

  const regex1 = /(?:type|property)\s*\(\s*(\w+)\s*\)/;
  const regex2 = /property\s*\(\s*\{[\s\S]*?type\s*:\s*(\w+)/;

  for (const decoratorStr of decorators) {
    let match = decoratorStr.match(regex1);
    if (match && match[1]) {
      return match[1];
    }

    match = decoratorStr.match(regex2);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function getReturnValue(node) {
  if (!node || node.type !== "ObjectExpression") {
    return null;
  }

  const initializerProp = node.properties.find(
    (p) => p.key.name === "initializer"
  );

  if (!initializerProp) {
    return null;
  }

  let functionNode = null;
  if (initializerProp.type === "ObjectMethod") {
    functionNode = initializerProp;
  } else if (initializerProp.type === "ObjectProperty") {
    functionNode = initializerProp.value;
  }

  if (!functionNode || functionNode.type === "NullLiteral") {
    return null;
  }

  if (
    ["FunctionExpression", "ArrowFunctionExpression", "ObjectMethod"].includes(
      functionNode.type
    )
  ) {
    const body = functionNode.body.body;
    if (body) {
      const returnStatement = body.find((s) => s.type === "ReturnStatement");
      if (returnStatement) {
        return generator(returnStatement.argument).code;
      }
    }
  }

  return null;
}

function isClassCode(code) {
  return (
    code.includes("prototype;") ||
    code.includes("static ") ||
    code.includes("inheritsLoose") ||
    code.includes("applyDecoratedDescriptor") ||
    code.includes("class ")
  );
}

function parseClassConstructorAst(constructorAst, classInfo) {
  const { properties } = classInfo;
  // console.log("constructorAst===",constructorAst);
  // 如何遍历constructorAst所有的赋值表达式
  let beginMemberExpression = -1;
  constructorAst.body.forEach((node, idx) => {
    // console.log("constructorAst path===",idx, node);
    if (
      t.isExpressionStatement(node) &&
      t.isAssignmentExpression(node.expression) &&
      t.isMemberExpression(node.expression.left)
    ) {
      console.log(
        "constructorAst path=2==",
        idx,
        node.expression.left,
        node.expression.right
      );
      beginMemberExpression = idx;
      const property = node.expression.left.property.name;
      const value = generator(node.expression.right).code;
      properties.push({
        name: property,
        value,
        static: false,
        accessibility:
          property.startsWith("_") || property.endsWith("_")
            ? "private"
            : "public",
      });
    }else if(beginMemberExpression>0 && !t.isReturnStatement(node)){
      console.log("constructorAst 表达式异常, 未知调用:", node);
      throw new Error("constructorAst 表达式异常, 未知调用");
    }
  });
}

// class e { ... static}
function parseClassAstBody(classBodyAst, classInfo) {
  const constructorAst = classBodyAst.body[0];
  parseClassConstructorAst(constructorAst.body, classInfo);
  for (let i = 1; i < classBodyAst.body.length; i++) {
    const node = classBodyAst.body[i];
    if (!t.isClassMethod(node)) {
      console.warn("parseClassAstBody遇到未知表达式:", node);
      continue;
    }
    classInfo.methods.push({
      name: node.key.name,
      args: node.params.map((param) => generator(param).code).join(","),
      body: node.body.body.map((item) => generator(item).code).join("\n"),
      static: node.static,
    });
  }
}

function processClassAst(codeAst, classInfo) {
  const classCode = generator(codeAst).code;
  if ("AssignmentExpression" !== codeAst.type) {
    throw new Error("Not a class, 期望结构： s = ((t) => {})(Component)");
  }
  const callAst = codeAst.right;
  console.log('callAst:', classCode);
  if ("CallExpression" !== callAst.type) {
    throw new Error(`Not a class, type: ${callAst.type} 期望结构： ((t) => {})(Component)`);
  }

  classInfo.extends = "";
  if (callAst.arguments[0]) {
    classInfo.extends = callAst.arguments[0].name;
  }

  const bodys = callAst.callee.body.body;
  if (classCode.includes("class ") && classCode.includes("static ")) {
    // es6 和 es5混合模式
    console.log("class mode:::", codeAst);
    if (bodys[0].type !== "ClassDeclaration") {
      throw new Error("Not a class, 期望结构： class e { ... static }");
    }
    if (bodys[bodys.length - 1].type !== "ReturnStatement") {
      throw new Error("Not a class, 期望结构： return e");
    }
    // 分析 class xxx { ... }
    parseClassAstBody(bodys[0].body, classInfo);
  } else {
    // es5模式
    if (!t.isFunctionDeclaration(bodys[0])) {
      throw new Error("Not a class, 期望结构： function e() { ... }");
    }
    parseClassConstructorAst(bodys[0].body, classInfo);

    console.log("es5 mode:::bodys:", bodys);
    // console.log("es5 mode:::classInfo:", classInfo);
  }

  for (let i = 1; i < bodys.length - 1; i++) {
    const node = bodys[i];
    if (t.isExpressionStatement(node) && t.isCallExpression(node.expression)) {
      if (node.expression.callee.name === "inheritsLoose") {
        continue;
      }
      throw new Error(
        "未知结构, 理论上应该除了inheritsLoose, 全局是赋值语句-成员函数赋值"
      );
    }
    // const e_prototype = e.prototype;
    if (
      i <= 2 &&
      t.isVariableDeclaration(node) &&
      node.declarations.length === 1
    ) {
      continue;
    }
    if (
      t.isExpressionStatement(node) &&
      t.isAssignmentExpression(node.expression)
    ) {
      const params = node.expression.right.params;
      console.log('node.expression.right====',node.expression.left, node.expression.right);
      classInfo.methods.push({
        name: node.expression.left.property.name,
        args: params.map((param) => generator(param).code).join(","),
        body: node.expression.right.body.body
          .map((item) => generator(item).code)
          .join("\n"),
        static: node.static,
      });
    } else {
      throw new Error(
        "未知结构, 理论上应该除了inheritsLoose, 全局是赋值语句-成员函数赋值"
      );
    }
    console.log("body::1:", i, node);
  } // end for
}

function processDecorators(codeAst, codeAstPath) {
  const properties = [];
  const decorators = [];
  const methods = [];
  const decoratorRef = {};
  const classInfo = {
    properties,
    decorators,
    methods,
  };
  const expressions = codeAst.expressions;
  for (let i = 0; i < expressions.length - 1; i++) {
    const expr = expressions[i];
    if (expr.type === "AssignmentExpression") {
      const name = expr.left.name;
      const value = generator(expr.right).code.replace(/\n/g, "");
      decoratorRef[name] = value;
    } else {
      throw new Error("不应该出现其他非赋值表达式");
    }
  } // end for 提取装饰器信息

  let realClassAst = null;
  let firstPath = null;
  // 获取所有的applyDecoratedDescriptor表达式
  codeAstPath.traverse({
    AssignmentExpression(path) {
      if (path.node.right.type === "CallExpression") {
        const callee = path.node.right.callee;
        if (callee.name === "applyDecoratedDescriptor") {
          if (!firstPath) {
            firstPath = path.parentPath;
          }
          const args = path.node.right.arguments;
          if (args[0].type != "MemberExpression") {
            throw new Error("Unsupported decorator type:" + args[0].type);
          }
          const object = args[0].object;
          if (!realClassAst && object.type === "AssignmentExpression" && isClassCode(generator(object.right).code)) {
            realClassAst = object;
          }
          let decorators = args[2].elements;
          const propName = args[1].value;
          decorators = decorators.map((node) => {
            if (node.type === "Identifier")
              return decoratorRef[node.name] || node.name;
            throw new Error("Unsupported decorator type:" + node.type);
          });
          console.log("type===", decorators);
          const type = getTypeFromDecorators(decorators);
          const init = getReturnValue(args[3]);

          properties.push({
            name: propName,
            value: init,
            type,
            decorators,
            static: false,
          });
          path.remove();
        }
      }else if(path.node.left.type === 'MemberExpression'){
        const object = path.node.left.object;
        if (!realClassAst && object.type === "AssignmentExpression" && isClassCode(generator(object.right).code)) {
          realClassAst = object;
          properties.push({
            name: path.node.left.property.name,
            value: generator(path.node.right).code,
            static: true,
          })
          // console.log("cals rrr==:", path.node.right);
        }
      }
    },
  });

  if (!realClassAst) {
    throw new Error("不应该出现找不到类的情况");
  }

  if (firstPath && realClassAst) {
    let parent = firstPath.parent;
    // 循环目的-类可能存在多个装饰器
    while (parent && parent.type !== "SequenceExpression") {
      if (parent.type !== "CallExpression") {
        // 应该是call expression, 类似ccclass(...)
        throw new Error("Unexpected parent type: " + parent.type);
      }
      const name = parent.callee.name;
      decorators.push(decoratorRef[name] || name);
      console.log("parent:::::", parent);
      parent = parent.parent;
    }
    processClassAst(realClassAst, classInfo);
    // firstPath.replaceWith(realClassAst);
  }

  decorators.reverse();
  return classInfo;
}

function processNonDecorators(codeAst, codeAstPath) {
  const properties = [];
  const decorators = [];
  const methods = [];
  const classInfo = {
    properties,
    decorators,
    methods,
  };
  return classInfo;
}

// 返回classInfo
function analyzeCode(className, codeAst, codeAstPath) {
  const codeStr = generator(codeAst, { jsescOption: { minimal: true } }).code;
  if (!codeStr || !isClassCode(codeStr)) {
    return;
  }

  const classInfo = {
    name: className,
    extends: null,
    decorators: [],
    properties: [],
    methods: [],
  };

  // console.log('codeAst', codeAst.type);
  if (codeAst.type === "SequenceExpression") {
    const lastExpr = codeAst.expressions[codeAst.expressions.length - 1];
    if (lastExpr.type === "LogicalExpression") {
      // 说明包含装饰器类
      Object.assign(classInfo, processDecorators(codeAst, codeAstPath));
    } else {
      console.log('lastExpr.type:::', lastExpr.type)
      // 不包含类装饰器的情况
      Object.assign(classInfo, processNonDecorators(codeAst, codeAstPath));
    }
  }

  console.log("classInfo::", classInfo);
  console.log("----replace Code", generator(codeAst).code);
  if (classInfo) {
      const classAst = makeClassAst(classInfo);
      codeAstPath.scope.removeBinding(className);
      codeAstPath.replaceWith(t.exportNamedDeclaration(classAst, [], null));
  }
}

function getTsCode(code) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: [
      "typescript",
      ["decorators", { decoratorsBeforeExport: true }],
      "classProperties",
    ],
  });

  traverse(ast, {
    ExportNamedDeclaration(path) {
      const declaration = path.node.declaration;
      if (declaration && declaration.type === "VariableDeclaration") {
        declaration.declarations.forEach((declarator) => {
          if (declarator.id.type === "Identifier") {
            const name = declarator.id.name;
            const valueNode = declarator.init;
            analyzeCode(name, valueNode, path);
          }
        });
      }
    },
  });

  return generator(ast, {
    jsescOption: { minimal: true },
    decoratorsBeforeExport: true,
  }).code;
}

module.exports = { getTsCode };
