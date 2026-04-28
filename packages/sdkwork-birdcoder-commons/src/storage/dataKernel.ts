export {
  buildLocalStoreKey,
  type BirdCoderStoredRawValueEntry,
  createJsonRecordRepository,
  deserializeStoredValue,
  getStoredJson,
  getStoredRawValue,
  listStoredRawValues,
  readUserHomeTextFile,
  removeStoredValue,
  serializeStoredValue,
  setStoredJson,
  setStoredRawValue,
  writeUserHomeTextFile,
  type BirdCoderJsonRecordRepository,
  type CreateBirdCoderJsonRecordRepositoryOptions,
} from '../../../sdkwork-birdcoder-infrastructure/src/storage/runtime.ts';

export {
  coerceBirdCoderSqlEntityRow,
} from '../../../sdkwork-birdcoder-infrastructure/src/storage/sqlRowCodec.ts';

export {
  createBirdCoderTableRecordRepository,
  type BirdCoderTableRecordRepository,
} from '../../../sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
