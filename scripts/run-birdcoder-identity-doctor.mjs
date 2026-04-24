#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  createBirdcoderIdentityEnvReport,
  parseBirdcoderIdentityEnvCliArgs,
} from './show-birdcoder-identity-env.mjs';

const __filename = fileURLToPath(import.meta.url);

export function createBirdcoderIdentityDoctorReport(options = {}) {
  const envReport = createBirdcoderIdentityEnvReport(options);
  const status = envReport.errors.length > 0 ? 'failed' : 'ok';

  return {
    ...envReport,
    tool: 'run-birdcoder-identity-doctor',
    status,
    checks: [
      {
        id: 'identity-env-normalization',
        status,
      },
      {
        id: 'developer-experience-prefill',
        status:
          envReport.developerExperience?.quickLogin
          || envReport.developerExperience?.quickLoginSample
            ? 'ok'
            : 'skipped',
      },
    ],
  };
}

export function runBirdcoderIdentityDoctor(argv = process.argv.slice(2)) {
  const parsedOptions = parseBirdcoderIdentityEnvCliArgs(argv);
  const report = createBirdcoderIdentityDoctorReport(parsedOptions);

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.errors.length > 0 ? 1 : 0);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runBirdcoderIdentityDoctor();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
