import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { runCommandSequence } from './run-command-sequence.mjs';

export const QUALITY_FAST_CHECK_COMMANDS = [
  'node scripts/run-workspace-package-script.mjs . typecheck',
  'node scripts/run-workspace-package-script.mjs . check:workspace-package-script-runner',
  'node scripts/run-workspace-package-script.mjs . check:source-parse',
  'node scripts/run-workspace-package-script.mjs . check:vite-config-esm',
  'node scripts/run-workspace-package-script.mjs . check:vite-build-entry',
  'node scripts/run-workspace-package-script.mjs . check:web-vite-build',
  'node scripts/run-workspace-package-script.mjs . check:vite-windows-realpath',
  'node scripts/run-workspace-package-script.mjs . check:vite-host-preflight',
  'node scripts/run-workspace-package-script.mjs . check:i18n',
  'node scripts/run-workspace-package-script.mjs . check:tauri-rust-toolchain',
  'node scripts/run-workspace-package-script.mjs . check:run-tauri-cli',
  'node scripts/run-workspace-package-script.mjs . check:desktop-tauri-dev',
  'node scripts/run-workspace-package-script.mjs . check:windows-tauri-bundle',
  'node scripts/run-workspace-package-script.mjs . check:tauri-dev-binary-unlock',
  'node scripts/run-workspace-package-script.mjs . check:tauri-target-clean',
  'node scripts/run-workspace-package-script.mjs . check:desktop-vite-host',
  'node scripts/run-workspace-package-script.mjs . check:desktop-standard-vite-server',
  'node scripts/run-workspace-package-script.mjs . check:desktop-react-compat',
  'node scripts/run-workspace-package-script.mjs . check:desktop-startup-graph',
  'node scripts/run-workspace-package-script.mjs . check:ui-dependency-resolution',
  'node scripts/run-workspace-package-script.mjs . check:ui-bundle-segmentation',
  'node scripts/run-workspace-package-script.mjs . check:runtime-symlink-dependency-resolution',
  'node scripts/run-workspace-package-script.mjs . check:tailwind-source',
  'node scripts/run-workspace-package-script.mjs . check:studio-chat-layout',
  'node scripts/run-workspace-package-script.mjs . check:studio-sidebar-stability',
  'node scripts/run-workspace-package-script.mjs . check:studio-stage-header',
  'node scripts/run-workspace-package-script.mjs . check:studio-page-componentization',
  'node scripts/run-workspace-package-script.mjs . check:code-page-componentization',
  'node scripts/run-workspace-package-script.mjs . check:code-editor-surface-boundary',
  'node scripts/run-workspace-package-script.mjs . check:file-system-boundary',
  'node scripts/run-workspace-package-script.mjs . check:code-workbench-command-boundary',
  'node scripts/run-workspace-package-script.mjs . check:code-run-entry-boundary',
  'node scripts/run-workspace-package-script.mjs . check:local-store-browser-fallback',
  'node scripts/run-workspace-package-script.mjs . check:package-governance',
  'node scripts/run-workspace-package-script.mjs . check:package-subpath-exports',
  'node scripts/run-workspace-package-script.mjs . check:governance-baseline',
  'node scripts/run-workspace-package-script.mjs . check:terminal-governance',
  'node scripts/run-workspace-package-script.mjs . check:governance-regression-contract',
  'node scripts/run-workspace-package-script.mjs . check:live-docs-governance-baseline',
  'node scripts/run-workspace-package-script.mjs . check:quality-loop-scoreboard',
  'node scripts/run-workspace-package-script.mjs . test:skill-binding-contract',
  'node scripts/run-workspace-package-script.mjs . test:template-instantiation-contract',
  'node scripts/run-workspace-package-script.mjs . test:prompt-skill-template-runtime-assembly-contract',
  'node scripts/run-workspace-package-script.mjs . test:prompt-skill-template-evidence-repository-contract',
  'node scripts/run-workspace-package-script.mjs . test:prompt-skill-template-evidence-consumer-contract',
  'node scripts/run-workspace-package-script.mjs . test:coding-server-prompt-skill-template-evidence-consumer-contract',
  'node scripts/run-workspace-package-script.mjs . test:postgresql-live-smoke-contract',
  'node scripts/run-workspace-package-script.mjs packages/sdkwork-birdcoder-web lint',
  'node scripts/run-workspace-package-script.mjs . check:arch',
  'node scripts/run-workspace-package-script.mjs . check:sdkwork-birdcoder-structure',
  'node scripts/run-workspace-package-script.mjs . check:release-flow',
  'node scripts/run-workspace-package-script.mjs . check:ci-flow',
];

export function runQualityFastCheck({
  commands = QUALITY_FAST_CHECK_COMMANDS,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  return runCommandSequence({ commands, cwd, env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runQualityFastCheck());
}
