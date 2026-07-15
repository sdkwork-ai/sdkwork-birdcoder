import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';
import { createChatEngineById } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';
import { createWorkbenchCanonicalChatEngine } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/runtime.ts';
import {
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/coding-session.ts';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readMarkdownBulletList(source: string, heading: string): string[] {
  const headingPattern = new RegExp(
    `^## ${escapeRegExp(heading)}\\r?\\n([\\s\\S]*?)(?=^##\\s|\\Z)`,
    'm',
  );
  const match = source.match(headingPattern);

  assert.ok(match, `Missing markdown section: ${heading}`);

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim().replace(/^`/, '').replace(/`$/, ''));
}

const integrationReferenceSource = await readFile(
  new URL('../docs/reference/engine-sdk-integration.md', import.meta.url),
  'utf8',
);
const eventKindRegistry = new Set<string>(BIRDCODER_CODING_SESSION_EVENT_KINDS);
const artifactKindRegistry = new Set<string>(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS);

assert.deepEqual(
  readMarkdownBulletList(integrationReferenceSource, 'Canonical event kinds'),
  [...BIRDCODER_CODING_SESSION_EVENT_KINDS],
);

assert.deepEqual(
  readMarkdownBulletList(integrationReferenceSource, 'Canonical artifact kinds'),
  [...BIRDCODER_CODING_SESSION_ARTIFACT_KINDS],
);

const messages = [
  {
    id: 'msg-user-1',
    role: 'user' as const,
    content: 'Inspect the workspace and take the next coding action.',
    timestamp: Date.now(),
  },
];

const root = path.resolve(import.meta.dirname, '..');
const kernelBinary = [
  path.join(root, 'target/debug/birdcoder-kernel-turn.exe'),
  path.join(root, 'target/debug/birdcoder-kernel-turn'),
].find((candidate) => existsSync(candidate));
assert.ok(kernelBinary, 'birdcoder-kernel-turn binary must be built');
process.env.BIRDCODER_KERNEL_TURN_BIN = kernelBinary;

await withMockCodexCliJsonl(async () => {
  for (const engine of listWorkbenchCliEngines()) {
    const runtime = createWorkbenchCanonicalChatEngine(createChatEngineById(engine.id), {
      engineId: engine.id,
      defaultModelId: engine.defaultModelId,
      descriptor: engine.descriptor,
    });
    const emittedEventKinds = new Set<string>();

    for await (const event of runtime.sendCanonicalEvents?.(messages, {
      model: engine.defaultModelId,
      context: {
        workspaceRoot: 'D:/workspace',
        currentFile: {
          path: 'src/App.tsx',
          content: 'export default function App() { return null; }',
          language: 'tsx',
        },
      },
    }) ?? []) {
      emittedEventKinds.add(event.kind);
      assert.equal(eventKindRegistry.has(event.kind), true);

      if (event.artifact) {
        assert.equal(artifactKindRegistry.has(event.artifact.kind), true);
      }
    }

    assert.equal(emittedEventKinds.size > 0, true);
    assert.equal(emittedEventKinds.has('turn.completed'), true);
  }
});

console.log('engine canonical registry governance contract passed.');
