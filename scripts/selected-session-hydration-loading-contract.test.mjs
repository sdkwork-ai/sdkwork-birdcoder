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
  /const \[isLoading, setIsLoading\] = useState\(false\);/,
  'useSelectedAgentSessionItems must track a local loading state for selected session hydration.',
);

assert.match(
  hookSource,
  /const activeRequestKeyRef = useRef\(''\);[\s\S]*if \(!isActive \|\| !normalizedSessionId \|\| activeRequestKeyRef\.current === requestKey\) \{[\s\S]*activeRequestKeyRef\.current = requestKey;/,
  'useSelectedAgentSessionItems must expose one loading lifecycle per active request key and suppress duplicate refreshes.',
);

assert.match(
  hookSource,
  /let disposed = false;\s*setIsLoading\(true\);[\s\S]*\.finally\(\(\) => \{\s*if \(!disposed\) \{\s*setIsLoading\(false\);\s*\}\s*\}\);[\s\S]*return \(\) => \{\s*disposed = true;\s*\};/,
  'useSelectedAgentSessionItems must set loading before authority refresh, clear it when the active refresh settles, and prevent stale requests from updating observable state.',
);

assert.doesNotMatch(
  hookSource,
  /activeSynchronizationCountRef/,
  'useSelectedAgentSessionItems must not retain the retired shared synchronization counter implementation.',
);

assert.match(
  hookSource,
  /return isLoading;/,
  'useSelectedAgentSessionItems must return the selected session hydration state.',
);

assert.match(
  hookSource,
  /selectedAgentSession\?\.items\.length \?\? 0,[\s\S]*selectedAgentSession\?\.items\.length,/,
  'useSelectedAgentSessionItems refresh identity must observe canonical Agent Session Items rather than a parallel message collection.',
);

assert.match(
  codePageSource,
  /const isSelectedAgentSessionItemsLoading = useSelectedAgentSessionItems\(/,
  'CodePage must consume the selected session hydration state from useSelectedAgentSessionItems.',
);

assert.match(
  codePageSource,
  /const selectedAgentSessionItems = useMemo\(\s*\(\) => \(isNewAgentSessionCreating \? \[\] : selectedAgentSession\?\.items \?\? \[\]\),\s*\[isNewAgentSessionCreating,\s*selectedAgentSession\?\.items\],\s*\);/s,
  'CodePage must normalize the visible selected Session Items and mask them to an empty collection while a new Agent Session is being created.',
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
  /const selectedSessionMessages = useMemo\(\s*\(\) => selectedSession\?\.items \?\? EMPTY_STUDIO_CHAT_MESSAGES,\s*\[selectedSession\?\.items\],\s*\);/s,
  'StudioPage must normalize the selected session transcript into a dedicated derived collection before deciding whether the visible chat is still hydrating.',
);

assert.match(
  studioPageSource,
  /const isSelectedAgentSessionHydrating = Boolean\([\s\S]*isSelectedAgentSessionItemsLoading[\s\S]*selectedSessionMessages\.length === 0/s,
  'StudioPage must derive a session transcript hydration state from the normalized visible message collection so authority-backed transcript sync does not fall through to an empty chat state.',
);

console.log('selected session hydration loading contract passed.');
