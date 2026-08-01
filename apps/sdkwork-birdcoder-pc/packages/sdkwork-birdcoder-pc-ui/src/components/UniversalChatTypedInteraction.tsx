import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  FilePenLine,
  FolderOpen,
  Globe2,
  PlugZap,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  AgentApprovalDecisionInput,
  AgentInteractionAction,
  AgentQuestionAnswerInput,
  AgentSessionPendingApproval,
  AgentSessionPendingQuestion,
  AgentSessionPendingQuestionPrompt,
  AgentSessionPendingTypedRequest,
} from '@sdkwork/birdcoder-pc-workbench';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';

interface TypedInteractionProps {
  approval?: AgentSessionPendingApproval;
  disabled?: boolean;
  isCodex?: boolean;
  isSubmitting?: boolean;
  onSubmitApprovalDecision?: (
    interactionId: string,
    input: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer?: (
    interactionId: string,
    input: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
  question?: AgentSessionPendingQuestion;
}

interface JsonSchemaProperty {
  default?: unknown;
  description?: string;
  enum?: unknown[];
  format?: string;
  items?: { enum?: unknown[]; type?: string };
  maximum?: number;
  minimum?: number;
  oneOf?: Array<{ const?: unknown; title?: string }>;
  title?: string;
  type?: string;
}

interface JsonObjectSchema {
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  type?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObjectSchema(value: unknown): JsonObjectSchema | null {
  if (!isRecord(value)) return null;
  return value as JsonObjectSchema;
}

function createInitialSchemaValues(schema: JsonObjectSchema | null): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema?.properties ?? {}).flatMap(([fieldName, property]) => (
      property.default === undefined ? [] : [[fieldName, property.default]]
    )),
  );
}

function hasSchemaValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function formatChange(change: unknown): string | null {
  if (typeof change === 'string') return change;
  if (change === undefined) return null;
  try {
    return JSON.stringify(change, null, 2);
  } catch {
    return String(change);
  }
}

function actionAllowed(
  request: AgentSessionPendingTypedRequest,
  action: AgentInteractionAction,
): boolean {
  return request.allowedActions.includes(action);
}

function interactionIcon(kind: AgentSessionPendingTypedRequest['kind']) {
  switch (kind) {
    case 'command_execution':
      return <Terminal size={15} aria-hidden="true" />;
    case 'file_change':
      return <FilePenLine size={15} aria-hidden="true" />;
    case 'permission_profile':
      return <ShieldCheck size={15} aria-hidden="true" />;
    case 'mcp_elicitation':
      return <PlugZap size={15} aria-hidden="true" />;
    case 'context_source_picker':
      return <FolderOpen size={15} aria-hidden="true" />;
    default:
      return <Check size={15} aria-hidden="true" />;
  }
}

function approvalLabelKey(kind: AgentSessionPendingTypedRequest['kind']): string {
  switch (kind) {
    case 'command_execution':
      return 'chat.interactionCommandHeader';
    case 'file_change':
      return 'chat.interactionFileHeader';
    case 'permission_profile':
      return 'chat.interactionPermissionHeader';
    case 'mcp_elicitation':
      return 'chat.interactionMcpHeader';
    default:
      return 'chat.pendingApproval';
  }
}

function resolveDismissAction(
  request: AgentSessionPendingTypedRequest,
): AgentInteractionAction | null {
  return (['cancel', 'dismiss', 'skip', 'decline'] as const)
    .find((action) => actionAllowed(request, action)) ?? null;
}

function AutoResolutionCountdown({
  disabled,
  milliseconds,
  onElapsed,
}: {
  disabled: boolean;
  milliseconds: number;
  onElapsed: () => void;
}) {
  const { t } = useTranslation();
  const didElapseRef = useRef(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.max(0, Math.ceil(milliseconds / 1_000)),
  );

  useEffect(() => {
    if (disabled || milliseconds <= 0) return undefined;
    didElapseRef.current = false;
    const deadline = Date.now() + milliseconds;
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && !didElapseRef.current) {
        didElapseRef.current = true;
        onElapsed();
      }
    };
    const interval = window.setInterval(updateRemaining, 1_000);
    const timeout = window.setTimeout(updateRemaining, milliseconds);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [disabled, milliseconds, onElapsed]);

  return (
    <span
      className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-200"
      data-user-input-auto-resolution={milliseconds}
      aria-live="polite"
    >
      {t('chat.interactionAutoDismiss', { seconds: remainingSeconds })}
    </span>
  );
}

