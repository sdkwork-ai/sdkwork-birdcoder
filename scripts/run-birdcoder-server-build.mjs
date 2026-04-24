import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverManifestPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-server',
  'src-host',
  'Cargo.toml',
);

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    targetTriple: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--target') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --target.');
      }
      options.targetTriple = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

export function buildServerBuildPlan({ targetTriple = '' } = {}) {
  const args = ['build', '--manifest-path', serverManifestPath, '--release'];
  if (String(targetTriple).trim()) {
    args.push('--target', String(targetTriple).trim());
  }

  return {
    command: 'cargo',
    args,
    cwd: rootDir,
    shell: false,
  };
}

export function runServerBuild({ targetTriple = '', runner = spawnSync, env = process.env } = {}) {
  const plan = buildServerBuildPlan({ targetTriple });
  const result = runner(plan.command, plan.args, {
    cwd: plan.cwd,
    stdio: 'inherit',
    shell: plan.shell,
    env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runServerBuild(parseArgs());
}
