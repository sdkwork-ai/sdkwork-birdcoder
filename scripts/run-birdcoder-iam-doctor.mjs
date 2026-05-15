#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  createBirdcoderIamEnvReport,
  parseBirdcoderIamEnvCliArgs,
} from './show-birdcoder-iam-env.mjs';

const __filename = fileURLToPath(import.meta.url);

export function createBirdcoderIamDoctorReport(options = {}) {
  const envReport = createBirdcoderIamEnvReport(options);
  const status = envReport.errors.length > 0 ? 'failed' : 'ok';

  return {
    ...envReport,
    tool: 'run-birdcoder-iam-doctor',
    status,
    checks: [
      {
        id: 'iam-env-normalization',
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

export function runBirdcoderIamDoctor(argv = process.argv.slice(2)) {
  const parsedOptions = parseBirdcoderIamEnvCliArgs(argv);
  const report = createBirdcoderIamDoctorReport(parsedOptions);

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.errors.length > 0 ? 1 : 0);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runBirdcoderIamDoctor();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
