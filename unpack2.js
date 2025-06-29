const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

function transformerSystemjs(bundleCode) {
  // 解析SystemJS代码为AST
  const ast = parser.parse(bundleCode, {
    sourceType: "module",
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
  });

  let moduleName = "";
  let dependencies = [];
  let settersInfo = [];
  let executeBody = [];
  let exportCalls = [];

  // 检查第一个语句是否是System.register调用
  const firstStatement = ast.program.body[0];
  if (
    firstStatement &&
    firstStatement.type === "ExpressionStatement" &&
    firstStatement.expression.type === "CallExpression" &&
    firstStatement.expression.callee.type === "MemberExpression" &&
    firstStatement.expression.callee.object.name === "System" &&
    firstStatement.expression.callee.property.name === "register"
  ) {
    const systemRegisterCall = firstStatement.expression;
    const args = systemRegisterCall.arguments;

    if (args.length >= 2) {
      let moduleNameIndex = 0;

      // 检查第一个参数是否是模块名
      if (args[0].type === "StringLiteral") {
        moduleName = args[0].value;
        moduleNameIndex = 1;
      }

      // 依赖数组
      if (
        args[moduleNameIndex] &&
        args[moduleNameIndex].type === "ArrayExpression"
      ) {
        dependencies = args[moduleNameIndex].elements
          .map((dep) => (dep.type === "StringLiteral" ? dep.value : null))
          .filter(Boolean);
      }

      // factory函数
      if (
        args[moduleNameIndex + 1] &&
        args[moduleNameIndex + 1].type === "FunctionExpression"
      ) {
        factoryFunction = args[moduleNameIndex + 1];

        const returnStatement = factoryFunction.body.body.find(
          (stmt) => stmt.type === "ReturnStatement"
        );

        if (
          returnStatement &&
          returnStatement.argument.type === "ObjectExpression"
        ) {
          const returnObject = returnStatement.argument;

          // 查找setters数组
          const settersProperty = returnObject.properties.find(
            (prop) => prop.key.name === "setters"
          );

          if (
            settersProperty &&
            settersProperty.value.type === "ArrayExpression"
          ) {
            settersProperty.value.elements.forEach((setter, index) => {
              if (setter.type === "FunctionExpression" && dependencies[index]) {
                settersInfo.push({
                  dependency: dependencies[index],
                  setterFunction: setter,
                });
              }
            });
          }

          // 查找execute函数
          const executeProperty = returnObject.properties.find(
            (prop) => prop.key.name === "execute"
          );

          if (
            executeProperty &&
            executeProperty.value.type === "FunctionExpression"
          ) {
            executeBody = executeProperty.value.body.body;
          }
        }
      }
    }
  }

  // 分析execute函数体中的导出调用 - 动态查找导出函数调用
  // 首先从factory函数参数中获取导出函数的参数名
  let exportFunctionParam = null;
  if (
    factoryFunction &&
    factoryFunction.params &&
    factoryFunction.params.length > 0
  ) {
    // 通常第一个参数是exports函数
    exportFunctionParam = factoryFunction.params[0].name;
  }

  if (executeBody.length > 0 && exportFunctionParam) {
    executeBody.forEach((stmt) => {
      if (
        stmt.type === "ExpressionStatement" &&
        stmt.expression.type === "CallExpression" &&
        stmt.expression.callee.type === "Identifier" &&
        stmt.expression.callee.name === exportFunctionParam &&
        stmt.expression.arguments.length === 2
      ) {
        // exportFunction("key", value) 调用
        const keyArg = stmt.expression.arguments[0];
        const valueArg = stmt.expression.arguments[1];
        if (keyArg.type === "StringLiteral") {
          // 检查value参数是否是逗号表达式
          if (valueArg.type === 'SequenceExpression') {
            // 处理逗号表达式：将前面的表达式作为独立语句，最后一个作为导出值
            const sequenceExpressions = valueArg.expressions;
            const precedingExpressions = sequenceExpressions.slice(0, -1);
            const finalExpression = sequenceExpressions[sequenceExpressions.length - 1];
            
            exportCalls.push({
              name: keyArg.value,
              value: finalExpression,
              precedingExpressions: precedingExpressions
            });
          } else {
            exportCalls.push({
              name: keyArg.value,
              value: valueArg,
              precedingExpressions: []
            });
          }
        }
      }
    });
  }

  // 生成CommonJS代码
  let result = "";

  // 生成require语句
  settersInfo.forEach((setterInfo, index) => {
    if (setterInfo.dependency && setterInfo.setterFunction) {
      const importMappings = extractImportMappings(setterInfo.setterFunction);
      if (importMappings.length > 0) {
        const destructuring = importMappings.join(",\n");
        result += `var {\n  ${destructuring},\n} = require('${setterInfo.dependency}');\n`;
      }
    }
  });

  // 添加空行
  result += "\n";

  // 生成execute部分的代码
  executeBody.forEach((stmt) => {
    // 跳过导出调用，我们会在最后处理
    if (
      stmt.type === "ExpressionStatement" &&
      stmt.expression.type === "CallExpression" &&
      stmt.expression.callee.type === "Identifier" &&
      exportFunctionParam &&
      stmt.expression.callee.name === exportFunctionParam
    ) {
      return;
    }

    // 生成其他语句
    const code = generate(stmt).code;
    result += code + "\n";
  });

  // 生成module.exports
  if (exportCalls.length > 0) {
    exportCalls.forEach((exportCall) => {
      // 先生成逗号表达式中的前置语句
      if (exportCall.precedingExpressions && exportCall.precedingExpressions.length > 0) {
        exportCall.precedingExpressions.forEach((expr) => {
          const exprCode = generate(expr).code;
          result += `${exprCode};\n`;
        });
      }
      
      // 然后生成最终的导出语句
      const valueCode = generate(exportCall.value).code;
      result += `module.exports["${exportCall.name}"] = ${valueCode};\n`;
    });
  }
  console.log(result);
  return result;
}

