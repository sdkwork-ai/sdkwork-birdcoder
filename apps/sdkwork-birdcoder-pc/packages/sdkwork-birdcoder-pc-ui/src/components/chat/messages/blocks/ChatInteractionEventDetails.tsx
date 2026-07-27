import { Check, Circle, Copy } from 'lucide-react';
import type { AgentSessionItemInteractionView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import { buildInteractionEventCopyContent } from './interactionEventPresentation.ts';

interface ChatInteractionEventDetailsProps {
  copyMessageToClipboard: (content: string) => void;
  detailsId: string;
  interaction: AgentSessionItemInteractionView;
  t?: ChatMessageTranslate;
}

function DetailLabel({ children }: { children: string }) {
  return <dt className="shrink-0 text-[10px] font-medium uppercase text-gray-500">{children}</dt>;
}

export function ChatInteractionEventDetails({
  copyMessageToClipboard,
  detailsId,
  interaction,
  t,
}: ChatInteractionEventDetailsProps) {
  const copyLabel = t?.('chat.interactionCopyDetails') ?? 'Copy interaction details';
  const copyContent = buildInteractionEventCopyContent(interaction, t);
  return (
    <div
      id={detailsId}
      className="relative ml-7 min-w-0 border-l border-white/[0.08] pb-2 pl-3 pr-9 pt-1"
      data-chat-interaction-details="true"
      role="region"
      tabIndex={0}
    >
      <button
        type="button"
        className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
        aria-label={copyLabel}
        title={copyLabel}
        onClick={() => copyMessageToClipboard(copyContent)}
      >
        <Copy size={11} aria-hidden="true" />
      </button>

      {interaction.prompt?.trim() ? (
        <p className="whitespace-pre-wrap break-words text-[12px] leading-5 text-gray-300 [overflow-wrap:anywhere]">
          {interaction.prompt.trim()}
        </p>
      ) : null}

      {interaction.kind === 'approval' ? (
        <dl className="mt-1.5 flex min-w-0 flex-col gap-1.5">
          {interaction.action?.trim() ? (
            <div className="flex min-w-0 items-baseline gap-2">
              <DetailLabel>{t?.('chat.interactionAction') ?? 'Action'}</DetailLabel>
              <dd className="min-w-0 break-words font-mono text-[11px] text-gray-300 [overflow-wrap:anywhere]">
                {interaction.action.trim()}
              </dd>
            </div>
          ) : null}
          {interaction.resources?.length ? (
            <div className="min-w-0">
              <DetailLabel>{t?.('chat.interactionResources') ?? 'Resources'}</DetailLabel>
              <dd className="mt-1 flex min-w-0 flex-col gap-1">
                {interaction.resources.map((resource) => (
                  <code
                    key={resource}
                    className="block min-w-0 break-words bg-white/[0.025] px-2 py-1 text-[11px] text-gray-300 [overflow-wrap:anywhere]"
                  >
                    {resource}
                  </code>
                ))}
              </dd>
            </div>
          ) : null}
          {interaction.decision?.trim() ? (
            <div className="flex min-w-0 items-baseline gap-2">
              <DetailLabel>{t?.('chat.interactionDecision') ?? 'Decision'}</DetailLabel>
              <dd className="text-[11px] text-gray-300">{interaction.decision.trim()}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {interaction.questions?.length ? (
        <div className="flex min-w-0 flex-col gap-3" data-chat-interaction-questions="true">
          {interaction.questions.map((question, questionIndex) => (
            <section key={question.id ?? `${question.question}:${questionIndex}`} className="min-w-0">
              {question.header ? (
                <div className="mb-0.5 text-[10px] font-medium uppercase text-gray-500">
                  {question.header}
                </div>
              ) : null}
              <div className="whitespace-pre-wrap break-words text-[12px] leading-5 text-gray-200">
                {question.question}
              </div>
              {question.options?.length ? (
                <ul className="mt-1.5 flex min-w-0 flex-col gap-1" aria-label={t?.('chat.interactionOptions') ?? 'Options'}>
                  {question.options.map((option, optionIndex) => {
                    const selected = question.answers?.some((answer) =>
                      answer === option.label || answer === option.value,
                    ) ?? false;
                    return (
                      <li
                        key={`${option.label}:${option.value ?? ''}:${optionIndex}`}
                        className="flex min-w-0 items-start gap-2 text-[11px] leading-5"
                        data-selected={selected ? 'true' : undefined}
                      >
                        <span className={`mt-1 flex h-3 w-3 shrink-0 items-center justify-center ${selected ? 'text-emerald-400' : 'text-gray-600'}`}>
                          {selected ? <Check size={11} aria-hidden="true" /> : <Circle size={7} aria-hidden="true" />}
                        </span>
                        <span className="min-w-0">
                          <span className={selected ? 'font-medium text-gray-200' : 'text-gray-400'}>{option.label}</span>
                          {option.description ? <span className="ml-1.5 text-gray-500">{option.description}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {question.answers?.length ? (
                <div className="mt-1.5 flex min-w-0 items-baseline gap-2 text-[11px]">
                  <span className="shrink-0 text-gray-500">{t?.('chat.interactionAnswer') ?? 'Answer'}</span>
                  <span className="min-w-0 break-words font-medium text-emerald-300/90">
                    {question.answers.join(', ')}
                  </span>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      ) : interaction.answer?.trim() ? (
        <div className="mt-1 flex min-w-0 items-baseline gap-2 text-[11px]">
          <span className="shrink-0 text-gray-500">{t?.('chat.interactionAnswer') ?? 'Answer'}</span>
          <span className="min-w-0 break-words font-medium text-emerald-300/90">{interaction.answer.trim()}</span>
        </div>
      ) : null}

      {interaction.detail?.trim() ? (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-5 text-gray-400 [overflow-wrap:anywhere]">
          {interaction.detail.trim()}
        </p>
      ) : null}
    </div>
  );
}
