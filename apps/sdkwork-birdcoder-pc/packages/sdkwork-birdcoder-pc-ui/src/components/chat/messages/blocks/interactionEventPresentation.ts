import type { AgentSessionItemInteractionView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';

export function resolveInteractionEventLabel(
  interaction: AgentSessionItemInteractionView,
  t?: ChatMessageTranslate,
): string {
  if (interaction.kind === 'approval') {
    const labels = {
      approved: t?.('chat.interactionApprovalApproved') ?? 'Approval granted',
      answered: t?.('chat.interactionApprovalCompleted') ?? 'Approval resolved',
      cancelled: t?.('chat.interactionApprovalCancelled') ?? 'Approval cancelled',
      completed: t?.('chat.interactionApprovalCompleted') ?? 'Approval resolved',
      denied: t?.('chat.interactionApprovalDenied') ?? 'Approval denied',
      failed: t?.('chat.interactionApprovalFailed') ?? 'Approval failed',
      pending: t?.('chat.interactionApprovalPending') ?? 'Approval requested',
      rejected: t?.('chat.interactionApprovalDenied') ?? 'Approval denied',
    } as const;
    return labels[interaction.status];
  }

  const labels = {
    answered: t?.('chat.interactionQuestionAnswered') ?? 'Question answered',
    approved: t?.('chat.interactionQuestionCompleted') ?? 'Question resolved',
    cancelled: t?.('chat.interactionQuestionCancelled') ?? 'Question cancelled',
    completed: t?.('chat.interactionQuestionCompleted') ?? 'Question resolved',
    denied: t?.('chat.interactionQuestionRejected') ?? 'Question rejected',
    failed: t?.('chat.interactionQuestionFailed') ?? 'Question failed',
    pending: t?.('chat.interactionQuestionPending') ?? 'Question requires an answer',
    rejected: t?.('chat.interactionQuestionRejected') ?? 'Question rejected',
  } as const;
  return labels[interaction.status];
}

export function resolveInteractionEventSummary(
  interaction: AgentSessionItemInteractionView,
): string {
  return interaction.title?.trim()
    || interaction.prompt?.trim()
    || interaction.questions?.[0]?.question.trim()
    || interaction.action?.trim()
    || interaction.resources?.[0]?.trim()
    || interaction.detail?.trim()
    || '';
}

export function resolveInteractionEventMeta(
  interaction: AgentSessionItemInteractionView,
  t?: ChatMessageTranslate,
): string {
  if (interaction.kind === 'question') {
    const count = interaction.questions?.length ?? 0;
    if (count > 1) {
      return t?.('chat.interactionQuestionCount', { count }) ?? `${count} questions`;
    }
    if (interaction.answer?.trim()) return interaction.answer.trim();
    return '';
  }
  const count = interaction.resources?.length ?? 0;
  if (count > 1) {
    return t?.('chat.interactionResourceCount', { count }) ?? `${count} resources`;
  }
  return interaction.decision?.trim() ?? '';
}

export function hasInteractionEventDetails(
  interaction: AgentSessionItemInteractionView,
): boolean {
  return Boolean(
    interaction.prompt?.trim()
    || interaction.detail?.trim()
    || interaction.action?.trim()
    || interaction.resources?.length
    || interaction.questions?.length
    || interaction.answer?.trim()
    || interaction.decision?.trim(),
  );
}

export function buildInteractionEventCopyContent(
  interaction: AgentSessionItemInteractionView,
  t?: ChatMessageTranslate,
): string {
  const lines = [resolveInteractionEventLabel(interaction, t)];
  if (interaction.prompt?.trim()) lines.push(interaction.prompt.trim());
  if (interaction.action?.trim()) {
    lines.push(`${t?.('chat.interactionAction') ?? 'Action'}: ${interaction.action.trim()}`);
  }
  if (interaction.resources?.length) {
    lines.push(`${t?.('chat.interactionResources') ?? 'Resources'}:`);
    lines.push(...interaction.resources.map((resource) => `- ${resource}`));
  }
  for (const question of interaction.questions ?? []) {
    lines.push(question.header ? `${question.header}: ${question.question}` : question.question);
    if (question.answers?.length) {
      lines.push(`${t?.('chat.interactionAnswer') ?? 'Answer'}: ${question.answers.join(', ')}`);
    }
  }
  if (interaction.answer?.trim() && !(interaction.questions ?? []).some((question) => question.answers?.length)) {
    lines.push(`${t?.('chat.interactionAnswer') ?? 'Answer'}: ${interaction.answer.trim()}`);
  }
  if (interaction.decision?.trim()) {
    lines.push(`${t?.('chat.interactionDecision') ?? 'Decision'}: ${interaction.decision.trim()}`);
  }
  if (interaction.detail?.trim()) lines.push(interaction.detail.trim());
  return lines.join('\n');
}
