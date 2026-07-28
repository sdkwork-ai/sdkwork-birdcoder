import type { FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';

type UnknownRecord = Record<string, unknown>;

interface FileChangeCandidate {
  pathHint?: string;
  value: unknown;
}

interface FileChangeProtocolAdapter {
  readonly id: 'claude-agent-sdk' | 'codex-app-server' | 'gemini-cli' | 'opencode' | 'compatibility';
  resolveCandidates(payload: UnknownRecord): readonly FileChangeCandidate[];
}

function readRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function readNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFirstString(record: UnknownRecord, keys: readonly string[]): string {
  for (const key of keys) {
    const value = readNonEmptyString(record[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

function readFirstContent(record: UnknownRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    if (typeof record[key] === 'string') {
      return record[key];
    }
  }
  return undefined;
}

function readFirstFiniteNumber(
  records: readonly (UnknownRecord | null)[],
  keys: readonly string[],
): number | undefined {
  for (const record of records) {
    if (!record) {
      continue;
    }
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.floor(value));
      }
    }
  }
  return undefined;
}

function normalizeProtocolType(value: unknown): string {
  return readNonEmptyString(value)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[.\-\s]+/gu, '_');
}

function toCollectionCandidates(value: unknown): FileChangeCandidate[] {
  if (Array.isArray(value)) {
    return value.map((candidate) => ({ value: candidate }));
  }

  const record = readRecord(value);
  if (!record) {
    return [];
  }
  if (readFirstString(record, ['path', 'file', 'filePath', 'file_path'])) {
    return [{ value: record }];
  }
  return Object.entries(record).map(([pathHint, candidate]) => ({ pathHint, value: candidate }));
}

function resolveFirstCollection(
  records: readonly (UnknownRecord | null)[],
  keys: readonly string[],
): FileChangeCandidate[] {
  for (const record of records) {
    if (!record) {
      continue;
    }
    for (const key of keys) {
      const candidates = toCollectionCandidates(record[key]);
      if (candidates.length > 0) {
        return candidates;
      }
    }
  }
  return [];
}

function resolveCodexCandidates(payload: UnknownRecord): readonly FileChangeCandidate[] {
  const data = readRecord(payload.data);
  const params = readRecord(payload.params);
  const records = [
    readRecord(payload.item),
    readRecord(data?.item),
    readRecord(params?.item),
    payload,
  ];
  for (const record of records) {
    if (!record) {
      continue;
    }
    const type = normalizeProtocolType(record.type);
    if (type !== 'file_change' && type !== 'patch' && type !== 'apply_patch') {
      continue;
    }
    const candidates = toCollectionCandidates(record.changes);
    if (candidates.length > 0) {
      return candidates;
    }
  }
  return [];
}

function resolveGeminiCandidates(payload: UnknownRecord): readonly FileChangeCandidate[] {
  const data = readRecord(payload.data);
  const response = readRecord(payload.response);
  const records = [response, readRecord(data?.response), payload, data];
  for (const record of records) {
    if (!record) {
      continue;
    }
    for (const key of ['resultDisplay', 'returnDisplay'] as const) {
      const candidate = readRecord(record[key]);
      if (candidate && (
        readNonEmptyString(candidate.fileDiff)
        || normalizeProtocolType(candidate.type) === 'diff'
      )) {
        return [{ value: candidate }];
      }
    }
    const displayResult = readRecord(readRecord(record.display)?.result);
    if (displayResult && normalizeProtocolType(displayResult.type) === 'diff') {
      return [{ value: displayResult }];
    }
  }
  return [];
}

function looksLikeClaudeFileResult(record: UnknownRecord): boolean {
  const type = normalizeProtocolType(record.type);
  return Boolean(
    readFirstString(record, ['filePath', 'file_path'])
    && (
      Array.isArray(record.structuredPatch)
      || Array.isArray(record.structured_patch)
      || readRecord(record.gitDiff)
      || readRecord(record.git_diff)
      || Object.hasOwn(record, 'originalFile')
      || Object.hasOwn(record, 'original_file')
      || type === 'create'
      || type === 'update'
    )
  );
}

function resolveClaudeCandidates(payload: UnknownRecord): readonly FileChangeCandidate[] {
  const data = readRecord(payload.data);
  const message = readRecord(payload.message);
  const candidates = [
    readRecord(payload.tool_use_result),
    readRecord(payload.toolUseResult),
    readRecord(data?.tool_use_result),
    readRecord(data?.toolUseResult),
    readRecord(message?.tool_use_result),
    readRecord(message?.toolUseResult),
    payload,
  ];
  for (const candidate of candidates) {
    if (candidate && looksLikeClaudeFileResult(candidate)) {
      return [{ value: candidate }];
    }
  }

  const hookEvent = normalizeProtocolType(payload.hook_event_name);
  if (hookEvent === 'file_changed' && readNonEmptyString(payload.file_path)) {
    return [{ value: payload }];
  }
  return [];
}

