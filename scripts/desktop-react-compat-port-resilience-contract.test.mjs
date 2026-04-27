import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const contractPath = path.join(rootDir, 'scripts', 'desktop-react-compat-contract.test.mjs');
const contractSource = fs.readFileSync(contractPath, 'utf8');

assert.doesNotMatch(
  contractSource,
  /http:\/\/127\.0\.0\.1:1532/u,
  'Desktop React compatibility probes must derive URLs from the live Vite server origin instead of hard-coding port 1532.',
);
assert.doesNotMatch(
  contractSource,
  /port:\s*1532/u,
  'Desktop React compatibility contract must not reserve the legacy fixed port 1532.',
);
assert.match(
  contractSource,
  /port:\s*0/u,
  'Desktop React compatibility contract must ask Vite for an ephemeral loopback port.',
);
assert.match(
  contractSource,
  /strictPort:\s*false/u,
  'Desktop React compatibility contract must allow Vite to bind the selected free port.',
);
assert.match(
  contractSource,
  /resolveDesktopServerOrigin/u,
  'Desktop React compatibility contract must resolve the actual listening server origin before probing modules.',
);

console.log('desktop react compatibility port resilience contract passed.');
