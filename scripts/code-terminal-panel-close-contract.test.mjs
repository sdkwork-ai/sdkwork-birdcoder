import assert from 'node:assert/strict';
import fs from 'node:fs';

const panelSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodeTerminalIntegrationPanel.tsx', import.meta.url),
  'utf8',
);
const pageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const surfacePropsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts', import.meta.url),
  'utf8',
);

assert.match(
  panelSource,
  /interface CodeTerminalIntegrationPanelProps \{[\s\S]*onClose: \(\) => void;/,
  'Code terminal integration panel must accept an explicit onClose callback so the host workbench can close the embedded terminal immediately.',
);

assert.match(
  panelSource,
  /CodeTerminalIntegrationPanel\(\{[\s\S]*onClose,[\s\S]*\}: CodeTerminalIntegrationPanelProps\)/,
  'Code terminal integration panel must read the onClose callback from its props.',
);

assert.match(
  panelSource,
  /aria-label="Close terminal"[\s\S]*onClick=\{onClose\}[\s\S]*<X size=\{14\} \/>/,
  'Code terminal integration panel must render a close button on the terminal tab row that closes the panel immediately.',
);

assert.match(
  panelSource,
  />\s*Terminal\s*</,
  'Code terminal integration panel must render a terminal tab label in the embedded panel header.',
);

assert.match(
  pageSource,
  /const handleCloseTerminal = useCallback\(\(\) => \{[\s\S]*setIsTerminalOpen\(false\);[\s\S]*\}, \[\]\);/,
  'Code page must define a stable close handler that closes the terminal panel through isTerminalOpen state.',
);

assert.match(
  pageSource,
  /useCodePageSurfaceProps\(\{[\s\S]*onCloseTerminal: handleCloseTerminal,[\s\S]*\}\);/,
  'Code page must wire the terminal panel close handler into the shared surface prop assembler.',
);

assert.match(
  surfacePropsSource,
  /const terminalProps = useMemo<CodeTerminalIntegrationPanelComponentProps>\(\(\) => \(\{[\s\S]*onClose: onCloseTerminal,[\s\S]*\}\),/,
  'Code page surface props must pass the close handler into terminal panel props.',
);

console.log('code terminal panel close contract passed.');
