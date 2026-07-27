import type {
  AgentSessionItemInteractionOptionView,
  AgentSessionItemInteractionQuestionView,
  AgentSessionItemInteractionStatus,
  AgentSessionItemInteractionView,
  AgentSessionItemToolCallKind,
  AgentSessionItemToolCallStatus,
} from './agent-session-view.ts';

export type {
  AgentSessionItemInteractionOptionView,
  AgentSessionItemInteractionQuestionView,
  AgentSessionItemInteractionStatus,
  AgentSessionItemInteractionView,
} from './agent-session-view.ts';

interface NormalizeAgentSessionItemInteractionInput {
  argumentsValue?: unknown;
  id: string;
  kind: AgentSessionItemToolCallKind;
  name: string;
  output?: string;
  record: Record<string, unknown>;
  status?: AgentSessionItemToolCallStatus;
  title?: string;
}

const INTERACTION_RECORD_KEYS = [
  'arguments', 'args', 'details', 'event', 'input', 'interaction', 'item',
  'metadata', 'output', 'part', 'request', 'response', 'result', 'state',
  'toolResult', 'tool_result', 'value',
] as const;
const MAX_INTERACTION_RECORD_DEPTH = 5;
const MAX_INTERACTION_TEXT_CHARACTERS = 16_000;

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_INTERACTION_TEXT_CHARACTERS);
}

function parseStructuredString(value: unknown): unknown {
  const text = readString(value);
  if (!text || !/^[\[{]/u.test(text)) return value;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return value;
  }
}

function collectInteractionRecords(values: readonly unknown[]): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const visited = new WeakSet<object>();
  const queue = values.map((value) => ({ depth: 0, value: parseStructuredString(value) }));
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth > MAX_INTERACTION_RECORD_DEPTH) continue;
    const record = readRecord(current.value);
    if (!record || visited.has(record)) continue;
    visited.add(record);
    records.push(record);
    for (const key of INTERACTION_RECORD_KEYS) {
      const nested = parseStructuredString(record[key]);
      if (readRecord(nested)) {
        queue.push({ depth: current.depth + 1, value: nested });
      }
    }
  }
  return records;
}

function readFirstString(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): string {
  for (const record of records) {
    for (const key of keys) {
      const value = readString(record[key]);
      if (value) return value;
    }
  }
  return '';
}

function readFirstBoolean(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): boolean | undefined {
  for (const record of records) {
    for (const key of keys) {
      if (typeof record[key] === 'boolean') return record[key];
    }
  }
  return undefined;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[.\s-]+/gu, '_');
}

function deduplicateStrings(values: readonly string[]): string[] {
  const normalizedValues = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || normalizedValues.has(normalized)) continue;
    normalizedValues.add(normalized);
    result.push(normalized);
  }
  return result;
}

function readStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    const parsed = parseStructuredString(value);
    if (parsed !== value) return readStringList(parsed);
    return value.trim() ? [value.trim()] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const direct = readString(entry);
    if (direct) return [direct];
    const record = readRecord(entry);
    if (!record) return [];
    const label = readString(record.label)
      || readString(record.value)
      || readString(record.resource)
      || readString(record.pattern)
      || readString(record.path);
    return label ? [label] : [];
  });
}

function readInteractionResources(records: readonly Record<string, unknown>[]): string[] {
  const resources = records.flatMap((record) => [
    ...readStringList(record.resources),
    ...readStringList(record.patterns),
    ...readStringList(record.save),
  ]);
  if (resources.length === 0) {
    const fallback = readFirstString(records, [
      'command', 'filePath', 'file_path', 'path', 'resource', 'target', 'url',
    ]);
    if (fallback) resources.push(fallback);
  }
  return deduplicateStrings(resources).slice(0, 100);
}

