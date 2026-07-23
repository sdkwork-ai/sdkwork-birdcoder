import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = readBirdcoderAppShellSource();

const focusTerminalSurfaceMatch = appSource.match(
  /const focusTerminalSurface = \(([\s\S]*?)\) => \{([\s\S]*?)\n    \};/,
);

assert.ok(
  focusTerminalSurfaceMatch,
  'App shell must keep terminal surface focus logic local to the global terminal event bridge.',
);

assert.match(
  focusTerminalSurfaceMatch[1],
  /forceProjectTerminal\?: boolean/,
  'Terminal focus logic must distinguish generic terminal visibility from explicit launch requests.',
);

assert.match(
  focusTerminalSurfaceMatch[2],
  /if \(options\?\.forceProjectTerminal\) \{[\s\S]*return 'terminal';[\s\S]*\}/,
  'Explicit project terminal launch requests must focus the full Terminal view even when Code is active.',
);

assert.match(
  appSource,
  /const handleOpenTerminal = \(\) => \{[\s\S]*focusTerminalSurface\(\);[\s\S]*\};/,
  'Generic openTerminal events should keep their existing visibility semantics.',
);

assert.match(
  appSource,
  /const handleTerminalRequest = \(req: TerminalCommandRequest\) => \{[\s\S]*if \(!isProjectTerminalRequest\(req\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(req\);[\s\S]*focusTerminalSurface\(\{ forceProjectTerminal: true \}\);[\s\S]*\};/,
  'Project and file explorer terminal launch requests must focus the full Terminal view while embedded terminal requests stay inside their workbench.',
);

assert.doesNotMatch(
  appSource,
  /forceWorkspace|isWorkspaceTerminalRequest|surface:\s*'workspace'/,
  'Terminal routing must not reintroduce retired Workspace-domain request semantics.',
);

console.log('app terminal request focus contract passed.');
