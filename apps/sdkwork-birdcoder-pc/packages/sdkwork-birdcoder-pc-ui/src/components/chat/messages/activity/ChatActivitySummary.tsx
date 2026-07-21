import React, { memo, useId, useMemo } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileCode2,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import type { CommandExecution, FileChange } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { hasRestorableFileChanges } from '@sdkwork/birdcoder-pc-workbench/workbench/fileChangeRestore';
import {
  buildChatContentPreview,
  buildChatLinePreview,
  buildCommandOutputPreview,
  MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
} from '../contentPreview.ts';
import type { ActivityFileChange } from '../messageActivity.ts';
import type { ChatMessageEnvironment, ChatMessageTranslate } from '../types.ts';
import {
  resolveChatCommandLifecycleTone as resolveCommandExecutionTone,
  type ChatCommandLifecycleTone,
} from './chatCommandLifecycle.ts';

export {
  buildCommandOutputPreview,
  MAX_COMMAND_OUTPUT_PREVIEW_LINES,
} from '../contentPreview.ts';

export const MAX_ACTIVITY_DIFF_PREVIEW_LINES = 80;
export const MAX_ACTIVITY_CONTENT_PREVIEW_LINES = 60;
export const MAX_ACTIVITY_PREVIEW_CHARACTERS = MAX_CHAT_CONTENT_PREVIEW_CHARACTERS;

const MAX_COMMAND_TEXT_PREVIEW_CHARACTERS = 4_000;
const MAX_COMMAND_SUMMARY_CHARACTERS = 320;

export type ActivityDiffPreviewLineTone = 'addition' | 'deletion' | 'hunk' | 'meta' | 'context';

export interface ActivityDiffPreviewLine {
  marker: string;
  text: string;
  tone: ActivityDiffPreviewLineTone;
}

export interface ActivityDiffPreview {
  isFallback: boolean;
  isTruncated: boolean;
  lines: ActivityDiffPreviewLine[];
}

export type CommandExecutionTone = ChatCommandLifecycleTone;

export interface ActivityFileChangeLineImpact {
  additions: number;
  deletions: number;
  isKnown: boolean;
}

export interface ChatActivitySummaryProps {
  commands?: readonly CommandExecution[];
  compact?: boolean;
  copyLabel: string;
  copyMessageToClipboard: (content: string) => void;
  disclosureScopeKey: string;
  environment?: ChatMessageEnvironment | null;
  expandedDisclosureKeys: ReadonlySet<string>;
  fileChanges?: readonly ActivityFileChange[];
  messageId: string;
  successIconSize: number;
  toggleDisclosure: (key: string) => void;
}

interface RenderCommandExecutionCardOptions {
  cmd: CommandExecution;
  commandDetailsId: string;
  commandLabel: string;
  commandKey: string;
  commandOutputLabel: string;
  copyLabel: string;
  copyMessageToClipboard: (content: string) => void;
  isCommandExpanded: boolean;
  noCommandOutputLabel: string;
  successIconSize: number;
  t?: ChatMessageTranslate;
  toggleCommandDetails: (commandKey: string) => void;
}

function normalizeActivityLineCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function resolveActivityFileChangeStatusLabel(
  fileChange: ActivityFileChange,
  t?: ChatMessageTranslate,
): string {
  const updateStatus = fileChange.updateStatus?.trim() ?? '';
  if (!updateStatus) {
    return '';
  }

  const movedFromMatch = /^moved from\s+(.+)$/iu.exec(updateStatus);
  if (movedFromMatch?.[1]) {
    return t?.('chat.fileOperationMovedFrom', { path: movedFromMatch[1] })
      ?? `Moved from ${movedFromMatch[1]}`;
  }

  const operationLabels: Readonly<Record<string, string>> = {
    '??': t?.('chat.fileOperationCreated') ?? 'Created',
    A: t?.('chat.fileOperationCreated') ?? 'Created',
    D: t?.('chat.fileOperationDeleted') ?? 'Deleted',
    M: t?.('chat.fileOperationModified') ?? 'Modified',
    R: t?.('chat.fileOperationMoved') ?? 'Moved',
  };
  if (operationLabels[updateStatus]) {
    return operationLabels[updateStatus];
  }
  if (/^[A-Z?]{1,2}$/u.test(updateStatus)) {
    return t?.('chat.fileOperationUpdated') ?? 'Updated';
  }

  return buildChatContentPreview(updateStatus, {
    maxCharacters: 160,
    tailCharacters: 0,
  }).text;
}

