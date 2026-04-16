import assert from 'node:assert/strict';

import { createCodexOfficialSdkBridge } from '../packages/sdkwork-birdcoder-chat-codex/src/index.ts';

const bridge = createCodexOfficialSdkBridge({
  Codex: class BrokenCodex {
    constructor() {
      throw new Error(
        'Unable to locate Codex CLI binaries. Ensure @openai/codex is installed with optional dependencies.',
      );
    }
  },
});

assert.equal(
  bridge,
  null,
  'Codex official SDK bridge must not activate when the mirrored SDK source cannot construct a runnable Codex client.',
);

console.log('codex official sdk binary probe contract passed.');
