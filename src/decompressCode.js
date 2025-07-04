const jscodeshift = require("jscodeshift");

function decompressCode(code) {
  // 解析所有的解构赋值导入语句
  const importMappings = new Map();

  // 找到所有的 require 语句
  const requirePattern = /var\s*\{([^}]+)\}\s*=\s*require\([^)]+\);/g;
  let match;

  while ((match = requirePattern.exec(code)) !== null) {
    const destructureContent = match[1];
    const fullMatch = match[0];

    // 解析解构内容
    const assignments = parseDestructureAssignments(destructureContent);

    // 记录映射关系
    for (const [compressedName, originalName] of assignments) {
      importMappings.set(compressedName, originalName);
    }
  }

  // 使用 jscodeshift 进行 AST 级别的变量替换
  let decompressedCode = code;

  try {
    const ast = jscodeshift(code);

    // 首先处理解构赋值：移除重命名，直接使用原始名称
    ast.find(jscodeshift.VariableDeclarator).forEach((path) => {
      if (path.value.id && path.value.id.type === "ObjectPattern") {
        path.value.id.properties.forEach((prop) => {
          if (
            prop.type === "Property" &&
            prop.key &&
            prop.value &&
            prop.key.type === "Identifier" &&
            prop.value.type === "Identifier"
          ) {
            // 检查是否是重命名的解构赋值（originalName: compressedName）
            // 在demo2.js中格式是 applyDecoratedDescriptor: e，所以key是原始名，value是压缩名
            if (
              importMappings.has(prop.value.name) &&
              prop.key.name !== prop.value.name
            ) {
              // 将 originalName: compressedName 改为 shorthand 形式
              prop.value.name = prop.key.name;
              prop.shorthand = true;
            }
          }
        });
      }
    });

    // 收集所有局部变量声明
    const localVariables = new Set();

    // 收集所有变量声明
    ast.find(jscodeshift.VariableDeclarator).forEach((path) => {
      if (path.value.id && path.value.id.type === "Identifier") {
        localVariables.add(path.value.id.name);
      }
    });

    // 收集函数参数
    ast.find(jscodeshift.Function).forEach((path) => {
      if (path.value.params) {
        path.value.params.forEach((param) => {
          if (param.type === "Identifier") {
            localVariables.add(param.name);
          }
        });
      }
    });

    // 然后遍历所有标识符并替换
    ast.find(jscodeshift.Identifier).forEach((path) => {
      const name = path.value.name;
      if (importMappings.has(name) && !localVariables.has(name)) {
        // 检查是否在对象属性键位置，如果是则不替换
        const parent = path.parent;
        if (
          parent.value.type === "Property" &&
          parent.value.key === path.value
        ) {
          return; // 跳过对象属性键
        }
        if (
          parent.value.type === "MemberExpression" &&
          parent.value.property === path.value &&
          !parent.value.computed
        ) {
          return; // 跳过成员表达式的属性部分
        }

        // 检查是否是变量声明，如果是则不替换（避免替换局部变量）
        if (
          parent.value.type === "VariableDeclarator" &&
          parent.value.id === path.value
        ) {
          return; // 跳过变量声明中的标识符
        }

        // 检查是否是函数参数，如果是则不替换
        if (
          parent.value.type === "FunctionDeclaration" ||
          parent.value.type === "FunctionExpression"
        ) {
          return; // 跳过函数声明中的标识符
        }

        path.value.name = importMappings.get(name);
      }
    });

    // 优化属性访问模式：将 obj.prop1; var x = obj.prop2; 转换为 var {prop1, prop2} = obj;
    optimizePropertyAccess(ast);

    decompressedCode = ast.toSource();
  } catch (error) {
    console.warn("AST 解析失败，回退到原始代码:", error.message);
    decompressedCode = code;
  }

  return decompressedCode;
}

