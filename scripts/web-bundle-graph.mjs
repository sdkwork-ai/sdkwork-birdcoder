import ts from 'typescript';

function getStaticChunkDependency(statement) {
  if (
    !ts.isImportDeclaration(statement)
    && !ts.isExportDeclaration(statement)
  ) {
    return null;
  }
  const moduleSpecifier = statement.moduleSpecifier;
  if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) {
    return null;
  }
  return moduleSpecifier.text.startsWith('./')
    ? moduleSpecifier.text.slice(2)
    : null;
}

export function parseStaticChunkDependencies({ assetName, assetNames, source }) {
  const sourceFile = ts.createSourceFile(
    assetName,
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  return [
    ...new Set(
      sourceFile.statements
        .map(getStaticChunkDependency)
        .filter((dependency) => dependency !== null)
        .filter((dependency) => assetNames.has(dependency)),
    ),
  ];
}

export function findStaticImportCycles(graph) {
  let nextIndex = 0;
  const activeNodes = new Set();
  const components = [];
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];

  function visit(node) {
    indexes.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    activeNodes.add(node);

    for (const dependency of graph.get(node) ?? []) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(dependency)));
      } else if (activeNodes.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(dependency)));
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) {
      return;
    }
    const component = [];
    let member;
    do {
      member = stack.pop();
      activeNodes.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component);
  }

  for (const node of graph.keys()) {
    if (!indexes.has(node)) {
      visit(node);
    }
  }

  return components.filter(
    (component) =>
      component.length > 1
      || (graph.get(component[0]) ?? []).includes(component[0]),
  );
}
