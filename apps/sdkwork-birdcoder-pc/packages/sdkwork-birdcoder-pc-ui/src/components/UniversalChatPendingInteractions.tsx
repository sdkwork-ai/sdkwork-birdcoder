import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  MAX_AGENT_INTERACTION_ANSWER_CHARACTERS,
  MAX_AGENT_INTERACTION_APPROVAL_REASON_CHARACTERS,
  type AgentApprovalDecisionInput,
  type AgentQuestionAnswerInput,
  type AgentSessionPendingApproval,
  type AgentSessionPendingQuestion,
  type AgentSessionPendingQuestionOption,
  type AgentSessionPendingQuestionPrompt,
} from '@sdkwork/birdcoder-pc-workbench';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { resolveChatProviderPresentationProfile } from './chat/messages/presentation/providerPresentationProfiles.ts';
import { UniversalChatTypedInteraction } from './UniversalChatTypedInteraction.tsx';

export interface UniversalChatPendingInteractionsProps {
  disabled?: boolean;
  engineId?: string;
  hasLoadError?: boolean;
  isLoading?: boolean;
  isSubmitting?: boolean;
  pendingApprovals?: AgentSessionPendingApproval[];
  pendingUserQuestions?: AgentSessionPendingQuestion[];
  onSubmitApprovalDecision?: (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer?: (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
  onRetryLoad?: () => void | Promise<void>;
}

function buildQuestionPromptKey(
  pendingQuestion: AgentSessionPendingQuestion,
  prompt: AgentSessionPendingQuestionPrompt,
  promptIndex: number,
): string {
  return `${pendingQuestion.interactionId}:${prompt.question}:${promptIndex}`;
}

function buildQuestionOptionKey(
  prompt: AgentSessionPendingQuestionPrompt,
  option: AgentSessionPendingQuestionOption,
  optionIndex: number,
): string {
  return `${prompt.question}:${option.value}:${option.label}:${optionIndex}`;
}

function buildQuestionOptionPayload(
  option: AgentSessionPendingQuestionOption,
): AgentQuestionAnswerInput {
  return {
    answer: option.value?.trim() || option.label,
    optionValue: option.value,
    optionLabel: option.label,
  };
}

function shouldRenderQuestionPrompt(
  pendingQuestion: AgentSessionPendingQuestion,
  prompt: AgentSessionPendingQuestionPrompt,
): boolean {
  return pendingQuestion.questions.length > 1
    || prompt.question.trim() !== pendingQuestion.prompt.trim();
}

export function UniversalChatPendingInteractions({
  disabled = false,
  engineId,
  hasLoadError = false,
  isLoading = false,
  isSubmitting = false,
  pendingApprovals = [],
  pendingUserQuestions = [],
  onRetryLoad,
  onSubmitApprovalDecision,
  onSubmitUserQuestionAnswer,
}: UniversalChatPendingInteractionsProps) {
  const { t } = useTranslation();
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [approvalReasons, setApprovalReasons] = useState<Record<string, string>>({});
  const hasPendingInteractions = pendingUserQuestions.length > 0 || pendingApprovals.length > 0;
  const controlsDisabled = disabled || isSubmitting;
  const isCodexInteractionSurface =
    resolveChatProviderPresentationProfile(engineId)?.engineId === 'codex';
  const typedApprovals = useMemo(
    () => pendingApprovals.filter((approval) => approval.request !== undefined),
    [pendingApprovals],
  );
  const legacyApprovals = useMemo(
    () => pendingApprovals.filter((approval) => approval.request === undefined),
    [pendingApprovals],
  );
  const typedQuestions = useMemo(
    () => pendingUserQuestions.filter((question) => question.request !== undefined),
    [pendingUserQuestions],
  );
  const legacyQuestions = useMemo(
    () => pendingUserQuestions.filter((question) => question.request === undefined),
    [pendingUserQuestions],
  );
  const activeQuestionIds = useMemo(
    () => new Set(pendingUserQuestions.map((question) => question.interactionId)),
    [pendingUserQuestions],
  );
  const activeApprovalIds = useMemo(
    () => new Set(pendingApprovals.map((approval) => approval.interactionId)),
    [pendingApprovals],
  );

  useEffect(() => {
    setAnswerDrafts((previousDrafts) => {
      let didPruneDraft = false;
      const nextDrafts: Record<string, string> = {};
      for (const [questionId, draft] of Object.entries(previousDrafts)) {
        if (activeQuestionIds.has(questionId)) {
          nextDrafts[questionId] = draft;
        } else {
          didPruneDraft = true;
        }
      }
      return didPruneDraft ? nextDrafts : previousDrafts;
    });

    setApprovalReasons((previousReasons) => {
      let didPruneReason = false;
      const nextReasons: Record<string, string> = {};
      for (const [approvalId, reason] of Object.entries(previousReasons)) {
        if (activeApprovalIds.has(approvalId)) {
          nextReasons[approvalId] = reason;
        } else {
          didPruneReason = true;
        }
      }
      return didPruneReason ? nextReasons : previousReasons;
    });
  }, [activeApprovalIds, activeQuestionIds]);

  const handleAnswerDraftChange = useCallback((interactionId: string, value: string) => {
    setAnswerDrafts((previousDrafts) => ({
      ...previousDrafts,
      [interactionId]: value,
    }));
  }, []);

  const handleApprovalReasonChange = useCallback((interactionId: string, value: string) => {
    setApprovalReasons((previousReasons) => ({
      ...previousReasons,
      [interactionId]: value,
    }));
  }, []);

  const submitQuestionAnswer = useCallback(async (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => {
    if (!onSubmitUserQuestionAnswer || disabled || isSubmitting) {
      return;
    }

    await onSubmitUserQuestionAnswer(interactionId, request);
    setAnswerDrafts((previousDrafts) => {
      if (!(interactionId in previousDrafts)) {
        return previousDrafts;
      }

      const nextDrafts = { ...previousDrafts };
      delete nextDrafts[interactionId];
      return nextDrafts;
    });
  }, [disabled, isSubmitting, onSubmitUserQuestionAnswer]);

  const submitApprovalDecision = useCallback(async (
    interactionId: string,
    decision: AgentApprovalDecisionInput['decision'],
  ) => {
    if (!onSubmitApprovalDecision || disabled || isSubmitting) {
      return;
    }

    const reason = approvalReasons[interactionId]?.trim();
    await onSubmitApprovalDecision(interactionId, {
      decision,
      reason: reason || undefined,
    });
    setApprovalReasons((previousReasons) => {
      if (!(interactionId in previousReasons)) {
        return previousReasons;
      }

      const nextReasons = { ...previousReasons };
      delete nextReasons[interactionId];
      return nextReasons;
    });
  }, [approvalReasons, disabled, isSubmitting, onSubmitApprovalDecision]);

  const handleQuestionSurfaceKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
    interactionId: string,
  ) => {
    if (!isCodexInteractionSurface || event.key !== 'Escape' || controlsDisabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void submitQuestionAnswer(interactionId, { rejected: true });
  }, [controlsDisabled, isCodexInteractionSurface, submitQuestionAnswer]);

  const handleApprovalSurfaceKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
    interactionId: string,
  ) => {
    if (!isCodexInteractionSurface || controlsDisabled) {
      return;
    }
    if (event.target instanceof Element && event.target.closest('button,textarea,input,a')) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void submitApprovalDecision(
      interactionId,
      event.key === 'Enter' ? 'approved' : 'denied',
    );
  }, [controlsDisabled, isCodexInteractionSurface, submitApprovalDecision]);

