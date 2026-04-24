import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const studioPageSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-studio',
    'src',
    'pages',
    'StudioPage.tsx',
  ),
  'utf8',
);

assert.match(
  studioPageSource,
  /const handleStudioViewChanges = useCallback\(/,
  'StudioPage must stabilize view-change callbacks so StudioChatSidebar memoization is not invalidated by unrelated workspace state updates.',
);

assert.match(
  studioPageSource,
  /const handleStudioEditMessage = useCallback\(/,
  'StudioPage must stabilize edit-message callbacks so StudioChatSidebar memoization is not invalidated by unrelated workspace state updates.',
);

assert.match(
  studioPageSource,
  /const handleStudioDeleteMessage = useCallback\(/,
  'StudioPage must stabilize delete-message callbacks so StudioChatSidebar memoization is not invalidated by unrelated workspace state updates.',
);

assert.match(
  studioPageSource,
  /const handleStudioRegenerateMessage = useCallback\(/,
  'StudioPage must stabilize regenerate-message callbacks so StudioChatSidebar memoization is not invalidated by unrelated workspace state updates.',
);

assert.match(
  studioPageSource,
  /const handleStudioRestoreMessage = useCallback\(/,
  'StudioPage must stabilize restore-message callbacks so StudioChatSidebar memoization is not invalidated by unrelated workspace state updates.',
);

assert.match(
  studioPageSource,
  /isBusy=\{isChatBusy\}/,
  'StudioPage must pass the derived busy state into StudioChatSidebar so executing-session updates do not depend on transient local send flags.',
);

assert.match(
  studioPageSource,
  /onViewChanges=\{handleStudioViewChanges\}/,
  'StudioPage must pass a stable view-change callback into StudioChatSidebar.',
);

assert.match(
  studioPageSource,
  /onEditMessage=\{handleStudioEditMessage\}/,
  'StudioPage must pass a stable edit-message callback into StudioChatSidebar.',
);

assert.match(
  studioPageSource,
  /onDeleteMessage=\{handleStudioDeleteMessage\}/,
  'StudioPage must pass a stable delete-message callback into StudioChatSidebar.',
);

assert.match(
  studioPageSource,
  /onRegenerateMessage=\{handleStudioRegenerateMessage\}/,
  'StudioPage must pass a stable regenerate-message callback into StudioChatSidebar.',
);

assert.match(
  studioPageSource,
  /onRestoreMessage=\{handleStudioRestoreMessage\}/,
  'StudioPage must pass a stable restore-message callback into StudioChatSidebar.',
);

assert.match(
  studioPageSource,
  /onRestoreMessage=\{handleStudioRestoreMessage\}/,
  'StudioPage must pass a stable restore-message callback into StudioChatSidebar.',
);

assert.doesNotMatch(
  studioPageSource,
  /const handleStudioStopSending = useCallback\(/,
  'StudioPage should not keep a dead stop-sending callback after removing the fake stop interaction.',
);

assert.doesNotMatch(
  studioPageSource,
  /onStopSending=\{handleStudioStopSending\}/,
  'StudioPage should not pass a removed stop-sending callback into StudioChatSidebar.',
);

console.log('studio chat sidebar callback stability contract passed.');
