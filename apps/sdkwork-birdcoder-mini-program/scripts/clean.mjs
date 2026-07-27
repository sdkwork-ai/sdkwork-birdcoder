import fs from 'node:fs';
import path from 'node:path';

import { MINI_PROGRAM_ROOT } from './lib/build-context.mjs';

for (const relative of ['dist', '.cache']) {
  fs.rmSync(path.join(MINI_PROGRAM_ROOT, relative), { recursive: true, force: true });
}
console.log('Mini program reproducible build artifacts removed.');
