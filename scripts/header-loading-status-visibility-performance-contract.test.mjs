import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-shell/src/application/app/HeaderLoadingStatus.tsx',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  source,
  /const isProjectMountRecovering =\s*projectMountRecoveryNotice\?\.state\.status === 'recovering';/s,
  'HeaderLoadingStatus should derive a dedicated recovery-status boolean so timer effects do not churn on unrelated recovery payload identity changes.',
);

assert.match(
  source,
  /const \[isDocumentVisible, setIsDocumentVisible\] = useState\(\(\) =>[\s\S]*document\.visibilityState !== 'hidden'[\s\S]*\);/s,
  'HeaderLoadingStatus should track whether the document is visible so the elapsed-time clock can pause in hidden tabs.',
);

assert.match(
  source,
  /useEffect\(\(\) => \{\s*if \(!isProjectMountRecovering \|\| !showPopover \|\| typeof document === 'undefined'\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('visibilitychange', syncDocumentVisibility\);/s,
  'HeaderLoadingStatus should only subscribe to visibility changes while the recovery popover is open and actively recovering.',
);

assert.match(
  source,
  /if \(\s*!projectMountRecoveryStartedAt\s*\|\|\s*!isProjectMountRecovering\s*\|\|\s*!showPopover\s*\|\|\s*!isDocumentVisible\s*\) \{\s*return;\s*\}/s,
  'HeaderLoadingStatus must avoid priming the elapsed-time clock while the recovery popover is hidden or the document is backgrounded.',
);

assert.match(
  source,
  /if \(!isProjectMountRecovering \|\| !showPopover \|\| !isDocumentVisible\) \{\s*return;\s*\}/s,
  'HeaderLoadingStatus must pause its one-second elapsed-time interval when the document is hidden.',
);

console.log('header loading status visibility performance contract passed.');
