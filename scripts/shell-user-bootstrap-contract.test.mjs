import assert from 'node:assert/strict';

const bootstrapModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellUserState.ts',
  import.meta.url,
);
const localStoreModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/storage/localStore.ts',
  import.meta.url,
);
const preferencesModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/preferences.ts',
  import.meta.url,
);
const runConfigsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runConfigStorage.ts',
  import.meta.url,
);
const recoveryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/recovery.ts',
  import.meta.url,
);

const backingStore = new Map();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function resolveRepositoryRawStorageKey(binding) {
  return binding.storageMode === 'table'
    ? `${binding.storageMode}.${binding.preferredProvider}.${binding.storageKey}`
    : binding.storageKey;
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key) {
        return backingStore.has(key) ? backingStore.get(key) : null;
      },
      setItem(key, value) {
        backingStore.set(key, value);
      },
      removeItem(key) {
        backingStore.delete(key);
      },
    },
  },
});

try {
  const bootstrapModule = await import(`${bootstrapModulePath.href}?t=${Date.now()}`);
  const localStoreModule = await import(`${localStoreModulePath.href}?t=${Date.now()}`);
  const preferencesModule = await import(`${preferencesModulePath.href}?t=${Date.now()}`);
  const runConfigsModule = await import(`${runConfigsModulePath.href}?t=${Date.now()}`);
  const recoveryModule = await import(`${recoveryModulePath.href}?t=${Date.now()}`);

  assert.equal(typeof bootstrapModule.bootstrapShellUserState, 'function');
  assert.equal(typeof bootstrapModule.bootstrapProjectWorkbenchState, 'function');

  await bootstrapModule.bootstrapShellUserState();

  assert.notEqual(
    await localStoreModule.getStoredRawValue(
      preferencesModule.getWorkbenchPreferencesRepository().binding.storageScope,
      resolveRepositoryRawStorageKey(
        preferencesModule.getWorkbenchPreferencesRepository().binding,
      ),
    ),
    null,
    'shell bootstrap must persist workbench preferences on first launch',
  );
  assert.notEqual(
    await localStoreModule.getStoredRawValue('workbench', 'recovery-context'),
    null,
    'shell bootstrap must persist a workbench recovery snapshot on first launch',
  );

  const bootstrappedPreferences = await preferencesModule.readWorkbenchPreferences();
  const bootstrappedRecoverySnapshot = recoveryModule.normalizeWorkbenchRecoverySnapshot(
    await localStoreModule.getStoredJson(
      'workbench',
      'recovery-context',
      recoveryModule.DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    ),
  );

  assert.equal(bootstrappedPreferences.codeEngineId, 'codex');
  assert.equal(bootstrappedRecoverySnapshot.activeTab, 'code');
  assert.equal(bootstrappedRecoverySnapshot.cleanExit, true);

  await preferencesModule.writeWorkbenchPreferences({
    codeEngineId: 'gemini',
    codeModelId: 'gemini-1.5-pro',
    terminalProfileId: 'bash',
    defaultWorkingDirectory: 'D:/custom-workspace',
  });
  await localStoreModule.setStoredJson('workbench', 'recovery-context', {
    version: 1,
    sessionId: 'session-custom',
    activeTab: 'terminal',
    activeWorkspaceId: 'workspace-existing',
    activeProjectId: 'project-existing',
    updatedAt: '2026-04-15T12:00:00.000Z',
    cleanExit: false,
  });

  await bootstrapModule.bootstrapShellUserState();

  const preservedPreferences = await preferencesModule.readWorkbenchPreferences();
  const preservedRecoverySnapshot = recoveryModule.normalizeWorkbenchRecoverySnapshot(
    await localStoreModule.getStoredJson(
      'workbench',
      'recovery-context',
      recoveryModule.DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    ),
  );

  assert.equal(
    preservedPreferences.codeEngineId,
    'gemini',
    'shell bootstrap must preserve existing workbench preferences',
  );
  assert.equal(
    preservedRecoverySnapshot.activeProjectId,
    'project-existing',
    'shell bootstrap must preserve an existing recovery snapshot',
  );
  assert.equal(
    preservedRecoverySnapshot.cleanExit,
    false,
    'shell bootstrap must preserve crash-recovery state instead of forcing a clean exit',
  );

  await bootstrapModule.bootstrapProjectWorkbenchState('project-alpha');

  assert.notEqual(
    await localStoreModule.getStoredRawValue(
      runConfigsModule.getRunConfigurationRepository('project-alpha').binding.storageScope,
      resolveRepositoryRawStorageKey(
        runConfigsModule.getRunConfigurationRepository('project-alpha').binding,
      ),
    ),
    null,
    'project bootstrap must persist default run configurations for the active project',
  );

  const bootstrappedRunConfigurations = await runConfigsModule.listStoredRunConfigurations('project-alpha');
  assert.equal(bootstrappedRunConfigurations.length, 3);
  assert.equal(bootstrappedRunConfigurations[0].id, 'dev');

  await runConfigsModule.saveStoredRunConfigurations('project-alpha', [
    {
      id: 'lint',
      name: 'Lint',
      command: 'pnpm lint',
      profileId: 'powershell',
      group: 'custom',
      cwdMode: 'project',
      customCwd: '',
    },
  ]);

  await bootstrapModule.bootstrapProjectWorkbenchState('project-alpha');

  const preservedRunConfigurations = await runConfigsModule.listStoredRunConfigurations('project-alpha');
  assert.equal(
    preservedRunConfigurations[0].id,
    'lint',
    'project bootstrap must preserve existing run configuration records',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
}

console.log('shell user bootstrap contract passed.');
