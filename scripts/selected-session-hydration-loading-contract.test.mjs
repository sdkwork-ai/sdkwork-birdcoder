import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const hookSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'hooks',
    'useSelectedCodingSessionMessages.ts',
  ),
  'utf8',
);
const codePageSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-code',
    'src',
    'pages',
    'CodePage.tsx',
  ),
  'utf8',
);
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
  hookSource,
  /export function useSelectedCodingSessionMessages\([\s\S]*\): boolean \{/,
  'useSelectedCodingSessionMessages must expose whether the selected session transcript is currently hydrating.',
);

assert.match(
  hookSource,
  /const \[isSelectedCodingSessionMessagesLoading,\s*setIsSelectedCodingSessionMessagesLoading\] = useState\(false\);/,
  'useSelectedCodingSessionMessages must track a local loading state for selected session hydration.',
);

assert.match(
  hookSource,
  /return isSelectedCodingSessionMessagesLoading;/,
  'useSelectedCodingSessionMessages must return the selected session hydration state.',
);

assert.match(
  codePageSource,
  /const isSelectedCodingSessionMessagesLoading = useSelectedCodingSessionMessages\(/,
  'CodePage must consume the selected session hydration state from useSelectedCodingSessionMessages.',
);

assert.match(
  codePageSource,
  /const selectedCodingSessionMessages = useMemo\(\s*\(\) => selectedCodingSession\?\.messages \?\? \[\],\s*\[selectedCodingSession\?\.messages\],\s*\);/s,
  'CodePage must normalize the selected session transcript into a dedicated derived collection before deciding whether the visible chat is still hydrating.',
);

assert.match(
  codePageSource,
  /const isSelectedCodingSessionHydrating = Boolean\([\s\S]*isSelectedCodingSessionMessagesLoading[\s\S]*selectedCodingSessionMessages\.length === 0/s,
  'CodePage must derive a session transcript hydration state from the normalized visible message collection so missing local session objects still render a loading state while authority history is syncing.',
);

assert.match(
  studioPageSource,
  /const isSelectedCodingSessionMessagesLoading = useSelectedCodingSessionMessages\(/,
  'StudioPage must consume the selected session hydration state from useSelectedCodingSessionMessages.',
);

assert.match(
  studioPageSource,
  /const selectedSessionMessages = useMemo\(\s*\(\) => selectedSession\?\.messages \?\? EMPTY_STUDIO_CHAT_MESSAGES,\s*\[selectedSession\?\.messages\],\s*\);/s,
  'StudioPage must normalize the selected session transcript into a dedicated derived collection before deciding whether the visible chat is still hydrating.',
);

assert.match(
  studioPageSource,
  /const isSelectedCodingSessionHydrating = Boolean\([\s\S]*isSelectedCodingSessionMessagesLoading[\s\S]*selectedSessionMessages\.length === 0/s,
  'StudioPage must derive a session transcript hydration state from the normalized visible message collection so authority-backed transcript sync does not fall through to an empty chat state.',
);

console.log('selected session hydration loading contract passed.');
