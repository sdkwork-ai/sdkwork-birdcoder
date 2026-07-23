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
  /function replaceAgentSessionItemById\(/,
  'useProjects must centralize message replacement so edit and reconcile paths do not inline full transcript maps.',
);

const appendBody = extractFunctionBody('appendAgentSessionItemIfMissing');
assert.doesNotMatch(
  appendBody,
  /messages\.map\(/,
  'appendAgentSessionItemIfMissing must replace a merged message by index instead of mapping the whole transcript.',
);
assert.match(
  appendBody,
  /\[matchingMessageIndex\] = /,
  'appendAgentSessionItemIfMissing should copy only when the matching message actually changes.',
);

const reconcileBody = extractFunctionBody('reconcileAgentSessionItem');
assert.doesNotMatch(
  reconcileBody,
  /messages\.filter\(/,
  'reconcileAgentSessionItem must not filter the entire transcript to remove an optimistic message.',
);
assert.doesNotMatch(
  reconcileBody,
  /messagesWithoutOptimistic\.map\(/,
  'reconcileAgentSessionItem must not map the entire transcript when merging the resolved message.',
);

const removeBody = extractFunctionBody('removeAgentSessionItemById');
assert.doesNotMatch(
  removeBody,
  /messages\.filter\(/,
  'removeAgentSessionItemById must remove by lazy copy/splice instead of filtering the full transcript.',
);
assert.doesNotMatch(
  removeBody,
  /messages\.some\(/,
  'removeAgentSessionItemById must not pre-scan with some before scanning again to remove.',
);

const editHandlerStart = useProjectsSource.indexOf('const editAgentSessionItem = async (');
assert.notEqual(editHandlerStart, -1, 'useProjects must define editAgentSessionItem.');
const deleteHandlerStart = useProjectsSource.indexOf('const deleteAgentSessionItem = async (');
assert.notEqual(deleteHandlerStart, -1, 'useProjects must define deleteAgentSessionItem.');
const editHandlerBody = useProjectsSource.slice(editHandlerStart, deleteHandlerStart);
assert.doesNotMatch(
  editHandlerBody,
  /agentSession\.messages\.map\(/,
  'editAgentSessionItem must call the indexed replacement helper instead of mapping every message.',
);
assert.match(
  editHandlerBody,
  /replaceAgentSessionItemById\(\s*agentSession\.messages,\s*messageId,\s*editableUpdates,\s*\)/s,
  'editAgentSessionItem must use replaceAgentSessionItemById for hot message edits.',
);

const sendHandlerStart = useProjectsSource.indexOf('const sendMessage = async (');
assert.notEqual(sendHandlerStart, -1, 'useProjects must define sendMessage.');
const deleteHandlerBody = useProjectsSource.slice(deleteHandlerStart, sendHandlerStart);
assert.doesNotMatch(
  deleteHandlerBody,
  /agentSession\.messages\.filter\(/,
  'deleteAgentSessionItem must call the lazy remove helper instead of filtering every message.',
);
assert.match(
  deleteHandlerBody,
  /removeAgentSessionItemById\(\s*agentSession\.messages,\s*messageId,\s*\)/s,
  'deleteAgentSessionItem must use removeAgentSessionItemById for hot message deletes.',
);

console.log('useProjects message mutation performance contract passed.');
