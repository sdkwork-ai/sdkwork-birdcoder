import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const webViteConfigPath = path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'vite.config.ts');
const webViteConfigSource = fs.readFileSync(webViteConfigPath, 'utf8');

assert.match(
  webViteConfigSource,
  /defineConfig\(\(\{\s*mode\s*\}\)\s*=>/u,
  'Web Vite config must resolve the active Vite mode so build-time compat plugins can distinguish development from production.',
);

assert.match(
  webViteConfigSource,
  /createBirdcoderVitePlugins\(\{\s*[\s\S]*mode,\s*[\s\S]*\}\)/u,
  'Web Vite config must pass the active mode into createBirdcoderVitePlugins so React compat wrappers emit production runtimes during production builds.',
);

console.log('web react compat mode contract passed.');
