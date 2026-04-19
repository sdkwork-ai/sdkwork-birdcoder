import assert from 'node:assert/strict';
import fs from 'node:fs';

const layoutPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/useCodeEditorChatLayout.ts',
  import.meta.url,
);

const layoutSource = fs.readFileSync(layoutPath, 'utf8');

assert.match(
  layoutSource,
  /const CODE_EDITOR_CHAT_WIDTH_PERSIST_DELAY_MS = 160;/,
  'Code editor chat width persistence must be deferred to avoid per-drag storage churn.',
);

assert.match(
  layoutSource,
  /window\.setTimeout\(\s*persist,\s*CODE_EDITOR_CHAT_WIDTH_PERSIST_DELAY_MS,\s*\)/s,
  'Code editor chat width persistence must be scheduled through a delayed commit.',
);

assert.doesNotMatch(
  layoutSource,
  /handleEditorChatResize[\s\S]*updatePreferences\(/,
  'handleEditorChatResize must not persist preferences inline during drag operations.',
);

assert.doesNotMatch(
  layoutSource,
  /const \[editorWorkspaceWidth, setEditorWorkspaceWidth\] = useState\(/,
  'Responsive chat layout must not store raw workspace width in React state because every resize frame would rerender the full code workspace.',
);

assert.match(
  layoutSource,
  /const \[effectiveEditorChatWidth, setEffectiveEditorChatWidth\] = useState\(/,
  'Responsive chat layout must keep only the effective chat width in React state so resize bursts only rerender when the visible split actually changes.',
);

assert.match(
  layoutSource,
  /syncEffectiveEditorChatWidth\(requestedChatWidthRef\.current, nextWidth\)/,
  'Workspace resize handling must compute the next responsive chat width from refs and only commit the effective width.',
);

console.log('chat width persistence performance contract passed.');
