import assert from 'node:assert/strict';

import { runServerBuild } from './run-claw-server-build.mjs';

assert.equal(typeof runServerBuild, 'function');

console.log('claw-compatible server build contract passed.');
