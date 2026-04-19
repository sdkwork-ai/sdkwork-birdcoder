import assert from 'node:assert/strict';
import fs from 'node:fs';

const resizeHandlePath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/ResizeHandle.tsx',
  import.meta.url,
);
const codePagePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  import.meta.url,
);

const resizeHandleSource = fs.readFileSync(resizeHandlePath, 'utf8');
const codePageSource = fs.readFileSync(codePagePath, 'utf8');

assert.match(
  resizeHandleSource,
  /const onResizeRef = useRef\(onResize\);/,
  'ResizeHandle must hold the latest onResize callback in a ref so drag listeners do not churn during parent rerenders.',
);

assert.match(
  resizeHandleSource,
  /useEffect\(\(\) => \{\s*onResizeRef\.current = onResize;\s*\}, \[onResize\]\);/s,
  'ResizeHandle must keep the onResize ref synchronized with the latest callback.',
);

assert.match(
  resizeHandleSource,
  /onResizeRef\.current\(e\.movementX\);/,
  'ResizeHandle horizontal dragging must route movement through the stable onResize ref.',
);

assert.match(
  resizeHandleSource,
  /onResizeRef\.current\(e\.movementY\);/,
  'ResizeHandle vertical dragging must route movement through the stable onResize ref.',
);

assert.doesNotMatch(
  resizeHandleSource,
  /\[isDragging, direction, onResize\]/,
  'ResizeHandle drag listener effect must not depend on the external onResize callback reference.',
);

assert.match(
  codePageSource,
  /const handleSidebarResize = useCallback\(\(delta: number\) => \{\s*setSidebarWidth\(/s,
  'CodePage must expose sidebar resizing through a stable callback.',
);

assert.match(
  codePageSource,
  /const handleTerminalResize = useCallback\(\(delta: number\) => \{\s*setTerminalHeight\(/s,
  'CodePage must expose terminal resizing through a stable callback.',
);

assert.match(
  codePageSource,
  /<ResizeHandle\s+direction="horizontal"\s+onResize=\{handleSidebarResize\}/s,
  'CodePage must pass the stable sidebar resize callback into ResizeHandle.',
);

assert.match(
  codePageSource,
  /<CodeTerminalIntegrationPanel[\s\S]*onResize=\{handleTerminalResize\}/s,
  'CodePage must pass the stable terminal resize callback into the terminal integration panel.',
);

console.log('resize handle performance contract passed.');
