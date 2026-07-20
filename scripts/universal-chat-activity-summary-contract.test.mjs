import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const activitySummarySource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/ChatActivitySummary.tsx'),
  'utf8',
);

const activityProjectionSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-activity-projection.ts'),
  'utf8',
);

const chatMessageViewSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts'),
  'utf8',
);

const messageActivitySource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/messageActivity.ts'),
  'utf8',
);

const contentBlockRenderersSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContentBlockRenderers.tsx'),
  'utf8',
);

const toolCallCardSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ToolCallCard.tsx'),
  'utf8',
);
const toolResultBlocksSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ToolResultBlocks.tsx'),
  'utf8',
);
const replyMessageRenderersSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ReplyMessageRenderers.tsx'),
  'utf8',
);

const englishChatSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/en/chat.ts'),
  'utf8',
);

const chineseChatSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/zh/chat.ts'),
  'utf8',
);
const universalChatSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx'),
  'utf8',
);
const codePageSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx'),
  'utf8',
);
const codePageSurfaceSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageSurface.tsx'),
  'utf8',
);
const studioPageSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx'),
  'utf8',
);

assert.match(
  activitySummarySource,
  /export const ChatActivitySummary = memo\(function ChatActivitySummary\(/,
  'Chat activity summary must render file changes and command executions through one professional activity summary component.',
);

assert.match(
  activitySummarySource,
  /const editedFilesLabel = environment\?\.t\('chat\.editedFilesSummary'[\s\S]*const ranCommandsLabel = environment\?\.t\('chat\.ranCommandsSummary'/,
  'The activity summary header must report edited-file and command counts with localized copy.',
);

assert.match(
  activitySummarySource,
  /const totalAdditions = fileChangesWithKnownLineImpact\.reduce\(/,
  'The activity summary must aggregate additions so the transcript can show total changed lines.',
);

assert.match(
  activitySummarySource,
  /const totalDeletions = fileChangesWithKnownLineImpact\.reduce\(/,
  'The activity summary must aggregate deletions so the transcript can show total removed lines.',
);

assert.match(
  activitySummarySource,
  /function buildFileChangeDiffPreview\(/,
  'File rows must be expandable and able to show professional plus/minus diff details.',
);

assert.match(
  activitySummarySource,
  /data-chat-activity-summary="inline"/,
  'The activity summary must render as an inline transcript block instead of a bordered card.',
);

assert.match(
  activitySummarySource,
  /data-chat-file-change-row="inline"/,
  'Each file change must render as a flat clickable inline row inside the message stream.',
);

assert.match(
  activitySummarySource,
  /data-chat-file-inline-diff="true"/,
  'Clicking an edited-file row must reveal the diff inline below that row.',
);

assert.doesNotMatch(
  activitySummarySource,
  /data-chat-activity-summary="inline"[\s\S]{0,160}border border-white\/10/,
  'The inline activity summary must not use an outer border because the transcript should keep a flat no-frame style.',
);

assert.doesNotMatch(
  activitySummarySource,
  /data-chat-file-change-row="inline"[\s\S]{0,180}border border-white\/10/,
  'Inline file rows must not be rendered as bordered nested cards.',
);

assert.match(
  activitySummarySource,
  /expandedDisclosureKeys\.has\([\s\S]{0,140}disclosureScopeKey[\s\S]{0,80}file/,
  'Each edited-file row must use transcript-owned stable expansion state.',
);

assert.match(
  activitySummarySource,
  /data-chat-activity-details="true"/,
  'Clicking the activity summary must reveal its command and file detail sections inline.',
);

assert.match(
  activitySummarySource,
  /expandedDisclosureKeys\.has\([\s\S]{0,140}disclosureScopeKey[\s\S]{0,80}command/,
  'Each command row must use transcript-owned stable expansion state.',
);

assert.match(
  activitySummarySource,
  /data-chat-command-details="true"/,
  'Clicking a command row must reveal the full command and captured output.',
);

assert.match(
  activitySummarySource,
  /aria-expanded=\{isExpanded\}/,
  'The activity summary expansion control must expose its state to assistive technology.',
);

assert.match(
  activitySummarySource,
  /environment\?\.onViewChanges\?\.\(fileChange\)/,
  'Edited-file rows must still be connected to the existing full diff viewer action.',
);
assert.match(
  activitySummarySource,
  /environment\.onOpenFile\(fileChange\.path\)/,
  'Clicking a changed-file name must open that file in the editor.',
);
assert.match(
  activitySummarySource,
  /aria-label=\{`\$\{toggleDiffPreviewLabel\}: \$\{fileChange\.path\}`\}/,
  'The inline diff disclosure must remain a separate accessible action.',
);
assert.match(
  universalChatSource,
  /onOpenFile\?: \(path: string\) => void/,
  'UniversalChat must expose file navigation independently from full diff viewing.',
);
assert.match(
  codePageSource,
  /handleOpenMessageFile[\s\S]*selectFile\(path\)[\s\S]*setActiveTab\('editor'\)/,
  'Code-page chat file navigation must select the file and switch to the editor tab.',
);
assert.match(
  codePageSurfaceSource,
  /className="min-w-0 flex-1 flex flex-col relative/,
  'The code workbench content column must shrink below long transcript content instead of clipping file actions off-screen.',
);
assert.match(
  studioPageSource,
  /handleStudioOpenMessageFile[\s\S]*selectFile\(path\)[\s\S]*handleActiveTabChange\('code'\)/,
  'Studio chat file navigation must select the file and switch to the code tab.',
);

assert.match(
  activityProjectionSource,
  /export function parseFileUpdateSummaryContent\(/,
  'Activity projection must parse tool-style "Updated the following files" content into structured file rows instead of rendering it as raw text.',
);

assert.match(
  activityProjectionSource,
  /FILE_UPDATE_SUMMARY_HEADER_PATTERN = \/\^\(\?:Success\\\.\\s\+\)\?Updated the following files:/,
  'The file update summary parser must recognize successful apply-patch output headers.',
);

assert.match(
  activityProjectionSource,
  /export function resolveProjectedActivityFileChanges\(/,
  'Activity projection must merge parsed file update summaries with structured fileChanges so line-count and diff metadata are preserved.',
);

assert.match(
  activityProjectionSource,
  /export function shouldHideMessageContentAsFileUpdateSummary/,
  'Activity projection must suppress raw "Updated the following files" markdown when the same content is represented by the expandable activity summary.',
);

assert.match(
  chatMessageViewSource,
  /resolveVisibleMarkdownBlockContent\(message\)/,
  'Chat message view projection must strip embedded tool update summaries before building markdown blocks.',
);

assert.match(
  chatMessageViewSource,
  /resolveProjectedActivityFileChanges\(message\)/,
  'Chat message view projection must include parsed and structured file changes in activity blocks.',
);

assert.match(
  contentBlockRenderersSource,
  /block\.content/,
  'Markdown block rendering must consume pre-projected markdown content from the view model.',
);

assert.match(
  toolCallCardSource,
  /\[call\.arguments, call\.command, call\.target, call\.title\]/,
  'Tool-call summaries must refresh when a streaming provider updates only the semantic title.',
);

assert.doesNotMatch(
  activitySummarySource.match(/export function resolveActivityFileChangeKey[\s\S]*?\n\}/)?.[0] ?? '',
  /fileChange\.(?:diff|content|originalContent|additions|deletions)/,
  'File disclosure identity must not change while provider diff content is streaming.',
);
assert.match(
  universalChatSource,
  /expandedDisclosureKeys[\s\S]*toggleDisclosure[\s\S]*setExpandedDisclosureKeys\(new Set\(\)\)/,
  'Transcript-owned disclosure state must survive row virtualization and reset on session changes.',
);
assert.match(
  toolCallCardSource,
  /isExpanded: boolean;[\s\S]*onToggle: \(\) => void;/,
  'Tool details must use controlled transcript-owned expansion state.',
);
assert.match(
  toolResultBlocksSource,
  /data-chat-tool-result-blocks="true"/,
  'Structured tool results must render through dedicated rich result blocks instead of raw JSON.',
);
assert.match(
  toolResultBlocksSource,
  /block\.type === 'image'[\s\S]*block\.type === 'audio'[\s\S]*block\.type === 'diff'/,
  'Rich tool result rendering must cover media and diff result kinds.',
);
assert.doesNotMatch(
  activitySummarySource,
  /checkpointSavedLabel/,
  'File activity must not claim that a checkpoint was saved without persistence evidence.',
);
assert.match(
  replyMessageRenderersSource,
  /group-focus-within:opacity-100[\s\S]*\[@media\(hover:none\)\]:opacity-100/,
  'Message actions must remain discoverable for keyboard and touch users.',
);
assert.match(
  universalChatSource,
  /aria-label=\{t\('chat\.transcriptRegion'\)\}[\s\S]*role="region"[\s\S]*tabIndex=\{0\}/,
  'The transcript scroll surface must be a named, keyboard-focusable region.',
);

assert.match(
  messageActivitySource,
  /resolveProjectedActivityFileChanges/,
  'UI activity helpers must delegate file-change projection to pc-types instead of duplicating parser logic.',
);

assert.match(
  activityProjectionSource,
  /lineImpactKnown: false/,
  'Parsed raw file update summaries must not fake +0/-0 line impact when the tool output did not include diff metadata.',
);

assert.match(
  activitySummarySource,
  /function countDiffLineImpacts\(/,
  'The activity summary must derive + and - line impact from inline diff metadata when explicit line counts are missing.',
);

assert.match(
  activitySummarySource,
  /chat\.changedLinesUnknown/,
  'File rows without diff metadata must use localized unknown line-impact copy instead of misleading +0/-0 counts.',
);

assert.doesNotMatch(
  activitySummarySource,
  /Modified Files/,
  'The activity summary must not keep the legacy generic "Modified Files" file card copy once the professional activity summary is in place.',
);

assert.match(
  contentBlockRenderersSource,
  /<ChatActivitySummary/,
  'Content block renderers must delegate activity rendering to ChatActivitySummary instead of UniversalChat injection hooks.',
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
