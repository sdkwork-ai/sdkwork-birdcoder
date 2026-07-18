import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const taskProgressSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-task-progress.ts'),
  'utf8',
);

const taskProgressUiSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/blocks/ChatTaskProgress.tsx'),
  'utf8',
);

const contentBlockRenderersSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContentBlockRenderers.tsx'),
  'utf8',
);

const chatMessageViewSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts'),
  'utf8',
);

assert.match(
  taskProgressSource,
  /export function normalizeTaskProgressCounter\(/,
  'pc-types must normalize task progress counters before rendering them so string or malformed native payloads cannot display NaN.',
);

assert.match(
  taskProgressSource,
  /export function resolveTaskProgressDisplayState\(/,
  'pc-types must resolve task progress into a finite display state before computing labels and bar width.',
);

assert.match(
  taskProgressSource,
  /Number\.isFinite\(parsedValue\)/,
  'Task progress normalization must reject non-finite values instead of passing NaN into Math.floor.',
);

assert.match(
  taskProgressUiSource,
  /resolveTaskProgressDisplayState\(taskProgress\)/,
  'Task progress rendering must use the normalized display state rather than reading raw payload fields directly.',
);

assert.match(
  chatMessageViewSource,
  /resolveTaskProgressDisplayState\(message\.taskProgress\)/,
  'Chat message view projection must normalize task progress before emitting task-progress blocks.',
);

assert.match(
  taskProgressUiSource,
  /data-chat-task-progress="inline"/,
  'Task progress must render as an inline transcript activity row instead of a bordered card.',
);

assert.doesNotMatch(
  taskProgressUiSource,
  /data-chat-task-progress="inline"[\s\S]{0,180}border border-white\/5/,
  'Inline task progress must not use the old bordered card styling.',
);

assert.doesNotMatch(
  taskProgressUiSource,
  /Math\.floor\(taskProgress\.(?:total|completed)\)/,
  'Task progress rendering must not floor raw taskProgress fields because malformed payloads render as NaN/NaN.',
);

assert.match(
  contentBlockRenderersSource,
  /<ChatTaskProgress taskProgress=\{block\.progress\} \/>/,
  'Content block renderers must delegate task progress rendering to ChatTaskProgress instead of UniversalChat injection hooks.',
);

console.log('universal chat task progress contract passed.');
