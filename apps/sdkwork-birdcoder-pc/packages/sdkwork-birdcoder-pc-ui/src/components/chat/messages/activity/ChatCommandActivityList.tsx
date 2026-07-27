import React, { memo } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Terminal,
} from 'lucide-react';
import type { AgentSessionCommandView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  buildChatContentPreview,
  buildCommandOutputPreview,
} from '../contentPreview.ts';
import type { ChatMessageTranslate } from '../types.ts';
import {
  resolveChatCommandLifecycleTone,
  type ChatCommandLifecycleTone,
} from './chatCommandLifecycle.ts';
import { revealChatActivityDetails } from './activityPresentation.ts';

const MAX_COMMAND_TEXT_PREVIEW_CHARACTERS = 4_000;
const MAX_COMMAND_SUMMARY_CHARACTERS = 320;

export type CommandExecutionTone = ChatCommandLifecycleTone;

export interface CommandActivitySummaryState {
  statusLabel: string;
  tone: CommandExecutionTone;
}

export interface ChatCommandActivityListProps {
  commands: readonly AgentSessionCommandView[];
  copyLabel: string;
  copyMessageToClipboard: (content: string) => void;
  detailsIdPrefix: string;
  disclosureScopeKey: string;
  expandedDisclosureKeys: ReadonlySet<string>;
  sectionLabel: string;
  successIconSize: number;
  t?: ChatMessageTranslate;
  toggleDisclosure: (key: string) => void;
}

interface ChatCommandActivityRowProps {
  command: AgentSessionCommandView;
  commandDetailsId: string;
  commandKey: string;
  copyLabel: string;
  copyMessageToClipboard: (content: string) => void;
  isExpanded: boolean;
  successIconSize: number;
  t?: ChatMessageTranslate;
  toggleDisclosure: (key: string) => void;
}

function resolveCommandExecutionStatusLabel(
  tone: CommandExecutionTone,
  t?: ChatMessageTranslate,
): string {
  if (tone === 'reply') return t?.('chat.commandNeedsReply') ?? 'Needs reply';
  if (tone === 'approval') return t?.('chat.commandNeedsApproval') ?? 'Needs approval';
  if (tone === 'success') return t?.('chat.commandSucceeded') ?? 'Succeeded';
  if (tone === 'cancelled') return t?.('chat.commandCancelled') ?? 'Cancelled';
  if (tone === 'error') return t?.('chat.commandFailed') ?? 'Failed';
  return t?.('chat.commandRunning') ?? 'Running';
}

export function resolveCommandExecutionStatusClassName(tone: CommandExecutionTone): string {
  if (tone === 'reply' || tone === 'approval') return 'bg-amber-500/10 text-amber-200';
  if (tone === 'success') return 'bg-emerald-500/10 text-emerald-200';
  if (tone === 'error') return 'bg-red-500/10 text-red-200';
  return 'bg-white/5 text-gray-400';
}

