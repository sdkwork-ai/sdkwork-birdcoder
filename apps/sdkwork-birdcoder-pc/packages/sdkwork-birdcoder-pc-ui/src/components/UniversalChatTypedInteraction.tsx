import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  FolderOpen,
  Globe2,
  Loader2,
  Pencil,
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
  enableGlobalApprovalHotkeys?: boolean;
  enableGlobalQuestionHotkeys?: boolean;
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

function isInteractionControlTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement
    || target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement;
}

function hasOpenInteractionPopup(): boolean {
  return document.querySelector([
    '[role="dialog"][data-state="open"]',
    '[role="menu"]',
    '[role="listbox"][data-state="open"]',
  ].join(', ')) !== null;
}

function isIgnoredQuestionShortcutTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && target.closest('[data-codex-terminal],[data-codex-branch-create-dialog]') !== null;
}

function isComposingKeyboardEvent(
  event: KeyboardEvent | ReactKeyboardEvent<HTMLElement>,
): boolean {
  return 'nativeEvent' in event ? event.nativeEvent.isComposing : event.isComposing;
}

interface ApprovalScopedAction {
  action: AgentInteractionAction;
  label: string;
  scope?: 'turn' | 'session';
  tooltip?: string;
}

function ApprovalSplitButton({
  disabled,
  isLoading,
  onPrimaryAction,
  onScopedAction,
  primaryDisabled,
  primaryLabel,
  scopedAction,
}: {
  disabled: boolean;
  isLoading: boolean;
  onPrimaryAction: () => void;
  onScopedAction: () => void;
  primaryDisabled: boolean;
  primaryLabel: string;
  scopedAction: ApprovalScopedAction;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const positionMenu = useCallback(() => {
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setMenuStyle({
      bottom: Math.max(8, window.innerHeight - bounds.top + 6),
      right: Math.max(8, window.innerWidth - bounds.right),
      width: Math.max(220, bounds.width),
    });
  }, []);

  const openMenu = useCallback((focusIndex = 0) => {
    if (disabled) return;
    positionMenu();
    setIsOpen(true);
    window.requestAnimationFrame(() => menuItemRefs.current[focusIndex]?.focus());
  }, [disabled, positionMenu]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleViewportChange = () => positionMenu();
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, positionMenu]);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const activeIndex = menuItemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      menuItemRefs.current[event.key === 'Home' ? 0 : 1]?.focus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      menuItemRefs.current[(activeIndex + direction + 2) % 2]?.focus();
    }
  };

  const approvalOptionsLabel = t('chat.interactionApprovalOptions');
  const menu = isOpen ? createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={approvalOptionsLabel}
      className="fixed z-[120] rounded-lg border border-white/10 bg-[#18181b] p-1 text-sm text-gray-100 shadow-[0_16px_48px_rgba(0,0,0,0.48)]"
      style={menuStyle}
      onKeyDown={handleMenuKeyDown}
    >
      <button
        ref={(element) => { menuItemRefs.current[0] = element; }}
        type="button"
        role="menuitem"
        disabled={primaryDisabled}
        className="flex min-h-9 w-full items-center rounded-md px-3 py-2 text-left hover:bg-white/[0.08] focus:bg-white/[0.08] focus:outline-none disabled:opacity-50"
        onClick={() => {
          setIsOpen(false);
          onPrimaryAction();
        }}
      >
        {primaryLabel}
      </button>
      <button
        ref={(element) => { menuItemRefs.current[1] = element; }}
        type="button"
        role="menuitem"
        title={scopedAction.tooltip}
        className="flex min-h-9 w-full items-center rounded-md px-3 py-2 text-left hover:bg-white/[0.08] focus:bg-white/[0.08] focus:outline-none"
        onClick={() => {
          setIsOpen(false);
          onScopedAction();
        }}
      >
        {scopedAction.label}
      </button>
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={rootRef} className="relative flex overflow-hidden rounded-md">
      <Button
        type="button"
        size="sm"
        autoFocus
        className="rounded-r-none border-r border-blue-400/30"
        disabled={disabled || primaryDisabled}
        onClick={onPrimaryAction}
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
        {primaryLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={approvalOptionsLabel}
        title={approvalOptionsLabel}
        className="w-8 rounded-l-none px-0"
        disabled={disabled}
        onClick={() => {
          if (isOpen) setIsOpen(false);
          else openMenu(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(event.key === 'ArrowUp' ? 1 : 0);
          }
        }}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </Button>
      {menu}
    </div>
  );
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
  enableGlobalApprovalHotkeys,
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
  const submissionInFlightRef = useRef(false);
  const [isSubmittingLocally, setIsSubmittingLocally] = useState(false);
  const schemaEntries = Object.entries(objectSchema?.properties ?? {});
  const requiredFields = new Set(objectSchema?.required ?? []);
  const controlsDisabled = disabled
    || isSubmitting
    || isSubmittingLocally
    || !onSubmitApprovalDecision;
  const isSchemaComplete = [...requiredFields].every((fieldName) => (
    hasSchemaValue(formContent[fieldName])
  ));

  const submitAction = useCallback(async (
    action: AgentInteractionAction,
    scope?: 'turn' | 'session',
  ) => {
    if (controlsDisabled || submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setIsSubmittingLocally(true);
    const accepted = action === 'accept'
      || action === 'accept_for_session'
      || action === 'accept_with_exec_policy_amendment'
      || action === 'apply_network_policy_amendment'
      || action === 'grant';
    try {
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
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmittingLocally(false);
    }
  }, [approval.interactionId, controlsDisabled, data, formContent, onSubmitApprovalDecision, request.kind]);

  const title = data.message?.trim() || approval.prompt;
  const changes = data.changes ? Object.entries(data.changes) : [];
  const showSchema = request.kind === 'mcp_elicitation'
    && (data.mode === 'form' || data.mode === 'openai/form')
    && schemaEntries.length > 0;
  const primaryKeyboardAction = actionAllowed(request, 'accept')
    ? 'accept'
    : actionAllowed(request, 'grant')
      ? 'grant'
      : null;
  const declineKeyboardAction = actionAllowed(request, 'decline')
    ? 'decline'
    : actionAllowed(request, 'cancel')
      ? 'cancel'
      : null;
  const hasNetworkPolicyAmendment = actionAllowed(request, 'apply_network_policy_amendment')
    && data.proposedNetworkPolicyAmendment !== undefined;
  const scopedApproveAction: ApprovalScopedAction | null = !isCodex
    ? null
    : hasNetworkPolicyAmendment && actionAllowed(request, 'accept_for_session')
      ? {
          action: 'accept_for_session',
          label: t('chat.interactionAllowConversation'),
        }
      : request.kind === 'file_change' && actionAllowed(request, 'accept_for_session')
        ? {
            action: 'accept_for_session',
            label: t('chat.interactionAllowAllEdits'),
            tooltip: t('chat.interactionAllowAllEditsTooltip'),
          }
        : request.kind === 'command_execution'
          && actionAllowed(request, 'accept_with_exec_policy_amendment')
          && data.proposedExecPolicyAmendment !== undefined
          ? {
              action: 'accept_with_exec_policy_amendment',
              label: t('chat.interactionAllowSimilar'),
              tooltip: t('chat.interactionAllowSimilarTooltip'),
            }
          : null;
  const showPrimaryAccept = actionAllowed(request, 'accept');
  const approvalIsLoading = Boolean(isSubmitting || isSubmittingLocally);
  const primaryActionDisabled = showSchema && !isSchemaComplete;

  useEffect(() => {
    if (!isCodex || !enableGlobalApprovalHotkeys) return undefined;
    const handleGlobalApprovalHotkey = (event: KeyboardEvent) => {
      if (controlsDisabled || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[role="dialog"],[role="menu"]')) return;
      if (
        event.key === 'Enter'
        && primaryKeyboardAction
        && !primaryActionDisabled
        && !target?.closest('button,a')
      ) {
        event.preventDefault();
        void submitAction(
          primaryKeyboardAction,
          primaryKeyboardAction === 'grant' ? 'turn' : undefined,
        );
      } else if (event.key === 'Escape' && declineKeyboardAction) {
        event.preventDefault();
        void submitAction(declineKeyboardAction);
      }
    };
    window.addEventListener('keydown', handleGlobalApprovalHotkey);
    return () => window.removeEventListener('keydown', handleGlobalApprovalHotkey);
  }, [
    controlsDisabled,
    declineKeyboardAction,
    enableGlobalApprovalHotkeys,
    isCodex,
    primaryActionDisabled,
    primaryKeyboardAction,
    submitAction,
  ]);

  return (
    <section
      className={`@container/request-card flex flex-col overflow-hidden bg-[#242426] text-gray-100 shadow-[0_12px_32px_rgba(0,0,0,0.28)] focus:outline-none ${
        showSchema ? 'rounded-[28px]' : 'rounded-3xl'
      }`}
      data-codex-approval-surface={isCodex ? 'true' : undefined}
      data-codex-interaction-kind={request.kind}
      tabIndex={isCodex ? 0 : undefined}
      onKeyDown={(event) => {
        if (!isCodex || controlsDisabled || isInteractionControlTarget(event.target)) return;
        if (event.key === 'Enter' && primaryKeyboardAction && !primaryActionDisabled) {
          event.preventDefault();
          void submitAction(primaryKeyboardAction, primaryKeyboardAction === 'grant' ? 'turn' : undefined);
        } else if (event.key === 'Escape' && declineKeyboardAction) {
          event.preventDefault();
          void submitAction(declineKeyboardAction);
        }
      }}
    >
      <div className="flex min-w-0 flex-col gap-2 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2 text-xs font-normal leading-5 text-gray-400">
          {interactionIcon(request.kind)}
          <span>{t(approvalLabelKey(request.kind))}</span>
        </div>
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
        <div className="flex flex-col gap-4 px-4 pb-3">
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

      <div className={`flex flex-wrap items-center gap-2 px-4 @max-md/request-card:flex-col @max-md/request-card:items-end ${
        showSchema ? 'border-t border-white/[0.06] py-3' : 'pb-4 pt-2'
      }`}>
        {hasNetworkPolicyAmendment ? (
          <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('apply_network_policy_amendment')}>
            {isCodex ? t('chat.interactionAlwaysAllow') : t('chat.interactionAllowNetwork')}
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2 @max-md/request-card:flex-col @max-md/request-card:items-end">
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
          {!isCodex && actionAllowed(request, 'accept_with_exec_policy_amendment') && data.proposedExecPolicyAmendment ? (
            <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => void submitAction('accept_with_exec_policy_amendment')}>
              {t('chat.interactionAllowSimilar')}
            </Button>
          ) : null}
          {!isCodex && actionAllowed(request, 'accept_for_session') ? (
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
                {approvalIsLoading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                {t('chat.allowOnceInteraction')}
              </Button>
            </>
          ) : null}
          {showPrimaryAccept && scopedApproveAction ? (
            <ApprovalSplitButton
              disabled={controlsDisabled}
              isLoading={approvalIsLoading}
              primaryDisabled={primaryActionDisabled}
              primaryLabel={request.kind === 'mcp_elicitation'
                ? t('chat.interactionContinue')
                : t('chat.allowOnceInteraction')}
              scopedAction={scopedApproveAction}
              onPrimaryAction={() => void submitAction('accept')}
              onScopedAction={() => void submitAction(
                scopedApproveAction.action,
                scopedApproveAction.scope,
              )}
            />
          ) : showPrimaryAccept ? (
            <Button
              type="button"
              size="sm"
              autoFocus
              disabled={controlsDisabled || primaryActionDisabled}
              onClick={() => void submitAction('accept')}
            >
              {approvalIsLoading ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : null}
              {request.kind === 'mcp_elicitation'
                ? t('chat.interactionContinue')
                : t('chat.allowOnceInteraction')}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function promptKey(prompt: AgentSessionPendingQuestionPrompt, index: number): string {
  return prompt.id?.trim() || `question-${index}`;
}

function TypedQuestionCard({
  disabled,
  enableGlobalQuestionHotkeys,
  isCodex,
  isSubmitting,
  onSubmitUserQuestionAnswer,
  question,
}: Required<Pick<TypedInteractionProps, 'question'>> & Omit<TypedInteractionProps, 'approval' | 'question'>) {
  const { t } = useTranslation();
  const request = question.request!;
  const allowMultiple = request.data.allowMultiple === true;
  const isImmediateResponse = Boolean(
    isCodex
    && (request.kind === 'question_set' || request.kind === 'onboarding_question_set'),
  );
  const [isSubmittingLocally, setIsSubmittingLocally] = useState(false);
  const controlsDisabled = Boolean(
    disabled || isSubmitting || isSubmittingLocally || !onSubmitUserQuestionAnswer,
  );
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => (
    allowMultiple
      ? {}
      : Object.fromEntries(question.questions.flatMap((prompt, index) => (
          prompt.options?.[0]
            ? [[promptKey(prompt, index), [prompt.options[0].value]]]
            : []
        )))
  ));
  const [freeformDrafts, setFreeformDrafts] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [advancingOptionValue, setAdvancingOptionValue] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const freeformTextareaRef = useRef<HTMLTextAreaElement>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoResolutionMs = useMemo(() => {
    const value = Number(request.data.autoResolutionMs);
    return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647
      ? value
      : null;
  }, [request.data.autoResolutionMs]);

  const updateOption = useCallback((
    key: string,
    value: string,
    multiple: boolean,
  ) => {
    const selected = answers[key] ?? [];
    const nextAnswers = {
      ...answers,
      [key]: multiple
        ? selected.includes(value)
          ? selected.filter((entry) => entry !== value)
          : [...selected, value]
        : [value],
    };
    setAnswers(nextAnswers);
    return nextAnswers;
  }, [answers]);

  const submitAction = useCallback(async (
    action: AgentInteractionAction,
    answerState: Record<string, string[]> = answers,
    freeformState: Record<string, string> = freeformDrafts,
  ) => {
    if (controlsDisabled) return;
    const normalizedAnswers = Object.fromEntries(
      question.questions.flatMap((prompt, index) => {
        const key = promptKey(prompt, index);
        const selected = answerState[key] ?? [];
        const freeform = freeformState[key]?.trim();
        const values = allowMultiple && freeform
          ? [...selected, freeform]
          : selected.length > 0
            ? selected
            : freeform
              ? [freeform]
              : [];
        return prompt.id && values.length > 0 ? [[prompt.id, values]] : [];
      }),
    );
    const pickerKey = promptKey(question.questions[0] ?? { question: '' }, 0);
    const pickerValues = answerState[pickerKey] ?? [];
    const pickerFreeform = pickerValues.length > 0
      ? null
      : freeformState[pickerKey]?.trim() || null;
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
    setIsSubmittingLocally(true);
    try {
      await onSubmitUserQuestionAnswer?.(question.interactionId, input);
    } finally {
      setIsSubmittingLocally(false);
    }
  }, [allowMultiple, answers, controlsDisabled, freeformDrafts, onSubmitUserQuestionAnswer, question, request]);

  const dismissAction = resolveDismissAction(request);
  const handleAutoResolution = useCallback(() => {
    if (dismissAction) void submitAction(dismissAction);
  }, [dismissAction, submitAction]);
  const primaryAction = actionAllowed(request, 'continue') ? 'continue'
    : actionAllowed(request, 'submit') ? 'submit'
      : null;
  const isMultiQuestion = question.questions.length > 1;
  const isFirstQuestion = questionIndex === 0;
  const isLastQuestion = questionIndex >= question.questions.length - 1;
  const currentPrompt = question.questions[questionIndex] ?? question.questions[0];
  const currentPromptKey = promptKey(currentPrompt ?? { question: '' }, questionIndex);
  const currentSelected = answers[currentPromptKey] ?? [];
  const showNextQuestion = isMultiQuestion && !isLastQuestion && primaryAction !== null;
  const currentOptions = currentPrompt?.options ?? [];
  const currentFreeform = freeformDrafts[currentPromptKey] ?? '';
  const hasInlineOther = Boolean(currentPrompt?.allowOther && currentOptions.length > 0);
  const handlePrimaryAction = useCallback((
    nextAnswers: Record<string, string[]> = answers,
    nextFreeformDrafts: Record<string, string> = freeformDrafts,
  ) => {
    if (controlsDisabled || !primaryAction) return;
    if (showNextQuestion) {
      setQuestionIndex((current) => Math.min(current + 1, question.questions.length - 1));
      return;
    }
    void submitAction(primaryAction, nextAnswers, nextFreeformDrafts);
  }, [answers, controlsDisabled, freeformDrafts, primaryAction, question.questions.length, showNextQuestion, submitAction]);

  const selectOption = useCallback((value: string, shouldAdvance: boolean) => {
    if (controlsDisabled || advanceTimerRef.current !== null) return;
    const nextAnswers = updateOption(currentPromptKey, value, allowMultiple);
    if (!shouldAdvance || !primaryAction) return;
    setAdvancingOptionValue(value);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      setAdvancingOptionValue(null);
      handlePrimaryAction(nextAnswers);
    }, 180);
  }, [allowMultiple, controlsDisabled, currentPromptKey, handlePrimaryAction, primaryAction, updateOption]);

  const handleQuestionNavigationKeyDown = useCallback((
    event: KeyboardEvent | ReactKeyboardEvent<HTMLElement>,
  ) => {
    if (event.defaultPrevented || controlsDisabled || hasOpenInteractionPopup()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-request-input-other-row], [data-request-input-freeform]')) return;
    if (target?.closest('[data-request-input-navigation-control]')) return;
    if (event.key === 'Escape' && dismissAction) {
      event.preventDefault();
      void submitAction(dismissAction);
      return;
    }
    if (advanceTimerRef.current !== null) {
      event.preventDefault();
      return;
    }
    if (event.key >= '1' && event.key <= '9') {
      const optionIndex = Number(event.key) - 1;
      const option = currentOptions[optionIndex];
      if (option) {
        event.preventDefault();
        selectOption(option.value, isImmediateResponse && !allowMultiple);
        return;
      }
      if (hasInlineOther && optionIndex === currentOptions.length) {
        event.preventDefault();
        setAnswers((current) => ({ ...current, [currentPromptKey]: [] }));
        freeformTextareaRef.current?.focus();
      }
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!isMultiQuestion) return;
      event.preventDefault();
      setQuestionIndex((current) => Math.min(
        Math.max(current + (event.key === 'ArrowRight' ? 1 : -1), 0),
        question.questions.length - 1,
      ));
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentOptions.length === 0) return;
      const selectedIndex = currentOptions.findIndex((option) => (
        currentSelected.includes(option.value)
      ));
      if (event.key === 'ArrowUp' && selectedIndex === 0) return;
      if (event.key === 'ArrowDown' && selectedIndex === currentOptions.length - 1) {
        if (hasInlineOther) {
          setAnswers((current) => ({ ...current, [currentPromptKey]: [] }));
          freeformTextareaRef.current?.focus();
        }
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = selectedIndex < 0
        ? direction > 0 ? 0 : currentOptions.length - 1
        : Math.min(Math.max(selectedIndex + direction, 0), currentOptions.length - 1);
      const option = currentOptions[nextIndex];
      if (option) updateOption(currentPromptKey, option.value, false);
      return;
    }
    if (event.key === 'Enter') {
      if (isComposingKeyboardEvent(event)) return;
      event.preventDefault();
      handlePrimaryAction();
    }
  }, [
    allowMultiple,
    controlsDisabled,
    currentOptions,
    currentPromptKey,
    currentSelected,
    dismissAction,
    handlePrimaryAction,
    hasInlineOther,
    isImmediateResponse,
    isMultiQuestion,
    question.questions.length,
    selectOption,
    submitAction,
    updateOption,
  ]);

  useEffect(() => {
    surfaceRef.current?.focus();
  }, [questionIndex]);

  useEffect(() => () => {
    if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current);
  }, []);

  useEffect(() => {
    if (!enableGlobalQuestionHotkeys || !isCodex) return undefined;
    const handleGlobalQuestionHotkey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isIgnoredQuestionShortcutTarget(event.target)) return;
      if (event.target instanceof Node && surfaceRef.current?.contains(event.target)) return;
      handleQuestionNavigationKeyDown(event);
    };
    window.addEventListener('keydown', handleGlobalQuestionHotkey);
    return () => window.removeEventListener('keydown', handleGlobalQuestionHotkey);
  }, [enableGlobalQuestionHotkeys, handleQuestionNavigationKeyDown, isCodex]);

  return (
    <section
      ref={surfaceRef}
      className="@container/request-card flex flex-col overflow-hidden rounded-3xl bg-[#242426] text-gray-100 shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
      data-codex-composer-request-navigation="true"
      data-codex-interaction-kind={request.kind}
      data-codex-question-index={questionIndex + 1}
      data-user-input-auto-resolution={autoResolutionMs ? 'true' : undefined}
      tabIndex={0}
      onKeyDown={handleQuestionNavigationKeyDown}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-gray-300">
          {interactionIcon(request.kind)}
          <span>{request.data.submitLabel || t('chat.pendingQuestion')}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 text-xs text-gray-400">
          {isMultiQuestion ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 rounded-md"
                data-request-input-navigation-control="true"
                aria-label={t('chat.interactionPrevious')}
                title={t('chat.interactionPrevious')}
                disabled={controlsDisabled || isFirstQuestion}
                onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft size={12} aria-hidden="true" />
              </Button>
              <span className="px-1">
                {questionIndex + 1} {t('chat.interactionOf')} {question.questions.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 rounded-md"
                data-request-input-navigation-control="true"
                aria-label={t('chat.interactionNext')}
                title={t('chat.interactionNext')}
                disabled={controlsDisabled || isLastQuestion}
                onClick={() => setQuestionIndex((current) => Math.min(
                  current + 1,
                  question.questions.length - 1,
                ))}
              >
                <ChevronRight size={12} aria-hidden="true" />
              </Button>
            </>
          ) : null}
          {autoResolutionMs ? (
            <AutoResolutionCountdown
              disabled={controlsDisabled}
              milliseconds={autoResolutionMs}
              onElapsed={handleAutoResolution}
            />
          ) : null}
        </div>
      </div>
      <p className="px-4 pb-3 whitespace-pre-wrap break-words text-sm leading-5 text-gray-100">
        {question.prompt}
      </p>

      <div className="space-y-4 px-4 pb-3">
        {currentPrompt ? (
          <fieldset
            className="space-y-1"
            key={currentPromptKey}
            role={allowMultiple ? 'group' : 'radiogroup'}
          >
            <legend className="px-1 text-sm font-medium text-gray-100">
              {currentPrompt.header ? <span className="mr-2 text-xs text-gray-400">{currentPrompt.header}</span> : null}
              {currentPrompt.question}
            </legend>
            {currentPrompt.options?.map((option, optionIndex) => {
              const isSelected = currentSelected.includes(option.value);
              return (
                <button
                  key={`${currentPromptKey}:${option.value}:${optionIndex}`}
                  type="button"
                  role={allowMultiple ? 'checkbox' : 'radio'}
                  aria-checked={isSelected}
                  disabled={controlsDisabled}
                  data-request-input-option="true"
                  onClick={() => selectOption(
                    option.value,
                    isImmediateResponse && !allowMultiple,
                  )}
                  className={`flex min-h-9 w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-gray-200 hover:bg-white/[0.05] disabled:opacity-50 ${
                    isSelected || advancingOptionValue === option.value ? 'bg-white/[0.04]' : ''
                  }`}
                >
                  <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium leading-none ${
                    allowMultiple
                      ? isSelected
                        ? 'border-blue-400 bg-blue-500 text-white'
                        : 'border-white/20 text-gray-400'
                      : isSelected
                        ? 'border-white bg-white text-[#18181b]'
                        : 'border-white/20 bg-white/[0.05] text-gray-400'
                  }`}>
                    {allowMultiple && isSelected ? <Check size={11} /> : optionIndex + 1}
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
            {hasInlineOther ? (
              <div
                className="mt-1 flex min-h-8 w-full cursor-text items-start gap-2 rounded-xl px-2 py-1.5 text-sm text-gray-200 hover:bg-white/[0.05] focus-within:ring-1 focus-within:ring-white/25"
                data-request-input-other-row="true"
                onMouseDown={(event) => {
                  if (event.target !== freeformTextareaRef.current) event.preventDefault();
                  freeformTextareaRef.current?.focus();
                }}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    currentSelected.length === 0 && currentFreeform.length > 0
                      ? 'border-white bg-white text-[#18181b]'
                      : 'border-white/20 bg-white/[0.05] text-gray-400'
                  }`}
                >
                  <Pencil size={11} />
                </span>
                <textarea
                  ref={freeformTextareaRef}
                  rows={1}
                  value={currentFreeform}
                  disabled={controlsDisabled}
                  data-autoresize="true"
                  aria-label={t('chat.interactionOther')}
                  placeholder={t('chat.interactionOther')}
                  className="block h-5 max-h-32 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-5 text-gray-100 outline-none placeholder:text-gray-500"
                  onFocus={() => {
                    setAnswers((current) => ({ ...current, [currentPromptKey]: [] }));
                  }}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    event.currentTarget.style.height = value.trim().length > 0
                      ? `${Math.min(event.currentTarget.scrollHeight, 128)}px`
                      : '';
                    const nextFreeformDrafts = {
                      ...freeformDrafts,
                      [currentPromptKey]: value,
                    };
                    setFreeformDrafts(nextFreeformDrafts);
                    setAnswers((current) => ({ ...current, [currentPromptKey]: [] }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' && currentOptions.length > 0) {
                      const lineHeight = Number.parseFloat(window.getComputedStyle(event.currentTarget).lineHeight);
                      if (
                        Number.isFinite(lineHeight)
                        && event.currentTarget.scrollHeight <= lineHeight * 1.1
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        updateOption(
                          currentPromptKey,
                          currentOptions[currentOptions.length - 1]!.value,
                          false,
                        );
                        surfaceRef.current?.focus();
                      }
                      return;
                    }
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.stopPropagation();
                      handlePrimaryAction();
                    }
                  }}
                />
                {isImmediateResponse ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={currentFreeform.trim() ? 'default' : 'outline'}
                    className="shrink-0"
                    data-request-input-navigation-control="true"
                    disabled={controlsDisabled}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.stopPropagation();
                    }}
                    onClick={() => handlePrimaryAction()}
                  >
                    {currentFreeform.trim()
                      ? t('chat.interactionNext')
                      : t('chat.interactionSkip')}
                  </Button>
                ) : null}
              </div>
            ) : currentOptions.length === 0 ? (
              <div className="space-y-2" data-request-input-freeform="true">
              {currentPrompt.secret ? (
                <input
                  type="password"
                  value={currentFreeform}
                  disabled={controlsDisabled}
                  aria-label={t('chat.pendingQuestionAnswerPlaceholder')}
                  placeholder={t('chat.pendingQuestionAnswerPlaceholder')}
                  className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-transparent px-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white/25"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFreeformDrafts((current) => ({
                      ...current,
                      [currentPromptKey]: value,
                    }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.stopPropagation();
                      handlePrimaryAction();
                    }
                  }}
                />
              ) : (
                <textarea
                  rows={4}
                  value={currentFreeform}
                  disabled={controlsDisabled}
                  aria-label={t('chat.pendingQuestionAnswerPlaceholder')}
                  placeholder={t('chat.pendingQuestionAnswerPlaceholder')}
                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-transparent p-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white/25"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFreeformDrafts((current) => ({
                      ...current,
                      [currentPromptKey]: value,
                    }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.stopPropagation();
                      handlePrimaryAction();
                    }
                  }}
                />
              )}
              {isImmediateResponse ? (
                <div className="flex justify-end py-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={currentFreeform.trim() ? 'default' : 'outline'}
                    data-request-input-navigation-control="true"
                    disabled={controlsDisabled}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.stopPropagation();
                    }}
                    onClick={() => handlePrimaryAction()}
                  >
                    {currentFreeform.trim()
                      ? t('chat.interactionNext')
                      : t('chat.interactionSkip')}
                  </Button>
                </div>
              ) : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}
      </div>

      {!isImmediateResponse ? (
      <div className="flex flex-wrap justify-end gap-2 px-4 pb-4 pt-2">
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
          <Button
            type="button"
            size="sm"
            data-request-input-navigation-control="true"
            disabled={controlsDisabled}
            onClick={() => handlePrimaryAction()}
          >
            {request.data.submitLabel || (showNextQuestion
              ? t('chat.interactionContinue')
              : t('chat.interactionSubmit'))}
            <kbd
              aria-hidden="true"
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-white/15 px-1.5 text-xs font-normal leading-4"
            >
              {'\u23ce'}
            </kbd>
          </Button>
        ) : null}
      </div>
      ) : null}
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
