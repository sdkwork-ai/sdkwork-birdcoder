import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const profilesModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/build/profiles.ts',
  import.meta.url,
);
const runtimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/build/runtime.ts',
  import.meta.url,
);

assert.equal(
  existsSync(profilesModulePath),
  true,
  'Studio build profile registry must exist.',
);
assert.equal(
  existsSync(runtimeModulePath),
  true,
  'Studio build execution runtime must exist.',
);

for (const modulePath of [profilesModulePath, runtimeModulePath]) {
  const absoluteModulePath = fileURLToPath(modulePath);
  const checkIgnoreResult = spawnSync(
    'git',
    ['check-ignore', '--quiet', absoluteModulePath],
    {
      encoding: 'utf8',
      shell: false,
    },
  );

  assert.notEqual(
    checkIgnoreResult.status,
    0,
    `${absoluteModulePath} must be tracked release source, not ignored build output.`,
  );
}

const {
  STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID,
  resolveStudioBuildProfile,
} = await import('../packages/sdkwork-birdcoder-studio/src/build/profiles.ts');
const {
  STUDIO_BUILD_EXECUTION_ADAPTER_ID,
  buildStudioBuildExecutionEvidence,
  resolveStudioBuildExecutionLaunch,
} = await import('../packages/sdkwork-birdcoder-studio/src/build/runtime.ts');

const buildProfile = resolveStudioBuildProfile({
  platform: 'app',
  appPlatform: 'harmony',
});

assert.deepEqual(buildProfile, {
  adapterId: STUDIO_BUILD_PROFILE_REGISTRY_ADAPTER_ID,
  profileId: 'app.harmony',
  platform: 'app',
  targetId: 'app.harmony',
  outputKind: 'application',
  displayName: 'App Harmony',
  evidenceKey: 'build.app.harmony',
});

const launch = await resolveStudioBuildExecutionLaunch(
  buildProfile,
  {
    id: 'build-app',
    name: 'Build Harmony App',
    command: 'pnpm build:app',
    profileId: 'powershell',
    group: 'build',
    cwdMode: 'project',
    customCwd: '',
  },
  {
    projectId: 'project-1',
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 77,
  },
);

assert.deepEqual(launch.request, {
  adapterId: STUDIO_BUILD_EXECUTION_ADAPTER_ID,
  runConfigurationId: 'build-app',
  buildProfile,
  terminalRequest: {
    surface: 'embedded',
    path: '/workspace/demo-project',
    command: 'pnpm build:app',
    profileId: 'powershell',
    timestamp: 77,
  },
  evidence: {
    adapterId: STUDIO_BUILD_EXECUTION_ADAPTER_ID,
    evidenceKey: 'build.app.harmony.launch',
    buildProfileId: 'app.harmony',
    targetId: 'app.harmony',
    outputKind: 'application',
    command: 'pnpm build:app',
    cwd: '/workspace/demo-project',
    profileId: 'powershell',
    projectId: 'project-1',
    runConfigurationId: 'build-app',
    launchedAt: 77,
  },
});

assert.deepEqual(
  buildStudioBuildExecutionEvidence(
    buildProfile,
    {
      surface: 'embedded',
      path: '/workspace/demo-project',
      command: 'pnpm build:app',
      profileId: 'powershell',
      timestamp: 77,
    },
    {
      projectId: 'project-1',
      runConfigurationId: 'build-app',
    },
  ),
  {
    adapterId: STUDIO_BUILD_EXECUTION_ADAPTER_ID,
    evidenceKey: 'build.app.harmony.launch',
    buildProfileId: 'app.harmony',
    targetId: 'app.harmony',
    outputKind: 'application',
    command: 'pnpm build:app',
    cwd: '/workspace/demo-project',
    profileId: 'powershell',
    projectId: 'project-1',
    runConfigurationId: 'build-app',
    launchedAt: 77,
  },
);

const blockedLaunch = await resolveStudioBuildExecutionLaunch(
  buildProfile,
  {
    id: 'build-codex',
    name: 'Build via Codex',
    command: 'pnpm build:app',
    profileId: 'codex',
    group: 'build',
    cwdMode: 'workspace',
    customCwd: '',
  },
  {
    projectId: 'project-1',
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 78,
    cliAvailabilityByProfileId: {
      codex: {
        profileId: 'codex',
        executable: 'codex',
        aliases: ['codex', 'openai-codex'],
        installHint: 'Install Codex CLI and ensure the codex command is on PATH.',
        status: 'missing',
        resolvedExecutable: null,
        checkedAt: 78,
        detectedVia: 'tauri',
      },
    },
  },
);

assert.equal(blockedLaunch.request, null);
assert.deepEqual(blockedLaunch.launchPresentation, {
  canLaunch: false,
  reason: 'Install Codex CLI and ensure the codex command is on PATH.',
  statusLabel: 'Install',
  detailLabel: 'Install Codex CLI and ensure the codex command is on PATH.',
});
assert.deepEqual(blockedLaunch.blockedAction, {
  actionId: 'open-settings',
  actionLabel: 'Open Settings',
});

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const studioExecutionHookSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/useStudioExecutionActions.ts', import.meta.url),
  'utf8',
);
assert.equal(
  studioPageSource.includes("from './useStudioExecutionActions';"),
  true,
  'StudioPage should delegate build execution wiring through the shared studio execution hook.',
);
assert.equal(
  studioExecutionHookSource.includes('resolveStudioBuildExecutionLaunch('),
  true,
  'Studio execution hook should use the shared studio build execution launch contract.',
);
assert.equal(
  studioExecutionHookSource.includes('resolveStudioBuildProfile('),
  true,
  'Studio execution hook should resolve build targets through the build profile registry.',
);

console.log('studio build execution contract passed.');
