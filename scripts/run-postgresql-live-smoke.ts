import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { runBirdCoderPostgresqlLiveSmoke } from './postgresql-live-smoke.ts';

export async function runBirdCoderPostgresqlLiveSmokeCli(): Promise<number> {
  const report = await runBirdCoderPostgresqlLiveSmoke();

  console.log(JSON.stringify(report, null, 2));

  if (report.status === 'passed') {
    return 0;
  }

  if (report.status === 'blocked') {
    return 2;
  }

  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runBirdCoderPostgresqlLiveSmokeCli()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
