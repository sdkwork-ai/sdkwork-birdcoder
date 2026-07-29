import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BirdCoderWorkProviderInstallationError,
  installBirdCoderWorkProvider,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/platform/workProviderInstallation.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function installDesktopInvoke(
  implementation: (command: string, args?: Record<string, unknown>) => Promise<unknown>,
) {
  const invoke = vi.fn(implementation);
  vi.stubGlobal('window', {
    __TAURI_INTERNALS__: { invoke },
  });
  vi.stubGlobal('navigator', {
    platform: 'Win32',
    userAgent: 'Windows',
  });
  return invoke;
}

describe('Work Provider desktop installation', () => {
  it('uses the fixed official OpenClaw baseline and non-interactive installer', async () => {
    const invoke = installDesktopInvoke(async () => ({
      exitCode: 0,
      stdout: 'installed',
      stderr: '',
    }));

    await expect(installBirdCoderWorkProvider('openclaw')).resolves.toMatchObject({
      providerId: 'openclaw',
      baseline: '2026.7.2',
      exitCode: 0,
    });
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith('desktop_local_shell_exec', {
      request: {
        profile: 'powershell',
        commandText: expect.stringMatching(
          /openclaw\.ai\/install\.ps1.*2026\.7\.2.*-NoOnboard/u,
        ),
      },
    });
  });

  it('rejects unknown Provider input before invoking the desktop host', async () => {
    const invoke = installDesktopInvoke(async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
    }));

    await expect(installBirdCoderWorkProvider('openclaw; remove-all')).rejects.toMatchObject({
      code: 'unsupported-provider',
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('surfaces a failed official installer without publishing fake success', async () => {
    installDesktopInvoke(async () => ({
      exitCode: 23,
      stdout: '',
      stderr: 'network unavailable',
    }));

    await expect(installBirdCoderWorkProvider('hermes')).rejects.toEqual(
      expect.objectContaining<BirdCoderWorkProviderInstallationError>({
        code: 'install-failed',
        message: 'network unavailable',
      }),
    );
  });

  it('requires the desktop host instead of simulating installation in a browser', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {
      platform: 'Linux x86_64',
      userAgent: 'Linux',
    });

    await expect(installBirdCoderWorkProvider('openclaw')).rejects.toMatchObject({
      code: 'desktop-required',
    });
  });
});
