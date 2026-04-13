#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { runServerBuild } from './run-birdcoder-server-build.mjs';

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return '';
  }

  return process.argv[index + 1];
}

export { runServerBuild };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runServerBuild({
    targetTriple: readArg('--target'),
  });
}