function optimizePropertyAccess(ast) {
  // 收集所有的属性访问模式
  const propertyAccessMap = new Map(); // object -> Set of properties
  const variableAssignments = new Map(); // variable -> {object, property}
  const expressionStatements = []; // 存储需要删除的表达式语句

  // 第一遍：收集特定对象的属性访问表达式
  ast.find(jscodeshift.ExpressionStatement).forEach((path) => {
    const expr = path.value.expression;
    if (expr.type === "MemberExpression" && !expr.computed) {
      const objectName = expr.object.name;
      const propertyName = expr.property.name;

      // 只处理特定对象的属性访问（如 _decorator, cc 等框架对象）
      const targetObjects = ["_decorator", "cc", "cclegacy"];
      if (objectName && propertyName && targetObjects.includes(objectName)) {
        if (!propertyAccessMap.has(objectName)) {
          propertyAccessMap.set(objectName, new Set());
        }
        propertyAccessMap.get(objectName).add(propertyName);
        expressionStatements.push(path);
      }
    }
  });

  // 收集变量赋值：var x = obj.prop（只处理特定对象如 _decorator）
  ast.find(jscodeshift.VariableDeclarator).forEach((path) => {
    const init = path.value.init;
    if (init && init.type === "MemberExpression" && !init.computed) {
      const objectName = init.object.name;
      const propertyName = init.property.name;
      const variableName = path.value.id.name;

      // 只处理特定对象的属性访问（如 _decorator, cc 等框架对象）
      const targetObjects = ["_decorator", "cc", "cclegacy"];
      if (
        objectName &&
        propertyName &&
        variableName &&
        targetObjects.includes(objectName)
      ) {
        if (!propertyAccessMap.has(objectName)) {
          propertyAccessMap.set(objectName, new Set());
        }
        propertyAccessMap.get(objectName).add(propertyName);
        variableAssignments.set(variableName, {
          object: objectName,
          property: propertyName,
        });
      }
    }
  });

  // 为每个对象创建解构赋值
  for (const [objectName, properties] of propertyAccessMap) {
    if (properties.size > 0) {
      // 创建解构赋值声明
      const destructureProperties = Array.from(properties).map((prop) => {
        return jscodeshift.property.from({
          kind: "init",
          key: jscodeshift.identifier(prop),
          value: jscodeshift.identifier(prop),
          shorthand: true,
        });
      });

      const destructureDeclaration = jscodeshift.variableDeclaration("var", [
        jscodeshift.variableDeclarator(
          jscodeshift.objectPattern(destructureProperties),
          jscodeshift.identifier(objectName)
        ),
      ]);

      // 找到第一个相关的语句位置来插入解构赋值
      let insertPosition = null;

      // 查找第一个属性访问语句
      ast.find(jscodeshift.ExpressionStatement).forEach((path) => {
        const expr = path.value.expression;
        if (
          expr.type === "MemberExpression" &&
          expr.object.name === objectName
        ) {
          if (!insertPosition) {
            insertPosition = path;
          }
        }
      });

      // 查找第一个变量赋值语句
      ast.find(jscodeshift.VariableDeclaration).forEach((path) => {
        path.value.declarations.forEach((decl) => {
          if (
            decl.init &&
            decl.init.type === "MemberExpression" &&
            decl.init.object.name === objectName
          ) {
            if (!insertPosition) {
              insertPosition = path;
            }
          }
        });
      });

      if (insertPosition) {
        // 在找到的位置前插入解构赋值
        insertPosition.insertBefore(destructureDeclaration);
      }
    }
  }

  // 删除原始的表达式语句（obj.prop;）
  expressionStatements.forEach((path) => {
    path.prune();
  });

  // 删除原始的变量赋值并替换所有使用
  for (const [variableName, { object, property }] of variableAssignments) {
    // 替换所有对这个变量的引用为属性名
    ast.find(jscodeshift.Identifier).forEach((path) => {
      if (path.value.name === variableName) {
        // 确保不是在变量声明中
        const parent = path.parent;
        if (
          !(
            parent.value.type === "VariableDeclarator" &&
            parent.value.id === path.value
          )
        ) {
          path.value.name = property;
        }
      }
    });

    // 删除原始的变量声明
    ast.find(jscodeshift.VariableDeclarator).forEach((path) => {
      if (
        path.value.id.name === variableName &&
        path.value.init &&
        path.value.init.type === "MemberExpression"
      ) {
        const parentDeclaration = path.parent;
        if (parentDeclaration.value.declarations.length === 1) {
          // 如果这是声明中唯一的变量，删除整个声明
          parentDeclaration.prune();
        } else {
          // 否则只删除这个声明器
          path.prune();
        }
      }
    });
  }
}

function parseDestructureAssignments(destructureContent) {
  const assignments = new Map();

  // 分割并解析每个赋值
  const items = destructureContent.split(",");

  for (const item of items) {
    const trimmed = item.trim();

    // 匹配 originalName: compressedName 格式
    const colonMatch = trimmed.match(/^(\w+):\s*(\w+)$/);
    if (colonMatch) {
      const originalName = colonMatch[1];
      const compressedName = colonMatch[2];
      assignments.set(compressedName, originalName); // 修正：压缩名 -> 原始名
    }
    // 匹配简单的 name 格式（没有重命名）
    else {
      const simpleMatch = trimmed.match(/^(\w+)$/);
      if (simpleMatch) {
        const name = simpleMatch[1];
        assignments.set(name, name);
      }
    }
  }

  return assignments;
}

module.exports = { decompressCode };
