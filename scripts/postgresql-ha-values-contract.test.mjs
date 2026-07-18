import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { smokeKubernetesPostgresqlHaChart } from './kubernetes-postgresql-ha-chart-smoke.mjs';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const overlaySource = readText('deployments/kubernetes/values-postgresql-ha.yaml');
const deploymentTemplate = readText('deployments/kubernetes/templates/deployment.yaml');
const backupCronJobTemplate = readText('deployments/kubernetes/templates/backup-cronjob.yaml');
const backupPvcTemplate = readText('deployments/kubernetes/templates/backup-pvc.yaml');
const valuesSource = readText('deployments/kubernetes/values.yaml');
const readmeSource = readText('deployments/kubernetes/README.md');

assert.match(
  overlaySource,
  /database:\s*\n\s*engine: postgresql/u,
  'PostgreSQL HA overlay must set database.engine to postgresql.',
);
assert.match(
  overlaySource,
  /persistence:\s*\n\s*enabled: false/u,
  'PostgreSQL HA overlay must disable SQLite PVC persistence.',
);
assert.match(
  overlaySource,
  /autoscaling:\s*\n\s*enabled: true/u,
  'PostgreSQL HA overlay must enable autoscaling.',
);
assert.match(
  overlaySource,
  /minReplicas: 3/u,
  'PostgreSQL HA overlay must set autoscaling.minReplicas to 3 for HA quorum.',
);
assert.match(
  overlaySource,
  /realtime:\s*\n\s*backend: redis/u,
  'PostgreSQL HA overlay must require Redis-backed realtime.',
);
assert.match(
  overlaySource,
  /redis:\s*\n\s*enabled: true/u,
  'PostgreSQL HA overlay must enable Redis.',
);
assert.match(
  deploymentTemplate,
  /configMapRef:/u,
  'Deployment template must mount ConfigMap env vars alongside secrets.',
);
assert.match(
  deploymentTemplate,
  /\{\{- if \.Values\.persistence\.enabled \}\}/u,
  'Deployment template must mount PVC only when persistence is enabled.',
);
assert.match(
  deploymentTemplate,
  /emptyDir: \{\}/u,
  'Deployment template must fall back to emptyDir when persistence is disabled.',
);
assert.match(
  readmeSource,
  /values-postgresql-ha\.yaml/u,
  'Kubernetes README must document the PostgreSQL HA values overlay.',
);
assert.match(
  backupCronJobTemplate,
  /and \.Values\.backup\.enabled \(eq \.Values\.database\.engine "postgresql"\) \(or \.Values\.auth\.existingSecret \.Values\.database\.url\)/u,
  'Backup CronJob must render for Secret-only PostgreSQL deployments.',
);
assert.match(
  backupPvcTemplate,
  /and \.Values\.backup\.enabled \(eq \.Values\.database\.engine "postgresql"\) \(or \.Values\.auth\.existingSecret \.Values\.database\.url\)/u,
  'Backup PVC must render for Secret-only PostgreSQL deployments.',
);
assert.match(
  backupCronJobTemplate,
  /name: VERIFY_DATABASE_URL[\s\S]*secretKeyRef:[\s\S]*key: \{\{ \.Values\.backup\.verifyDatabaseUrlSecretKey/u,
  'Restore verification DSN must come from the configured Kubernetes Secret.',
);
assert.doesNotMatch(
  backupCronJobTemplate,
  /pg_restore[^\r\n]*\|\|/u,
  'Restore verification must not swallow pg_restore failures.',
);
assert.doesNotMatch(
  valuesSource,
  /^\s*verifyDatabaseUrl:\s*/mu,
  'Default values must not expose a plaintext restore verification DSN.',
);
assert.match(
  overlaySource,
  /verifyDatabaseUrlSecretKey: SDKWORK_BIRDCODER_BACKUP_VERIFY_DATABASE_URL/u,
  'PostgreSQL HA overlay must configure the restore verification Secret key.',
);

const smokeResult = smokeKubernetesPostgresqlHaChart();
assert.notEqual(
  smokeResult.status,
  'failed',
  `PostgreSQL HA chart smoke must pass static validation: ${smokeResult.message ?? smokeResult.checks?.map((check) => check.detail).join('; ')}`,
);
if (smokeResult.status === 'blocked') {
  console.log(`postgresql ha chart helm smoke skipped: ${smokeResult.message}`);
}

console.log('postgresql ha values contract passed.');