function resolveOpenCodeCandidates(payload: UnknownRecord): readonly FileChangeCandidate[] {
  const data = readRecord(payload.data);
  const message = readRecord(payload.message) ?? readRecord(data?.message);
  const summary = readRecord(message?.summary)
    ?? readRecord(payload.summary)
    ?? readRecord(data?.summary);
  return resolveFirstCollection([summary], ['diffs', 'fileChanges', 'file_changes']);
}

function resolveCompatibilityCandidates(payload: UnknownRecord): readonly FileChangeCandidate[] {
  const data = readRecord(payload.data);
  const message = readRecord(payload.message) ?? readRecord(data?.message);
  const summary = readRecord(payload.summary)
    ?? readRecord(data?.summary)
    ?? readRecord(message?.summary);
  return resolveFirstCollection(
    [payload, data, summary],
    ['fileChanges', 'file_changes', 'diffs', 'changes'],
  );
}

// Exact provider protocols take precedence; the final adapter retains older persisted payloads.
const FILE_CHANGE_PROTOCOL_ADAPTERS: readonly FileChangeProtocolAdapter[] = [
  { id: 'codex-app-server', resolveCandidates: resolveCodexCandidates },
  { id: 'gemini-cli', resolveCandidates: resolveGeminiCandidates },
  { id: 'claude-agent-sdk', resolveCandidates: resolveClaudeCandidates },
  { id: 'opencode', resolveCandidates: resolveOpenCodeCandidates },
  { id: 'compatibility', resolveCandidates: resolveCompatibilityCandidates },
];

const NORMALIZED_UPDATE_STATUS: Readonly<Record<string, string>> = {
  add: 'A',
  added: 'A',
  create: 'A',
  created: 'A',
  delete: 'D',
  deleted: 'D',
  unlink: 'D',
  modify: 'M',
  modified: 'M',
  update: 'M',
  updated: 'M',
  change: 'M',
  move: 'R',
  moved: 'R',
  rename: 'R',
  renamed: 'R',
};

function resolveUpdateStatus(record: UnknownRecord, gitDiff: UnknownRecord | null): string {
  const kind = readRecord(record.kind);
  const movePath = readFirstString(kind ?? {}, ['movePath', 'move_path'])
    || readFirstString(record, ['movePath', 'move_path']);
  const kindType = normalizeProtocolType(kind?.type ?? record.kind);
  if (kindType === 'update' && movePath) {
    return 'R';
  }

  const rawStatus = readFirstString(record, ['updateStatus', 'update_status', 'status'])
    || readFirstString(gitDiff ?? {}, ['status'])
    || kindType
    || normalizeProtocolType(record.event)
    || normalizeProtocolType(record.type);
  if (record.isNewFile === true || record.is_new_file === true || record.originalFile === null) {
    return 'A';
  }
  const normalizedStatus = NORMALIZED_UPDATE_STATUS[normalizeProtocolType(rawStatus)] ?? rawStatus;
  if (normalizedStatus) {
    return normalizedStatus;
  }
  const hasBeforeAfter = (
    readFirstContent(record, ['originalContent', 'original_content', 'beforeText', 'before'])
    !== undefined
    && readFirstContent(record, ['newContent', 'new_content', 'afterText', 'after']) !== undefined
  );
  return hasBeforeAfter || record.isNewFile === false || record.is_new_file === false ? 'M' : '';
}

function buildStructuredPatch(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const hunks = value.flatMap((candidate) => {
    const hunk = readRecord(candidate);
    if (!hunk || !Array.isArray(hunk.lines)) {
      return [];
    }
    const lines = hunk.lines.filter((line): line is string => typeof line === 'string');
    const oldStart = readFirstFiniteNumber([hunk], ['oldStart', 'old_start']) ?? 0;
    const oldLines = readFirstFiniteNumber([hunk], ['oldLines', 'old_lines']) ?? 0;
    const newStart = readFirstFiniteNumber([hunk], ['newStart', 'new_start']) ?? 0;
    const newLines = readFirstFiniteNumber([hunk], ['newLines', 'new_lines']) ?? 0;
    return [`@@ -${oldStart},${oldLines} +${newStart},${newLines} @@\n${lines.join('\n')}`];
  });
  return hunks.length > 0 ? hunks.join('\n') : undefined;
}

