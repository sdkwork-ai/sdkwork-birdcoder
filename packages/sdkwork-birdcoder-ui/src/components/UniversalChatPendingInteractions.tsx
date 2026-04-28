import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CircleHelp, Loader2, ShieldAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  BirdCoderCodingSessionPendingApproval,
  BirdCoderCodingSessionPendingUserQuestion,
  BirdCoderCodingSessionPendingUserQuestionOption,
  BirdCoderCodingSessionPendingUserQuestionPrompt,
} from '@sdkwork/birdcoder-commons';
import type {
  BirdCoderSubmitApprovalDecisionRequest,
  BirdCoderSubmitUserQuestionAnswerRequest,
} from '@sdkwork/birdcoder-types';
import { Button } from '@sdkwork/birdcoder-ui-shell';

export interface UniversalChatPendingInteractionsProps {
  disabled?: boolean;
  isSubmitting?: boolean;
  pendingApprovals?: BirdCoderCodingSessionPendingApproval[];
  pendingUserQuestions?: BirdCoderCodingSessionPendingUserQuestion[];
  onSubmitApprovalDecision?: (
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer?: (
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ) => void | Promise<void>;
}

function buildQuestionPromptKey(
  pendingQuestion: BirdCoderCodingSessionPendingUserQuestion,
  prompt: BirdCoderCodingSessionPendingUserQuestionPrompt,
  promptIndex: number,
): string {
  return `${pendingQuestion.questionId}:${prompt.header ?? ''}:${prompt.question}:${promptIndex}`;
}

function buildQuestionOptionKey(
  prompt: BirdCoderCodingSessionPendingUserQuestionPrompt,
  option: BirdCoderCodingSessionPendingUserQuestionOption,
  optionIndex: number,
): string {
  return `${prompt.question}:${option.id ?? ''}:${option.label}:${optionIndex}`;
}

function buildQuestionOptionPayload(
  option: BirdCoderCodingSessionPendingUserQuestionOption,
): BirdCoderSubmitUserQuestionAnswerRequest {
  return {
    answer: option.value?.trim() || option.label,
    optionId: option.id,
    optionLabel: option.label,
  };
}

export function UniversalChatPendingInteractions({
  disabled = false,
  isSubmitting = false,
  pendingApprovals = [],
  pendingUserQuestions = [],
  onSubmitApprovalDecision,
  onSubmitUserQuestionAnswer,
}: UniversalChatPendingInteractionsProps) {
  const { t } = useTranslation();
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [approvalReasons, setApprovalReasons] = useState<Record<string, string>>({});
  const hasPendingInteractions = pendingUserQuestions.length > 0 || pendingApprovals.length > 0;
  const activeQuestionIds = useMemo(
    () => new Set(pendingUserQuestions.map((question) => question.questionId)),
    [pendingUserQuestions],
  );
  const activeApprovalIds = useMemo(
    () => new Set(pendingApprovals.map((approval) => approval.approvalId)),
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

  const handleAnswerDraftChange = useCallback((questionId: string, value: string) => {
    setAnswerDrafts((previousDrafts) => ({
      ...previousDrafts,
      [questionId]: value,
    }));
  }, []);

  const handleApprovalReasonChange = useCallback((approvalId: string, value: string) => {
    setApprovalReasons((previousReasons) => ({
      ...previousReasons,
      [approvalId]: value,
    }));
  }, []);

  const submitQuestionAnswer = useCallback(async (
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ) => {
    if (!onSubmitUserQuestionAnswer || disabled || isSubmitting) {
      return;
    }

    await onSubmitUserQuestionAnswer(questionId, request);
    setAnswerDrafts((previousDrafts) => {
      if (!(questionId in previousDrafts)) {
        return previousDrafts;
      }

      const nextDrafts = { ...previousDrafts };
      delete nextDrafts[questionId];
      return nextDrafts;
    });
  }, [disabled, isSubmitting, onSubmitUserQuestionAnswer]);

  const submitApprovalDecision = useCallback(async (
    approvalId: string,
    decision: BirdCoderSubmitApprovalDecisionRequest['decision'],
  ) => {
    if (!onSubmitApprovalDecision || disabled || isSubmitting) {
      return;
    }

    const reason = approvalReasons[approvalId]?.trim();
    await onSubmitApprovalDecision(approvalId, {
      decision,
      reason: reason || undefined,
    });
    setApprovalReasons((previousReasons) => {
      if (!(approvalId in previousReasons)) {
        return previousReasons;
      }

      const nextReasons = { ...previousReasons };
      delete nextReasons[approvalId];
      return nextReasons;
    });
  }, [approvalReasons, disabled, isSubmitting, onSubmitApprovalDecision]);

  if (!hasPendingInteractions) {
    return null;
  }

  const controlsDisabled = disabled || isSubmitting;

  return (
    <section className="mb-3 rounded-xl border border-white/10 bg-[#18181b]/90 p-3 shadow-lg shadow-black/20">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            {t('chat.pendingInteractions')}
          </div>
          <div className="truncate text-sm font-medium text-white">
            {t('chat.pendingInteractionsDescription')}
          </div>
        </div>
        {isSubmitting ? <Loader2 size={16} className="shrink-0 animate-spin text-blue-300" /> : null}
      </div>

      {pendingUserQuestions.map((pendingQuestion) => (
        <div
          key={pendingQuestion.questionId}
          className="border-t border-white/10 py-3 first:border-t-0 first:pt-1 last:pb-1"
        >
          <div className="mb-2 flex items-start gap-2">
            <CircleHelp size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-amber-100">
                {t('chat.pendingQuestion')}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">
                {pendingQuestion.prompt}
              </p>
            </div>
          </div>

          <div className="space-y-3 pl-6">
            {pendingQuestion.questions.map((prompt, promptIndex) => (
              <div key={buildQuestionPromptKey(pendingQuestion, prompt, promptIndex)}>
                {prompt.header ? (
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {prompt.header}
                  </div>
                ) : null}
                <div className="mb-2 whitespace-pre-wrap break-words text-sm text-gray-300">
                  {prompt.question}
                </div>
                {prompt.options && prompt.options.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {prompt.options.map((option, optionIndex) => (
                      <Button
                        key={buildQuestionOptionKey(prompt, option, optionIndex)}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={controlsDisabled || !onSubmitUserQuestionAnswer}
                        title={option.description || option.label}
                        onClick={() => {
                          void submitQuestionAnswer(
                            pendingQuestion.questionId,
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

            <div className="flex min-w-0 items-end gap-2">
              <textarea
                value={answerDrafts[pendingQuestion.questionId] ?? ''}
                onChange={(event) => handleAnswerDraftChange(pendingQuestion.questionId, event.target.value)}
                placeholder={t('chat.pendingQuestionAnswerPlaceholder')}
                className="min-h-[38px] flex-1 resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-amber-300/40"
                rows={1}
                disabled={controlsDisabled || !onSubmitUserQuestionAnswer}
              />
              <Button
                type="button"
                size="sm"
                disabled={
                  controlsDisabled ||
                  !onSubmitUserQuestionAnswer ||
                  !(answerDrafts[pendingQuestion.questionId] ?? '').trim()
                }
                onClick={() => {
                  const answer = (answerDrafts[pendingQuestion.questionId] ?? '').trim();
                  if (!answer) {
                    return;
                  }

                  void submitQuestionAnswer(pendingQuestion.questionId, { answer });
                }}
              >
                {t('chat.submitAnswer')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={controlsDisabled || !onSubmitUserQuestionAnswer}
                onClick={() => {
                  void submitQuestionAnswer(pendingQuestion.questionId, { rejected: true });
                }}
              >
                <X size={14} />
                {t('chat.rejectQuestion')}
              </Button>
            </div>
          </div>
        </div>
      ))}

      {pendingApprovals.map((pendingApproval) => (
        <div
          key={pendingApproval.approvalId}
          className="border-t border-white/10 py-3 first:border-t-0 first:pt-1 last:pb-1"
        >
          <div className="mb-2 flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-sky-300" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-sky-100">
                {t('chat.pendingApproval')}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">
                {pendingApproval.reason || t('chat.pendingApprovalDescription')}
              </p>
            </div>
          </div>

          <div className="space-y-2 pl-6">
            <textarea
              value={approvalReasons[pendingApproval.approvalId] ?? ''}
              onChange={(event) => handleApprovalReasonChange(pendingApproval.approvalId, event.target.value)}
              placeholder={t('chat.pendingApprovalReasonPlaceholder')}
              className="min-h-[38px] w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-sky-300/40"
              rows={1}
              disabled={controlsDisabled || !onSubmitApprovalDecision}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                disabled={controlsDisabled || !onSubmitApprovalDecision}
                onClick={() => {
                  void submitApprovalDecision(pendingApproval.approvalId, 'approved');
                }}
              >
                <Check size={14} />
                {t('chat.approveInteraction')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={controlsDisabled || !onSubmitApprovalDecision}
                onClick={() => {
                  void submitApprovalDecision(pendingApproval.approvalId, 'denied');
                }}
              >
                <X size={14} />
                {t('chat.denyInteraction')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={controlsDisabled || !onSubmitApprovalDecision}
                onClick={() => {
                  void submitApprovalDecision(pendingApproval.approvalId, 'blocked');
                }}
              >
                {t('chat.blockInteraction')}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
