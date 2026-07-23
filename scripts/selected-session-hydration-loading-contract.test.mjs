import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const hookSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    
    'sdkwork-birdcoder-pc',
    
    'packages',
    
    'sdkwork-birdcoder-pc-workbench',
    'src',
    'hooks',
    'useSelectedAgentSessionItems.ts',
  ),
  'utf8',
);
const codePageSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    
    'sdkwork-birdcoder-pc',
    
    'packages',
    
    'sdkwork-birdcoder-pc-code',
    'src',
    'pages',
    'CodePage.tsx',
  ),
  'utf8',
);
const studioPageSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    
    'sdkwork-birdcoder-pc',
    
    'packages',
    
    'sdkwork-birdcoder-pc-studio',
    'src',
    'pages',
    'StudioPage.tsx',
  ),
  'utf8',
);

assert.match(
  hookSource,
  /export function useSelectedAgentSessionItems\([\s\S]*\): boolean \{/,
  'useSelectedAgentSessionItems must expose whether the selected session transcript is currently hydrating.',
);

assert.match(
  hookSource,
  /const \[isSelectedAgentSessionItemsLoading,\s*setIsSelectedAgentSessionItemsLoading\] = useState\(false\);/,
  'useSelectedAgentSessionItems must track a local loading state for selected session hydration.',
);

assert.match(
  hookSource,
  /const isMountedRef = useRef\(true\);/,
  'useSelectedAgentSessionItems must track hook mount state separately from per-refresh disposal so stale refreshes can still release shared loading ownership.',
);

assert.match(
  hookSource,
  /if \(isMountedRef\.current && activeSynchronizationCountRef\.current === 0\) \{/,
  'useSelectedAgentSessionItems must clear loading when all refreshes settle, even if the last completed refresh belonged to a previous selected session.',
);

assert.doesNotMatch(
  hookSource,
  /if \(!isDisposed && activeSynchronizationCountRef\.current === 0\) \{/,
  'useSelectedAgentSessionItems must not couple loading release to per-refresh disposal because session switches can otherwise leave hydration stuck.',
);

assert.match(
  hookSource,
  /return isSelectedAgentSessionItemsLoading;/,
  'useSelectedAgentSessionItems must return the selected session hydration state.',
);

assert.match(
  codePageSource,
  /const isSelectedAgentSessionItemsLoading = useSelectedAgentSessionItems\(/,
  'CodePage must consume the selected session hydration state from useSelectedAgentSessionItems.',
);

assert.match(
  codePageSource,
  /const selectedAgentSessionItems = useMemo\(\s*\(\) => \(isNewAgentSessionCreating \? \[\] : selectedAgentSession\?\.messages \?\? \[\]\),\s*\[isNewAgentSessionCreating,\s*selectedAgentSession\?\.messages\],\s*\);/s,
  'CodePage must normalize the visible selected session transcript and mask it to an empty collection while a new coding session is being created.',
);

assert.match(
  codePageSource,
  /const isSelectedAgentSessionHydrating = Boolean\(\s*isNewAgentSessionCreating \|\|[\s\S]*visibleSessionId[\s\S]*isSelectedAgentSessionItemsLoading[\s\S]*selectedAgentSessionItems\.length === 0/s,
  'CodePage must render transcript loading immediately while a new session is being created and while authority history is syncing for an existing visible session.',
);

assert.match(
  studioPageSource,
  /const isSelectedAgentSessionItemsLoading = useSelectedAgentSessionItems\(/,
  'StudioPage must consume the selected session hydration state from useSelectedAgentSessionItems.',
);

assert.match(
  studioPageSource,
  /const selectedSessionMessages = useMemo\(\s*\(\) => selectedSession\?\.messages \?\? EMPTY_STUDIO_CHAT_MESSAGES,\s*\[selectedSession\?\.messages\],\s*\);/s,
  'StudioPage must normalize the selected session transcript into a dedicated derived collection before deciding whether the visible chat is still hydrating.',
);

assert.match(
  studioPageSource,
  /const isSelectedAgentSessionHydrating = Boolean\([\s\S]*isSelectedAgentSessionItemsLoading[\s\S]*selectedSessionMessages\.length === 0/s,
  'StudioPage must derive a session transcript hydration state from the normalized visible message collection so authority-backed transcript sync does not fall through to an empty chat state.',
);

console.log('selected session hydration loading contract passed.');
