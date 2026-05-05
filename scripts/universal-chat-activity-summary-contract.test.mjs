import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const universalChatSource = await readFile(
  resolve('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx'),
  'utf8',
);

const englishChatSource = await readFile(
  resolve('packages/sdkwork-birdcoder-i18n/src/locales/en/chat.ts'),
  'utf8',
);

const chineseChatSource = await readFile(
  resolve('packages/sdkwork-birdcoder-i18n/src/locales/zh/chat.ts'),
  'utf8',
);

assert.match(
  universalChatSource,
  /function UniversalChatActivitySummary\(/,
  'UniversalChat must render file changes and command executions through one professional activity summary component.',
);

assert.match(
  universalChatSource,
  /const editedFilesLabel = environment\?\.t\('chat\.editedFilesSummary'[\s\S]*const ranCommandsLabel = environment\?\.t\('chat\.ranCommandsSummary'/,
  'The activity summary header must report edited-file and command counts with localized copy.',
);

assert.match(
  universalChatSource,
  /const totalAdditions = fileChangesWithKnownLineImpact\.reduce\(/,
  'The activity summary must aggregate additions so the transcript can show total changed lines.',
);

assert.match(
  universalChatSource,
  /const totalDeletions = fileChangesWithKnownLineImpact\.reduce\(/,
  'The activity summary must aggregate deletions so the transcript can show total removed lines.',
);

assert.match(
  universalChatSource,
  /function buildFileChangeDiffPreview\(/,
  'File rows must be expandable and able to show professional plus/minus diff details.',
);

assert.match(
  universalChatSource,
  /expandedFileKeys\.has\(fileKey\)/,
  'Each edited-file row must have independent expansion state for inspecting its details.',
);

assert.match(
  universalChatSource,
  /environment\?\.onViewChanges\?\.\(fileChange\)/,
  'Edited-file rows must still be connected to the existing full diff viewer action.',
);

assert.match(
  universalChatSource,
  /function parseFileUpdateSummaryContent\(/,
  'UniversalChat must parse tool-style "Updated the following files" content into structured file rows instead of rendering it as raw text.',
);

assert.match(
  universalChatSource,
  /FILE_UPDATE_SUMMARY_HEADER_PATTERN = \/\^\(\?:Success\\\.\\s\+\)\?Updated the following files:/,
  'The file update summary parser must recognize successful apply-patch output headers.',
);

assert.match(
  universalChatSource,
  /function resolveMessageActivityFileChanges\(/,
  'UniversalChat must merge parsed file update summaries with structured fileChanges so line-count and diff metadata are preserved.',
);

assert.match(
  universalChatSource,
  /shouldHideMessageContentAsFileUpdateSummary/,
  'UniversalChat must suppress raw "Updated the following files" markdown when the same content is represented by the expandable activity summary.',
);

assert.match(
  universalChatSource,
  /stripFileUpdateSummaryContent\(msg\.content\) \|\| msg\.content/,
  'UniversalChat must remove embedded tool update summaries while preserving surrounding assistant prose.',
);

assert.match(
  universalChatSource,
  /lineImpactKnown: false/,
  'Parsed raw file update summaries must not fake +0/-0 line impact when the tool output did not include diff metadata.',
);

assert.match(
  universalChatSource,
  /function countDiffLineImpacts\(/,
  'The activity summary must derive + and - line impact from inline diff metadata when explicit line counts are missing.',
);

assert.match(
  universalChatSource,
  /chat\.changedLinesUnknown/,
  'File rows without diff metadata must use localized unknown line-impact copy instead of misleading +0/-0 counts.',
);

assert.doesNotMatch(
  universalChatSource,
  /Modified Files/,
  'UniversalChat must not keep the legacy generic "Modified Files" file card copy once the professional activity summary is in place.',
);

assert.match(
  englishChatSource,
  /editedFilesSummary: 'Edited \{\{count\}\} file/,
  'English chat copy must include the edited-files summary string.',
);

assert.match(
  englishChatSource,
  /ranCommandsSummary: 'Ran \{\{count\}\} command/,
  'English chat copy must include the ran-commands summary string.',
);

assert.match(
  englishChatSource,
  /changedLinesUnknown: 'Line impact not captured'/,
  'English chat copy must include the unknown line-impact string.',
);

assert.match(
  chineseChatSource,
  /editedFilesSummary: '\\u5df2\\u7f16\\u8f91 \{\{count\}\} \\u4e2a\\u6587\\u4ef6'/,
  'Chinese chat copy must include the edited-files summary string.',
);

assert.match(
  chineseChatSource,
  /ranCommandsSummary: '\\u5df2\\u8fd0\\u884c \{\{count\}\} \\u6761\\u547d\\u4ee4'/,
  'Chinese chat copy must include the ran-commands summary string.',
);

assert.match(
  chineseChatSource,
  /changedLinesUnknown: '\\u672a\\u6355\\u83b7\\u884c\\u6570\\u5f71\\u54cd'/,
  'Chinese chat copy must include the unknown line-impact string.',
);

console.log('universal chat activity summary contract passed.');
