import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const source = fs.readFileSync(
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

assert.match(
  source,
  /const hadSynchronizedSessionVersion =\s*synchronizedSessionVersionsByScopeKey\.has\(synchronizationScopeKey\);/,
  'selected session refresh must remember whether the session was already synchronized before a polling tick resets the refresh key.',
);

assert.match(
  source,
  /const shouldShowForegroundLoading =[\s\S]*!hadSynchronizedSessionVersion[\s\S]*resolvedCodingSession\.messages\.length === 0/,
  'selected session refresh must only show the foreground loading state for first-time empty transcript hydration.',
);

assert.match(
  source,
  /if \(shouldShowForegroundLoading\) \{[\s\S]*setIsSelectedCodingSessionMessagesLoading/,
  'selected session background polling must not force the visible transcript back into Loading conversation after the session has already synchronized.',
);

console.log('selected session background refresh loading contract passed.');
