import assert from 'node:assert/strict';

import {
  TERMINAL_PROFILE_IDS,
  buildTerminalExecutionPlan,
  tokenizeTerminalCommand,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/profiles.ts';

assert.deepEqual(TERMINAL_PROFILE_IDS, [
  'powershell',
  'cmd',
  'ubuntu',
  'bash',
  'node',
  'codex',
  'claude-code',
  'gemini',
  'opencode',
]);

const powershellPlan = buildTerminalExecutionPlan('powershell', 'Get-ChildItem', 'C:\\repo');
assert.equal(powershellPlan.executable, 'powershell');
assert.deepEqual(powershellPlan.args, ['-NoLogo', '-Command', 'Get-ChildItem']);
assert.equal(powershellPlan.cwd, 'C:\\repo');
assert.equal(powershellPlan.kind, 'shell');

const claudePlan = buildTerminalExecutionPlan('claude-code', 'chat --print "fix bug"', 'C:\\repo');
assert.equal(claudePlan.executable, 'claude');
assert.deepEqual(claudePlan.args, ['chat', '--print', 'fix bug']);
assert.equal(claudePlan.kind, 'cli');

assert.deepEqual(tokenizeTerminalCommand('chat --model sonnet "fix bug"'), [
  'chat',
  '--model',
  'sonnet',
  'fix bug',
]);

console.log('terminal runtime contract passed.');
