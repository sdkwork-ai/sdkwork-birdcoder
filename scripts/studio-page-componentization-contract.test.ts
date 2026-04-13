import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const studioPageSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  studioPageSource,
  /from '\.\.\/preview\/StudioStageHeader'/,
  'StudioPage should delegate the preview and simulator header UI to a child component.',
);
assert.match(
  studioPageSource,
  /from '\.\.\/preview\/StudioPreviewPanel'/,
  'StudioPage should delegate preview rendering to a child component.',
);
assert.match(
  studioPageSource,
  /from '\.\.\/simulator\/StudioSimulatorPanel'/,
  'StudioPage should delegate simulator rendering to an independent child component.',
);
assert.match(
  studioPageSource,
  /from '\.\/StudioPageDialogs'/,
  'StudioPage should delegate modal rendering to a dedicated child component.',
);
assert.match(
  studioPageSource,
  /<StudioSimulatorPanel\b/,
  'StudioPage should render the simulator through StudioSimulatorPanel.',
);
assert.equal(
  studioPageSource.includes('<DevicePreview'),
  false,
  'StudioPage should not render DevicePreview directly after component extraction.',
);

const studioPageLineCount = studioPageSource.split('\n').length;
assert.ok(
  studioPageLineCount <= 1700,
  `StudioPage should stay under 1700 lines after component extraction, received ${studioPageLineCount}.`,
);

console.log('studio page componentization contract passed.');
