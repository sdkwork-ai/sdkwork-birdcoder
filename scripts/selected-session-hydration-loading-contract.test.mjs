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
  /const isSelectedCodingSessionHydrating = Boolean\([\s\S]*isSelectedCodingSessionMessagesLoading[\s\S]*selectedCodingSession\?\.messages\.length === 0/s,
  'CodePage must derive a session transcript hydration state so it can avoid showing an empty prompt while history is still loading.',
);

assert.match(
  studioPageSource,
  /const isSelectedCodingSessionMessagesLoading = useSelectedCodingSessionMessages\(/,
  'StudioPage must consume the selected session hydration state from useSelectedCodingSessionMessages.',
);

assert.match(
  studioPageSource,
  /const isSelectedCodingSessionHydrating = Boolean\([\s\S]*isSelectedCodingSessionMessagesLoading[\s\S]*messages\.length === 0/s,
  'StudioPage must derive a session transcript hydration state so it can avoid showing an empty prompt while history is still loading.',
);

console.log('selected session hydration loading contract passed.');
