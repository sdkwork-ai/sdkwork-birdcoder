import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const skipDirectories = new Set(['node_modules', 'dist', 'target', '.git', '.turbo', '.next']);
const violations = [];

function walk(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }

    inspectFile(fullPath);
  }
}

function inspectFile(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node) => {
    if (ts.isCallExpression(node) && isReactEffectCall(node.expression, sourceFile)) {
      const callback = node.arguments[0];
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        inspectEffectCallback(filePath, sourceFile, callback);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function isReactEffectCall(expression, sourceFile) {
  const text = expression.getText(sourceFile);
  return text === 'useEffect' || text === 'useLayoutEffect' || text === 'React.useEffect' || text === 'React.useLayoutEffect';
}

function inspectEffectCallback(filePath, sourceFile, callback) {
  if (!ts.isBlock(callback.body)) {
    pushViolation(
      filePath,
      sourceFile,
      callback.body,
      'Effect callback must use a block body so cleanup behavior stays explicit and unambiguous.',
    );
    return;
  }

  for (const statement of callback.body.statements) {
    if (!ts.isReturnStatement(statement) || !statement.expression) {
      continue;
    }

    if (ts.isCallExpression(statement.expression)) {
      pushViolation(
        filePath,
        sourceFile,
        statement.expression,
        'Effect cleanup must be wrapped in an explicit function instead of returning a call result.',
      );
    }
  }
}

function pushViolation(filePath, sourceFile, node, message) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  violations.push({
    filePath,
    line: line + 1,
    character: character + 1,
    message,
    snippet: node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 240),
  });
}

if (fs.existsSync(packagesDir)) {
  walk(packagesDir);
}

if (violations.length > 0) {
  console.error('Found effect cleanup contract violations:');
  for (const violation of violations) {
    console.error(
      `- ${path.relative(rootDir, violation.filePath)}:${violation.line}:${violation.character} ${violation.message}`,
    );
    console.error(`  ${violation.snippet}`);
  }
  process.exit(1);
}

console.log('Effect cleanup contract passed.');