// 提取setter函数中的导入映射
function extractImportMappings(setterFunction) {
  const mappings = [];

  // 获取setter函数的参数名（通常是导入对象的参数名）
  let importObjectParam = null;
  if (setterFunction.params && setterFunction.params.length > 0) {
    importObjectParam = setterFunction.params[0].name;
  }

  // 直接分析setter函数体
  if (setterFunction.body && setterFunction.body.body && importObjectParam) {
    setterFunction.body.body.forEach((stmt) => {
      if (stmt.type === "ExpressionStatement") {
        const expr = stmt.expression;

        // 处理序列表达式
        if (expr.type === "SequenceExpression") {
          expr.expressions.forEach((subExpr) => {
            if (
              subExpr.type === "AssignmentExpression" &&
              subExpr.left.type === "Identifier" &&
              subExpr.right.type === "MemberExpression" &&
              subExpr.right.object.type === "Identifier" &&
              subExpr.right.object.name === importObjectParam
            ) {
              const localVar = subExpr.left.name;
              const importedName = subExpr.right.property.name;
              mappings.push(`${importedName}: ${localVar}`);
            }
          });
        }

        // 处理直接的赋值表达式
        if (
          expr.type === "AssignmentExpression" &&
          expr.left.type === "Identifier" &&
          expr.right.type === "MemberExpression" &&
          expr.right.object.type === "Identifier" &&
          expr.right.object.name === importObjectParam
        ) {
          const localVar = expr.left.name;
          const importedName = expr.right.property.name;
          mappings.push(`${importedName}: ${localVar}`);
        }
      }
    });
  }

  return mappings;
}

// 从命令行参数获取输入文件，如果没有提供则使用默认文件
const inputFile = process.argv[2] || "demo.js";
transformerSystemjs(fs.readFileSync(inputFile, "utf8"));
