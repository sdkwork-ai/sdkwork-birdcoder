import fs from 'node:fs';

import { sha256Hash } from '@sdkwork/utils-typescript/crypto';

export function sha256Value(value) {
  return sha256Hash(value);
}

export function sha256File(filePath) {
  return sha256Hash(fs.readFileSync(filePath));
}
