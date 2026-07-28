import {
  MAX_AGENT_SESSION_FILE_CHANGES,
  MAX_FILE_CHANGE_PATH_CHARACTERS,
  MAX_FILE_CHANGE_TEXT_CHARACTERS,
  MAX_FILE_CHANGE_TOTAL_TEXT_CHARACTERS,
  type FileChange,
} from '@sdkwork/birdcoder-pc-contracts-commons';

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
  if (typeof value !== 'string' || value.length > MAX_FILE_CHANGE_PATH_CHARACTERS) {
    return '';
  }
  return value.trim();
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
    return value
      .slice(0, MAX_AGENT_SESSION_FILE_CHANGES)
      .map((candidate) => ({ value: candidate }));
  }

  const record = readRecord(value);
  if (!record) {
    return [];
  }
  if (readFirstString(record, ['path', 'file', 'filePath', 'file_path'])) {
    return [{ value: record }];
  }
  const candidates: FileChangeCandidate[] = [];
  for (const pathHint in record) {
    if (!Object.hasOwn(record, pathHint)) {
      continue;
    }
    candidates.push({ pathHint, value: record[pathHint] });
    if (candidates.length >= MAX_AGENT_SESSION_FILE_CHANGES) {
      break;
    }
  }
  return candidates;
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
        (typeof candidate.fileDiff === 'string' && candidate.fileDiff.length > 0)
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
  const parts: string[] = [];
  let characterCount = 0;
  let lineCount = 0;
  const maxHunks = Math.min(value.length, MAX_AGENT_SESSION_FILE_CHANGES * 2);
  for (let index = 0; index < maxHunks; index += 1) {
    const hunk = readRecord(value[index]);
    if (!hunk || !Array.isArray(hunk.lines)) {
      continue;
    }
    const oldStart = readFirstFiniteNumber([hunk], ['oldStart', 'old_start']) ?? 0;
    const oldLines = readFirstFiniteNumber([hunk], ['oldLines', 'old_lines']) ?? 0;
    const newStart = readFirstFiniteNumber([hunk], ['newStart', 'new_start']) ?? 0;
    const newLines = readFirstFiniteNumber([hunk], ['newLines', 'new_lines']) ?? 0;
    const header = `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`;
    const separatorLength = parts.length > 0 ? 1 : 0;
    if (characterCount + separatorLength + header.length > MAX_FILE_CHANGE_TEXT_CHARACTERS) {
      return undefined;
    }
    if (separatorLength > 0) {
      parts.push('\n');
      characterCount += 1;
    }
    parts.push(header);
    characterCount += header.length;

    for (const line of hunk.lines) {
      if (typeof line !== 'string') {
        continue;
      }
      lineCount += 1;
      if (
        lineCount > 100_000
        || characterCount + line.length + 1 > MAX_FILE_CHANGE_TEXT_CHARACTERS
      ) {
        return undefined;
      }
      parts.push('\n', line);
      characterCount += line.length + 1;
    }
  }
  return parts.length > 0 ? parts.join('') : undefined;
}

function countUnifiedDiffLineImpact(diff: string): { additions: number; deletions: number } | null {
  if (!diff.includes('@@') && !diff.includes('diff --git')) {
    return null;
  }
  let additions = 0;
  let deletions = 0;
  let lineStart = 0;
  while (lineStart < diff.length) {
    const firstCharacter = diff.charCodeAt(lineStart);
    const secondCharacter = diff.charCodeAt(lineStart + 1);
    const thirdCharacter = diff.charCodeAt(lineStart + 2);
    if (firstCharacter === 43 && !(secondCharacter === 43 && thirdCharacter === 43)) {
      additions += 1;
    } else if (firstCharacter === 45 && !(secondCharacter === 45 && thirdCharacter === 45)) {
      deletions += 1;
    }
    const lineFeedIndex = diff.indexOf('\n', lineStart);
    if (lineFeedIndex < 0) {
      break;
    }
    lineStart = lineFeedIndex + 1;
  }
  return { additions, deletions };
}

function countContentLines(content: string): number {
  if (!content) {
    return 0;
  }
  let lineCount = 1;
  for (let index = 0; index < content.length; index += 1) {
    const character = content.charCodeAt(index);
    if (character === 13) {
      lineCount += 1;
      if (content.charCodeAt(index + 1) === 10) {
        index += 1;
      }
    } else if (character === 10) {
      lineCount += 1;
    }
  }
  const finalCharacter = content.charCodeAt(content.length - 1);
  return finalCharacter === 10 || finalCharacter === 13 ? lineCount - 1 : lineCount;
}

function retainBoundedFileChangeContent(value: string | undefined): string | undefined {
  return value !== undefined && value.length <= MAX_FILE_CHANGE_TEXT_CHARACTERS
    ? value
    : undefined;
}

