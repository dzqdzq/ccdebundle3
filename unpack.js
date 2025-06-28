const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');

const prettier = require('prettier');

function createImportStatement(dependency, setter) {
  if (!setter) {
    return null;
  }

  const body = setter.toString();
  // This regex finds all assignments like `varName = e.exportedName` (for named exports)
  // or `varName = e` (for default export).
  const assignments = [...body.matchAll(/(\w+)\s*=\s*e(?:\.(\w+))?/g)];

  if (assignments.length === 0) {
    return null;
  }

  const namedImports = [];
  let defaultImport = null;

  for (const match of assignments) {
    const localName = match[1];
    const exportedName = match[2];

    if (exportedName) {
      // It's a named import: `localName = e.exportedName`
      namedImports.push(`${exportedName} as ${localName}`);
    } else {
      // It's a default import: `localName = e`
      defaultImport = localName;
    }
  }

  const parts = ['import'];
  if (defaultImport) {
    parts.push(defaultImport);
  }

  if (namedImports.length > 0) {
    if (defaultImport) {
      parts.push(',');
    }
    parts.push(`{ ${namedImports.join(', ')} }`);
  }

  parts.push(`from '${dependency}';`);

  return parts.join(' ');
}

async function unpack(bundleContent) {
  let registered;
  const sandbox = {
    System: {
      register: (...args) => {
        registered = args;
      },
    },
  };

  const script = new vm.Script(bundleContent);
  script.runInNewContext(sandbox);

  if (!registered) {
    throw new Error('Failed to find System.register call');
  }

  const [moduleName, dependencies, factory] = registered;
  const fileName = moduleName.split('/').pop();

  const moduleDefinition = factory(() => {}, {});

  if (!moduleDefinition || !moduleDefinition.setters || !moduleDefinition.execute) {
    throw new Error('Could not get module definition from factory');
  }

  const importStatements = dependencies
    .map((dep, i) => createImportStatement(dep, moduleDefinition.setters[i]))
    .filter(Boolean); // Filter out any null results

  const executeBody = moduleDefinition.execute
    .toString()
    .replace(/^function\s*\(\)\s*{/, '')
    .replace(/\s*}\s*$/, '');

  const finalCode = [importStatements.join('\n'), executeBody].join('\n\n');

  const formattedCode = await prettier.format(finalCode, {
    parser: 'babel-ts',
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    arrowParens: 'always',
  });

  return { fileName, code: formattedCode };
}

async function main() {
  try {
    const bundlePath = path.join(__dirname, 'exm', 'bundle.js');
    const bundleContent = await fs.readFile(bundlePath, 'utf-8');
    const { fileName, code } = await unpack(bundleContent);
    const outputPath = path.join(__dirname, 'exm', fileName.replace(/\.ts$/, '.unpacked.ts'));
    await fs.writeFile(outputPath, code);
    console.log(`Unpacked code saved to ${outputPath}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
        console.error(`Bundle file not found: ${error.path}`);
    } else {
        console.error("An error occurred in main:", error);
    }
  }
}

main();