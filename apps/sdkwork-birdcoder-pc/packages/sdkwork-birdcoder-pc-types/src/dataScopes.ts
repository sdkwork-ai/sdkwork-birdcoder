export const BIRDCODER_DATA_SCOPES = [
  'DEFAULT',
  'PRIVATE',
  'ORGANIZATION',
  'TENANT',
  'PUBLIC',
] as const;

export type BirdCoderDataScope =
  (typeof BIRDCODER_DATA_SCOPES)[number] | (string & {});
