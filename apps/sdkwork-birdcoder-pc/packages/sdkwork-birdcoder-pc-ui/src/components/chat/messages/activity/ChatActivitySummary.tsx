import React, { memo, useId, useMemo } from 'react';
import {
  Blocks,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Globe,
  Search,
  Terminal,
  Wrench,
} from 'lucide-react';
import type { AgentSessionCommandView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ActivityFileChange } from '../messageActivity.ts';
import type { ChatMessageEnvironment } from '../types.ts';
import {
  ChatCommandActivityList,
  CommandActivityStatusIcon,
  resolveCommandActivitySummaryState,
  resolveCommandExecutionStatusClassName,
} from './ChatCommandActivityList.tsx';
import { ChatFileActivityList } from './ChatFileActivityList.tsx';
import {
  resolveActivityFileChangeLineImpact,
} from './activityPresentation.ts';
import { revealChatDisclosureDetails } from '../revealChatDisclosureDetails.ts';

export {
  buildFileChangeDiffPreview,
  countDiffLineImpacts,
  MAX_ACTIVITY_CONTENT_PREVIEW_LINES,
  MAX_ACTIVITY_DIFF_PREVIEW_LINES,
  MAX_ACTIVITY_PREVIEW_CHARACTERS,
  resolveActivityFileChangeKey,
  resolveActivityFileChangeLineImpact,
  type ActivityDiffPreview,
  type ActivityDiffPreviewLine,
  type ActivityDiffPreviewLineTone,
  type ActivityFileChangeLineImpact,
} from './activityPresentation.ts';
export {
  buildCommandOutputPreview,
  MAX_COMMAND_OUTPUT_PREVIEW_LINES,
} from '../contentPreview.ts';
export type { CommandExecutionTone } from './ChatCommandActivityList.tsx';

export interface ChatActivitySummaryProps {
  commands?: readonly AgentSessionCommandView[];
  compact?: boolean;
  copyLabel: string;
  copyMessageToClipboard: (content: string) => void;
  disclosureScopeKey: string;
  engineId?: string;
  environment?: ChatMessageEnvironment | null;
  expandedDisclosureKeys: ReadonlySet<string>;
  fileChanges?: readonly ActivityFileChange[];
  mcpSources?: ChatActivitySummarySegmentInput['mcpSources'];
  messageId: string;
  successIconSize: number;
  toggleDisclosure: (key: string) => void;
  unnamedMcpToolCallCount?: number;
  loadedToolCount?: number;
  explorationCount?: number;
  webSearchCount?: number;
  runningWebSearchCount?: number;
}

export function resolveChatActivityActionLabel(
  fileCount: number,
  commandCount: number,
  t?: ChatMessageEnvironment['t'],
): string {
  const editedFilesLabel = t?.('chat.activityEditedFilesSummary', { count: fileCount })
    ?? (fileCount === 1 ? 'Edited a file' : 'Edited files');
  const ranCommandsLabel = t?.('chat.activityRanCommandsSummary', { count: commandCount })
    ?? (commandCount === 1 ? 'Ran a command' : 'Ran commands');
  const ranCommandsContinuation = t?.('chat.activityRanCommandsContinuation', {
    count: commandCount,
  }) ?? (commandCount === 1 ? 'ran a command' : 'ran commands');

  if (fileCount > 0 && commandCount > 0) {
    return t?.('chat.activityCombinedSummary', {
      commands: ranCommandsContinuation,
      files: editedFilesLabel,
    }) ?? `${editedFilesLabel}, ${ranCommandsContinuation}`;
  }
  return fileCount > 0 ? editedFilesLabel : ranCommandsLabel;
}

export interface ChatActivitySummarySegmentInput {
  fileCount: number;
  commandCount: number;
  mcpSources?: readonly {
    key: string;
    name: string;
    count: number;
    runningCount: number;
  }[];
  unnamedMcpToolCallCount?: number;
  loadedToolCount?: number;
  explorationCount?: number;
  webSearchCount?: number;
  runningWebSearchCount?: number;
}

export interface ChatActivitySummarySegment {
  kind:
    | 'mcp-sources'
    | 'loaded-tools'
    | 'called-tools'
    | 'file-changes'
    | 'exploration'
    | 'commands'
    | 'web-search';
  count?: number;
  sources?: string;
}

