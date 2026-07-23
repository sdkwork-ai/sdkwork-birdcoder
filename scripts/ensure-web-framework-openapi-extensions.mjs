#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  BIRDCODER_OPENAPI_AUTHORITY_TARGETS,
  applyWebFrameworkOpenApiExtensions,
} from './web-framework-openapi-extensions.mjs';

const rootDir = process.cwd();

let total = 0;
for (const target of BIRDCODER_OPENAPI_AUTHORITY_TARGETS) {
  const absolutePath = path.join(rootDir, target.relativePath);
  const document = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const changed = applyWebFrameworkOpenApiExtensions(document, target.apiSurface);
  if (changed > 0) {
    fs.writeFileSync(absolutePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
  total += changed;
  process.stdout.write(`${target.relativePath}: patched ${changed} operation extension(s)\n`);
}

process.stdout.write(`Web framework OpenAPI extensions ensured (${total} updates)\n`);
