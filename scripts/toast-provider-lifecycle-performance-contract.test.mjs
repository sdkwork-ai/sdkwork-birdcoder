import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toastProviderSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/contexts/ToastProvider.ts', import.meta.url),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

assert.match(
  toastProviderSource,
  /const MAX_VISIBLE_TOASTS = 4;/,
  'ToastProvider must cap the visible toast queue so bursty task failures do not render an unbounded overlay stack.',
);
assert.match(
  toastProviderSource,
  /const TOAST_AUTO_DISMISS_MS = 3000;/,
  'ToastProvider must centralize auto-dismiss timing so lifecycle cleanup and UX timing stay governed together.',
);
assert.match(
  toastProviderSource,
  /const toastTimeoutsRef = useRef\(new Map<string, ReturnType<typeof setTimeout>>\(\)\);/,
  'ToastProvider must track auto-dismiss timers so manual dismissal and unmount cleanup can cancel pending callbacks.',
);
assert.match(
  toastProviderSource,
  /const toastsRef = useRef<Toast\[\]>\(\[\]\);/,
  'ToastProvider must keep a current toast snapshot so queue capping does not rely on side effects inside React state updaters.',
);
assert.match(
  toastProviderSource,
  /function createToastId\(\): string/,
  'ToastProvider must use a dedicated toast id factory instead of scattering id generation inside addToast.',
);
assert.match(
  toastProviderSource,
  /previousToasts\.slice\(0, overflowCount\)\.forEach\(\(toast\) => clearToastTimeout\(toast\.id\)\);/,
  'ToastProvider must clear timers for overflowed toasts when enforcing the visible queue cap.',
);
assert.match(
  toastProviderSource,
  /const publishToasts = useCallback\(\(nextToasts: Toast\[\]\) => \{[\s\S]*toastsRef\.current = nextToasts;[\s\S]*setToasts\(nextToasts\);/,
  'ToastProvider must publish toast state through a helper that keeps the ref snapshot and React state synchronized.',
);
assert.match(
  toastProviderSource,
  /clearToastTimeout\(id\);[\s\S]*publishToasts\(nextToasts\);/,
  'ToastProvider manual removal must clear the associated auto-dismiss timer before publishing the next toast list.',
);
assert.match(
  toastProviderSource,
  /for \(const timeoutId of toastTimeoutsRef\.current\.values\(\)\) \{[\s\S]*clearTimeout\(timeoutId\);[\s\S]*toastTimeoutsRef\.current\.clear\(\);/,
  'ToastProvider must clear all pending auto-dismiss timers when the provider unmounts.',
);
assert.match(
  packageJson.scripts['check:workbench-activity-performance'] ?? '',
  /toast-provider-lifecycle-performance-contract\.test\.mjs/,
  'Workbench activity performance checks must cover global toast queue and timer lifecycle governance.',
);

console.log('toast provider lifecycle performance contract passed.');
