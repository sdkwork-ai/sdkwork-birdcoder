import assert from 'node:assert/strict';

const preferencesModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts',
  import.meta.url,
);
const runConfigsModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts',
  import.meta.url,
);
const sessionsModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/terminal/sessions.ts',
  import.meta.url,
);

const backingStore = new Map();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

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
  const preferencesModule = await import(`${preferencesModulePath.href}?t=${Date.now()}`);
  const runConfigsModule = await import(`${runConfigsModulePath.href}?t=${Date.now()}`);
  const sessionsModule = await import(`${sessionsModulePath.href}?t=${Date.now()}`);

  assert.equal(typeof preferencesModule.getWorkbenchPreferencesRepository, 'function');
  assert.equal(
    preferencesModule.getWorkbenchPreferencesRepository().binding.entityName,
    'workbench_preference',
  );

  await preferencesModule.writeWorkbenchPreferences({
    codeEngineId: 'gemini',
    codeModelId: 'gemini-1.5-pro',
    terminalProfileId: 'gemini',
    defaultWorkingDirectory: 'D:/workspace',
  });
  const preferences = await preferencesModule.readWorkbenchPreferences();
  assert.equal(preferences.codeEngineId, 'gemini');

  assert.equal(typeof runConfigsModule.getRunConfigurationRepository, 'function');
  assert.equal(
    runConfigsModule.getRunConfigurationRepository('project-alpha').binding.entityName,
    'run_configuration',
  );

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
  const runConfigurations = await runConfigsModule.listStoredRunConfigurations('project-alpha');
  assert.equal(runConfigurations[0].id, 'lint');

  assert.equal(typeof sessionsModule.listStoredTerminalSessions, 'function');
  assert.equal(
    'getTerminalSessionRepository' in sessionsModule,
    false,
    'Terminal sessions should no longer expose a BirdCoder-owned repository once sdkwork-terminal runtime inventory is the single source of truth.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
}

console.log('runtime repository contract passed.');
