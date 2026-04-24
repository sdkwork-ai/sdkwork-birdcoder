import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-ui-shell/src/components/useRelativeMinuteNow.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  source,
  /function scheduleRelativeMinuteNow\(\): void \{/,
  'useRelativeMinuteNow should centralize timer orchestration in a dedicated scheduler so minute refresh cadence stays consistent across subscribers.',
);

assert.match(
  source,
  /window\.setTimeout\(\(\) => \{\s*relativeMinuteNowTimer = null;\s*scheduleRelativeMinuteNow\(\);\s*\},\s*resolveRelativeMinuteNowDelay\(relativeMinuteNowValue\)\);/s,
  'useRelativeMinuteNow should align the next wake-up to the upcoming minute boundary instead of drifting on a fixed interval.',
);

assert.doesNotMatch(
  source,
  /window\.setInterval\(/,
  'useRelativeMinuteNow must not keep a fixed interval running because hidden tabs and long-lived workspaces should not wake on a drifting global timer.',
);

assert.match(
  source,
  /document\.addEventListener\('visibilitychange', handleRelativeMinuteNowVisibilityChange\);/,
  'useRelativeMinuteNow should observe document visibility so hidden tabs can suspend their shared minute timer.',
);

assert.match(
  source,
  /if \(document\.visibilityState === 'hidden'\) \{\s*disposeRelativeMinuteNowTimer\(\);\s*return;\s*\}/s,
  'useRelativeMinuteNow should stop the shared timer while the document is hidden.',
);

assert.match(
  source,
  /const shouldStartRelativeMinuteNow = relativeMinuteNowListeners\.size === 0;/,
  'useRelativeMinuteNow should detect whether a subscription is the first active listener so additional consumers can reuse the shared timer without restarting it.',
);

assert.match(
  source,
  /if \(shouldStartRelativeMinuteNow \|\| relativeMinuteNowTimer === null\) \{\s*scheduleRelativeMinuteNow\(\);\s*\}/s,
  'useRelativeMinuteNow should only start or recover the shared timer when needed instead of rescheduling on every new subscriber.',
);

console.log('relative minute now performance contract passed.');