function SchemaField({
  autoFocus,
  fieldName,
  onChange,
  property,
  required,
  value,
}: {
  autoFocus: boolean;
  fieldName: string;
  onChange: (value: unknown) => void;
  property: JsonSchemaProperty;
  required: boolean;
  value: unknown;
}) {
  const label = property.title?.trim() || fieldName;
  const options = property.oneOf?.map((option) => ({
    label: option.title ?? String(option.const ?? ''),
    value: option.const,
  })) ?? property.enum?.map((option) => ({ label: String(option), value: option }));

  if (property.type === 'boolean') {
    return (
      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-100 hover:bg-white/[0.04]">
        <input
          autoFocus={autoFocus}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span>
          <span className="block">{label}</span>
          {property.description ? (
            <span className="block text-xs text-gray-400">{property.description}</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (options?.length) {
    return (
      <fieldset className="space-y-1 px-2">
        <legend className="text-sm font-medium text-gray-100">{label}</legend>
        {property.description ? (
          <p className="text-xs text-gray-400">{property.description}</p>
        ) : null}
        {options.map((option, index) => (
          <label
            key={`${fieldName}:${String(option.value)}:${index}`}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-200 hover:bg-white/[0.04]"
          >
            <input
              autoFocus={autoFocus && index === 0}
              type="radio"
              name={fieldName}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    );
  }

  const numeric = property.type === 'integer' || property.type === 'number';
  return (
    <label className="flex flex-col gap-1 px-2 text-sm text-gray-100">
      <span className="font-medium">{label}</span>
      {property.description ? (
        <span className="text-xs text-gray-400">{property.description}</span>
      ) : null}
      <input
        autoFocus={autoFocus}
        required={required}
        type={numeric ? 'number' : property.format === 'email' ? 'email' : property.format === 'uri' ? 'url' : 'text'}
        min={property.minimum}
        max={property.maximum}
        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
        onChange={(event) => onChange(
          numeric && event.currentTarget.value !== ''
            ? Number(event.currentTarget.value)
            : event.currentTarget.value,
        )}
        className="h-9 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-white/25"
      />
    </label>
  );
}

function TypedApprovalCard({
  approval,
  disabled,
  isCodex,
  isSubmitting,
  onSubmitApprovalDecision,
}: Required<Pick<TypedInteractionProps, 'approval'>> & Omit<TypedInteractionProps, 'approval' | 'question'>) {
  const { t } = useTranslation();
  const request = approval.request!;
  const data = request.data;
  const objectSchema = asObjectSchema(data.requestedSchema);
  const [formContent, setFormContent] = useState<Record<string, unknown>>(
    () => createInitialSchemaValues(objectSchema),
  );
  const schemaEntries = Object.entries(objectSchema?.properties ?? {});
  const requiredFields = new Set(objectSchema?.required ?? []);
  const controlsDisabled = disabled || isSubmitting || !onSubmitApprovalDecision;
  const isSchemaComplete = [...requiredFields].every((fieldName) => (
    hasSchemaValue(formContent[fieldName])
  ));

  const submitAction = useCallback(async (
    action: AgentInteractionAction,
    scope?: 'turn' | 'session',
  ) => {
    if (controlsDisabled) return;
    const accepted = action === 'accept'
      || action === 'accept_for_session'
      || action === 'accept_with_exec_policy_amendment'
      || action === 'apply_network_policy_amendment'
      || action === 'grant';
    await onSubmitApprovalDecision?.(approval.interactionId, {
      action,
      content: request.kind === 'mcp_elicitation' && action === 'accept'
        ? formContent
        : undefined,
      decision: accepted ? 'approved' : action === 'cancel' ? 'blocked' : 'denied',
      execPolicyAmendment: action === 'accept_with_exec_policy_amendment'
        ? data.proposedExecPolicyAmendment
        : undefined,
      networkPolicyAmendment: action === 'apply_network_policy_amendment'
        ? data.proposedNetworkPolicyAmendment
        : undefined,
      permissions: action === 'grant' ? data.requestedPermissions ?? {} : undefined,
      scope: action === 'grant' ? scope ?? 'turn' : undefined,
    });
  }, [approval.interactionId, controlsDisabled, data, formContent, onSubmitApprovalDecision, request.kind]);

  const title = data.message?.trim() || approval.prompt;
  const changes = data.changes ? Object.entries(data.changes) : [];
  const showSchema = request.kind === 'mcp_elicitation'
    && (data.mode === 'form' || data.mode === 'openai/form')
    && schemaEntries.length > 0;

  return (
    <section
      className="overflow-hidden rounded-xl border border-white/10 bg-[#242426] shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
      data-codex-approval-surface={isCodex ? 'true' : undefined}
      data-codex-interaction-kind={request.kind}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-3 text-xs font-medium text-gray-300">
        {interactionIcon(request.kind)}
        <span>{t(approvalLabelKey(request.kind))}</span>
      </div>
      <div className="px-4 pb-3">
        <h3 className="whitespace-pre-wrap break-words text-sm font-medium leading-5 text-gray-100">
          {title}
        </h3>
        {data.reason ? <p className="mt-1 text-xs text-gray-400">{data.reason}</p> : null}
      </div>

      {data.command ? (
        <pre className="mx-4 mb-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/25 px-3 py-2 font-mono text-xs leading-5 text-gray-200">
          {data.command}
        </pre>
      ) : null}
      {data.cwd ? (
        <div className="mx-4 mb-3 flex min-w-0 items-center gap-2 text-xs text-gray-400">
          <FolderOpen size={13} className="shrink-0" aria-hidden="true" />
          <span className="truncate" title={data.cwd}>{data.cwd}</span>
        </div>
      ) : null}
      {changes.length > 0 ? (
        <div className="mx-4 mb-3 max-h-52 overflow-auto rounded-lg bg-black/20 px-3 py-2">
          {changes.map(([path, change]) => (
            <div key={path} className="border-b border-white/[0.06] py-1.5 last:border-b-0">
              <div className="break-all font-mono text-xs text-gray-200">{path}</div>
              {formatChange(change) ? (
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-gray-400">{formatChange(change)}</pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {data.requestedPermissions ? (
        <pre className="mx-4 mb-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 px-3 py-2 font-mono text-xs leading-5 text-gray-300">
          {JSON.stringify(data.requestedPermissions, null, 2)}
        </pre>
      ) : null}
      {data.mode === 'url' && data.url ? (
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="mx-4 mb-3 flex min-w-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-blue-300 hover:bg-white/[0.04]"
        >
          <Globe2 size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{data.url}</span>
        </a>
      ) : null}
      {showSchema ? (
        <div className="space-y-3 px-2 pb-3">
          {schemaEntries.map(([fieldName, property], index) => (
            <SchemaField
              key={fieldName}
              autoFocus={index === 0}
              fieldName={fieldName}
              property={property}
              required={requiredFields.has(fieldName)}
              value={formContent[fieldName] ?? property.default}
              onChange={(value) => setFormContent((current) => ({ ...current, [fieldName]: value }))}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-3 py-2">
        {actionAllowed(request, 'cancel') ? (
          <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('cancel')}>
            <X size={14} />{t('chat.interactionCancel')}
          </Button>
        ) : null}
        {actionAllowed(request, 'decline') ? (
          <Button type="button" variant="outline" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('decline')}>
            {request.kind === 'mcp_elicitation' ? t('chat.interactionSkip') : t('chat.denyInteraction')}
          </Button>
        ) : null}
        {actionAllowed(request, 'apply_network_policy_amendment') && data.proposedNetworkPolicyAmendment ? (
          <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('apply_network_policy_amendment')}>
            {t('chat.interactionAllowNetwork')}
          </Button>
        ) : null}
        {actionAllowed(request, 'accept_with_exec_policy_amendment') && data.proposedExecPolicyAmendment ? (
          <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('accept_with_exec_policy_amendment')}>
            {t('chat.interactionAllowSimilar')}
          </Button>
        ) : null}
        {actionAllowed(request, 'accept_for_session') ? (
          <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('accept_for_session')}>
            {request.kind === 'file_change'
              ? t('chat.interactionAllowAllEdits')
              : t('chat.interactionAllowSession')}
          </Button>
        ) : null}
        {actionAllowed(request, 'grant') ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('grant', 'session')}>
              {t('chat.interactionAllowSession')}
            </Button>
            <Button type="button" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('grant', 'turn')}>
              {t('chat.allowOnceInteraction')}
            </Button>
          </>
        ) : null}
        {actionAllowed(request, 'accept') ? (
          <Button
            type="button"
            size="sm"
            autoFocus
            disabled={controlsDisabled || (showSchema && !isSchemaComplete)}
            onClick={() => void submitAction('accept')}
          >
            {request.kind === 'mcp_elicitation'
              ? t('chat.interactionContinue')
              : t('chat.allowOnceInteraction')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function promptKey(prompt: AgentSessionPendingQuestionPrompt, index: number): string {
  return prompt.id?.trim() || `question-${index}`;
}

function TypedQuestionCard({
  disabled,
  isSubmitting,
  onSubmitUserQuestionAnswer,
  question,
}: Required<Pick<TypedInteractionProps, 'question'>> & Omit<TypedInteractionProps, 'approval' | 'question'>) {
  const { t } = useTranslation();
  const request = question.request!;
  const controlsDisabled = disabled || isSubmitting || !onSubmitUserQuestionAnswer;
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [freeformDrafts, setFreeformDrafts] = useState<Record<string, string>>({});

  const autoResolutionMs = useMemo(() => {
    const value = Number(request.data.autoResolutionMs);
    return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647
      ? value
      : null;
  }, [request.data.autoResolutionMs]);

  const updateOption = useCallback((
    key: string,
    value: string,
    allowMultiple: boolean,
  ) => {
    setAnswers((current) => {
      const selected = current[key] ?? [];
      return {
        ...current,
        [key]: allowMultiple
          ? selected.includes(value)
            ? selected.filter((entry) => entry !== value)
            : [...selected, value]
          : [value],
      };
    });
  }, []);

  const submitAction = useCallback(async (action: AgentInteractionAction) => {
    if (controlsDisabled) return;
    const normalizedAnswers = Object.fromEntries(
      question.questions.flatMap((prompt, index) => {
        const key = promptKey(prompt, index);
        const selected = answers[key] ?? [];
        const freeform = freeformDrafts[key]?.trim();
        const values = freeform ? [...selected, freeform] : selected;
        return prompt.id && values.length > 0 ? [[prompt.id, values]] : [];
      }),
    );
    const pickerKey = promptKey(question.questions[0] ?? { question: '' }, 0);
    const pickerValues = answers[pickerKey] ?? [];
    const pickerFreeform = freeformDrafts[pickerKey]?.trim() || null;
    const input: AgentQuestionAnswerInput = { action };
    if (request.kind === 'question_set' || request.kind === 'onboarding_question_set') {
      input.answers = normalizedAnswers;
    } else if (request.kind === 'option_picker') {
      input.selectedOptions = pickerValues;
      input.freeformAnswer = pickerFreeform;
    } else if (request.kind === 'context_source_picker') {
      input.selectedSources = pickerValues;
    } else if (request.kind === 'setup_step') {
      if (request.data.step === 'role') input.selectedRoles = pickerValues;
      if (request.data.step === 'task') input.answers = normalizedAnswers;
      if (request.data.step === 'context') input.selectedSources = pickerValues;
    }
    input.rejected = action === 'cancel' || action === 'dismiss' || action === 'skip';
    await onSubmitUserQuestionAnswer?.(question.interactionId, input);
  }, [answers, controlsDisabled, freeformDrafts, onSubmitUserQuestionAnswer, question, request]);

  const dismissAction = resolveDismissAction(request);
  const handleAutoResolution = useCallback(() => {
    if (dismissAction) void submitAction(dismissAction);
  }, [dismissAction, submitAction]);
  const primaryAction = actionAllowed(request, 'continue') ? 'continue'
    : actionAllowed(request, 'submit') ? 'submit'
      : null;
  const allowMultiple = request.data.allowMultiple === true;

  return (
    <section
      className="overflow-hidden rounded-xl border border-white/10 bg-[#242426] shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
      data-codex-interaction-kind={request.kind}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && dismissAction && !controlsDisabled) {
          event.preventDefault();
          void submitAction(dismissAction);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-gray-300">
          {interactionIcon(request.kind)}
          <span>{request.data.submitLabel || t('chat.pendingQuestion')}</span>
        </div>
        {autoResolutionMs ? (
          <AutoResolutionCountdown
            disabled={controlsDisabled}
            milliseconds={autoResolutionMs}
            onElapsed={handleAutoResolution}
          />
        ) : null}
      </div>
      <p className="px-4 pb-3 whitespace-pre-wrap break-words text-sm leading-5 text-gray-100">
        {question.prompt}
      </p>

      <div className="space-y-4 px-3 pb-3">
        {question.questions.map((prompt, promptIndex) => {
          const key = promptKey(prompt, promptIndex);
          const selected = answers[key] ?? [];
          const optionMultiple = allowMultiple;
          return (
            <fieldset key={key} className="space-y-1">
              <legend className="px-1 text-sm font-medium text-gray-100">
                {prompt.header ? <span className="mr-2 text-xs text-gray-400">{prompt.header}</span> : null}
                {prompt.question}
              </legend>
              {prompt.options?.map((option, optionIndex) => {
                const isSelected = selected.includes(option.value);
                return (
                  <button
                    key={`${key}:${option.value}:${optionIndex}`}
                    type="button"
                    role={optionMultiple ? 'checkbox' : 'radio'}
                    aria-checked={isSelected}
                    disabled={controlsDisabled}
                    onClick={() => updateOption(key, option.value, optionMultiple)}
                    className="flex min-h-9 w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-200 hover:bg-white/[0.05] disabled:opacity-50"
                  >
                    <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center border ${optionMultiple ? 'rounded' : 'rounded-full'} ${isSelected ? 'border-blue-400 bg-blue-500 text-white' : 'border-white/20'}`}>
                      {isSelected ? <Check size={11} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words">{option.label}</span>
                      {option.description ? (
                        <span className="block break-words text-xs leading-4 text-gray-400">{option.description}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
              {prompt.allowOther || !prompt.options?.length ? (
                <input
                  type={prompt.secret ? 'password' : 'text'}
                  value={freeformDrafts[key] ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFreeformDrafts((current) => ({
                      ...current,
                      [key]: value,
                    }));
                  }}
                  disabled={controlsDisabled}
                  placeholder={t('chat.pendingQuestionAnswerPlaceholder')}
                  className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white/25"
                />
              ) : null}
            </fieldset>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-3 py-2">
        {actionAllowed(request, 'dismiss') ? (
          <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('dismiss')}>
            {t('chat.interactionDismiss')}
          </Button>
        ) : null}
        {actionAllowed(request, 'skip') ? (
          <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('skip')}>
            {request.data.skipLabel || t('chat.interactionSkip')}
          </Button>
        ) : null}
        {actionAllowed(request, 'cancel') ? (
          <Button type="button" variant="outline" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('cancel')}>
            {t('chat.interactionCancel')}
          </Button>
        ) : null}
        {primaryAction ? (
          <Button type="button" size="sm" autoFocus disabled={controlsDisabled} onClick={() => void submitAction(primaryAction)}>
            {request.data.submitLabel || (primaryAction === 'continue'
              ? t('chat.interactionContinue')
              : t('chat.interactionSubmit'))}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function UniversalChatTypedInteraction(props: TypedInteractionProps) {
  if (props.approval?.request) {
    return <TypedApprovalCard {...props} approval={props.approval} />;
  }
  if (props.question?.request) {
    return <TypedQuestionCard {...props} question={props.question} />;
  }
  return null;
}