function resolveDiffPreviewLineTone(line: string): ActivityDiffPreviewLineTone {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return 'meta';
  }
  if (line.startsWith('+')) {
    return 'addition';
  }
  if (line.startsWith('-')) {
    return 'deletion';
  }
  if (line.startsWith('@@')) {
    return 'hunk';
  }
  if (
    line.startsWith('diff --git') ||
    line.startsWith('index ') ||
    line.startsWith('new file ') ||
    line.startsWith('deleted file ')
  ) {
    return 'meta';
  }

  return 'context';
}

function buildActivityDiffPreviewLine(line: string): ActivityDiffPreviewLine {
  const tone = resolveDiffPreviewLineTone(line);
  if (tone === 'addition') {
    return { marker: '+', text: line.slice(1), tone };
  }
  if (tone === 'deletion') {
    return { marker: '-', text: line.slice(1), tone };
  }
  if (tone === 'hunk') {
    return { marker: '@', text: line, tone };
  }

  return { marker: ' ', text: line, tone };
}

function buildFileChangeContentPreview(fileChange: FileChange): ActivityDiffPreview {
  const previewLines: ActivityDiffPreviewLine[] = [];
  const originalContent =
    typeof fileChange.originalContent === 'string' ? fileChange.originalContent : '';
  const content = typeof fileChange.content === 'string' ? fileChange.content : '';
  const halfPreviewLimit = Math.max(1, Math.floor(MAX_ACTIVITY_CONTENT_PREVIEW_LINES / 2));
  const halfPreviewCharacterLimit = Math.max(
    1,
    Math.floor(MAX_ACTIVITY_PREVIEW_CHARACTERS / 2),
  );
  let isTruncated = false;

  if (originalContent) {
    previewLines.push({
      marker: ' ',
      text: `--- ${fileChange.path}`,
      tone: 'meta',
    });
    const originalPreview = buildChatLinePreview(originalContent, {
      maxCharacters: content
        ? halfPreviewCharacterLimit
        : MAX_ACTIVITY_PREVIEW_CHARACTERS,
      maxLines: content ? halfPreviewLimit : MAX_ACTIVITY_CONTENT_PREVIEW_LINES,
    });
    isTruncated = isTruncated || originalPreview.isTruncated;
    for (const line of originalPreview.lines) {
      previewLines.push({ marker: '-', text: line, tone: 'deletion' });
    }
  }

  if (content) {
    previewLines.push({
      marker: ' ',
      text: `+++ ${fileChange.path}`,
      tone: 'meta',
    });
    const contentPreview = buildChatLinePreview(content, {
      maxCharacters: originalContent
        ? halfPreviewCharacterLimit
        : MAX_ACTIVITY_PREVIEW_CHARACTERS,
      maxLines: originalContent ? halfPreviewLimit : MAX_ACTIVITY_CONTENT_PREVIEW_LINES,
    });
    isTruncated = isTruncated || contentPreview.isTruncated;
    for (const line of contentPreview.lines) {
      previewLines.push({ marker: '+', text: line, tone: 'addition' });
    }
  }

  return {
    isFallback: true,
    isTruncated,
    lines: previewLines,
  };
}

export function buildFileChangeDiffPreview(fileChange: FileChange): ActivityDiffPreview {
  const diffContent = typeof fileChange.diff === 'string' ? fileChange.diff.trim() : '';
  if (!diffContent) {
    return buildFileChangeContentPreview(fileChange);
  }

  const diffPreview = buildChatLinePreview(diffContent, {
    maxCharacters: MAX_ACTIVITY_PREVIEW_CHARACTERS,
    maxLines: MAX_ACTIVITY_DIFF_PREVIEW_LINES,
  });
  return {
    isFallback: false,
    isTruncated: diffPreview.isTruncated,
    lines: diffPreview.lines.map(buildActivityDiffPreviewLine),
  };
}

export function resolveActivityFileChangeKey(fileChange: FileChange, index: number): string {
  return JSON.stringify([
    index,
    fileChange.path.trim().replace(/\\/gu, '/'),
  ]);
}

