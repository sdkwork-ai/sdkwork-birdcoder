import assert from 'node:assert/strict';
import fs from 'node:fs';

const codeSearchSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/codeFileSearch.ts', import.meta.url),
  'utf8',
);
const codeOverlaySource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodeWorkspaceOverlays.tsx', import.meta.url),
  'utf8',
);
const studioSearchSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/studioFileSearch.ts', import.meta.url),
  'utf8',
);
const studioOverlaySource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioWorkspaceOverlays.tsx', import.meta.url),
  'utf8',
);

for (const [label, source, taskName, chunkName, limitName, idleTimeoutName] of [
  [
    'Code quick-open',
    codeSearchSource,
    'createCodeQuickOpenSearchTask',
    'CODE_QUICK_OPEN_SEARCH_CHUNK_SIZE',
    'CODE_QUICK_OPEN_SEARCH_RESULT_LIMIT',
    'CODE_QUICK_OPEN_SEARCH_IDLE_TIMEOUT_MS',
  ],
  [
    'Studio quick-open',
    studioSearchSource,
    'createStudioQuickOpenSearchTask',
    'STUDIO_QUICK_OPEN_SEARCH_CHUNK_SIZE',
    'STUDIO_QUICK_OPEN_SEARCH_RESULT_LIMIT',
    'STUDIO_QUICK_OPEN_SEARCH_IDLE_TIMEOUT_MS',
  ],
]) {
  assert.match(
    source,
    new RegExp(`const ${chunkName} = \\d+;`),
    `${label} must define a bounded chunk size so file-name search cannot monopolize the UI thread.`,
  );
  assert.match(
    source,
    new RegExp(`const ${limitName} = \\d+;`),
    `${label} must cap returned rows so a broad query cannot render thousands of buttons in one frame.`,
  );
  assert.match(
    source,
    new RegExp(`const ${idleTimeoutName} = \\d+;`),
    `${label} must define a bounded idle timeout so broad searches continue to make progress.`,
  );
  assert.match(
    source,
    new RegExp(`function ${taskName}\\(`),
    `${label} must expose a cancellable scheduled search task instead of a synchronous recursive collector.`,
  );
  assert.match(
    source,
    new RegExp(
      `window\\.requestIdleCallback\\(runNextQuickOpenSearchChunk,\\s*\\{\\s*timeout: ${idleTimeoutName},\\s*\\}\\)`,
    ),
    `${label} must prefer idle callbacks between chunks so keystrokes and resize work can run before search continuation.`,
  );
  assert.match(
    source,
    /setTimeout\(runNextQuickOpenSearchChunk, 0\)/,
    `${label} must keep a timer fallback for environments without requestIdleCallback.`,
  );
  assert.match(
    source,
    /window\.cancelIdleCallback\(searchIdleCallbackId\);/,
    `${label} cancellation must cancel pending idle callbacks as well as timer fallback work.`,
  );
}

for (const [label, source, taskName] of [
  ['Code workspace overlays', codeOverlaySource, 'createCodeQuickOpenSearchTask'],
  ['Studio workspace overlays', studioOverlaySource, 'createStudioQuickOpenSearchTask'],
]) {
  assert.match(
    source,
    /const \[quickOpenResults, setQuickOpenResults\] = useState<[^>]+>\(\[\]\);/,
    `${label} must store quick-open results in state so search work runs after React commits the input update.`,
  );
  assert.match(
    source,
    new RegExp(`useEffect\\(\\(\\) => \\{[\\s\\S]*const quickOpenSearchTask = ${taskName}\\(`),
    `${label} must start cancellable quick-open search work from an effect, not the render path.`,
  );
  assert.doesNotMatch(
    source,
    /const quickOpenResults = useMemo\(\(\) => \{[\s\S]*collect[A-Za-z]+QuickOpenResults\(/,
    `${label} must not recursively collect quick-open results inside useMemo during render.`,
  );
}

console.log('quick-open search scheduling performance contract passed.');
