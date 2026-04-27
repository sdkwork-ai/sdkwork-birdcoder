import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url),
  'utf8',
);

const focusTerminalSurfaceMatch = appSource.match(
  /const focusTerminalSurface = \(([\s\S]*?)\) => \{([\s\S]*?)\n    \};/,
);

assert.ok(
  focusTerminalSurfaceMatch,
  'App shell must keep terminal surface focus logic local to the global terminal event bridge.',
);

assert.match(
  focusTerminalSurfaceMatch[1],
  /forceWorkspace\?: boolean/,
  'Terminal focus logic must distinguish generic terminal visibility from explicit launch requests.',
);

assert.match(
  focusTerminalSurfaceMatch[2],
  /if \(options\?\.forceWorkspace\) \{[\s\S]*return 'terminal';[\s\S]*\}/,
  'Explicit terminal launch requests must force the full Terminal workspace view even when Code is active.',
);

assert.match(
  appSource,
  /const handleOpenTerminal = \(\) => \{[\s\S]*focusTerminalSurface\(\);[\s\S]*\};/,
  'Generic openTerminal events should keep their existing visibility semantics.',
);

assert.match(
  appSource,
  /const handleTerminalRequest = \(req: TerminalCommandRequest\) => \{[\s\S]*if \(!isWorkspaceTerminalRequest\(req\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(req\);[\s\S]*focusTerminalSurface\(\{ forceWorkspace: true \}\);[\s\S]*\};/,
  'Project and file explorer terminal launch requests must focus the full Terminal workspace while embedded terminal requests stay inside their workbench.',
);

console.log('app terminal request focus contract passed.');
