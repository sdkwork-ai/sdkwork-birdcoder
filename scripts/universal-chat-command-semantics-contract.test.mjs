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
const activityLifecycleSource = fs.readFileSync(
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
    'chatCommandLifecycle.ts',
  ),
  'utf8',
);
const activityAnnouncerSource = fs.readFileSync(
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
    'ChatActivityLiveAnnouncer.tsx',
  ),
  'utf8',
);
const universalChatSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'UniversalChat.tsx',
  ),
  'utf8',
);

assert.match(
  activityLifecycleSource,
  /function resolveChatCommandLifecycleTone\(/,
  'UniversalChat must centralize command semantic rendering so user questions and approvals do not duplicate generic command-card markup.',
);

assert.match(
  activityLifecycleSource,
  /function resolveChatCommandLifecycleTone\([\s\S]*command\.runtimeStatus === 'terminated'[\s\S]*return 'cancelled'[\s\S]*resolveBirdCoderCodeEngineCommandInteractionState\(command\)/,
  'Provider-terminated commands must render as cancelled before the public three-state status can misclassify them as failures.',
);

assert.match(
  activitySummarySource,
  /commandCancelled[\s\S]*<Ban[\s\S]*cancelledCommandCount[\s\S]*commandsCancelledSummary/,
  'Cancelled command rows and summaries must use an explicit neutral label, icon, and aggregate count.',
);

assert.doesNotMatch(
  activitySummarySource,
  /aria-live=|role=\{?['"]status/,
  'Virtualized command summary rows must stay static so remounting history cannot repeat a live announcement.',
);

assert.match(
  activityLifecycleSource,
  /resolveBirdCoderCodeEngineCommandInteractionState\(/,
  'UniversalChat command cards must consume the shared code-engine interaction state resolver.',
);

assert.match(
  activityLifecycleSource,
  /const interactionState = resolveBirdCoderCodeEngineCommandInteractionState\(command\);[\s\S]*interactionState\.requiresReply[\s\S]*interactionState\.requiresApproval/,
  'UniversalChat command cards must ignore stale wait flags through the shared settled-command interaction state.',
);

assert.doesNotMatch(
  activityLifecycleSource,
  /command\.runtimeStatus === 'awaiting_user'|command\.kind === 'user_question'|command\.runtimeStatus === 'awaiting_approval'|command\.kind === 'approval'/,
  'UniversalChat must not duplicate code-engine waiting-state dialect checks locally.',
);

assert.match(
  activityAnnouncerSource,
  /announcementScopeRef[\s\S]*previousScope\.sessionId !== normalizedSessionId[\s\S]*!isActive[\s\S]*!isLive[\s\S]*resolveChatCommandLiveAnnouncement\(/,
  'The command announcer must seed session, inactive, and non-live history as a quiet baseline before publishing state transitions.',
);
assert.match(
  activityAnnouncerSource,
  /aria-atomic="true"[\s\S]*aria-live="polite"[\s\S]*data-chat-activity-live-announcer="true"[\s\S]*role="status"/,
  'One stable atomic polite status surface must own live command announcements.',
);
assert.match(
  activityAnnouncerSource,
  /announcementIdRef\.current \+= 1;[\s\S]*<span key=\{announcement\.id\}>\{announcement\.label\}<\/span>/,
  'Repeated equal status labels must replace a keyed child inside the stable live region instead of depending on a timer that streaming output can starve.',
);
assert.match(
  universalChatSource,
  /<ChatActivityLiveAnnouncer[\s\S]*<div className="relative flex-1 min-h-0 min-w-0">[\s\S]*<UniversalChatTranscript/,
  'UniversalChat must mount the command announcer outside the virtualized transcript rows.',
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
