import assert from 'node:assert/strict';
import fs from 'node:fs';

const useProjectsSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts', import.meta.url),
  'utf8',
);

function extractFunctionBody(name) {
  const functionStart = useProjectsSource.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `useProjects must define ${name}.`);
  const bodyStart = useProjectsSource.indexOf('{', functionStart);
  assert.notEqual(bodyStart, -1, `useProjects ${name} must have a body.`);

  let depth = 0;
  for (let index = bodyStart; index < useProjectsSource.length; index += 1) {
    const character = useProjectsSource[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return useProjectsSource.slice(functionStart, index + 1);
      }
    }
  }

  assert.fail(`Unable to extract ${name} body.`);
}

assert.match(
  useProjectsSource,
  /function replaceAgentSessionItemAtIndex\(/,
  'useProjects must centralize indexed Session Item replacement so reconciliation paths do not inline full transcript maps.',
);

const appendBody = extractFunctionBody('appendAgentSessionItemIfMissing');
assert.doesNotMatch(
  appendBody,
  /items\.map\(/,
  'appendAgentSessionItemIfMissing must replace a merged Session Item by index instead of mapping the whole transcript.',
);
assert.match(
  appendBody,
  /\[matchingItemIndex\] = /,
  'appendAgentSessionItemIfMissing should copy only when the matching Session Item actually changes.',
);

const reconcileBody = extractFunctionBody('reconcileAgentSessionItem');
assert.doesNotMatch(
  reconcileBody,
  /items\.filter\(/,
  'reconcileAgentSessionItem must not filter the entire transcript to remove an optimistic Session Item.',
);
assert.doesNotMatch(
  reconcileBody,
  /itemsWithoutOptimistic\.map\(/,
  'reconcileAgentSessionItem must not map the entire transcript when merging the resolved Session Item.',
);

const removeBody = extractFunctionBody('removeAgentSessionItemById');
assert.doesNotMatch(
  removeBody,
  /items\.filter\(/,
  'removeAgentSessionItemById must remove by lazy copy/splice instead of filtering the full transcript.',
);
assert.doesNotMatch(
  removeBody,
  /items\.some\(/,
  'removeAgentSessionItemById must not pre-scan with some before scanning again to remove.',
);

const editHandlerStart = useProjectsSource.indexOf('const editAgentSessionItem = async (');
assert.notEqual(editHandlerStart, -1, 'useProjects must define editAgentSessionItem.');
const deleteHandlerStart = useProjectsSource.indexOf('const deleteAgentSessionItem = async (');
assert.notEqual(deleteHandlerStart, -1, 'useProjects must define deleteAgentSessionItem.');
const editHandlerBody = useProjectsSource.slice(editHandlerStart, deleteHandlerStart);
assert.doesNotMatch(
  editHandlerBody,
  /agentSession\.items\.map\(/,
  'editAgentSessionItem must not project an in-place edit across the local Session Item collection.',
);
assert.match(
  editHandlerBody,
  /Agents session items are immutable and cannot be edited in place\./,
  'editAgentSessionItem must preserve the canonical immutable Agents Session Item boundary.',
);

const submitTurnHandlerStart = useProjectsSource.indexOf('const submitAgentTurnInput = async (');
assert.notEqual(submitTurnHandlerStart, -1, 'useProjects must define submitAgentTurnInput.');
const deleteHandlerBody = useProjectsSource.slice(deleteHandlerStart, submitTurnHandlerStart);
assert.doesNotMatch(
  deleteHandlerBody,
  /agentSession\.items\.filter\(/,
  'deleteAgentSessionItem must not project an in-place deletion across the local Session Item collection.',
);
assert.match(
  deleteHandlerBody,
  /Agents session items are immutable and cannot be deleted in place\./,
  'deleteAgentSessionItem must preserve the canonical immutable Agents Session Item boundary.',
);

console.log('useProjects Session Item mutation boundary contract passed.');
