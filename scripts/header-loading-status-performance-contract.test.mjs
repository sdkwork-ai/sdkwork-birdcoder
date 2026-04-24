import assert from 'node:assert/strict';
import fs from 'node:fs';

const headerLoadingStatusSource = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-shell/src/application/app/HeaderLoadingStatus.tsx',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  headerLoadingStatusSource,
  /useEffect\(\(\) => \{\s*if \(\s*!projectMountRecoveryStartedAt\s*\|\|\s*!isProjectMountRecovering\s*\|\|\s*!showPopover\s*\|\|\s*!isDocumentVisible\s*\) \{\s*return;\s*\}\s*setProjectMountRecoveryTick\(Date\.now\(\)\);/s,
  'HeaderLoadingStatus must only prime the recovery elapsed clock when the recovery popover is visible and the document is foregrounded, otherwise background recovery metadata keeps forcing header re-renders without visible value.',
);

assert.match(
  headerLoadingStatusSource,
  /useEffect\(\(\) => \{\s*if \(!isProjectMountRecovering \|\| !showPopover \|\| !isDocumentVisible\) \{\s*return;\s*\}\s*const intervalId = window\.setInterval\(\(\) => \{\s*setProjectMountRecoveryTick\(Date\.now\(\)\);/s,
  'HeaderLoadingStatus must only run its elapsed-time interval while the recovery popover is expanded and the document is visible, otherwise the shell keeps waking every second without surfacing new information.',
);

console.log('header loading status performance contract passed.');
