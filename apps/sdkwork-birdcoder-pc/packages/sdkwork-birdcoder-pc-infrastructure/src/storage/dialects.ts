import type {
  BirdCoderDatabaseProviderId,
  BirdCoderLogicalColumnType,
  BirdCoderStorageDialect,
} from '@sdkwork/birdcoder-pc-contracts-commons';

type SupportedBirdCoderProviderId = 'sqlite' | 'postgresql';

function assertSupportedProviderId(
  providerId: BirdCoderDatabaseProviderId,
): SupportedBirdCoderProviderId {
  if (providerId === 'sqlite' || providerId === 'postgresql') {
    return providerId as SupportedBirdCoderProviderId;
  }

  throw new Error(`Unsupported BirdCoder storage provider: ${providerId}`);
}

function mapLogicalType(
  providerId: SupportedBirdCoderProviderId,
  logicalType: BirdCoderLogicalColumnType,
): string {
  switch (logicalType) {
    case 'bool':
      return providerId === 'sqlite' ? 'INTEGER' : 'BOOLEAN';
    case 'int':
      return 'INTEGER';
    case 'bigint':
      return providerId === 'sqlite' ? 'INTEGER' : 'BIGINT';
    case 'decimal':
      return 'NUMERIC';
    case 'double':
      return providerId === 'sqlite' ? 'REAL' : 'DOUBLE PRECISION';
    case 'date':
      return providerId === 'sqlite' ? 'TEXT' : 'DATE';
    case 'json':
      return providerId === 'sqlite' ? 'TEXT' : 'JSONB';
    case 'timestamp':
      return providerId === 'sqlite' ? 'TEXT' : 'TIMESTAMPTZ';
    case 'id':
    case 'text':
    case 'enum':
    default:
      return 'TEXT';
  }
}

const DIALECTS: Record<SupportedBirdCoderProviderId, BirdCoderStorageDialect> = {
  sqlite: {
    providerId: 'sqlite',
    buildPlaceholder: (index) => `?${index}`,
    mapLogicalType: (logicalType) => mapLogicalType('sqlite', logicalType),
    supportsJsonb: false,
  },
  postgresql: {
    providerId: 'postgresql',
    buildPlaceholder: (index) => `$${index}`,
    mapLogicalType: (logicalType) => mapLogicalType('postgresql', logicalType),
    supportsJsonb: true,
  },
};

export function createBirdCoderStorageDialect(
  providerId: BirdCoderDatabaseProviderId,
): BirdCoderStorageDialect {
  return DIALECTS[assertSupportedProviderId(providerId)];
}
