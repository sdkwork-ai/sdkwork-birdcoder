import { runBirdCoderPostgresqlLiveSmoke } from './postgresql-live-smoke.ts';

const report = await runBirdCoderPostgresqlLiveSmoke();

console.log(JSON.stringify(report, null, 2));

if (report.status === 'passed') {
  process.exit(0);
}

if (report.status === 'blocked') {
  process.exit(2);
}

process.exit(1);