function applyClaudeEditResult(record: UnknownRecord, originalContent: string): string | undefined {
  const oldString = retainBoundedFileChangeContent(
    readFirstContent(record, ['oldString', 'old_string']),
  );
  const newString = retainBoundedFileChangeContent(
    readFirstContent(record, ['newString', 'new_string']),
  );
  if (oldString === undefined || newString === undefined || !oldString) {
    return undefined;
  }
  if (record.replaceAll === true || record.replace_all === true) {
    let occurrenceCount = 0;
    let searchIndex = 0;
    while (searchIndex <= originalContent.length - oldString.length) {
      const occurrenceIndex = originalContent.indexOf(oldString, searchIndex);
      if (occurrenceIndex < 0) {
        break;
      }
      occurrenceCount += 1;
      if (occurrenceCount > 10_000) {
        return undefined;
      }
      searchIndex = occurrenceIndex + oldString.length;
    }
    const resultLength = originalContent.length
      + occurrenceCount * (newString.length - oldString.length);
    if (!Number.isSafeInteger(resultLength) || resultLength > MAX_FILE_CHANGE_TEXT_CHARACTERS) {
      return undefined;
    }
    return originalContent.split(oldString).join(newString);
  }
  const replacementIndex = originalContent.indexOf(oldString);
  if (replacementIndex < 0) {
    return undefined;
  }
  const resultLength = originalContent.length - oldString.length + newString.length;
  if (resultLength > MAX_FILE_CHANGE_TEXT_CHARACTERS) {
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
    || readNonEmptyString(candidate.pathHint)
    || '';
  if (!path) {
    return null;
  }

  const updateStatus = resolveUpdateStatus(record, gitDiff);
  const structuredPatch = buildStructuredPatch(record.structuredPatch ?? record.structured_patch);
  const rawDiff = readFirstContent(gitDiff ?? {}, ['patch', 'diff'])
    ?? readFirstContent(record, ['diff', 'patch', 'fileDiff', 'unifiedDiff', 'unified_diff']);
  const rawContent = readFirstContent(record, [
    'content',
    'after',
    'afterText',
    'afterContent',
    'after_content',
    'newContent',
    'new_content',
  ]);
  const rawOriginalContent = readFirstContent(record, [
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
  const hasOversizedPayload = [rawDiff, rawContent, rawOriginalContent].some(
    (value) => value !== undefined && value.length > MAX_FILE_CHANGE_TEXT_CHARACTERS,
  );
  let diff = retainBoundedFileChangeContent(rawDiff) ?? structuredPatch;
  let content = retainBoundedFileChangeContent(rawContent);
  let originalContent = retainBoundedFileChangeContent(rawOriginalContent);

  if (!hasOversizedPayload && content === undefined && originalContent !== undefined) {
    content = applyClaudeEditResult(record, originalContent);
  }
  const isCodexContentPayload = kind !== null
    && (updateStatus === 'A' || updateStatus === 'D')
    && diff !== undefined
    && countUnifiedDiffLineImpact(diff) === null;
  if (!hasOversizedPayload && isCodexContentPayload && updateStatus === 'A' && content === undefined) {
    content = diff;
    originalContent = '';
    diff = undefined;
  } else if (!hasOversizedPayload && isCodexContentPayload && updateStatus === 'D' && originalContent === undefined) {
    originalContent = diff;
    content = '';
    diff = undefined;
  }
  if (!hasOversizedPayload && updateStatus === 'D' && originalContent === undefined && content !== undefined) {
    originalContent = content;
    content = '';
  }
  if (!hasOversizedPayload && updateStatus === 'A' && originalContent === undefined) {
    originalContent = '';
  }
  if (hasOversizedPayload) {
    diff = undefined;
    content = undefined;
    originalContent = undefined;
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
  const retainedLineImpact = hasOversizedPayload ? null : lineImpact;
  const lineImpactKnown = hasOversizedPayload
    ? false
    : record.lineImpactKnown ?? record.line_impact_known;

  return {
    path,
    additions: retainedLineImpact?.additions ?? 0,
    deletions: retainedLineImpact?.deletions ?? 0,
    lineImpactKnown: typeof lineImpactKnown === 'boolean'
      ? lineImpactKnown
      : retainedLineImpact !== null,
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
    const fileChanges: FileChange[] = [];
    let retainedTextCharacters = 0;
    for (const candidate of candidates.slice(0, MAX_AGENT_SESSION_FILE_CHANGES)) {
      const fileChange = normalizeFileChange(candidate);
      if (!fileChange) {
        continue;
      }
      const fileChangeTextCharacters = (
        (fileChange.diff?.length ?? 0)
        + (fileChange.content?.length ?? 0)
        + (fileChange.originalContent?.length ?? 0)
      );
      if (
        fileChangeTextCharacters > 0
        && retainedTextCharacters + fileChangeTextCharacters
          > MAX_FILE_CHANGE_TOTAL_TEXT_CHARACTERS
      ) {
        fileChanges.push({
          path: fileChange.path,
          additions: 0,
          deletions: 0,
          lineImpactKnown: false,
          ...(fileChange.updateStatus ? { updateStatus: fileChange.updateStatus } : {}),
        });
        continue;
      }
      retainedTextCharacters += fileChangeTextCharacters;
      fileChanges.push(fileChange);
    }
    if (fileChanges.length > 0) {
      return fileChanges;
    }
  }
  return undefined;
}