function normalizeInteractionOption(value: unknown): AgentSessionItemInteractionOptionView | null {
  const direct = readString(value);
  if (direct) return { label: direct };
  const record = readRecord(value);
  if (!record) return null;
  const label = readString(record.label)
    || readString(record.name)
    || readString(record.title)
    || readString(record.value);
  if (!label) return null;
  const optionValue = readString(record.value);
  const description = readString(record.description) || readString(record.detail);
  return {
    label,
    ...(optionValue && optionValue !== label ? { value: optionValue } : {}),
    ...(description ? { description } : {}),
  };
}

function readAnswerGroups(records: readonly Record<string, unknown>[]): string[][] {
  for (const record of records) {
    const answers = parseStructuredString(record.answers);
    if (!Array.isArray(answers)) continue;
    if (answers.some(Array.isArray)) {
      return answers.map((answer) => deduplicateStrings(readStringList(answer)));
    }
    const values = deduplicateStrings(readStringList(answers));
    return values.length > 0 ? [values] : [];
  }
  const answer = readFirstString(records, [
    'answer', 'answerText', 'answer_text', 'selectedOption', 'selected_option',
  ]);
  return answer ? [[answer]] : [];
}

function normalizeInteractionQuestion(
  value: unknown,
  answers: readonly string[] | undefined,
  index: number,
): AgentSessionItemInteractionQuestionView | null {
  const direct = readString(value);
  if (direct) {
    return {
      id: `question-${index + 1}`,
      question: direct,
      ...(answers?.length ? { answers } : {}),
    };
  }
  const record = readRecord(value);
  if (!record) return null;
  const question = readString(record.question)
    || readString(record.prompt)
    || readString(record.text)
    || readString(record.title);
  if (!question) return null;
  const options = Array.isArray(record.options)
    ? record.options.flatMap((option) => {
        const normalized = normalizeInteractionOption(option);
        return normalized ? [normalized] : [];
      })
    : [];
  const id = readString(record.id) || readString(record.questionId) || readString(record.question_id);
  const header = readString(record.header) || readString(record.label);
  return {
    ...(id ? { id } : { id: `question-${index + 1}` }),
    ...(header ? { header } : {}),
    question,
    ...(options.length > 0 ? { options } : {}),
    ...(typeof record.multiple === 'boolean' ? { multiple: record.multiple } : {}),
    ...(typeof record.custom === 'boolean' ? { allowCustomAnswer: record.custom } : {}),
    ...(answers?.length ? { answers } : {}),
  };
}

function readInteractionQuestions(
  records: readonly Record<string, unknown>[],
): AgentSessionItemInteractionQuestionView[] {
  const answerGroups = readAnswerGroups(records);
  for (const record of records) {
    if (!Array.isArray(record.questions)) continue;
    const questions = record.questions.flatMap((question, index) => {
      const normalized = normalizeInteractionQuestion(question, answerGroups[index], index);
      return normalized ? [normalized] : [];
    });
    if (questions.length > 0) return questions.slice(0, 20);
  }
  const prompt = readFirstString(records, ['question', 'prompt']);
  if (!prompt) return [];
  const question = normalizeInteractionQuestion(prompt, answerGroups[0], 0);
  return question ? [question] : [];
}

function resolveInteractionStatus(
  kind: 'approval' | 'question',
  toolStatus: AgentSessionItemToolCallStatus | undefined,
  decision: string,
  questions: readonly AgentSessionItemInteractionQuestionView[],
): AgentSessionItemInteractionStatus {
  const normalizedDecision = normalizeToken(decision);
  if (kind === 'approval') {
    if (['always', 'allow', 'allowed', 'approve', 'approved', 'once'].includes(normalizedDecision)) {
      return 'approved';
    }
    if (['blocked', 'deny', 'denied', 'decline', 'declined', 'reject', 'rejected'].includes(normalizedDecision)) {
      return 'denied';
    }
  } else {
    if (['deny', 'denied', 'dismissed', 'reject', 'rejected'].includes(normalizedDecision)) {
      return 'rejected';
    }
    if (questions.some((question) => (question.answers?.length ?? 0) > 0) || normalizedDecision === 'answered') {
      return 'answered';
    }
  }
  if (toolStatus === 'error') return 'failed';
  if (toolStatus === 'cancelled') return kind === 'approval' ? 'denied' : 'cancelled';
  if (toolStatus === 'success') return 'completed';
  return 'pending';
}

