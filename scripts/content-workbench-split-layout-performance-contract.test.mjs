import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/ContentWorkbench.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /if \(currentMode !== 'split'\) \{\s*setIsCompactSplitLayout\(\(previousMode\) =>\s*previousMode \? false : previousMode,\s*\);\s*return undefined;\s*\}/s,
  'ContentWorkbench should disable compact split layout tracking outside split mode so edit and preview views do not keep layout observer work alive.',
);

assert.match(
  source,
  /useEffect\(\(\) => \{[\s\S]*const observer = new ResizeObserver\(\(\) => \{/s,
  'ContentWorkbench should continue using ResizeObserver for responsive split layout once split mode is active.',
);

assert.match(
  source,
  /\}, \[currentMode, responsiveSplitBreakpoint\]\);/,
  'ContentWorkbench split layout effect should depend on the active mode so observer work starts and stops with split visibility.',
);

console.log('content workbench split layout performance contract passed.');
