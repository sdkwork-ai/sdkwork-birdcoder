import { randomUUID } from 'node:crypto';

import { getBirdCoderSchemaMigrationDefinition } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts';
import { createBirdCoderRepresentativeAppAdminRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import {
  createBirdCoderPostgresqlClientSqlExecutor,
  type BirdCoderPostgresqlSqlConnection,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlBackendExecutors.ts';

export type BirdCoderPostgresqlLiveSmokeStatus = 'blocked' | 'failed' | 'passed';
export type BirdCoderPostgresqlDsnEnvState = 'missing' | 'empty' | 'configured';

export interface BirdCoderPostgresqlLiveSmokeReport {
  checks: string[];
  dsnCmdSetExample?: string;
  dsnExample?: string;
  dsnEnvPriority?: readonly string[];
  dsnEnvStatus?: Record<string, BirdCoderPostgresqlDsnEnvState>;
  dsnPowerShellSetExample?: string;
  dsnSource?: string;
  message: string;
  providerId: 'postgresql';
  reasonCode?: string;
  rerunCommand?: string;
  resolutionSteps?: readonly string[];
  resolutionHint?: string;
  status: BirdCoderPostgresqlLiveSmokeStatus;
}

export interface BirdCoderPostgresqlLiveSmokeConfig {
  dsn?: string;
  dsnSource?: string;
}

export type BirdCoderPostgresqlOpenConnectionFactory = (
  dsn: string,
) => Promise<BirdCoderPostgresqlSqlConnection>;

interface BirdCoderPgClientLike {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{
    rowCount?: number | null;
    rows?: readonly Record<string, unknown>[];
  }>;
}

interface BirdCoderPgModuleLike {
  Client?: new (options: { connectionString: string }) => BirdCoderPgClientLike;
  default?: {
    Client?: new (options: { connectionString: string }) => BirdCoderPgClientLike;
  } | null;
}

export interface RunBirdCoderPostgresqlLiveSmokeOptions {
  env?: Record<string, string | undefined>;
  loadOpenConnectionFactory?: () => Promise<BirdCoderPostgresqlOpenConnectionFactory | null>;
  openConnectionFactory?: BirdCoderPostgresqlOpenConnectionFactory;
}

const loadOptionalModule = new Function(
  'specifier',
  'return import(specifier);',
) as (specifier: string) => Promise<unknown>;

export const BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY = [
  'BIRDCODER_POSTGRESQL_DSN',
  'BIRDCODER_DATABASE_URL',
  'DATABASE_URL',
  'PGURL',
] as const;

export const BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_COMMAND =
  'pnpm.cmd run release:smoke:postgresql-live';
export const BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_STEP =
  `Run ${BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_COMMAND}.`;
export const BIRDCODER_POSTGRESQL_DSN_EXAMPLE =
  'postgresql://<user>:<password>@<host>:5432/<database>';
export const BIRDCODER_POSTGRESQL_DSN_CMD_SET_EXAMPLE =
  `set BIRDCODER_POSTGRESQL_DSN=${BIRDCODER_POSTGRESQL_DSN_EXAMPLE}`;
export const BIRDCODER_POSTGRESQL_DSN_POWERSHELL_SET_EXAMPLE =
  `$env:BIRDCODER_POSTGRESQL_DSN='${BIRDCODER_POSTGRESQL_DSN_EXAMPLE}'`;

export function resolveBirdCoderPostgresqlDsnEnvStatus(
  env: Record<string, string | undefined> = process.env,
): Record<string, BirdCoderPostgresqlDsnEnvState> {
  const statusByKey: Record<string, BirdCoderPostgresqlDsnEnvState> = {};
  for (const key of BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY) {
    const rawValue = env[key];
    if (rawValue === undefined) {
      statusByKey[key] = 'missing';
      continue;
    }

    statusByKey[key] = rawValue.trim() ? 'configured' : 'empty';
  }

  return statusByKey;
}

function readNonEmptyEnvValue(
  env: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function resolveBirdCoderPostgresqlLiveSmokeConfig(
  env: Record<string, string | undefined> = process.env,
): BirdCoderPostgresqlLiveSmokeConfig {
  for (const key of BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY) {
    const value = readNonEmptyEnvValue(env, key);
    if (value) {
      return {
        dsn: value,
        dsnSource: key,
      };
    }
  }

  return {};
}

async function loadPgOpenConnectionFactory(): Promise<BirdCoderPostgresqlOpenConnectionFactory | null> {
  try {
    const pgModule = (await loadOptionalModule('pg')) as BirdCoderPgModuleLike;
    const Client =
      pgModule.Client ??
      (typeof pgModule.default === 'object' && pgModule.default !== null ? pgModule.default.Client : undefined);
    if (typeof Client !== 'function') {
      return null;
    }

    return async (dsn: string) => {
      const client = new Client({
        connectionString: dsn,
      });
      await client.connect();

      return {
        async close() {
          await client.end();
        },
        async query(sql: string, params: readonly unknown[] = []) {
          const result = await client.query(sql, [...params]);
          return {
            rowCount: result.rowCount,
            rows: result.rows,
          };
        },
      };
    };
  } catch {
    return null;
  }
}

function createBlockedReport(
  reasonCode: string,
  message: string,
  options: {
    dsnCmdSetExample?: string;
    dsnExample?: string;
    dsnEnvStatus?: Record<string, BirdCoderPostgresqlDsnEnvState>;
    dsnPowerShellSetExample?: string;
    dsnSource?: string;
    resolutionSteps?: readonly string[];
    resolutionHint?: string;
  } = {},
): BirdCoderPostgresqlLiveSmokeReport {
  return {
    checks: [],
    dsnCmdSetExample: options.dsnCmdSetExample,
    dsnExample: options.dsnExample,
    dsnEnvPriority: [...BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY],
    dsnEnvStatus: options.dsnEnvStatus,
    dsnPowerShellSetExample: options.dsnPowerShellSetExample,
    dsnSource: options.dsnSource,
    message,
    providerId: 'postgresql',
    reasonCode,
    rerunCommand: BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_COMMAND,
    resolutionSteps: options.resolutionSteps,
    resolutionHint: options.resolutionHint,
    status: 'blocked',
  };
}

function createFailureReport(
  checks: string[],
  error: unknown,
  dsnSource?: string,
): BirdCoderPostgresqlLiveSmokeReport {
  const message = error instanceof Error ? error.message : String(error);
  return {
    checks,
    dsnSource,
    message,
    providerId: 'postgresql',
    reasonCode: 'postgresql_live_smoke_failed',
    status: 'failed',
  };
}

export async function runBirdCoderPostgresqlLiveSmoke(
  options: RunBirdCoderPostgresqlLiveSmokeOptions = {},
): Promise<BirdCoderPostgresqlLiveSmokeReport> {
  const env = options.env ?? process.env;
  const dsnEnvStatus = resolveBirdCoderPostgresqlDsnEnvStatus(env);
  const config = resolveBirdCoderPostgresqlLiveSmokeConfig(env);

  if (!config.dsn) {
    return createBlockedReport(
      'missing_postgresql_dsn',
      'PostgreSQL live smoke is blocked because no DSN is configured in the current environment.',
      {
        dsnCmdSetExample: BIRDCODER_POSTGRESQL_DSN_CMD_SET_EXAMPLE,
        dsnExample: BIRDCODER_POSTGRESQL_DSN_EXAMPLE,
        dsnEnvStatus,
        dsnPowerShellSetExample: BIRDCODER_POSTGRESQL_DSN_POWERSHELL_SET_EXAMPLE,
        resolutionSteps: [
          `Set one of ${BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY.join(' -> ')}.`,
          BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_STEP,
        ],
        resolutionHint: `Set one of ${BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY.join(' -> ')} and rerun the live smoke command.`,
      },
    );
  }

  const openConnectionFactory =
    options.openConnectionFactory ??
    (options.loadOpenConnectionFactory
      ? await options.loadOpenConnectionFactory()
      : await loadPgOpenConnectionFactory());

  if (!openConnectionFactory) {
    return createBlockedReport(
      'missing_postgresql_driver',
      'PostgreSQL live smoke is blocked because no PostgreSQL driver is available for runtime execution.',
      {
        dsnEnvStatus,
        dsnSource: config.dsnSource,
        resolutionSteps: [
          "Install the runtime 'pg' PostgreSQL driver in this environment.",
          BIRDCODER_POSTGRESQL_LIVE_SMOKE_RERUN_STEP,
        ],
        resolutionHint:
          "Install the runtime 'pg' PostgreSQL driver in this environment and rerun the live smoke command.",
      },
    );
  }

  const checks: string[] = [];
  const sqlExecutor = createBirdCoderPostgresqlClientSqlExecutor({
    openConnection: () => openConnectionFactory(config.dsn!),
  });
  const provider = createBirdCoderStorageProvider('postgresql', {
    sqlExecutor,
  });
  const repositories = createBirdCoderRepresentativeAppAdminRepositories({
    providerId: 'postgresql',
    storage: provider,
  });
  const uniqueId = `postgresql-live-smoke-${randomUUID()}`;

  try {
    await provider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);
    checks.push('migrations');

    const beforeTransaction = await repositories.releases.findById(uniqueId);
    if (beforeTransaction !== null) {
      throw new Error(`Smoke release ${uniqueId} unexpectedly already exists before the transaction starts.`);
    }
    checks.push('preflight-clean');

    const unitOfWork = await provider.beginUnitOfWork();
    try {
      const stagedRepositories = createBirdCoderRepresentativeAppAdminRepositories({
        providerId: 'postgresql',
        storage: unitOfWork,
      });

      await stagedRepositories.releases.save({
        id: uniqueId,
        releaseVersion: '0.5.0-postgresql-live-smoke',
        releaseKind: 'formal',
        rolloutStage: 'smoke',
        manifest: {
          lane: 'postgresql-live-smoke',
        },
        status: 'ready',
        createdAt: '2026-04-10T00:00:00.000Z',
        updatedAt: '2026-04-10T00:00:00.000Z',
      });

      const stagedRelease = await stagedRepositories.releases.findById(uniqueId);
      if (!stagedRelease) {
        throw new Error('Smoke release is not visible inside the PostgreSQL transaction.');
      }
      checks.push('transaction-write-visible');

      const providerVisibleBeforeRollback = await repositories.releases.findById(uniqueId);
      if (providerVisibleBeforeRollback !== null) {
        throw new Error('Uncommitted PostgreSQL smoke data leaked outside the transaction boundary.');
      }
      checks.push('transaction-isolation');
    } finally {
      await unitOfWork.rollback();
    }

    const providerVisibleAfterRollback = await repositories.releases.findById(uniqueId);
    if (providerVisibleAfterRollback !== null) {
      throw new Error('Rolled-back PostgreSQL smoke data remains visible after rollback.');
    }
    checks.push('rollback-clean');

    return {
      checks,
      dsnSource: config.dsnSource,
      message: 'PostgreSQL live smoke passed.',
      providerId: 'postgresql',
      status: 'passed',
    };
  } catch (error) {
    return createFailureReport(checks, error, config.dsnSource);
  } finally {
    await provider.close();
  }
}
