import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodeChatEmptyState.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /className=\"flex min-h-full w-full items-center justify-center pb-32/,
  'CodeChatEmptyState must fill the code-mode chat surface without re-declaring a competing outer width frame.',
);

assert.match(
  source,
  /className=\"mx-auto mb-6 flex w-full max-w-2xl flex-col items-center text-center\"/,
  'CodeChatEmptyState content block must stay centered inside the shared chat frame instead of shrinking the whole empty surface.',
);

assert.doesNotMatch(
  source,
  /max-w-3xl|px-4 md:px-8/,
  'CodeChatEmptyState must not duplicate the main chat shell max-width or horizontal padding because Code-mode already provides that frame at the UniversalChat layer.',
);

console.log('code chat empty state layout contract passed.');
