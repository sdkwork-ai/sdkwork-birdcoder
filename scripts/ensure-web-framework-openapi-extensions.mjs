#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  APP_SDK_OPENAPI_MIRROR_TARGETS,
  applyWebFrameworkOpenApiExtensions,
} from './web-framework-openapi-extensions.mjs';

const rootDir = process.cwd();

let total = 0;
for (const target of APP_SDK_OPENAPI_MIRROR_TARGETS) {
  const absolutePath = path.join(rootDir, target.relativePath);
  const document = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const changed = applyWebFrameworkOpenApiExtensions(document, target.apiSurface);
  const nextContent = `${JSON.stringify(document, null, 2)}\n`;
  if (changed > 0) {
    fs.writeFileSync(absolutePath, nextContent, 'utf8');
  }
  const mirrorPath = path.join(rootDir, target.mirrorRelativePath);
  fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
  const mirrorContent = fs.existsSync(mirrorPath) ? fs.readFileSync(mirrorPath, 'utf8') : '';
  if (mirrorContent !== nextContent) {
    fs.writeFileSync(mirrorPath, nextContent, 'utf8');
    changed += 1;
  }
  total += changed;
  process.stdout.write(`${target.relativePath}: patched ${changed} operation extension(s)\n`);
}

process.stdout.write(`Web framework OpenAPI extensions ensured (${total} updates)\n`);