export function CommandActivityStatusIcon({
  size,
  tone,
}: {
  size: number;
  tone: CommandExecutionTone;
}) {
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

export function resolveCommandActivitySummaryState(
  commands: readonly AgentSessionCommandView[],
  t?: ChatMessageTranslate,
): CommandActivitySummaryState {
  const tones = commands.map(resolveChatCommandLifecycleTone);
  const failedCount = tones.filter((tone) => tone === 'error').length;
  const waitingCount = tones.filter((tone) => tone === 'approval' || tone === 'reply').length;
  const runningCount = tones.filter((tone) => tone === 'running').length;
  const cancelledCount = tones.filter((tone) => tone === 'cancelled').length;
  if (failedCount > 0) {
    return {
      tone: 'error',
      statusLabel: t?.('chat.commandsFailedSummary', { count: failedCount }) ?? `${failedCount} failed`,
    };
  }
  if (waitingCount > 0) {
    return {
      tone: 'approval',
      statusLabel: t?.('chat.commandsWaitingSummary', { count: waitingCount }) ?? `${waitingCount} waiting`,
    };
  }
  if (runningCount > 0) {
    return {
      tone: 'running',
      statusLabel: t?.('chat.commandsRunningSummary', { count: runningCount }) ?? `${runningCount} running`,
    };
  }
  if (cancelledCount > 0) {
    return {
      tone: 'cancelled',
      statusLabel: t?.('chat.commandsCancelledSummary', { count: cancelledCount })
        ?? `${cancelledCount} cancelled`,
    };
  }
  return { tone: 'success', statusLabel: '' };
}

const ChatCommandActivityRow = memo(function ChatCommandActivityRow({
  command,
  commandDetailsId,
  commandKey,
  copyLabel,
  copyMessageToClipboard,
  isExpanded,
  successIconSize,
  t,
  toggleDisclosure,
}: ChatCommandActivityRowProps) {
  const tone = resolveChatCommandLifecycleTone(command);
  const outputPreview = isExpanded ? buildCommandOutputPreview(command.output) : null;
  const commandTextPreview = buildChatContentPreview(command.command, {
    maxCharacters: MAX_COMMAND_TEXT_PREVIEW_CHARACTERS,
    tailCharacters: 1_000,
  });
  const commandSummary = buildChatContentPreview(command.command, {
    maxCharacters: MAX_COMMAND_SUMMARY_CHARACTERS,
    tailCharacters: 0,
  }).text.replace(/\s+/gu, ' ').trim();
  const statusLabel = resolveCommandExecutionStatusLabel(tone, t);
  const commandLabel = t?.('chat.commandText') ?? 'Command';
  const outputLabel = t?.('chat.commandOutput') ?? 'Output';
  const noOutputLabel = t?.('chat.commandNoOutput') ?? 'No command output captured';
  const ranCommandLabel = t?.('chat.ranCommandPrefix') ?? 'Ran';
  const disclosureLabel = isExpanded
    ? t?.('chat.activityCollapse') ?? 'Hide activity details'
    : t?.('chat.activityExpand') ?? 'Show activity details';

  return (
    <div className="overflow-hidden" data-chat-command-row="inline">
      <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.035]">
        <button
          type="button"
          data-chat-command-disclosure="true"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          aria-expanded={isExpanded}
          aria-controls={commandDetailsId}
          aria-label={`${statusLabel}: ${commandSummary}. ${disclosureLabel}`}
          title={disclosureLabel}
          onClick={() => {
            toggleDisclosure(commandKey);
            if (!isExpanded) revealChatActivityDetails(commandDetailsId);
          }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-500">
            {tone === 'success'
              ? <Terminal size={successIconSize} aria-hidden="true" />
              : <CommandActivityStatusIcon tone={tone} size={successIconSize} />}
          </span>
          <span className="shrink-0 text-[12px] text-gray-400">{ranCommandLabel}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-300">
            {commandSummary}
          </span>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] max-[560px]:sr-only ${
            tone === 'success' ? 'sr-only' : resolveCommandExecutionStatusClassName(tone)
          }`}>
            {statusLabel}
          </span>
          <span className="shrink-0 text-gray-600">
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          title={copyLabel}
          aria-label={`${copyLabel}: ${commandSummary}`}
          onClick={() => copyMessageToClipboard(command.command)}
        >
          <Copy size={12} />
        </button>
      </div>

      {isExpanded ? (
        <div id={commandDetailsId} className="space-y-2 px-7 pb-2 pt-1" data-chat-command-details="true">
          <div>
            <div className="mb-1 text-[11px] font-medium text-gray-500">{commandLabel}</div>
            <pre
              className="max-h-40 overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words custom-scrollbar"
              role="region"
              aria-label={commandLabel}
              tabIndex={0}
            >
              {commandTextPreview.text}
            </pre>
            {commandTextPreview.isTruncated ? (
              <div className="pt-1 text-[10px] text-gray-400/80" data-chat-command-text-truncated="true">
                {t?.('chat.toolDetailTruncated') ?? 'Preview truncated. Copy to inspect the full content.'}
              </div>
            ) : null}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-gray-500">
              <span>{outputLabel}</span>
              {command.output?.trim() ? (
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                  title={copyLabel}
                  aria-label={`${copyLabel}: ${outputLabel}`}
                  onClick={() => copyMessageToClipboard(command.output ?? '')}
                >
                  <Copy size={11} />
                </button>
              ) : null}
            </div>
            {outputPreview?.text ? (
              <>
                <pre
                  className="max-h-64 overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words custom-scrollbar"
                  role="region"
                  aria-label={outputLabel}
                  tabIndex={0}
                >
                  {outputPreview.text}
                </pre>
                {outputPreview.isTruncated ? (
                  <div
                    className="pt-1 text-[10px] text-gray-400/80"
                    data-chat-command-output-truncated={outputPreview.isCharacterTruncated ? 'characters' : 'lines'}
                  >
                    {outputPreview.isCharacterTruncated
                      ? t?.('chat.toolDetailTruncated') ?? 'Preview truncated. Copy to inspect the full content.'
                      : t?.('chat.commandOutputTruncated', { count: outputPreview.omittedLineCount })
                        ?? `${outputPreview.omittedLineCount} lines omitted. Copy to inspect the complete output.`}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-md bg-white/[0.025] px-2 py-2 text-[11px] text-gray-500">
                {noOutputLabel}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export const ChatCommandActivityList = memo(function ChatCommandActivityList({
  commands,
  copyLabel,
  copyMessageToClipboard,
  detailsIdPrefix,
  disclosureScopeKey,
  expandedDisclosureKeys,
  sectionLabel,
  successIconSize,
  t,
  toggleDisclosure,
}: ChatCommandActivityListProps) {
  return (
    <section aria-label={sectionLabel}>
      <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium text-gray-500">
        <Terminal size={12} aria-hidden="true" />
        <span>{sectionLabel}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {commands.map((command, index) => {
          const identity = `${index}\u0001${command.toolCallId?.trim() || 'command'}`;
          const disclosureKey = `${disclosureScopeKey}\u0001command\u0001${identity}`;
          return (
            <ChatCommandActivityRow
              key={identity}
              command={command}
              commandDetailsId={`${detailsIdPrefix}-command-${index}`}
              commandKey={disclosureKey}
              copyLabel={copyLabel}
              copyMessageToClipboard={copyMessageToClipboard}
              isExpanded={expandedDisclosureKeys.has(disclosureKey)}
              successIconSize={successIconSize}
              t={t}
              toggleDisclosure={toggleDisclosure}
            />
          );
        })}
      </div>
    </section>
  );
});