export function countDiffLineImpacts(diff: string | undefined): ActivityFileChangeLineImpact | null {
  if (!diff?.trim()) {
    return null;
  }

  let additions = 0;
  let deletions = 0;
  const normalizedDiff = diff.replace(/\r\n?/gu, '\n');
  let lineStart = 0;
  while (lineStart <= normalizedDiff.length) {
    const lineEnd = normalizedDiff.indexOf('\n', lineStart);
    const line = normalizedDiff.slice(
      lineStart,
      lineEnd === -1 ? normalizedDiff.length : lineEnd,
    );
    if (line.startsWith('+++') || line.startsWith('---')) {
      // File metadata is not part of the line impact.
    } else if (line.startsWith('+')) {
      additions += 1;
    } else if (line.startsWith('-')) {
      deletions += 1;
    }

    if (lineEnd === -1) {
      break;
    }
    lineStart = lineEnd + 1;
  }

  if (additions === 0 && deletions === 0) {
    return null;
  }

  return {
    additions,
    deletions,
    isKnown: true,
  };
}

export function resolveActivityFileChangeLineImpact(
  fileChange: ActivityFileChange,
): ActivityFileChangeLineImpact {
  const additions = normalizeActivityLineCount(fileChange.additions);
  const deletions = normalizeActivityLineCount(fileChange.deletions);
  if (additions > 0 || deletions > 0) {
    return {
      additions,
      deletions,
      isKnown: true,
    };
  }

  const diffLineImpact = countDiffLineImpacts(fileChange.diff);
  if (diffLineImpact) {
    return diffLineImpact;
  }

  const isKnown = fileChange.lineImpactKnown !== false;

  return {
    additions,
    deletions,
    isKnown,
  };
}

function resolveCommandExecutionStatusLabel(
  tone: CommandExecutionTone,
  t: ChatMessageTranslate | undefined,
): string {
  if (tone === 'reply') {
    return t?.('chat.commandNeedsReply') ?? 'Needs reply';
  }
  if (tone === 'approval') {
    return t?.('chat.commandNeedsApproval') ?? 'Needs approval';
  }
  if (tone === 'success') {
    return t?.('chat.commandSucceeded') ?? 'Succeeded';
  }
  if (tone === 'cancelled') {
    return t?.('chat.commandCancelled') ?? 'Cancelled';
  }
  if (tone === 'error') {
    return t?.('chat.commandFailed') ?? 'Failed';
  }

  return t?.('chat.commandRunning') ?? 'Running';
}

function resolveDiffPreviewLineClassName(tone: ActivityDiffPreviewLineTone): string {
  if (tone === 'addition') {
    return 'bg-emerald-500/10 text-emerald-200';
  }
  if (tone === 'deletion') {
    return 'bg-red-500/10 text-red-200';
  }
  if (tone === 'hunk') {
    return 'bg-sky-500/10 text-sky-200';
  }
  if (tone === 'meta') {
    return 'text-gray-500';
  }

  return 'text-gray-300';
}

function renderCommandStatusIcon(tone: CommandExecutionTone, size: number) {
  if (tone === 'success') {
    return <CheckCircle2 size={size} className="text-emerald-400/80" aria-hidden="true" />;
  }
  if (tone === 'error') {
    return <AlertCircle size={size} className="text-red-400/80" aria-hidden="true" />;
  }
  if (tone === 'cancelled') {
    return <Ban size={size} className="text-gray-400" aria-hidden="true" />;
  }
  if (tone === 'reply' || tone === 'approval') {
    return <AlertCircle size={size} className="text-amber-300/85" aria-hidden="true" />;
  }

  return (
    <span
      className="inline-block rounded-full border-2 border-blue-500/25 border-t-blue-400 motion-safe:animate-spin"
      aria-hidden="true"
      style={{ height: size, width: size }}
    />
  );
}

function resolveCommandExecutionStatusClassName(tone: CommandExecutionTone): string {
  if (tone === 'reply' || tone === 'approval') {
    return 'bg-amber-500/10 text-amber-200';
  }
  if (tone === 'success') {
    return 'bg-emerald-500/10 text-emerald-200';
  }
  if (tone === 'error') {
    return 'bg-red-500/10 text-red-200';
  }
  if (tone === 'cancelled') {
    return 'bg-white/5 text-gray-400';
  }

  return 'bg-white/5 text-gray-400';
}

