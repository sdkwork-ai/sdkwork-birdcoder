import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const codeEditorSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/CodeEditor.tsx', import.meta.url),
  'utf8',
);
const chatCodeBlockSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChatCodeBlock.tsx', import.meta.url),
  'utf8',
);
const skillsPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-skills/src/SkillsPage.tsx', import.meta.url),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

for (const [name, source] of [
  ['CodeEditor', codeEditorSource],
  ['UniversalChatCodeBlock', chatCodeBlockSource],
]) {
  assert.match(
    source,
    /const copyFeedbackTimeoutRef = useRef<number \| null>\(null\);/,
    `${name} must track the copy feedback timeout so repeated copy actions do not accumulate pending state updates.`,
  );
  assert.match(
    source,
    /const clearCopyFeedbackTimeout = useCallback\(\(\) => \{[\s\S]*window\.clearTimeout\(copyFeedbackTimeoutRef\.current\);[\s\S]*copyFeedbackTimeoutRef\.current = null;/,
    `${name} must expose a stable copy feedback timeout cleanup callback.`,
  );
  assert.match(
    source,
    /clearCopyFeedbackTimeout\(\);[\s\S]*copyFeedbackTimeoutRef\.current = window\.setTimeout\(\(\) => \{[\s\S]*setCopied\(false\);[\s\S]*copyFeedbackTimeoutRef\.current = null;/,
    `${name} must cancel any previous copy feedback timeout before scheduling a new one.`,
  );
  assert.match(
    source,
    /useEffect\(\(\) => \(\) => \{[\s\S]*clearCopyFeedbackTimeout\(\);[\s\S]*\}, \[clearCopyFeedbackTimeout\]\);/,
    `${name} must cancel pending copy feedback timeouts when unmounted.`,
  );
  assert.doesNotMatch(
    source,
    /setTimeout\(\(\) => setCopied\(false\)|window\.setTimeout\(\(\) => setCopied\(false\)/,
    `${name} must not use untracked one-shot copy feedback timers.`,
  );
}

assert.match(
  skillsPageSource,
  /const copiedCommandTimeoutRef = useRef<number \| null>\(null\);/,
  'SkillsPage must track the install-command copy feedback timeout so route changes do not leave pending state updates.',
);
assert.match(
  skillsPageSource,
  /const clearCopiedCommandTimeout = useCallback\(\(\) => \{[\s\S]*window\.clearTimeout\(copiedCommandTimeoutRef\.current\);[\s\S]*copiedCommandTimeoutRef\.current = null;/,
  'SkillsPage must expose a stable copied-command timeout cleanup callback.',
);
assert.match(
  skillsPageSource,
  /clearCopiedCommandTimeout\(\);[\s\S]*copiedCommandTimeoutRef\.current = window\.setTimeout\(\(\) => \{[\s\S]*setCopiedCommand\(null\);[\s\S]*copiedCommandTimeoutRef\.current = null;/,
  'SkillsPage must cancel any previous copied-command timeout before scheduling a new one.',
);
assert.match(
  skillsPageSource,
  /useEffect\(\(\) => \(\) => \{[\s\S]*clearCopiedCommandTimeout\(\);[\s\S]*\}, \[clearCopiedCommandTimeout\]\);/,
  'SkillsPage must cancel pending copied-command feedback timeouts when unmounted.',
);
assert.doesNotMatch(
  skillsPageSource,
  /window\.setTimeout\(\(\) => setCopiedCommand\(null\)/,
  'SkillsPage must not use untracked copied-command feedback timers.',
);
assert.match(
  packageJson.scripts['check:workbench-activity-performance'] ?? '',
  /copy-feedback-timer-lifecycle-contract\.test\.mjs/,
  'Workbench activity performance checks must cover copy feedback timer lifecycle governance.',
);

console.log('copy feedback timer lifecycle contract passed.');
