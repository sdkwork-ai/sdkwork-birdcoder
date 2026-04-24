import assert from 'node:assert/strict';
import fs from 'node:fs';

const resizeHandlePath = new URL(
  '../packages/sdkwork-birdcoder-ui-shell/src/components/ResizeHandle.tsx',
  import.meta.url,
);
const codePagePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  import.meta.url,
);
const codePageSurfacePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodePageSurface.tsx',
  import.meta.url,
);
const codePageSurfacePropsPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts',
  import.meta.url,
);

const resizeHandleSource = fs.readFileSync(resizeHandlePath, 'utf8');
const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const codePageSurfaceSource = fs.readFileSync(codePageSurfacePath, 'utf8');
const codePageSurfacePropsSource = fs.readFileSync(codePageSurfacePropsPath, 'utf8');

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
  /const pendingDeltaRef = useRef\(0\);/,
  'ResizeHandle must accumulate drag deltas in a ref so pointer bursts can be coalesced before React updates fire.',
);

assert.match(
  resizeHandleSource,
  /const animationFrameRef = useRef<number \| null>\(null\);/,
  'ResizeHandle must track any scheduled animation frame so resize work can be coalesced and cancelled safely.',
);

assert.match(
  resizeHandleSource,
  /pendingDeltaRef\.current \+= direction === 'horizontal' \? event\.movementX : event\.movementY;/,
  'ResizeHandle must accumulate both horizontal and vertical movement through the shared pending delta buffer.',
);

assert.match(
  resizeHandleSource,
  /animationFrameRef\.current = window\.requestAnimationFrame\(\(\) => \{\s*animationFrameRef\.current = null;\s*flushPendingResize\(\);\s*\}\);/s,
  'ResizeHandle must batch resize flushes onto animation frames during drag bursts.',
);

assert.match(
  resizeHandleSource,
  /onResizeRef\.current\(delta\);/,
  'ResizeHandle must still route flushed drag deltas through the stable onResize ref.',
);

assert.match(
  resizeHandleSource,
  /window\.cancelAnimationFrame\(animationFrameRef\.current\);/s,
  'ResizeHandle must cancel any pending animation frame during drag completion and cleanup.',
);

assert.match(
  resizeHandleSource,
  /flushPendingResize\(\);\s*setIsDragging\(false\);/s,
  'ResizeHandle must flush any remaining drag delta before ending the drag session.',
);

assert.match(
  resizeHandleSource,
  /if \(typeof window === 'undefined'\) \{\s*flushPendingResize\(\);\s*return;\s*\}/s,
  'ResizeHandle must preserve a synchronous fallback when requestAnimationFrame is unavailable.',
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
  /<CodePageSurface[\s\S]*onSidebarResize=\{handleSidebarResize\}/s,
  'CodePage must pass the stable sidebar resize callback into the presentational surface.',
);

assert.match(
  codePageSource,
  /useCodePageSurfaceProps\(\{[\s\S]*onTerminalResize: handleTerminalResize,/s,
  'CodePage must thread the stable terminal resize callback into the surface-props assembler.',
);

assert.match(
  codePageSurfacePropsSource,
  /const terminalProps = useMemo<CodeTerminalIntegrationPanelComponentProps>\(\(\) => \(\{[\s\S]*onResize: onTerminalResize,/s,
  'useCodePageSurfaceProps must preserve the stable terminal resize callback when assembling terminal props.',
);

assert.match(
  codePageSurfaceSource,
  /<ResizeHandle\s+direction="horizontal"\s+onResize=\{onSidebarResize\}/s,
  'CodePageSurface must pass the stable sidebar resize callback into ResizeHandle.',
);

assert.match(
  codePageSurfaceSource,
  /<CodeTerminalIntegrationPanel\s+\{\.\.\.terminalProps\}\s*\/>/s,
  'CodePageSurface must render the terminal integration panel from the stabilized terminal props.',
);

console.log('resize handle performance contract passed.');
