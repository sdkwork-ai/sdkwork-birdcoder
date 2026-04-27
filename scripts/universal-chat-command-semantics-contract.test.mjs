import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-ui',
    'src',
    'components',
    'UniversalChat.tsx',
  ),
  'utf8',
);

assert.match(
  universalChatSource,
  /function resolveCommandExecutionTone\(/,
  'UniversalChat must centralize command semantic rendering so user questions and approvals do not duplicate generic command-card markup.',
);

assert.match(
  universalChatSource,
  /resolveBirdCoderCodeEngineCommandInteractionState\(/,
  'UniversalChat command cards must consume the shared code-engine interaction state resolver.',
);

assert.match(
  universalChatSource,
  /const interactionState = resolveBirdCoderCodeEngineCommandInteractionState\(cmd\);\s*const isWaitingForReply = interactionState\.requiresReply;\s*const isWaitingForApproval = interactionState\.requiresApproval;/s,
  'UniversalChat command cards must ignore stale wait flags through the shared settled-command interaction state.',
);

assert.doesNotMatch(
  universalChatSource,
  /cmd\.runtimeStatus === 'awaiting_user'|cmd\.kind === 'user_question'|cmd\.runtimeStatus === 'awaiting_approval'|cmd\.kind === 'approval'/,
  'UniversalChat must not duplicate code-engine waiting-state dialect checks locally.',
);

assert.match(
  universalChatSource,
  /Needs reply/,
  'UniversalChat must render an explicit user-reply waiting label instead of only a spinner.',
);

assert.match(
  universalChatSource,
  /Needs approval/,
  'UniversalChat must render an explicit approval waiting label instead of only a spinner.',
);

assert.match(
  universalChatSource,
  /renderCommandExecutionCard\(/,
  'UniversalChat must render command cards through one shared helper for sidebar and main transcript layouts.',
);

assert.equal(
  (universalChatSource.match(/renderCommandExecutionCard\(/g) ?? []).length,
  3,
  'UniversalChat should define one shared command-card helper and call it from the two transcript layouts.',
);

console.log('universal chat command semantics contract passed.');
