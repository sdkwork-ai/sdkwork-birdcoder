import assert from 'node:assert/strict';
import {
  listWorkbenchServerImplementedCodeEngines,
} from '@sdkwork/birdcoder-pc-codeengine';
import {
  buildWorkbenchModelPickerId,
  createWorkbenchModelPickerCatalog,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/workbenchModelPickerAdapter.ts';

const engines = listWorkbenchServerImplementedCodeEngines();
const catalog = createWorkbenchModelPickerCatalog(engines);
const expectedModelCount = engines.reduce(
  (count, engine) => count + engine.modelCatalog.length,
  0,
);
const pickerOptions = catalog.groups.flatMap((group) => group.llms);

assert.ok(catalog.groups.length > 0, 'expected at least one model vendor group');
assert.equal(pickerOptions.length, expectedModelCount, 'all code models must reach the picker');
assert.equal(
  new Set(pickerOptions.map((model) => model.id)).size,
  pickerOptions.length,
  'picker ids must be unique across engines and vendors',
);

for (const engine of engines) {
  for (const model of engine.modelCatalog) {
    const pickerId = buildWorkbenchModelPickerId(engine.id, model.id);
    assert.deepEqual(
      catalog.selectionByPickerId.get(pickerId),
      { engineId: engine.id, modelId: model.id },
      `picker selection must resolve ${engine.id}/${model.id}`,
    );
  }
}

console.log('workbench model picker adapter contract passed');
