import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const universalChatSource = await readFile(
  resolve('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx'),
  'utf8',
);

assert.match(
  universalChatSource,
  /function normalizeTaskProgressCounter\(/,
  'UniversalChat must normalize task progress counters before rendering them so string or malformed native payloads cannot display NaN.',
);

assert.match(
  universalChatSource,
  /function resolveTaskProgressDisplayState\(/,
  'UniversalChat must resolve task progress into a finite display state before computing labels and bar width.',
);

assert.match(
  universalChatSource,
  /Number\.isFinite\(parsedValue\)/,
  'Task progress normalization must reject non-finite values instead of passing NaN into Math.floor.',
);

assert.match(
  universalChatSource,
  /const taskProgressDisplayState = resolveTaskProgressDisplayState\(msg\.taskProgress\);/,
  'Task progress rendering must use the normalized display state rather than reading raw payload fields directly.',
);

assert.match(
  universalChatSource,
  /data-chat-task-progress="inline"/,
  'Task progress must render as an inline transcript activity row instead of a bordered card.',
);

assert.doesNotMatch(
  universalChatSource,
  /data-chat-task-progress="inline"[\s\S]{0,180}border border-white\/5/,
  'Inline task progress must not use the old bordered card styling.',
);

assert.doesNotMatch(
  universalChatSource,
  /Math\.floor\(msg\.taskProgress\.(?:total|completed)\)/,
  'Task progress rendering must not floor raw taskProgress fields because malformed payloads render as NaN/NaN.',
);

console.log('universal chat task progress contract passed.');
