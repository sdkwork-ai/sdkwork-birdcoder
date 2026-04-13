#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { parseArgs, smokeDesktopInstallers } from './smoke-desktop-installers.mjs';

export function smokeDesktopPackagedLaunch(options = {}) {
  const result = smokeDesktopInstallers(options);
  return {
    ...result,
    smokeKind: 'packaged-launch-contract',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = smokeDesktopPackagedLaunch(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

