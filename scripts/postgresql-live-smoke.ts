import { spawn } from 'node:child_process';
import process from 'node:process';

export type BirdCoderPostgresqlLiveSmokeStatus = 'blocked' | 'failed' | 'passed';
export type BirdCoderPostgresqlDsnEnvState = 'configured' | 'empty' | 'missing';

export interface BirdCoderPostgresqlLiveSmokeReport {
  checks: readonly string[];
  dsnCmdSetExample?: string;
  dsnExample?: string;
  dsnEnvPriority: readonly string[];
  dsnEnvStatus?: Record<string, BirdCoderPostgresqlDsnEnvState>;
  dsnPowerShellSetExample?: string;
  dsnSource?: string;
  message: string;
  providerId: 'postgresql';
  reasonCode?: string;
  rerunCommand?: string;
  resolutionSteps?: readonly string[];
  status: BirdCoderPostgresqlLiveSmokeStatus;
}

export interface BirdCoderPostgresqlLiveSmokeConfig {
  dsn?: string;
  dsnSource?: string;
}

export interface BirdCoderPostgresqlCommandOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export type BirdCoderPostgresqlCommandRunner = (
  command: string,
  args: readonly string[],
  options: BirdCoderPostgresqlCommandOptions,
) => Promise<number>;

export interface RunBirdCoderPostgresqlLiveSmokeOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  runCommand?: BirdCoderPostgresqlCommandRunner;
}

export const BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY = [
  'SDKWORK_BIRDCODER_POSTGRES_TEST_URL',
  'BIRDCODER_POSTGRESQL_DSN',
  'BIRDCODER_DATABASE_URL',
  'DATABASE_URL',
  'PGURL',
] as const;

export const BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_COMMAND =
  'pnpm.cmd run release:smoke:postgresql-live';
export const BIRDCODER_POSTGRESQL_DSN_EXAMPLE =
  'postgresql://<user>:<password>@<host>:5432/<database>';
export const BIRDCODER_POSTGRESQL_DSN_CMD_SET_EXAMPLE =
  `set SDKWORK_BIRDCODER_POSTGRES_TEST_URL=${BIRDCODER_POSTGRESQL_DSN_EXAMPLE}`;
export const BIRDCODER_POSTGRESQL_DSN_POWERSHELL_SET_EXAMPLE =
  `$env:SDKWORK_BIRDCODER_POSTGRES_TEST_URL='${BIRDCODER_POSTGRESQL_DSN_EXAMPLE}'`;

export const BIRDCODER_POSTGRESQL_REPOSITORY_TEST_ARGS = [
  'test',
  '-p',
  'sdkwork-birdcoder-workspace-repository-sqlx',
  '--tests',
  '--',
  '--ignored',
  '--nocapture',
] as const;

export function resolveBirdCoderPostgresqlDsnEnvStatus(
  env: Record<string, string | undefined> = process.env,
): Record<string, BirdCoderPostgresqlDsnEnvState> {
  return Object.fromEntries(
    BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY.map((key) => {
      const value = env[key];
      if (value === undefined) {
        return [key, 'missing'];
      }
      return [key, value.trim() ? 'configured' : 'empty'];
    }),
  ) as Record<string, BirdCoderPostgresqlDsnEnvState>;
}

export function resolveBirdCoderPostgresqlLiveSmokeConfig(
  env: Record<string, string | undefined> = process.env,
): BirdCoderPostgresqlLiveSmokeConfig {
  for (const key of BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY) {
    const dsn = env[key]?.trim();
    if (dsn) {
      return { dsn, dsnSource: key };
    }
  }
  return {};
}

async function runCommand(
  command: string,
  args: readonly string[],
  options: BirdCoderPostgresqlCommandOptions,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (exitCode, signal) => {
      if (signal) {
        reject(new Error(`PostgreSQL live smoke terminated by ${signal}.`));
        return;
      }
      resolve(exitCode ?? 1);
    });
  });
}

export async function runBirdCoderPostgresqlLiveSmoke(
  options: RunBirdCoderPostgresqlLiveSmokeOptions = {},
): Promise<BirdCoderPostgresqlLiveSmokeReport> {
  const env = options.env ?? process.env;
  const config = resolveBirdCoderPostgresqlLiveSmokeConfig(env);
  const dsnEnvPriority = [...BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY];
  if (!config.dsn) {
    return {
      checks: [],
      dsnCmdSetExample: BIRDCODER_POSTGRESQL_DSN_CMD_SET_EXAMPLE,
      dsnExample: BIRDCODER_POSTGRESQL_DSN_EXAMPLE,
      dsnEnvPriority,
      dsnEnvStatus: resolveBirdCoderPostgresqlDsnEnvStatus(env),
      dsnPowerShellSetExample: BIRDCODER_POSTGRESQL_DSN_POWERSHELL_SET_EXAMPLE,
      message: 'PostgreSQL live smoke is blocked because no test DSN is configured.',
      providerId: 'postgresql',
      reasonCode: 'missing_postgresql_test_dsn',
      rerunCommand: BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_COMMAND,
      resolutionSteps: [
        `Set one of ${BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY.join(' -> ')}.`,
        `Run ${BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_COMMAND}.`,
      ],
      status: 'blocked',
    };
  }

  const commandEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
    SDKWORK_BIRDCODER_POSTGRES_TEST_URL: config.dsn,
  };

  try {
    const exitCode = await (options.runCommand ?? runCommand)(
      'cargo',
      BIRDCODER_POSTGRESQL_REPOSITORY_TEST_ARGS,
      {
        cwd: options.cwd ?? process.cwd(),
        env: commandEnv,
      },
    );
    if (exitCode !== 0) {
      return {
        checks: [],
        dsnEnvPriority,
        dsnSource: config.dsnSource,
        message: `PostgreSQL workbench repository parity tests exited with code ${exitCode}.`,
        providerId: 'postgresql',
        reasonCode: 'postgresql_repository_parity_failed',
        status: 'failed',
      };
    }

    return {
      checks: ['workspace-repository-postgresql-driver-parity'],
      dsnEnvPriority,
      dsnSource: config.dsnSource,
      message: 'PostgreSQL workbench repository parity tests passed.',
      providerId: 'postgresql',
      status: 'passed',
    };
  } catch (error) {
    return {
      checks: [],
      dsnEnvPriority,
      dsnSource: config.dsnSource,
      message: error instanceof Error ? error.message : String(error),
      providerId: 'postgresql',
      reasonCode: 'postgresql_repository_parity_failed',
      status: 'failed',
    };
  }
}
