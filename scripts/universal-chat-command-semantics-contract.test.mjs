import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const activitySummarySource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'chat',
    'messages',
    'activity',
    'ChatActivitySummary.tsx',
  ),
  'utf8',
);

assert.match(
  activitySummarySource,
  /function resolveCommandExecutionTone\(/,
  'UniversalChat must centralize command semantic rendering so user questions and approvals do not duplicate generic command-card markup.',
);

assert.match(
  activitySummarySource,
  /resolveBirdCoderCodeEngineCommandInteractionState\(/,
  'UniversalChat command cards must consume the shared code-engine interaction state resolver.',
);

assert.match(
  activitySummarySource,
  /const interactionState = resolveBirdCoderCodeEngineCommandInteractionState\(cmd\);\s*const isWaitingForReply = interactionState\.requiresReply;\s*const isWaitingForApproval = interactionState\.requiresApproval;/s,
  'UniversalChat command cards must ignore stale wait flags through the shared settled-command interaction state.',
);

assert.doesNotMatch(
  activitySummarySource,
  /cmd\.runtimeStatus === 'awaiting_user'|cmd\.kind === 'user_question'|cmd\.runtimeStatus === 'awaiting_approval'|cmd\.kind === 'approval'/,
  'UniversalChat must not duplicate code-engine waiting-state dialect checks locally.',
);

assert.match(
  activitySummarySource,
  /Needs reply/,
  'UniversalChat must render an explicit user-reply waiting label instead of only a spinner.',
);

assert.match(
  activitySummarySource,
  /Needs approval/,
  'UniversalChat must render an explicit approval waiting label instead of only a spinner.',
);

assert.match(
  activitySummarySource,
  /renderCommandExecutionCard\(/,
  'UniversalChat must render command cards through one shared helper for sidebar and main transcript layouts.',
);

assert.match(
  activitySummarySource,
  /const commandTone = resolveCommandExecutionTone\(cmd\);[\s\S]*resolveCommandExecutionStatusLabel\(commandTone,\s*t\)[\s\S]*resolveCommandExecutionStatusClassName\(commandTone\)[\s\S]*renderCommandStatusIcon\(commandTone,\s*successIconSize\)/,
  'UniversalChat command cards must resolve the command tone once per row and pass it into label, class, and icon helpers.',
);

assert.match(
  activitySummarySource,
  /const commandOutputPreview = isCommandExpanded\s*\?\s*buildCommandOutputPreview\(cmd\.output\)\s*:\s*null;/,
  'UniversalChat command cards must not split large command output while the row is collapsed.',
);

assert.equal(
  (activitySummarySource.match(/renderCommandExecutionCard\(/g) ?? []).length,
  2,
  'UniversalChat should define one shared command-card helper and use it from the shared activity summary rendered by both transcript layouts.',
);

console.log('universal chat command semantics contract passed.');
