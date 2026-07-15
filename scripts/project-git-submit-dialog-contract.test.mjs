import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const submitDialogSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitSubmitDialog.tsx',
);
const mutationHookSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-commons',
  'src',
  'hooks',
  'useProjectGitMutationActions.ts',
);
const topBarSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-code',
  'src',
  'components',
  'TopBar.tsx',
);
const studioHeaderSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-studio',
  'src',
  'preview',
  'StudioStageHeader.tsx',
);

assert.match(
  submitDialogSource,
  /if \(!normalizedMessage\) \{[\s\S]*gitCommitMessageRequired[\s\S]*return false;/s,
  'Git submit must reject an empty or whitespace-only commit message before mutation.',
);
assert.match(
  mutationHookSource,
  /const normalizedMessage = message\.trim\(\);[\s\S]*if \(!normalizedMessage\)[\s\S]*Commit message is required/s,
  'The shared mutation hook must independently enforce the required commit message contract.',
);
assert.match(
  submitDialogSource,
  /checked=\{includeUnstaged\}[\s\S]*setIncludeUnstaged\(event\.target\.checked\)/s,
  'Include unstaged must be an interactive checkbox instead of decorative UI.',
);
assert.match(
  submitDialogSource,
  /await commitChanges\(normalizedMessage, \{ includeUnstaged \}\);[\s\S]*await pushBranch\(\{ branchName: currentBranch \}\);/s,
  'Commit and push must commit the selected change scope before pushing the current branch.',
);
assert.match(
  submitDialogSource,
  /setCommittedAwaitingPush\(true\);[\s\S]*gitCommitSucceededPushFailed/s,
  'A push failure after commit must be recorded as a partial success.',
);
assert.match(
  submitDialogSource,
  /if \(committedAwaitingPush\) \{\s*await pushCommittedChanges\(\);\s*return;\s*\}/s,
  'Retry after partial success must push only and never create a duplicate commit.',
);
assert.match(
  submitDialogSource,
  /event\.key === 'Enter' && \(event\.ctrlKey \|\| event\.metaKey\)[\s\S]*submit\(preferredMode\)/s,
  'Git submit must support the standard Ctrl/Cmd+Enter shortcut for the preferred action.',
);
assert.match(
  submitDialogSource,
  /aria-keyshortcuts="Control\+Enter Meta\+Enter"/,
  'Git submit must expose the keyboard shortcut to assistive technology.',
);
assert.match(
  submitDialogSource,
  /id="project-git-commit-message"[\s\S]*required/s,
  'The commit message field must expose its required state in the rendered form semantics.',
);
assert.match(
  submitDialogSource,
  /className="fixed inset-0 z-\[130\]/,
  'Git submit dialog must render above Git diff and header menu surfaces.',
);

for (const [surfaceName, source] of [
  ['Code TopBar', topBarSource],
  ['Studio header', studioHeaderSource],
]) {
  assert.match(
    source,
    /onRequestCommit=\{\(\) => setGitSubmitMode\('commit'\)\}/,
    `${surfaceName} must open the shared commit workflow.`,
  );
  assert.match(
    source,
    /onRequestPush=\{\(\) => setGitSubmitMode\('commitAndPush'\)\}/,
    `${surfaceName} Push must open the message-required commit-and-push workflow.`,
  );
  assert.match(
    source,
    /<ProjectGitSubmitDialog[\s\S]*isOpen=\{gitSubmitMode !== null\}/s,
    `${surfaceName} must render the shared Git submit dialog.`,
  );
  assert.doesNotMatch(
    source,
    /showCommitModal|showPushModal/,
    `${surfaceName} must not retain legacy separate commit or push modals.`,
  );
}

console.log('project git submit dialog contract passed.');
