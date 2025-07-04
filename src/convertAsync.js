const parser = require('@babel/parser');
const generate = require('@babel/generator').default;

function convertAsync(funcAst) {
  // 第一个关键点：找到 mark 调用
  const markCall = findMarkCall(funcAst);
  if (!markCall) {
    throw new Error("mark call not found, 不是 async 函数");
  }
  
  const funcXXX = markCall.arguments[0];
  
  // 提取参数
  const args = funcXXX.params.map(p => generate(p).code).join(', ');
  
  // 第二个关键点：处理 funcXXX 的 body，提取变量声明
  const varDeclarations = extractVariableDeclarations(funcXXX.body.body);
  
  // 找到 wrap 调用
  const wrapCall = findWrapCall(funcXXX.body.body);
  if (!wrapCall) {
    return { args: '', funcBody: '' };
  }
  
  // 第三个关键点：处理 wrap 调用中的 switch
  const funcYYY = wrapCall.arguments[0];
  const funcBody = processSwitchStatement(funcYYY.body, varDeclarations);
  
  return { args, funcBody };
}

function findMarkCall(node) {
  if (!node || typeof node !== 'object') return null;
  
  // 检查当前节点是否是 mark 调用
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee?.property?.name === 'mark'
  ) {
    return node;
  }
  
  // 递归搜索
  for (const key in node) {
    if (node.hasOwnProperty(key)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          const result = findMarkCall(item);
          if (result) return result;
        }
      } else if (typeof value === 'object' && value !== null) {
        const result = findMarkCall(value);
        if (result) return result;
      }
    }
  }
  
  return null;
}

function extractVariableDeclarations(bodyStatements) {
  const varNames = [];
  
  for (const stmt of bodyStatements) {
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id && decl.id.name) {
          varNames.push(decl.id.name);
        }
      }
    }
  }
  
  return varNames;
}

function findWrapCall(bodyStatements) {
  for (const stmt of bodyStatements) {
    if (
      stmt.type === 'ReturnStatement' &&
      stmt.argument?.type === 'CallExpression' &&
      stmt.argument?.callee?.type === 'MemberExpression' &&
      stmt.argument?.callee?.property?.name === 'wrap'
    ) {
      return stmt.argument;
    }
  }
  return null;
}

function processSwitchStatement(funcBody, varDeclarations) {
  let result = '';
  
  // 添加变量声明
  if (varDeclarations.length > 0) {
    result += `  let ${varDeclarations.join(', ')};\n`;
  }
  
  // 找到 switch 语句
  const switchStmt = findSwitchStatement(funcBody);
  if (!switchStmt) {
    return result.trim();
  }
  
  let pendingAwaitExpr = null;
  
  for (const c of switchStmt.cases) {
    if (c.test && c.test.type === 'NumericLiteral') {
      // console.log('处理 case:', c.test.value);
      const stmts = (c.consequent[0]?.type === 'BlockStatement' ? c.consequent[0].body : c.consequent);
      
      for (const s of stmts) {
        // 跳过 e.next 赋值
        if (isNextAssignment(s)) {
          continue;
        }
        
        // 处理 x = e.sent 赋值
        if (isSentAssignment(s)) {
          const assignment = generate(s.expression.left).code;
          if (pendingAwaitExpr) {
            result += `  ${assignment} = await ${pendingAwaitExpr};\n`;
            pendingAwaitExpr = null;
          }
          continue;
        }
        
        // 处理 return 语句
        if (s.type === 'ReturnStatement') {
          const awaitExpr = generate(s.argument).code;
          pendingAwaitExpr = awaitExpr;
          continue;
        }
        
        // 处理其他语句
        const stmtCode = generate(s).code;
        result += `  ${stmtCode}\n`;
      }
    }
  }
  
  // 处理最后剩余的 await
  if (pendingAwaitExpr) {
    result += `  await ${pendingAwaitExpr};\n`;
  }
  
  return result.trim();
}

function findSwitchStatement(funcBody) {
  for (const stmt of funcBody.body) {
    if (stmt.type === 'WhileStatement') {
      for (const s of stmt.body.body) {
        if (s.type === 'SwitchStatement') {
          return s;
        }
      }
    }
  }
  return null;
}

function isNextAssignment(stmt) {
  return (
    stmt.type === 'ExpressionStatement' &&
    stmt.expression.type === 'AssignmentExpression' &&
    stmt.expression.left.type === 'MemberExpression' &&
    stmt.expression.left.property.name === 'next'
  );
}

function isSentAssignment(stmt) {
  return (
    stmt.type === 'ExpressionStatement' &&
    stmt.expression.type === 'AssignmentExpression' &&
    stmt.expression.right.type === 'MemberExpression' &&
    stmt.expression.right.property.name === 'sent'
  );
}

module.exports = { convertAsync };

// 测试代码
if (require.main === module) {
  const fs = require('fs');
  
  try {
    const compiledCode = fs.readFileSync('编译后的代码.js', 'utf8');
    console.log('=== 开始解析编译后的代码 ===');
    
    const ast = parser.parse(compiledCode, {
      sourceType: 'script',
      plugins: ['jsx']
    });
    
    console.log('AST 解析成功，查找 aa 变量的初始化...');
    
    // 查找 aa 变量的初始化
    let funcAst = null;
    for (const stmt of ast.program.body) {
      if (
        stmt.type === 'VariableDeclaration' &&
        stmt.declarations.length > 0 &&
        stmt.declarations[0].id.name === 'aa'
      ) {
        funcAst = stmt.declarations[0].init;
        console.log('✓ 找到 aa 变量的初始化');
        break;
      }
    }
    
    if (funcAst) {
      const result = convertAsync(funcAst);
      console.log('\n=== 转换结果 ===');
      console.log('参数:', result.args);
      console.log('函数体:');
      console.log(result.funcBody);
    } else {
      console.log('❌ 未找到 aa 变量的初始化');
    }
  } catch (error) {
    console.error('测试失败:', error);
  }
}