function renderCommandExecutionCard({
  cmd,
  commandDetailsId,
  commandLabel,
  commandKey,
  commandOutputLabel,
  copyLabel,
  copyMessageToClipboard,
  isCommandExpanded,
  noCommandOutputLabel,
  successIconSize,
  t,
  toggleCommandDetails,
}: RenderCommandExecutionCardOptions) {
  const commandTone = resolveCommandExecutionTone(cmd);
  const commandOutputPreview = isCommandExpanded ? buildCommandOutputPreview(cmd.output) : null;
  const commandTextPreview = buildChatContentPreview(cmd.command, {
    maxCharacters: MAX_COMMAND_TEXT_PREVIEW_CHARACTERS,
    tailCharacters: 1_000,
  });
  const commandSummary = buildChatContentPreview(cmd.command, {
    maxCharacters: MAX_COMMAND_SUMMARY_CHARACTERS,
    tailCharacters: 0,
  }).text.replace(/\s+/gu, ' ').trim();
  const commandStatusLabel = resolveCommandExecutionStatusLabel(commandTone, t);
  const commandStatusClassName = resolveCommandExecutionStatusClassName(commandTone);
  return (
    <div key={commandKey} className="overflow-hidden" data-chat-command-row="inline">
      <div className="flex flex-wrap items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.035]">
        <button
          type="button"
          data-chat-command-disclosure="true"
          className="flex min-w-0 flex-1 basis-32 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          aria-expanded={isCommandExpanded}
          aria-controls={commandDetailsId}
          aria-label={`${commandStatusLabel}: ${commandSummary}`}
          title={isCommandExpanded ? t?.('chat.activityCollapse') : t?.('chat.activityExpand')}
          onClick={() => toggleCommandDetails(commandKey)}
        >
          <span className="shrink-0 text-blue-300">
            {isCommandExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
          <span className="shrink-0 max-[520px]:hidden">
            {renderCommandStatusIcon(commandTone, successIconSize)}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-200">
            {commandSummary}
          </span>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] max-[520px]:sr-only ${commandTone === 'success' ? 'max-[760px]:sr-only' : ''} ${commandStatusClassName}`}>
            {commandStatusLabel}
          </span>
        </button>
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          title={copyLabel}
          aria-label={`${copyLabel}: ${commandSummary}`}
          onClick={() => copyMessageToClipboard(cmd.command)}
        >
          <Copy size={12} />
        </button>
      </div>
      {isCommandExpanded ? (
        <div
          id={commandDetailsId}
          className="space-y-2 px-7 pb-2 pt-1"
          data-chat-command-details="true"
        >
          <div>
            <div className="mb-1 text-[11px] font-medium text-gray-500">
              {commandLabel}
            </div>
            <pre
              className="max-h-40 overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words custom-scrollbar"
              role="region"
              aria-label={commandLabel}
              tabIndex={0}
            >
              {commandTextPreview.text}
            </pre>
            {commandTextPreview.isTruncated ? (
              <div
                className="pt-1 text-[10px] text-gray-400/80"
                data-chat-command-text-truncated="true"
              >
                {t?.('chat.toolDetailTruncated')
                  ?? 'Preview truncated. Copy to inspect the full content.'}
              </div>
            ) : null}
          </div>
          <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-gray-500">
            <span>{commandOutputLabel}</span>
            {cmd.output?.trim() ? (
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                title={copyLabel}
                aria-label={`${copyLabel}: ${commandOutputLabel}`}
                onClick={() => copyMessageToClipboard(cmd.output ?? '')}
              >
                <Copy size={11} />
              </button>
            ) : null}
          </div>
          {commandOutputPreview?.text ? (
            <>
              <pre
                className="max-h-64 overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words custom-scrollbar"
                role="region"
                aria-label={commandOutputLabel}
                tabIndex={0}
              >
                {commandOutputPreview.text}
              </pre>
              {commandOutputPreview.isTruncated ? (
                <div
                  className="pt-1 text-[10px] text-gray-400/80"
                  data-chat-command-output-truncated={
                    commandOutputPreview.isCharacterTruncated ? 'characters' : 'lines'
                  }
                >
                  {commandOutputPreview.isCharacterTruncated
                    ? t?.('chat.toolDetailTruncated')
                      ?? 'Preview truncated. Copy to inspect the full content.'
                    : t?.('chat.commandOutputTruncated', {
                        count: commandOutputPreview.omittedLineCount,
                      })
                      ?? `${commandOutputPreview.omittedLineCount} lines omitted. Copy to inspect the complete output.`}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px] text-gray-500">
              {noCommandOutputLabel}
            </div>
          )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const ChatActivitySummary = memo(function ChatActivitySummary({
  commands: rawCommands,
  compact = false,
  copyLabel,
  copyMessageToClipboard,
  disclosureScopeKey,
  environment,
  expandedDisclosureKeys,
  fileChanges: rawFileChanges,
  messageId,
  successIconSize,
  toggleDisclosure,
}: ChatActivitySummaryProps) {
  const summaryDetailsId = useId();
  const fileChanges = useMemo(
    () => (rawFileChanges ?? []).filter((fileChange) => fileChange.path.trim().length > 0),
    [rawFileChanges],
  );
  const commands = useMemo(
    () => (rawCommands ?? []).filter((command) => command.command.trim().length > 0),
    [rawCommands],
  );
  const summaryDisclosureKey = `${disclosureScopeKey}\u0001summary`;
  const isExpanded = expandedDisclosureKeys.has(summaryDisclosureKey);

  const fileChangeLineImpacts = useMemo(
    () => fileChanges.map(resolveActivityFileChangeLineImpact),
    [fileChanges],
  );
  const fileChangesWithKnownLineImpact = fileChangeLineImpacts.filter(
    (lineImpact) => lineImpact.isKnown,
  );
  const totalAdditions = fileChangesWithKnownLineImpact.reduce(
    (sum, lineImpact) => sum + lineImpact.additions,
    0,
  );
  const totalDeletions = fileChangesWithKnownLineImpact.reduce(
    (sum, lineImpact) => sum + lineImpact.deletions,
    0,
  );
  const hasCompleteLineImpact = fileChanges.length > 0
    && fileChangesWithKnownLineImpact.length === fileChanges.length;

  if (fileChanges.length === 0 && commands.length === 0) {
    return null;
  }

  const editedFilesLabel = environment?.t('chat.editedFilesSummary', {
    count: fileChanges.length,
  }) ?? `Edited ${fileChanges.length} file${fileChanges.length === 1 ? '' : 's'}`;
  const ranCommandsLabel = environment?.t('chat.ranCommandsSummary', {
    count: commands.length,
  }) ?? `Ran ${commands.length} command${commands.length === 1 ? '' : 's'}`;
  const activitySummaryLabel = environment?.t('chat.activitySummary') ?? 'Code activity';
  const changedLinesLabel = hasCompleteLineImpact
    ? environment?.t('chat.changedLinesSummary', {
      additions: totalAdditions,
      deletions: totalDeletions,
    }) ?? `+${totalAdditions} -${totalDeletions}`
    : environment?.t('chat.changedLinesUnknown') ?? 'Line impact not captured';
  const expandLabel = environment?.t('chat.activityExpand') ?? 'Show activity details';
  const collapseLabel = environment?.t('chat.activityCollapse') ?? 'Hide activity details';
  const fileSectionLabel = environment?.t('chat.filesChangedSection') ?? 'Files changed';
  const commandSectionLabel = environment?.t('chat.commandsRunSection') ?? 'Commands';
  const openFullDiffLabel = environment?.t('chat.openFullDiff') ?? 'Open full diff';
  const openFileInEditorLabel = environment?.t('chat.openFileInEditor') ?? 'Open file in editor';
  const toggleDiffPreviewLabel = environment?.t('chat.toggleDiffPreview') ?? 'Toggle diff preview';
  const diffPreviewLabel = environment?.t('chat.diffPreview') ?? 'Diff preview';
  const noInlineDiffLabel = environment?.t('chat.noInlineDiff') ?? 'No inline diff available';
  const lineImpactUnknownLabel = environment?.t('chat.changedLinesUnknown') ?? 'Line impact not captured';
  const commandOutputLabel = environment?.t('chat.commandOutput') ?? 'Output';
  const commandLabel = environment?.t('chat.commandText') ?? 'Command';
  const noCommandOutputLabel = environment?.t('chat.commandNoOutput') ?? 'No command output captured';
  const changesAppliedLabel = environment?.t('chat.changesApplied') ?? 'Changes applied';
  const restoreLabel = environment?.t('chat.restoreChanges') ?? 'Restore';
  const hasRestorableChanges = hasRestorableFileChanges(fileChanges);
  const commandTones = commands.map(resolveCommandExecutionTone);
  const failedCommandCount = commandTones.filter((tone) => tone === 'error').length;
  const waitingCommandCount = commandTones.filter(
    (tone) => tone === 'approval' || tone === 'reply',
  ).length;
  const runningCommandCount = commandTones.filter((tone) => tone === 'running').length;
  const cancelledCommandCount = commandTones.filter((tone) => tone === 'cancelled').length;
  const summaryCommandTone: CommandExecutionTone = failedCommandCount > 0
    ? 'error'
    : waitingCommandCount > 0
      ? 'approval'
      : runningCommandCount > 0
        ? 'running'
        : cancelledCommandCount > 0
          ? 'cancelled'
          : 'success';
  const commandSummaryStatusLabel = failedCommandCount > 0
    ? environment?.t('chat.commandsFailedSummary', { count: failedCommandCount })
      ?? `${failedCommandCount} failed`
    : waitingCommandCount > 0
      ? environment?.t('chat.commandsWaitingSummary', { count: waitingCommandCount })
        ?? `${waitingCommandCount} waiting`
      : runningCommandCount > 0
        ? environment?.t('chat.commandsRunningSummary', { count: runningCommandCount })
          ?? `${runningCommandCount} running`
        : cancelledCommandCount > 0
          ? environment?.t('chat.commandsCancelledSummary', { count: cancelledCommandCount })
            ?? `${cancelledCommandCount} cancelled`
          : '';
  const toggleFileDetails = (fileKey: string) => {
    toggleDisclosure(`${disclosureScopeKey}\u0001file\u0001${fileKey}`);
  };

  const toggleCommandDetails = (commandKey: string) => {
    toggleDisclosure(`${disclosureScopeKey}\u0001command\u0001${commandKey}`);
  };

  return (
    <div
      data-chat-activity-summary="inline"
      className={`mt-2 w-full overflow-hidden ${
        compact ? 'text-xs' : 'text-sm'
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        title={isExpanded ? collapseLabel : expandLabel}
        aria-expanded={isExpanded}
        aria-controls={summaryDetailsId}
        onClick={() => toggleDisclosure(summaryDisclosureKey)}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-300">
            {commands.length > 0 && summaryCommandTone !== 'success'
              ? renderCommandStatusIcon(summaryCommandTone, compact ? 13 : 14)
              : commands.length > 0 && fileChanges.length === 0
                ? <Terminal size={compact ? 13 : 14} />
                : <CheckCircle2 size={compact ? 13 : 14} />}
          </span>
          <span className="font-medium text-gray-200">
            {fileChanges.length > 0 && commands.length > 0
              ? activitySummaryLabel
              : fileChanges.length > 0
                ? editedFilesLabel
                : ranCommandsLabel}
          </span>
          {fileChanges.length > 0 && commands.length > 0 ? (
            <span
              data-chat-activity-counts="true"
              className={`items-center gap-1.5 rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-gray-300 ${
                compact ? 'inline-flex' : 'inline-flex min-[901px]:hidden'
              }`}
              title={`${ranCommandsLabel}; ${editedFilesLabel}`}
              aria-label={`${ranCommandsLabel}; ${editedFilesLabel}`}
            >
              <Terminal size={10} className="text-blue-300" aria-hidden="true" />
              <span>{commands.length}</span>
              <FileCode2 size={10} className="ml-0.5 text-sky-300" aria-hidden="true" />
              <span>{fileChanges.length}</span>
            </span>
          ) : null}
          {fileChanges.length > 0 && commands.length > 0 && !compact ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-gray-300 max-[900px]:hidden">
              <FileCode2 size={11} className="text-sky-300" />
              {editedFilesLabel}
            </span>
          ) : null}
          {commands.length > 0 && fileChanges.length > 0 && !compact ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-gray-300 max-[900px]:hidden">
              <Terminal size={11} className="text-blue-300" />
              {ranCommandsLabel}
            </span>
          ) : null}
          {fileChanges.length > 0 && hasCompleteLineImpact && !compact ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-200 max-[900px]:hidden">
              <span>+{totalAdditions}</span>
              <span className="text-red-200">-{totalDeletions}</span>
            </span>
          ) : null}
          {commandSummaryStatusLabel ? (
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${resolveCommandExecutionStatusClassName(summaryCommandTone)}`}
            >
              {commandSummaryStatusLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-gray-500">
          {fileChanges.length > 0 ? (
            <span className="hidden font-mono text-[11px] min-[901px]:inline">{changedLinesLabel}</span>
          ) : null}
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {isExpanded ? (
        <div
          id={summaryDetailsId}
          className="px-1.5 pb-2 pt-1"
          data-chat-activity-details="true"
        >
          {commands.length > 0 ? (
            <div className={fileChanges.length > 0 ? 'mb-3' : undefined}>
              <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-normal text-gray-500">
                <Terminal size={12} />
                <span>{commandSectionLabel}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {commands.map((cmd, cmdIdx) => {
                  const commandKey = `${cmdIdx}\u0001${cmd.toolCallId?.trim() || 'command'}`;
                  const isCommandExpanded = expandedDisclosureKeys.has(
                    `${disclosureScopeKey}\u0001command\u0001${commandKey}`,
                  );
                  return renderCommandExecutionCard({
                    cmd,
                    commandDetailsId: `${summaryDetailsId}-command-${cmdIdx}`,
                    commandKey,
                    commandLabel,
                    commandOutputLabel,
                    copyLabel,
                    copyMessageToClipboard,
                    isCommandExpanded,
                    noCommandOutputLabel,
                    successIconSize,
                    t: environment?.t,
                    toggleCommandDetails,
                  });
                })}
              </div>
            </div>
          ) : null}

          {fileChanges.length > 0 ? (
            <div>
              <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-normal text-gray-500">
                <FileCode2 size={12} />
                <span>{fileSectionLabel}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {fileChanges.map((fileChange, fileIndex) => {
                  const fileKey = resolveActivityFileChangeKey(fileChange, fileIndex);
                  const normalizedPathParts = fileChange.path.replace(/\\/gu, '/').split('/').filter(Boolean);
                  const fileName = normalizedPathParts.at(-1) || fileChange.path;
                  const parentPath = normalizedPathParts.slice(0, -1).join('/');
                  const updateStatusLabel = resolveActivityFileChangeStatusLabel(
                    fileChange,
                    environment?.t,
                  );
                  const isFileExpanded = expandedDisclosureKeys.has(
                    `${disclosureScopeKey}\u0001file\u0001${fileKey}`,
                  );
                  const diffPreview = isFileExpanded
                    ? buildFileChangeDiffPreview(fileChange)
                    : null;
                  const lineImpact = fileChangeLineImpacts[fileIndex] ?? resolveActivityFileChangeLineImpact(fileChange);
                  const hasFullDiff = Boolean(
                    fileChange.diff?.trim()
                    || typeof fileChange.content === 'string'
                    || typeof fileChange.originalContent === 'string',
                  );
                  const fileDetailsId = `${summaryDetailsId}-file-${fileIndex}`;
                  return (
                    <div key={fileKey} className="overflow-hidden">
                      <div
                        data-chat-file-change-row="inline"
                        className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.035]"
                      >
                        <button
                          type="button"
                          data-chat-file-disclosure="true"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sky-300 transition-colors hover:bg-white/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                          aria-expanded={isFileExpanded}
                          aria-controls={fileDetailsId}
                          aria-label={`${toggleDiffPreviewLabel}: ${fileChange.path}`}
                          title={toggleDiffPreviewLabel}
                          onClick={() => toggleFileDetails(fileKey)}
                        >
                          {isFileExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        <button
                          type="button"
                          data-chat-file-open="true"
                          className="group/file flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                          title={`${environment?.onOpenFile ? openFileInEditorLabel : toggleDiffPreviewLabel}: ${fileChange.path}`}
                          aria-label={`${environment?.onOpenFile ? openFileInEditorLabel : toggleDiffPreviewLabel}: ${fileChange.path}`}
                          aria-expanded={environment?.onOpenFile ? undefined : isFileExpanded}
                          aria-controls={environment?.onOpenFile ? undefined : fileDetailsId}
                          onClick={() => {
                            if (environment?.onOpenFile) {
                              environment.onOpenFile(fileChange.path);
                              return;
                            }
                            toggleFileDetails(fileKey);
                          }}
                        >
                          <FileCode2 size={13} className="shrink-0 text-sky-300 max-[760px]:hidden" />
                          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-200 group-hover/file:text-sky-100 max-[900px]:hidden">
                            {fileChange.path}
                          </span>
                          <span className="hidden min-w-0 flex-1 flex-col items-start gap-0 font-mono text-gray-200 group-hover/file:text-sky-100 max-[900px]:flex">
                            <span className="block w-full truncate text-[12px]">{fileName}</span>
                            {parentPath ? (
                              <span className="block w-full truncate text-[10px] text-gray-400/80">{parentPath}</span>
                            ) : null}
                          </span>
                          {environment?.onOpenFile ? (
                            <FileCode2 size={12} className="shrink-0 text-gray-400 opacity-0 transition-opacity group-hover/file:opacity-100 max-[900px]:opacity-100" />
                          ) : null}
                        </button>
                        {updateStatusLabel && !compact ? (
                          <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 max-[900px]:hidden">
                            {updateStatusLabel}
                          </span>
                        ) : null}
                        {lineImpact.isKnown ? (
                          <>
                            <span className="shrink-0 font-mono text-[11px] text-emerald-300">
                              +{lineImpact.additions}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-red-300">
                              -{lineImpact.deletions}
                            </span>
                          </>
                        ) : (
                          <span
                            className="shrink-0 rounded-md bg-white/[0.025] px-1.5 py-0.5 text-[10px] text-gray-500"
                            aria-label={lineImpactUnknownLabel}
                            title={lineImpactUnknownLabel}
                          >
                            {compact ? '?' : (
                              <>
                                <span className="max-[760px]:hidden">{lineImpactUnknownLabel}</span>
                                <span className="hidden max-[760px]:inline">?</span>
                              </>
                            )}
                          </span>
                        )}
                        {environment?.onViewChanges && hasFullDiff ? (
                          <button
                            type="button"
                            data-chat-file-diff="true"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                            title={`${openFullDiffLabel}: ${fileChange.path}`}
                            aria-label={`${openFullDiffLabel}: ${fileChange.path}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              environment?.onViewChanges?.(fileChange);
                            }}
                          >
                            <Eye size={12} />
                          </button>
                        ) : null}
                      </div>
                      {isFileExpanded && diffPreview ? (
                        <div
                          id={fileDetailsId}
                          data-chat-file-inline-diff="true"
                          className="px-7 pb-2 pt-1"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-gray-500">
                              {diffPreviewLabel}
                            </span>
                            {diffPreview.isFallback && diffPreview.lines.length > 0 ? (
                              <span className="text-[10px] text-gray-400/80">
                                {environment?.t('chat.contentPreviewFallback') ?? 'content preview'}
                              </span>
                            ) : null}
                          </div>
                          {diffPreview.lines.length > 0 ? (
                            <div
                              className="max-h-72 overflow-auto rounded-md bg-black/20 py-2 font-mono text-[11px] leading-relaxed custom-scrollbar"
                              role="region"
                              aria-label={`${diffPreviewLabel}: ${fileChange.path}`}
                              tabIndex={0}
                            >
                              {diffPreview.lines.map((line, lineIndex) => (
                                <div
                                  key={`${fileKey}\u0001${lineIndex}`}
                                  className={`grid grid-cols-[2rem_1fr] gap-2 px-2 ${resolveDiffPreviewLineClassName(line.tone)}`}
                                >
                                  <span className="select-none text-right text-gray-500">
                                    {line.marker}
                                  </span>
                                  <span className="min-w-0 whitespace-pre-wrap break-words">
                                    {line.text || ' '}
                                  </span>
                                </div>
                              ))}
                              {diffPreview.isTruncated ? (
                                <div className="px-2 pt-1 text-[11px] text-gray-500">...</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px] text-gray-500">
                              {noInlineDiffLabel}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {fileChanges.length > 0 ? (
            <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-gray-500">
              <div className="flex min-w-0 items-center gap-1.5">
                <CheckCircle2 size={12} className="shrink-0 text-emerald-400/60" />
                <span className="truncate">{changesAppliedLabel}</span>
              </div>
              {hasRestorableChanges && environment?.onRestore ? (
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                  title={restoreLabel}
                  onClick={() => environment.onRestore?.(messageId)}
                >
                  <RotateCcw size={12} />
                  <span>{restoreLabel}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