/**
 * Builds the collapsed activity summary segments in the exact Codex desktop
 * order: named MCP sources, loaded tools, unnamed tool calls, file changes,
 * exploration, commands, then web searches. Every segment with a count above
 * zero participates; the first rendered segment uses sentence-initial casing
 * and the following segments use mid-sentence casing, joined with ", ".
 */
export function resolveChatActivitySummarySegments(
  input: ChatActivitySummarySegmentInput,
  t?: ChatMessageEnvironment['t'],
): ChatActivitySummarySegment[] {
  const segments: ChatActivitySummarySegment[] = [];
  if (input.mcpSources && input.mcpSources.length > 0) {
    const browserLabel = t?.('chat.activitySourcesBrowser') ?? 'the browser';
    const sources = input.mcpSources
      .map((source) => (
        source.name.trim().toLowerCase() === 'browser-use' ? browserLabel : source.name
      ))
      .join(', ');
    segments.push({ kind: 'mcp-sources', sources });
  }
  if (input.loadedToolCount) {
    segments.push({ kind: 'loaded-tools', count: input.loadedToolCount });
  }
  if (input.unnamedMcpToolCallCount) {
    segments.push({ kind: 'called-tools', count: input.unnamedMcpToolCallCount });
  }
  if (input.fileCount > 0) {
    segments.push({ kind: 'file-changes', count: input.fileCount });
  }
  if (input.explorationCount) {
    segments.push({ kind: 'exploration', count: input.explorationCount });
  }
  if (input.commandCount > 0) {
    segments.push({ kind: 'commands', count: input.commandCount });
  }
  if (input.webSearchCount) {
    segments.push({ kind: 'web-search', count: input.webSearchCount });
  }
  return segments;
}

const CHAT_ACTIVITY_SUMMARY_SEGMENT_KEYS = {
  'mcp-sources': {
    leading: 'chat.activityUsedSources',
    continuation: 'chat.activityUsedSourcesContinuation',
  },
  'loaded-tools': {
    leading: 'chat.activityLoadedToolSummary',
    continuation: 'chat.activityLoadedToolContinuation',
  },
  'called-tools': {
    leading: 'chat.activityCalledToolSummary',
    continuation: 'chat.activityCalledToolContinuation',
  },
  'file-changes': {
    leading: 'chat.activityEditedFilesSummary',
    continuation: 'chat.activityEditedFilesContinuation',
  },
  exploration: {
    leading: 'chat.activityReadFilesSummary',
    continuation: 'chat.activityReadFilesContinuation',
  },
  commands: {
    leading: 'chat.activityRanCommandsSummary',
    continuation: 'chat.activityRanCommandsContinuation',
  },
  'web-search': {
    leading: 'chat.activitySearchedWebSummary',
    continuation: 'chat.activitySearchedWebContinuation',
  },
} as const;

export function resolveChatActivitySummaryLabel(
  input: ChatActivitySummarySegmentInput,
  t?: ChatMessageEnvironment['t'],
): string | null {
  const segments = resolveChatActivitySummarySegments(input, t);
  if (segments.length === 0) {
    return null;
  }
  const labels = segments.map((segment, index) => {
    const keys = CHAT_ACTIVITY_SUMMARY_SEGMENT_KEYS[segment.kind];
    const key = index === 0 ? keys.leading : keys.continuation;
    const options: Record<string, unknown> = {};
    if (segment.count !== undefined) {
      options.count = segment.count;
    }
    if (segment.sources !== undefined) {
      options.sources = segment.sources;
    }
    const translated = t?.(key, options);
    if (typeof translated === 'string' && translated.trim()) {
      return translated;
    }
    return resolveChatActivitySummarySegmentFallback(segment, index === 0);
  });
  return labels.join(', ');
}

