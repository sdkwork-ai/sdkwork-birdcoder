import fs from 'node:fs';
import path from 'node:path';

import { MINI_PROGRAM_ROOT } from './lib/build-context.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.wxml', '.json']);
const checks = [
  {
    label: 'raw HTTP or manual auth',
    pattern: /fetch\s*\(|axios\.|wx\.request|Authorization|Access-Token|X-API-Key/u,
    allow: () => false,
  },
  {
    label: 'browser or H5 implementation leakage',
    pattern: /Capacitor|window\.|document\.|localStorage|sessionStorage|h5-mobile/u,
    allow: () => false,
  },
  {
    label: 'platform global outside mp-host or native projection',
    pattern: /\bwx\./u,
    allow: (relative) => relative.includes('sdkwork-birdcoder-mp-host/')
      || relative.startsWith('src/app.ts')
      || relative.startsWith('src/pages/__generated__/'),
  },
];

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

const roots = [path.join(MINI_PROGRAM_ROOT, 'packages'), path.join(MINI_PROGRAM_ROOT, 'src')];
const issues = [];
for (const file of roots.flatMap(walk)) {
  const relative = path.relative(MINI_PROGRAM_ROOT, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');
  for (const check of checks) {
    if (check.pattern.test(source) && !check.allow(relative)) {
      issues.push(`${relative}: ${check.label}`);
    }
  }
}
if (issues.length > 0) {
  console.error('Mini program static boundary check failed:');
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}
console.log('Mini program static boundary check passed.');
