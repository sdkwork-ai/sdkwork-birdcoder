import process from 'node:process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  listBirdCoderCodingServerEngines,
  listBirdCoderCodingServerModels,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const outputUrl = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json',
  import.meta.url,
);

export function generateRustHostEngineCatalog({
  targetUrl = outputUrl,
}: {
  targetUrl?: URL;
} = {}): string {
  mkdirSync(dirname(fileURLToPath(targetUrl)), { recursive: true });
  writeFileSync(
    targetUrl,
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

  return fileURLToPath(targetUrl);
}

export async function generateRustHostEngineCatalogCli(): Promise<void> {
  console.log(generateRustHostEngineCatalog());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void generateRustHostEngineCatalogCli().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
