import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listBirdCoderCodingServerEngines,
  listBirdCoderCodingServerModels,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const outputUrl = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json',
  import.meta.url,
);

mkdirSync(dirname(fileURLToPath(outputUrl)), { recursive: true });
writeFileSync(
  outputUrl,
  `${JSON.stringify(
    {
      engines: listBirdCoderCodingServerEngines(),
      models: listBirdCoderCodingServerModels(),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(fileURLToPath(outputUrl));
