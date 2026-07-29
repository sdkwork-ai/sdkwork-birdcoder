import { resolveBirdCoderTauriInvoke } from './tauriRuntime.ts';

export const BIRDCODER_WORK_PROVIDER_IDS = ['openclaw', 'hermes'] as const;

export type BirdCoderWorkProviderId = (typeof BIRDCODER_WORK_PROVIDER_IDS)[number];

export interface BirdCoderWorkProviderInstallationDefinition {
  providerId: BirdCoderWorkProviderId;
  displayName: string;
  baseline: string;
  installerAuthority: string;
}

export interface BirdCoderWorkProviderInstallationResult {
  providerId: BirdCoderWorkProviderId;
  baseline: string;
  exitCode: number;
  output: string;
}

export type BirdCoderWorkProviderInstallationErrorCode =
  | 'desktop-required'
  | 'install-failed'
  | 'unsupported-provider';

export class BirdCoderWorkProviderInstallationError extends Error {
  readonly code: BirdCoderWorkProviderInstallationErrorCode;

  constructor(code: BirdCoderWorkProviderInstallationErrorCode, message: string) {
    super(message);
    this.name = 'BirdCoderWorkProviderInstallationError';
    this.code = code;
  }
}

interface DesktopLocalShellExecSnapshot {
  exitCode: number;
  stdout: string;
  stderr?: string;
}

interface WorkProviderInstallerPlan {
  profile: 'bash' | 'powershell';
  commandText: string;
}

const OPENCLAW_BASELINE = '2026.7.2';
const HERMES_BASELINE = 'cff9728587da4f3c0beed0786f9bea528e489f13';

const INSTALLATION_DEFINITIONS: Readonly<
  Record<BirdCoderWorkProviderId, BirdCoderWorkProviderInstallationDefinition>
> = {
  openclaw: {
    providerId: 'openclaw',
    displayName: 'OpenClaw',
    baseline: OPENCLAW_BASELINE,
    installerAuthority: 'https://openclaw.ai/install.ps1',
  },
  hermes: {
    providerId: 'hermes',
    displayName: 'Hermes Agent',
    baseline: HERMES_BASELINE,
    installerAuthority: 'https://hermes-agent.nousresearch.com/install.ps1',
  },
};

function isWindowsHost(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /windows|win32|win64/iu.test(`${navigator.userAgent} ${navigator.platform}`);
}

function normalizeProviderId(providerId: string): BirdCoderWorkProviderId {
  const normalized = providerId.trim().toLowerCase();
  if (BIRDCODER_WORK_PROVIDER_IDS.includes(normalized as BirdCoderWorkProviderId)) {
    return normalized as BirdCoderWorkProviderId;
  }
  throw new BirdCoderWorkProviderInstallationError(
    'unsupported-provider',
    `BirdCoder cannot install unsupported Work Provider "${providerId}".`,
  );
}

function resolveInstallerPlan(
  providerId: BirdCoderWorkProviderId,
  windowsHost: boolean,
): WorkProviderInstallerPlan {
  if (windowsHost) {
    if (providerId === 'openclaw') {
      return {
        profile: 'powershell',
        commandText:
          `& ([scriptblock]::Create((Invoke-RestMethod 'https://openclaw.ai/install.ps1'))) -Tag '${OPENCLAW_BASELINE}' -NoOnboard`,
      };
    }
    return {
      profile: 'powershell',
      commandText:
        `& ([scriptblock]::Create((Invoke-RestMethod 'https://hermes-agent.nousresearch.com/install.ps1'))) -SkipSetup -NonInteractive -Commit '${HERMES_BASELINE}'`,
    };
  }

  if (providerId === 'openclaw') {
    return {
      profile: 'bash',
      commandText:
        `curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --no-prompt --no-onboard --version '${OPENCLAW_BASELINE}'`,
    };
  }
  return {
    profile: 'bash',
    commandText:
      `curl -fsSL --proto '=https' --tlsv1.2 https://hermes-agent.nousresearch.com/install.sh | bash -s -- --skip-setup --non-interactive --commit '${HERMES_BASELINE}'`,
  };
}

function resolveFailureDetail(snapshot: DesktopLocalShellExecSnapshot): string {
  return snapshot.stderr?.trim() || snapshot.stdout.trim() || `Installer exited with code ${snapshot.exitCode}.`;
}

export function getBirdCoderWorkProviderInstallationDefinition(
  providerId: string,
): BirdCoderWorkProviderInstallationDefinition {
  return INSTALLATION_DEFINITIONS[normalizeProviderId(providerId)];
}

export async function installBirdCoderWorkProvider(
  providerId: string,
): Promise<BirdCoderWorkProviderInstallationResult> {
  const normalizedProviderId = normalizeProviderId(providerId);
  const definition = INSTALLATION_DEFINITIONS[normalizedProviderId];
  const invoke = await resolveBirdCoderTauriInvoke();
  if (!invoke) {
    throw new BirdCoderWorkProviderInstallationError(
      'desktop-required',
      `${definition.displayName} installation requires the BirdCoder desktop app.`,
    );
  }

  const plan = resolveInstallerPlan(normalizedProviderId, isWindowsHost());
  const snapshot = await invoke<DesktopLocalShellExecSnapshot>('desktop_local_shell_exec', {
    request: {
      profile: plan.profile,
      commandText: plan.commandText,
    },
  });
  if (snapshot.exitCode !== 0) {
    throw new BirdCoderWorkProviderInstallationError(
      'install-failed',
      resolveFailureDetail(snapshot),
    );
  }

  return {
    providerId: normalizedProviderId,
    baseline: definition.baseline,
    exitCode: snapshot.exitCode,
    output: snapshot.stdout.trim(),
  };
}