  useEffect(() => {
    const activeLegacyApproval = typedApprovals.length === 0 ? legacyApprovals[0] : undefined;
    if (!isCodexInteractionSurface || !activeLegacyApproval) return undefined;
    const handleGlobalApprovalHotkey = (event: KeyboardEvent) => {
      if (controlsDisabled || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[role="dialog"],[role="menu"]')) return;
      if (event.key === 'Enter' && !target?.closest('button,a')) {
        event.preventDefault();
        void submitApprovalDecision(activeLegacyApproval.interactionId, 'approved');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        void submitApprovalDecision(activeLegacyApproval.interactionId, 'denied');
      }
    };
    window.addEventListener('keydown', handleGlobalApprovalHotkey);
    return () => window.removeEventListener('keydown', handleGlobalApprovalHotkey);
  }, [
    controlsDisabled,
    isCodexInteractionSurface,
    legacyApprovals,
    submitApprovalDecision,
    typedApprovals.length,
  ]);

  if (!hasPendingInteractions && !hasLoadError) {
    return null;
  }

  return (
    <section className="mb-3 space-y-2" data-chat-pending-interactions="true">
      {isSubmitting || isLoading ? (
        <div className="flex justify-end px-2" aria-live="polite">
          <Loader2 size={16} className="animate-spin text-gray-400" />
        </div>
      ) : null}

      {hasLoadError ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-3xl bg-[#242426] px-4 py-3 text-sm text-amber-100 shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
          role="alert"
        >
          <AlertTriangle size={16} className="shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1 break-words">
            {t('chat.pendingInteractionsLoadFailed')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isLoading || !onRetryLoad}
            onClick={() => {
              void onRetryLoad?.();
            }}
          >
            <RefreshCw size={14} />
            {t('chat.retryPendingInteractions')}
          </Button>
        </div>
      ) : null}

      {typedQuestions.map((pendingQuestion, questionIndex) => (
        <UniversalChatTypedInteraction
          key={pendingQuestion.interactionId}
          disabled={disabled}
          enableGlobalQuestionHotkeys={
            isCodexInteractionSurface
            && questionIndex === 0
            && pendingApprovals.length === 0
          }
          isCodex={isCodexInteractionSurface}
          isSubmitting={isSubmitting}
          question={pendingQuestion}
          onSubmitUserQuestionAnswer={onSubmitUserQuestionAnswer}
        />
      ))}

      {typedApprovals.map((pendingApproval, approvalIndex) => (
        <UniversalChatTypedInteraction
          key={pendingApproval.interactionId}
          approval={pendingApproval}
          disabled={disabled}
          enableGlobalApprovalHotkeys={isCodexInteractionSurface && approvalIndex === 0}
          isCodex={isCodexInteractionSurface}
          isSubmitting={isSubmitting}
          onSubmitApprovalDecision={onSubmitApprovalDecision}
        />
      ))}

      {legacyQuestions.map((pendingQuestion) => (
        <div
          key={pendingQuestion.interactionId}
          className="overflow-hidden rounded-3xl bg-[#242426] shadow-[0_8px_24px_rgba(0,0,0,0.16)] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
          tabIndex={isCodexInteractionSurface ? 0 : undefined}
          onKeyDown={(event) => handleQuestionSurfaceKeyDown(
            event,
            pendingQuestion.interactionId,
          )}
        >
          <div className="px-4 pb-3 pt-4">
            <div className="text-xs font-semibold text-gray-100">
              {t('chat.pendingQuestion')}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">
              {pendingQuestion.prompt}
            </p>
          </div>

          <div className="space-y-3 px-4 pb-3">
            {pendingQuestion.questions.map((prompt, promptIndex) => (
              <div key={buildQuestionPromptKey(pendingQuestion, prompt, promptIndex)}>
                {shouldRenderQuestionPrompt(pendingQuestion, prompt) ? (
                  <div className="mb-2 whitespace-pre-wrap break-words text-sm text-gray-300">
                    {prompt.question}
                  </div>
                ) : null}
                {prompt.options && prompt.options.length > 0 ? (
                  <div className="space-y-1">
                    {prompt.options.map((option, optionIndex) => (
                      <Button
                        key={buildQuestionOptionKey(prompt, option, optionIndex)}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-8 w-full justify-start rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]"
                        disabled={controlsDisabled || !onSubmitUserQuestionAnswer}
                        title={option.label}
                        onClick={() => {
                          void submitQuestionAnswer(
                            pendingQuestion.interactionId,
                            buildQuestionOptionPayload(option),
                          );
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex min-w-0 flex-wrap items-end gap-2 px-4 pb-4 pt-2">
            <textarea
              value={answerDrafts[pendingQuestion.interactionId] ?? ''}
              onChange={(event) => handleAnswerDraftChange(pendingQuestion.interactionId, event.target.value)}
              maxLength={MAX_AGENT_INTERACTION_ANSWER_CHARACTERS}
              placeholder={t('chat.pendingQuestionAnswerPlaceholder')}
              className="min-h-[38px] min-w-[min(100%,16rem)] flex-[1_1_16rem] resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-white/20"
              rows={1}
              disabled={controlsDisabled || !onSubmitUserQuestionAnswer}
            />
            <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={controlsDisabled || !onSubmitUserQuestionAnswer}
                onClick={() => {
                  void submitQuestionAnswer(pendingQuestion.interactionId, { rejected: true });
                }}
              >
                <X size={14} />
                {t('chat.rejectQuestion')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={
                  controlsDisabled
                  || !onSubmitUserQuestionAnswer
                  || !(answerDrafts[pendingQuestion.interactionId] ?? '').trim()
                }
                onClick={() => {
                  const answer = (answerDrafts[pendingQuestion.interactionId] ?? '').trim();
                  if (!answer) return;
                  void submitQuestionAnswer(pendingQuestion.interactionId, { answer });
                }}
              >
                {t('chat.submitAnswer')}
              </Button>
            </div>
          </div>
        </div>
      ))}

      {legacyApprovals.map((pendingApproval, approvalIndex) => (
        <div
          key={pendingApproval.interactionId}
          className="overflow-hidden rounded-3xl bg-[#242426] shadow-[0_8px_24px_rgba(0,0,0,0.16)] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
          data-codex-approval-surface={isCodexInteractionSurface ? 'true' : undefined}
          tabIndex={isCodexInteractionSurface ? 0 : undefined}
          onKeyDown={(event) => handleApprovalSurfaceKeyDown(
            event,
            pendingApproval.interactionId,
          )}
        >
          <div className="px-4 pb-3 pt-4">
            <div className="text-xs font-semibold text-gray-100">
              {t('chat.pendingApproval')}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">
              {pendingApproval.prompt || t('chat.pendingApprovalDescription')}
            </p>
          </div>
          {!isCodexInteractionSurface ? (
            <div className="px-4 pb-3">
              <textarea
                value={approvalReasons[pendingApproval.interactionId] ?? ''}
                onChange={(event) => handleApprovalReasonChange(pendingApproval.interactionId, event.target.value)}
                maxLength={MAX_AGENT_INTERACTION_APPROVAL_REASON_CHARACTERS}
                placeholder={t('chat.pendingApprovalReasonPlaceholder')}
                className="min-h-[38px] w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-white/20"
                rows={1}
                disabled={controlsDisabled || !onSubmitApprovalDecision}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 px-4 pb-4 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={controlsDisabled || !onSubmitApprovalDecision}
              onClick={() => {
                void submitApprovalDecision(pendingApproval.interactionId, 'denied');
              }}
            >
              {!isCodexInteractionSurface ? <X size={14} /> : null}
              {t('chat.denyInteraction')}
            </Button>
            <Button
              type="button"
              size="sm"
              autoFocus={isCodexInteractionSurface && approvalIndex === 0}
              disabled={controlsDisabled || !onSubmitApprovalDecision}
              onClick={() => {
                void submitApprovalDecision(pendingApproval.interactionId, 'approved');
              }}
            >
              {!isCodexInteractionSurface ? <Check size={14} /> : null}
              {isCodexInteractionSurface
                ? t('chat.allowOnceInteraction')
                : t('chat.approveInteraction')}
            </Button>
            {!isCodexInteractionSurface ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={controlsDisabled || !onSubmitApprovalDecision}
                onClick={() => {
                  void submitApprovalDecision(pendingApproval.interactionId, 'blocked');
                }}
              >
                {t('chat.blockInteraction')}
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}