export function normalizeAgentSessionItemInteraction(
  input: NormalizeAgentSessionItemInteractionInput,
): AgentSessionItemInteractionView | null {
  if (input.kind !== 'approval' && input.kind !== 'question') return null;
  const records = collectInteractionRecords([
    input.record,
    input.argumentsValue,
    input.output,
  ]);
  const questions = input.kind === 'question' ? readInteractionQuestions(records) : [];
  const answerGroups = readAnswerGroups(records);
  const decision = readFirstString(records, [
    'reply', 'decision', 'approvalDecision', 'approval_decision', 'resolution',
  ]);
  const status = resolveInteractionStatus(input.kind, input.status, decision, questions);
  const prompt = input.kind === 'question'
    ? readFirstString(records, ['prompt', 'question', 'message'])
    : readFirstString(records, ['prompt', 'message', 'description', 'reason']);
  const detail = readFirstString(records, [
    'decisionReason', 'decision_reason', 'detail', 'error', 'reason', 'resultSummary',
    'result_summary',
  ]);
  const action = input.kind === 'approval'
    ? readFirstString(records, ['action', 'permission', 'tool', 'toolName', 'tool_name'])
      || input.name
    : '';
  const resources = input.kind === 'approval' ? readInteractionResources(records) : [];
  const answer = answerGroups.flat().join(', ');
  const title = input.title?.trim()
    || (input.kind === 'question' ? questions[0]?.header : '')
    || '';
  return {
    id: input.id,
    kind: input.kind,
    status,
    ...(title ? { title } : {}),
    ...(prompt && !questions.some((question) => question.question === prompt) ? { prompt } : {}),
    ...(detail && detail !== prompt ? { detail } : {}),
    ...(action ? { action } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    ...(questions.length > 0 ? { questions } : {}),
    ...(answer ? { answer } : {}),
    ...(decision ? { decision } : {}),
    ...(status === 'pending' || readFirstBoolean(records, ['requiresResponse', 'requires_response']) === true
      ? { requiresResponse: true }
      : {}),
  };
}

function resolveMergedInteractionStatus(
  previous: AgentSessionItemInteractionStatus,
  incoming: AgentSessionItemInteractionStatus,
): AgentSessionItemInteractionStatus {
  if (incoming === 'pending' && previous !== 'pending') return previous;
  if (incoming === 'completed' && !['pending', 'completed'].includes(previous)) {
    return previous;
  }
  return incoming;
}

export function mergeAgentSessionItemInteraction(
  previous: AgentSessionItemInteractionView | undefined,
  incoming: AgentSessionItemInteractionView,
): AgentSessionItemInteractionView {
  if (!previous) return incoming;
  const questionCount = Math.max(
    previous.questions?.length ?? 0,
    incoming.questions?.length ?? 0,
  );
  const questions = questionCount > 0
    ? Array.from({ length: questionCount }, (_, index) => {
        const previousQuestion = previous.questions?.[index];
        const incomingQuestion = incoming.questions?.[index];
        if (!previousQuestion) return incomingQuestion!;
        if (!incomingQuestion) return previousQuestion;
        return {
          ...previousQuestion,
          ...incomingQuestion,
          options: incomingQuestion.options?.length
            ? incomingQuestion.options
            : previousQuestion.options,
          answers: incomingQuestion.answers?.length
            ? incomingQuestion.answers
            : previousQuestion.answers,
        };
      })
    : undefined;
  const resources = deduplicateStrings([
    ...(previous.resources ?? []),
    ...(incoming.resources ?? []),
  ]);
  const status = resolveMergedInteractionStatus(previous.status, incoming.status);
  return {
    ...previous,
    ...incoming,
    status,
    ...(questions?.length ? { questions } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    requiresResponse: status === 'pending',
  };
}
