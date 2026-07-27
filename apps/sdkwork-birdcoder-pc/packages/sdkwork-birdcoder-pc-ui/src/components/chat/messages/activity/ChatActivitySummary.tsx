import React, { memo, useId, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileCode2,
  Terminal,
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
  revealChatActivityDetails,
} from './activityPresentation.ts';

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
  messageId: string;
  successIconSize: number;
  toggleDisclosure: (key: string) => void;
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
  messageId,
  successIconSize,
  toggleDisclosure,
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
  const activityLabel = fileChanges.length > 0 && commands.length > 0
    ? environment?.t('chat.editedFilesAndRanCommandsGroup') ?? 'Edited files, ran commands'
    : fileChanges.length > 0
      ? environment?.t('chat.editedFilesGroup') ?? 'Edited files'
      : environment?.t('chat.ranCommandsGroup') ?? 'Ran commands';
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
      : 'commands';

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
          if (!isExpanded) revealChatActivityDetails(summaryDetailsId);
        }}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-500">
          {commands.length > 0 && commandSummary.tone !== 'success'
            ? <CommandActivityStatusIcon tone={commandSummary.tone} size={compact ? 13 : 14} />
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
