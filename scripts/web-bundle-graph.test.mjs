import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findStaticImportCycles,
  parseStaticChunkDependencies,
} from './web-bundle-graph.mjs';

test('static chunk parsing reads imports and re-exports without treating dynamic imports as static', () => {
  const assetNames = new Set(['dependency.js', 're-export.js', 'dynamic.js']);
  const dependencies = parseStaticChunkDependencies({
    assetName: 'entry.js',
    assetNames,
    source: [
      'import { value } from "./dependency.js";',
      'export { other } from "./re-export.js";',
      'const text = `import value from "./dynamic.js"`;',
      'void import("./dynamic.js");',
    ].join('\n'),
  });

  assert.deepEqual(dependencies, ['dependency.js', 're-export.js']);
});

test('static chunk cycle detection returns every cyclic component', () => {
  const graph = new Map([
    ['entry.js', ['feature.js']],
    ['feature.js', ['shared.js']],
    ['shared.js', ['feature.js']],
    ['self.js', ['self.js']],
    ['leaf.js', []],
  ]);

  const cycles = findStaticImportCycles(graph)
    .map((component) => component.sort())
    .sort((left, right) => left.join().localeCompare(right.join()));

  assert.deepEqual(cycles, [
    ['feature.js', 'shared.js'],
    ['self.js'],
  ]);
});

test('static chunk cycle detection accepts a directed acyclic graph', () => {
  const graph = new Map([
    ['entry.js', ['feature.js', 'shared.js']],
    ['feature.js', ['shared.js']],
    ['shared.js', []],
  ]);

  assert.deepEqual(findStaticImportCycles(graph), []);
});