function countUnifiedDiffLineImpact(diff: string): { additions: number; deletions: number } | null {
  const normalized = diff.replace(/\r\n?/gu, '\n');
  if (!normalized.includes('@@') && !normalized.includes('diff --git')) {
    return null;
  }
  let additions = 0;
  let deletions = 0;
  for (const line of normalized.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

function countContentLines(content: string): number {
  if (!content) {
    return 0;
  }
  const normalized = content.replace(/\r\n?/gu, '\n');
  const lineCount = normalized.split('\n').length;
  return normalized.endsWith('\n') ? lineCount - 1 : lineCount;
}

function applyClaudeEditResult(record: UnknownRecord, originalContent: string): string | undefined {
  const oldString = readFirstContent(record, ['oldString', 'old_string']);
  const newString = readFirstContent(record, ['newString', 'new_string']);
  if (oldString === undefined || newString === undefined || !oldString) {
    return undefined;
  }
  if (record.replaceAll === true || record.replace_all === true) {
    return originalContent.split(oldString).join(newString);
  }
  const replacementIndex = originalContent.indexOf(oldString);
  if (replacementIndex < 0) {
    return undefined;
  }
  return `${originalContent.slice(0, replacementIndex)}${newString}${originalContent.slice(
    replacementIndex + oldString.length,
  )}`;
}

function normalizeFileChange(candidate: FileChangeCandidate): FileChange | null {
  const record = readRecord(candidate.value);
  if (!record) {
    return null;
  }

  const gitDiff = readRecord(record.gitDiff) ?? readRecord(record.git_diff);
  const diffStat = readRecord(record.diffStat) ?? readRecord(record.diff_stat);
  const kind = readRecord(record.kind);
  const movePath = readFirstString(kind ?? {}, ['movePath', 'move_path'])
    || readFirstString(record, ['movePath', 'move_path']);
  const path = movePath
    || readFirstString(record, ['path', 'file', 'filePath', 'file_path'])
    || readFirstString(gitDiff ?? {}, ['filename', 'fileName', 'file_path'])
    || candidate.pathHint?.trim()
    || '';
  if (!path) {
    return null;
  }

  const updateStatus = resolveUpdateStatus(record, gitDiff);
  const structuredPatch = buildStructuredPatch(record.structuredPatch ?? record.structured_patch);
  let diff = readFirstContent(gitDiff ?? {}, ['patch', 'diff'])
    ?? readFirstContent(record, ['diff', 'patch', 'fileDiff', 'unifiedDiff', 'unified_diff'])
    ?? structuredPatch;
  let content = readFirstContent(record, [
    'content',
    'after',
    'afterText',
    'afterContent',
    'after_content',
    'newContent',
    'new_content',
  ]);
  let originalContent = readFirstContent(record, [
    'originalContent',
    'original_content',
    'originalFile',
    'original_file',
    'before',
    'beforeText',
    'beforeContent',
    'before_content',
    'oldContent',
    'old_content',
  ]);

  if (content === undefined && originalContent !== undefined) {
    content = applyClaudeEditResult(record, originalContent);
  }
  const isCodexContentPayload = kind !== null
    && (updateStatus === 'A' || updateStatus === 'D')
    && diff !== undefined
    && countUnifiedDiffLineImpact(diff) === null;
  if (isCodexContentPayload && updateStatus === 'A' && content === undefined) {
    content = diff;
    originalContent = '';
    diff = undefined;
  } else if (isCodexContentPayload && updateStatus === 'D' && originalContent === undefined) {
    originalContent = diff;
    content = '';
    diff = undefined;
  }
  if (updateStatus === 'D' && originalContent === undefined && content !== undefined) {
    originalContent = content;
    content = '';
  }
  if (updateStatus === 'A' && originalContent === undefined) {
    originalContent = '';
  }

  const explicitAdditions = readFirstFiniteNumber(
    [record, gitDiff, diffStat],
    ['additions', 'linesAdded', 'lines_added', 'model_added_lines'],
  );
  const explicitDeletions = readFirstFiniteNumber(
    [record, gitDiff, diffStat],
    ['deletions', 'linesDeleted', 'lines_deleted', 'model_removed_lines'],
  );
  const explicitLineImpact = explicitAdditions !== undefined && explicitDeletions !== undefined
    ? { additions: explicitAdditions, deletions: explicitDeletions }
    : null;
  const diffLineImpact = diff ? countUnifiedDiffLineImpact(diff) : null;
  const contentLineImpact = updateStatus === 'A' && originalContent === '' && content !== undefined
    ? { additions: countContentLines(content), deletions: 0 }
    : updateStatus === 'D' && content === '' && originalContent !== undefined
      ? { additions: 0, deletions: countContentLines(originalContent) }
      : null;
  const lineImpact = explicitLineImpact ?? diffLineImpact ?? contentLineImpact;
  const lineImpactKnown = record.lineImpactKnown ?? record.line_impact_known;

  return {
    path,
    additions: lineImpact?.additions ?? 0,
    deletions: lineImpact?.deletions ?? 0,
    lineImpactKnown: typeof lineImpactKnown === 'boolean'
      ? lineImpactKnown
      : lineImpact !== null,
    ...(updateStatus ? { updateStatus } : {}),
    ...(diff !== undefined ? { diff } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(originalContent !== undefined ? { originalContent } : {}),
  };
}

export function resolveAgentSessionFileChanges(value: unknown): FileChange[] | undefined {
  const payload = readRecord(value);
  if (!payload) {
    return undefined;
  }

  for (const adapter of FILE_CHANGE_PROTOCOL_ADAPTERS) {
    const candidates = adapter.resolveCandidates(payload);
    if (candidates.length === 0) {
      continue;
    }
    const fileChanges = candidates.flatMap((candidate) => {
      const fileChange = normalizeFileChange(candidate);
      return fileChange ? [fileChange] : [];
    });
    if (fileChanges.length > 0) {
      return fileChanges;
    }
  }
  return undefined;
}