function resolveChatActivitySummarySegmentFallback(
  segment: ChatActivitySummarySegment,
  isLeading: boolean,
): string {
  const count = segment.count;
  switch (segment.kind) {
    case 'mcp-sources':
      return isLeading
        ? `Used ${segment.sources}`
        : `used ${segment.sources}`;
    case 'loaded-tools':
      return count === 1
        ? (isLeading ? 'Loaded a tool' : 'loaded a tool')
        : (isLeading ? 'Loaded tools' : 'loaded tools');
    case 'called-tools':
      return count === 1
        ? (isLeading ? 'Called a tool' : 'called a tool')
        : (isLeading ? 'Called tools' : 'called tools');
    case 'file-changes':
      return count === 1
        ? (isLeading ? 'Edited a file' : 'edited a file')
        : (isLeading ? 'Edited files' : 'edited files');
    case 'exploration':
      return isLeading ? 'Read files' : 'read files';
    case 'commands':
      return count === 1
        ? (isLeading ? 'Ran a command' : 'ran a command')
        : (isLeading ? 'Ran commands' : 'ran commands');
    case 'web-search':
      return isLeading ? 'Searched the web' : 'searched the web';
  }
}

export const ChatActivitySummary = memo(function ChatActivitySummary({
  commands: rawCommands,
  compact = false,
  copyLabel,
  copyMessageToClipboard,
  disclosureScopeKey,
  engineId,
  environment,
  expandedDisclosureKeys,
  fileChanges: rawFileChanges,
  mcpSources,
  messageId,
  successIconSize,
  toggleDisclosure,
  unnamedMcpToolCallCount,
  loadedToolCount,
  explorationCount,
  webSearchCount,
  runningWebSearchCount,
}: ChatActivitySummaryProps) {
  const summaryDetailsId = useId();
  const fileChanges = useMemo(
    () => (rawFileChanges ?? []).filter((fileChange) => fileChange.path.trim()),
    [rawFileChanges],
  );
  const commands = useMemo(
    () => (rawCommands ?? []).filter((command) => command.command.trim()),
    [rawCommands],
  );
  const lineImpacts = useMemo(
    () => fileChanges.map(resolveActivityFileChangeLineImpact),
    [fileChanges],
  );
  const summaryDisclosureKey = `${disclosureScopeKey}\u0001summary`;
  const isExpanded = expandedDisclosureKeys.has(summaryDisclosureKey);

  if (fileChanges.length === 0 && commands.length === 0) {
    return null;
  }

  const knownLineImpacts = lineImpacts.filter((impact) => impact.isKnown);
  const totalAdditions = knownLineImpacts.reduce((sum, impact) => sum + impact.additions, 0);
  const totalDeletions = knownLineImpacts.reduce((sum, impact) => sum + impact.deletions, 0);
  const hasCompleteLineImpact = fileChanges.length > 0
    && knownLineImpacts.length === fileChanges.length;
  const editedFilesCountLabel = environment?.t('chat.editedFilesSummary', {
    count: fileChanges.length,
  }) ?? `Edited ${fileChanges.length} file${fileChanges.length === 1 ? '' : 's'}`;
  const ranCommandsCountLabel = environment?.t('chat.ranCommandsSummary', {
    count: commands.length,
  }) ?? `Ran ${commands.length} command${commands.length === 1 ? '' : 's'}`;
  const activitySegments = resolveChatActivitySummarySegments({
    fileCount: fileChanges.length,
    commandCount: commands.length,
    mcpSources,
    unnamedMcpToolCallCount,
    loadedToolCount,
    explorationCount,
    webSearchCount,
    runningWebSearchCount,
  }, environment?.t);
  const activityLabel = resolveChatActivitySummaryLabel({
    fileCount: fileChanges.length,
    commandCount: commands.length,
    mcpSources,
    unnamedMcpToolCallCount,
    loadedToolCount,
    explorationCount,
    webSearchCount,
    runningWebSearchCount,
  }, environment?.t)
    ?? resolveChatActivityActionLabel(fileChanges.length, commands.length, environment?.t);
  const activityAccessibleLabel = fileChanges.length > 0 && commands.length > 0
    ? `${editedFilesCountLabel}; ${ranCommandsCountLabel}`
    : fileChanges.length > 0
      ? editedFilesCountLabel
      : ranCommandsCountLabel;
  const changedLinesLabel = hasCompleteLineImpact
    ? environment?.t('chat.changedLinesSummary', {
        additions: totalAdditions,
        deletions: totalDeletions,
      }) ?? `+${totalAdditions} -${totalDeletions}`
    : environment?.t('chat.changedLinesUnknown') ?? 'Line impact not captured';
  const expandLabel = environment?.t('chat.activityExpand') ?? 'Show activity details';
  const collapseLabel = environment?.t('chat.activityCollapse') ?? 'Hide activity details';
  const commandSectionLabel = environment?.t('chat.commandsRunSection') ?? 'Commands';
  const fileSectionLabel = environment?.t('chat.filesChangedSection') ?? 'Files changed';
  const commandSummary = resolveCommandActivitySummaryState(commands, environment?.t);
  const activityKind = fileChanges.length > 0 && commands.length > 0
    ? 'files-and-commands'
    : fileChanges.length > 0
      ? 'files'
      : commands.length > 0
        ? 'commands'
        : activitySegments[0]?.kind ?? 'commands';

  return (
    <div
      data-chat-activity-summary="inline"
      data-chat-activity-kind={activityKind}
      data-chat-engine={engineId}
      className={`w-full min-w-0 overflow-hidden ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-gray-400 transition-colors hover:bg-white/[0.035] hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        title={isExpanded ? collapseLabel : expandLabel}
        aria-label={`${activityAccessibleLabel}. ${isExpanded ? collapseLabel : expandLabel}`}
        aria-expanded={isExpanded}
        aria-controls={summaryDetailsId}
        onClick={() => {
          toggleDisclosure(summaryDisclosureKey);
          if (!isExpanded) revealChatDisclosureDetails(summaryDetailsId);
        }}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-500">
          {commands.length > 0 && commandSummary.tone !== 'success'
            ? <CommandActivityStatusIcon tone={commandSummary.tone} size={compact ? 13 : 14} />
            : activityKind === 'mcp-sources'
              ? <Blocks size={compact ? 13 : 14} aria-hidden="true" />
              : activityKind === 'loaded-tools'
                ? <BookOpen size={compact ? 13 : 14} aria-hidden="true" />
                : activityKind === 'called-tools'
                  ? <Wrench size={compact ? 13 : 14} aria-hidden="true" />
                  : activityKind === 'exploration'
                    ? <Search size={compact ? 13 : 14} aria-hidden="true" />
                    : activityKind === 'web-search'
                      ? <Globe size={compact ? 13 : 14} aria-hidden="true" />
                      : fileChanges.length > 0
                        ? <FileCode2 size={compact ? 13 : 14} aria-hidden="true" />
                        : <Terminal size={compact ? 13 : 14} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={activityAccessibleLabel}>
          {activityLabel}
        </span>
        {commandSummary.statusLabel ? (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
            resolveCommandExecutionStatusClassName(commandSummary.tone)
          }`}>
            {commandSummary.statusLabel}
          </span>
        ) : null}
        {fileChanges.length > 0 && !compact ? (
          <span className="shrink-0 font-mono text-[10px] text-gray-600 max-[760px]:sr-only">
            {changedLinesLabel}
          </span>
        ) : null}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-600">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {isExpanded ? (
        <div
          id={summaryDetailsId}
          className="space-y-3 px-1.5 pb-2 pt-1"
          data-chat-activity-details="true"
        >
          {commands.length > 0 ? (
            <ChatCommandActivityList
              commands={commands}
              copyLabel={copyLabel}
              copyMessageToClipboard={copyMessageToClipboard}
              detailsIdPrefix={summaryDetailsId}
              disclosureScopeKey={disclosureScopeKey}
              expandedDisclosureKeys={expandedDisclosureKeys}
              sectionLabel={commandSectionLabel}
              successIconSize={successIconSize}
              t={environment?.t}
              toggleDisclosure={toggleDisclosure}
            />
          ) : null}
          {fileChanges.length > 0 ? (
            <ChatFileActivityList
              compact={compact}
              detailsIdPrefix={summaryDetailsId}
              disclosureScopeKey={disclosureScopeKey}
              environment={environment}
              expandedDisclosureKeys={expandedDisclosureKeys}
              fileChanges={fileChanges}
              messageId={messageId}
              sectionLabel={fileSectionLabel}
              toggleDisclosure={toggleDisclosure}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
