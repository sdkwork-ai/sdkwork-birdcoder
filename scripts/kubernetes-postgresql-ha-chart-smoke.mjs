#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const CHART_DIR = path.join(process.cwd(), 'deployments', 'kubernetes');
const BASE_VALUES = path.join(CHART_DIR, 'values.yaml');
const HA_VALUES = path.join(CHART_DIR, 'values-postgresql-ha.yaml');

function readHelmTemplate(chartDir = CHART_DIR) {
  const helmBinary = process.platform === 'win32' ? 'helm.exe' : 'helm';
  const helm = spawnSync(
    helmBinary,
    [
      'template',
      'sdkwork-birdcoder',
      chartDir,
      '-f',
      BASE_VALUES,
      '-f',
      HA_VALUES,
      '--set',
      'auth.managePassword=smoke-secret',
      '--set',
      'database.url=postgres://birdcoder:smoke-secret@postgresql:5432/birdcoder',
    ],
    { encoding: 'utf8' },
  );

  if (helm.error?.code === 'ENOENT' || helm.status === null) {
    return {
      status: 'blocked',
      reason: 'helm_unavailable',
      message: 'helm CLI is not available on PATH',
    };
  }

  if (helm.status !== 0) {
    return {
      status: 'failed',
      reason: 'helm_template_failed',
      message: helm.stderr?.trim() || helm.stdout?.trim() || 'helm template failed',
    };
  }

  return {
    status: 'passed',
    manifest: helm.stdout,
  };
}

export function smokeKubernetesPostgresqlHaChart({
  chartDir = CHART_DIR,
  baseValuesPath = BASE_VALUES,
  haValuesPath = HA_VALUES,
} = {}) {
  const failures = [];

  if (!fs.existsSync(path.join(chartDir, 'Chart.yaml'))) {
    failures.push(`missing chart manifest: ${path.join(chartDir, 'Chart.yaml')}`);
  }
  if (!fs.existsSync(baseValuesPath)) {
    failures.push(`missing base values: ${baseValuesPath}`);
  }
  if (!fs.existsSync(haValuesPath)) {
    failures.push(`missing HA overlay values: ${haValuesPath}`);
  }

  const deploymentTemplate = fs.readFileSync(
    path.join(chartDir, 'templates', 'deployment.yaml'),
    'utf8',
  );
  if (!deploymentTemplate.includes('configMapRef')) {
    failures.push('deployment template must mount the runtime ConfigMap through envFrom');
  }
  if (!deploymentTemplate.includes('emptyDir: {}')) {
    failures.push('deployment template must support emptyDir volumes when persistence is disabled');
  }

  const rendered = readHelmTemplate(chartDir);
  if (rendered.status === 'blocked') {
    if (failures.length > 0) {
      return {
        status: 'failed',
        reason: 'postgresql_ha_chart_smoke_failed',
        message: failures.join('; '),
        checks: failures.map((detail) => ({ id: 'postgresql-ha-chart', status: 'failed', detail })),
      };
    }

    return {
      status: 'blocked',
      reason: rendered.reason,
      message: rendered.message,
      checks: [{ id: 'static-chart-contract', status: 'passed' }],
    };
  }

  if (rendered.status === 'failed') {
    failures.push(rendered.message);
  } else {
    const manifest = rendered.manifest;
    if (!/kind:\s*HorizontalPodAutoscaler/m.test(manifest)) {
      failures.push('rendered chart must include a HorizontalPodAutoscaler for PostgreSQL HA');
    }
    if (!/SDKWORK_BIRDCODER_DATABASE_ENGINE/m.test(manifest)) {
      failures.push('rendered chart must publish SDKWORK_BIRDCODER_DATABASE_ENGINE');
    }
    if (!/SDKWORK_BIRDCODER_DATABASE_URL/m.test(manifest)) {
      failures.push('rendered chart must publish SDKWORK_BIRDCODER_DATABASE_URL for PostgreSQL');
    }
    if (!/emptyDir:\s*\{\}/m.test(manifest)) {
      failures.push('rendered PostgreSQL HA chart must use emptyDir instead of PVC persistence');
    }
    if (/kind:\s*PersistentVolumeClaim/m.test(manifest)) {
      failures.push('rendered PostgreSQL HA chart must not create a PersistentVolumeClaim');
    }
    if (!/path:\s*\/healthz/m.test(manifest)) {
      failures.push('rendered chart must keep unauthenticated /healthz liveness probes');
    }
    if (!/path:\s*\/readyz/m.test(manifest)) {
      failures.push('rendered chart must keep unauthenticated /readyz readiness probes');
    }
  }

  if (failures.length > 0) {
    return {
      status: 'failed',
      reason: 'postgresql_ha_chart_smoke_failed',
      message: failures.join('; '),
      checks: failures.map((detail) => ({ id: 'postgresql-ha-chart', status: 'failed', detail })),
    };
  }

  return {
    status: 'passed',
    checks: [
      { id: 'static-chart-contract', status: 'passed' },
      { id: 'helm-template', status: 'passed' },
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = smokeKubernetesPostgresqlHaChart();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'failed') {
    process.exitCode = 1;
  }
  if (result.status === 'blocked') {
    process.exitCode = 2;
  }
}
