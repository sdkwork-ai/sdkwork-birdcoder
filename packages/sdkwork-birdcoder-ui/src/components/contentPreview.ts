import { parseStructuredDataPreviewValue } from './contentPreviewStructuredData.ts';

export const CONTENT_WORKBENCH_MODES = ['edit', 'preview', 'split'] as const;

export type ContentWorkbenchMode = (typeof CONTENT_WORKBENCH_MODES)[number];

export const CONTENT_PREVIEW_KINDS = ['html', 'markdown', 'svg', 'text'] as const;
export const CONTENT_PREVIEW_SANDBOX_POLICIES = ['locked', 'balanced', 'trusted'] as const;

export type ResolvedContentPreviewKind = (typeof CONTENT_PREVIEW_KINDS)[number];
export type ContentPreviewKind = ResolvedContentPreviewKind | 'auto';
export type ContentPreviewSandboxPolicy =
  (typeof CONTENT_PREVIEW_SANDBOX_POLICIES)[number];

export interface ResolveContentPreviewKindOptions {
  kind?: ContentPreviewKind;
  language?: string | null;
  path?: string | null;
  value?: string | null;
}

export interface BuildContentPreviewDocumentOptions {
  baseUrl?: string;
  title?: string;
}

export interface ParsedStructuredDataPreviewValue {
  format: 'json' | 'jsonc' | 'toml' | 'yaml';
  value: unknown;
}

export interface ParsedKeyValuePreviewEntry {
  key: string;
  lineNumber: number;
  section: string | null;
  value: string;
}

export interface ParsedKeyValuePreviewValue {
  entries: ParsedKeyValuePreviewEntry[];
  format: 'dotenv' | 'ini' | 'properties';
  hasSections: boolean;
  sectionOrder: string[];
}

export interface ParsedTabularDataPreviewValue {
  columnCount: number;
  delimiter: ',' | '\t';
  hasHeaderRow: boolean;
  rows: string[][];
}

export const CONTENT_PREVIEW_PRESENTATIONS = [
  'html',
  'markdown',
  'svg',
  'structured-data',
  'key-value',
  'table',
  'code',
  'text',
] as const;

export type ContentPreviewPresentation = (typeof CONTENT_PREVIEW_PRESENTATIONS)[number];

export interface ResolvedContentPreviewDescriptor {
  codeLanguage: string;
  displayLabel: string;
  keyValueData: ParsedKeyValuePreviewValue | null;
  kind: ResolvedContentPreviewKind;
  language: string | null;
  path: string | null;
  presentation: ContentPreviewPresentation;
  shouldDefaultToSplit: boolean;
  sourceValue: string;
  structuredData: ParsedStructuredDataPreviewValue | null;
  tabularData: ParsedTabularDataPreviewValue | null;
}

const CSV_EXTENSIONS = new Set(['csv']);
const HTML_EXTENSIONS = new Set(['htm', 'html', 'xhtml']);
const INI_EXTENSIONS = new Set(['cfg', 'cnf', 'conf', 'ini']);
const JSON_EXTENSIONS = new Set(['json', 'jsonc']);
const MARKDOWN_EXTENSIONS = new Set(['markdown', 'md', 'mdown', 'mkd']);
const PROPERTIES_EXTENSIONS = new Set(['properties']);
const SVG_EXTENSIONS = new Set(['svg']);
const TOML_EXTENSIONS = new Set(['toml']);
const TSV_EXTENSIONS = new Set(['tsv']);
const TEXT_EXTENSIONS = new Set(['log', 'text', 'txt']);
const YAML_EXTENSIONS = new Set(['yaml', 'yml']);

const CSV_LANGUAGES = new Set(['csv']);
const HTML_LANGUAGES = new Set(['html', 'htm', 'xhtml', 'handlebars', 'vue']);
const DOTENV_LANGUAGES = new Set(['dotenv', 'env']);
const INI_LANGUAGES = new Set(['cfg', 'conf', 'ini']);
const JSON_LANGUAGES = new Set(['json', 'jsonc']);
const MARKDOWN_LANGUAGES = new Set(['markdown', 'md', 'mdx']);
const PROPERTIES_LANGUAGES = new Set(['java-properties', 'properties']);
const SVG_LANGUAGES = new Set(['svg']);
const TEXT_LANGUAGES = new Set(['plaintext', 'plain text', 'text']);
const TOML_LANGUAGES = new Set(['toml']);
const TSV_LANGUAGES = new Set(['tsv']);
const YAML_LANGUAGES = new Set(['yaml', 'yml']);

const INI_FILE_NAMES = new Set(['.editorconfig', '.gitconfig']);
const PROPERTIES_FILE_NAMES = new Set(['.npmrc']);

const CONTENT_PREVIEW_MAX_EMBEDDED_DOCUMENT_LENGTH = 500_000;
const CONTENT_PREVIEW_MAX_MARKDOWN_LENGTH = 300_000;
const CONTENT_PREVIEW_MAX_KEY_VALUE_LENGTH = 200_000;
const CONTENT_PREVIEW_MAX_KEY_VALUE_LINES = 4_000;
const CONTENT_PREVIEW_MAX_TABLE_LENGTH = 200_000;
const CONTENT_PREVIEW_MAX_TABLE_LINES = 2_000;

function normalizeValue(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hasLineCountAtMost(sourceValue: string, maxLines: number): boolean {
  let lineCount = 1;

  for (let index = 0; index < sourceValue.length; index += 1) {
    if (sourceValue.charCodeAt(index) !== 10) {
      continue;
    }

    lineCount += 1;
    if (lineCount > maxLines) {
      return false;
    }
  }

  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function readPathExtension(path: string | null | undefined): string {
  if (typeof path !== 'string') {
    return '';
  }

  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return '';
  }

  const fileName = normalizedPath.split(/[\\/]/u).at(-1) ?? normalizedPath;
  const extension = fileName.split('.').at(-1);
  return extension && extension !== fileName ? extension.toLowerCase() : '';
}

function readPathFileName(path: string | null | undefined): string {
  if (typeof path !== 'string') {
    return '';
  }

  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.split(/[\\/]/u).at(-1)?.toLowerCase() ?? '';
}

function looksLikeHtmlDocument(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return (
    normalizedValue.startsWith('<!doctype html') ||
    normalizedValue.startsWith('<html') ||
    normalizedValue.startsWith('<body') ||
    normalizedValue.startsWith('<head') ||
    /<([a-z][\w-]*)(?:\s[^>]*)?>/u.test(normalizedValue)
  );
}

function looksLikeSvgDocument(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  return value.trim().toLowerCase().startsWith('<svg');
}

function looksLikeMarkdownDocument(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return false;
  }

  return (
    /^#{1,6}\s+/mu.test(normalizedValue) ||
    /```[\s\S]*```/u.test(normalizedValue) ||
    /^\s*[-*+]\s+/mu.test(normalizedValue) ||
    /^\s*\d+\.\s+/mu.test(normalizedValue) ||
    /\[[^\]]+\]\([^)]+\)/u.test(normalizedValue)
  );
}

function looksLikeJsonDocument(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return false;
  }

  return (
    (normalizedValue.startsWith('{') && normalizedValue.endsWith('}')) ||
    (normalizedValue.startsWith('[') && normalizedValue.endsWith(']'))
  );
}

function looksLikeYamlDocument(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return false;
  }

  return (
    /^---\s*$/mu.test(normalizedValue) ||
    /^\s*[\w"'`-]+\s*:\s+/mu.test(normalizedValue)
  );
}

function resolveKeyValueFormat(
  language: string,
  path: string | null | undefined,
): ParsedKeyValuePreviewValue['format'] | null {
  const extension = readPathExtension(path);
  const fileName = readPathFileName(path);

  if (
    DOTENV_LANGUAGES.has(language) ||
    fileName === '.env' ||
    fileName.startsWith('.env.')
  ) {
    return 'dotenv';
  }

  if (
    PROPERTIES_LANGUAGES.has(language) ||
    PROPERTIES_EXTENSIONS.has(extension) ||
    PROPERTIES_FILE_NAMES.has(fileName)
  ) {
    return 'properties';
  }

  if (
    INI_LANGUAGES.has(language) ||
    INI_EXTENSIONS.has(extension) ||
    INI_FILE_NAMES.has(fileName)
  ) {
    return 'ini';
  }

  return null;
}

function isExplicitTabularSource(
  language: string,
  extension: string,
): boolean {
  return (
    CSV_LANGUAGES.has(language) ||
    CSV_EXTENSIONS.has(extension) ||
    TSV_LANGUAGES.has(language) ||
    TSV_EXTENSIONS.has(extension)
  );
}

function isExplicitKeyValueSource(
  language: string,
  path: string | null | undefined,
): boolean {
  return resolveKeyValueFormat(language, path) !== null;
}

function decodeQuotedConfigValue(rawValue: string): string {
  if (rawValue.length < 2) {
    return rawValue;
  }

  const quote = rawValue[0];
  if ((quote !== '"' && quote !== "'") || rawValue.at(-1) !== quote) {
    return rawValue;
  }

  const innerValue = rawValue.slice(1, -1);
  if (quote === "'") {
    return innerValue;
  }

  return innerValue
    .replace(/\\n/gu, '\n')
    .replace(/\\r/gu, '\r')
    .replace(/\\t/gu, '\t')
    .replace(/\\"/gu, '"')
    .replace(/\\\\/gu, '\\');
}

function findPropertySeparatorIndex(line: string): number {
  let isEscaped = false;
  let equalsIndex = -1;
  let colonIndex = -1;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === '\\') {
      isEscaped = true;
      continue;
    }

    if (character === '=' && equalsIndex < 0) {
      equalsIndex = index;
      continue;
    }

    if (character === ':' && colonIndex < 0) {
      colonIndex = index;
    }
  }

  if (equalsIndex >= 0) {
    return equalsIndex;
  }

  if (colonIndex >= 0) {
    return colonIndex;
  }

  return line.search(/\s/u);
}

function decodePropertiesToken(value: string): string {
  return value
    .replace(/\\ /gu, ' ')
    .replace(/\\:/gu, ':')
    .replace(/\\=/gu, '=')
    .replace(/\\\\/gu, '\\');
}

interface LogicalConfigLine {
  lineNumber: number;
  text: string;
}

function hasContinuationBackslash(line: string): boolean {
  let slashCount = 0;
  for (let index = line.length - 1; index >= 0 && line[index] === '\\'; index -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function buildPropertiesLogicalLines(sourceValue: string): LogicalConfigLine[] {
  const rawLines = sourceValue.split(/\r?\n/u);
  const logicalLines: LogicalConfigLine[] = [];
  let bufferedLine = '';
  let bufferedLineNumber = 0;

  rawLines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    if (!bufferedLine) {
      bufferedLine = rawLine;
      bufferedLineNumber = lineNumber;
    } else {
      bufferedLine += rawLine.trimStart();
    }

    if (hasContinuationBackslash(bufferedLine)) {
      bufferedLine = bufferedLine.slice(0, -1);
      return;
    }

    logicalLines.push({
      lineNumber: bufferedLineNumber,
      text: bufferedLine,
    });
    bufferedLine = '';
    bufferedLineNumber = 0;
  });

  if (bufferedLine) {
    logicalLines.push({
      lineNumber: bufferedLineNumber,
      text: bufferedLine,
    });
  }

  return logicalLines;
}

function parseDotenvPreviewValue(sourceValue: string): ParsedKeyValuePreviewValue | null {
  const entries: ParsedKeyValuePreviewEntry[] = [];

  sourceValue.split(/\r?\n/u).forEach((rawLine, index) => {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    const normalizedLine = trimmedLine.startsWith('export ')
      ? trimmedLine.slice('export '.length).trimStart()
      : trimmedLine;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) {
      return;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = decodeQuotedConfigValue(normalizedLine.slice(separatorIndex + 1).trim());
    if (!key) {
      return;
    }

    entries.push({
      key,
      lineNumber: index + 1,
      section: null,
      value,
    });
  });

  if (entries.length === 0) {
    return null;
  }

  return {
    entries,
    format: 'dotenv',
    hasSections: false,
    sectionOrder: [],
  };
}

function parseIniPreviewValue(sourceValue: string): ParsedKeyValuePreviewValue | null {
  const entries: ParsedKeyValuePreviewEntry[] = [];
  const sectionOrder: string[] = [];
  let currentSection: string | null = null;

  sourceValue.split(/\r?\n/u).forEach((rawLine, index) => {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
      return;
    }

    const sectionMatch = trimmedLine.match(/^\[(.+)\]$/u);
    if (sectionMatch) {
      currentSection = sectionMatch[1]?.trim() || null;
      if (currentSection && !sectionOrder.includes(currentSection)) {
        sectionOrder.push(currentSection);
      }
      return;
    }

    const separatorIndex = trimmedLine.search(/[:=]/u);
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = decodeQuotedConfigValue(trimmedLine.slice(separatorIndex + 1).trim());
    if (!key) {
      return;
    }

    entries.push({
      key,
      lineNumber: index + 1,
      section: currentSection,
      value,
    });
  });

  if (entries.length === 0) {
    return null;
  }

  return {
    entries,
    format: 'ini',
    hasSections: sectionOrder.length > 0,
    sectionOrder,
  };
}

function parsePropertiesPreviewValue(sourceValue: string): ParsedKeyValuePreviewValue | null {
  const entries: ParsedKeyValuePreviewEntry[] = [];

  buildPropertiesLogicalLines(sourceValue).forEach(({ lineNumber, text }) => {
    const trimmedLine = text.trim();
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('!')) {
      return;
    }

    const separatorIndex = findPropertySeparatorIndex(text);
    if (separatorIndex <= 0) {
      return;
    }

    const key = decodePropertiesToken(text.slice(0, separatorIndex).trim());
    const valueStartIndex = /[:=]/u.test(text[separatorIndex] ?? '')
      ? separatorIndex + 1
      : separatorIndex;
    const value = decodeQuotedConfigValue(
      decodePropertiesToken(text.slice(valueStartIndex).trim()),
    );
    if (!key) {
      return;
    }

    entries.push({
      key,
      lineNumber,
      section: null,
      value,
    });
  });

  if (entries.length === 0) {
    return null;
  }

  return {
    entries,
    format: 'properties',
    hasSections: false,
    sectionOrder: [],
  };
}

function parseDelimitedTextLine(
  line: string,
  delimiter: ',' | '\t',
): string[] {
  const values: string[] = [];
  let currentValue = '';
  let isInsideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (isInsideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      isInsideQuotes = !isInsideQuotes;
      continue;
    }

    if (character === delimiter && !isInsideQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function resolveTabularDelimiter(
  options: ResolveContentPreviewKindOptions,
): ',' | '\t' | null {
  const normalizedLanguage = normalizeValue(options.language);
  const extension = readPathExtension(options.path);
  const value = typeof options.value === 'string' ? options.value : '';

  if (CSV_LANGUAGES.has(normalizedLanguage) || CSV_EXTENSIONS.has(extension)) {
    return ',';
  }

  if (TSV_LANGUAGES.has(normalizedLanguage) || TSV_EXTENSIONS.has(extension)) {
    return '\t';
  }

  const nonEmptyLines = value
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(0, 6);

  if (nonEmptyLines.length < 2) {
    return null;
  }

  const commaColumnCounts = nonEmptyLines.map((line) => parseDelimitedTextLine(line, ',').length);
  if (
    commaColumnCounts.every((count) => count > 1) &&
    new Set(commaColumnCounts).size === 1
  ) {
    return ',';
  }

  const tabColumnCounts = nonEmptyLines.map((line) => parseDelimitedTextLine(line, '\t').length);
  if (
    tabColumnCounts.every((count) => count > 1) &&
    new Set(tabColumnCounts).size === 1
  ) {
    return '\t';
  }

  return null;
}

function inferTabularHeaderRow(rows: string[][]): boolean {
  if (rows.length < 2) {
    return false;
  }

  const firstRow = rows[0] ?? [];
  const secondRow = rows[1] ?? [];
  if (firstRow.length === 0) {
    return false;
  }

  const firstRowLooksDescriptive = firstRow.every((cell) => {
    const normalizedCell = cell.trim();
    return normalizedCell.length > 0 && !/^-?\d+(\.\d+)?$/u.test(normalizedCell);
  });
  const secondRowLooksData = secondRow.some((cell) => /^-?\d+(\.\d+)?$/u.test(cell.trim()));

  return firstRowLooksDescriptive || secondRowLooksData;
}

function injectHeadMarkup(documentSource: string, headMarkup: string): string {
  if (!headMarkup) {
    return documentSource;
  }

  if (/<head[^>]*>/iu.test(documentSource)) {
    return documentSource.replace(/<head([^>]*)>/iu, `<head$1>${headMarkup}`);
  }

  if (/<html[^>]*>/iu.test(documentSource)) {
    return documentSource.replace(/<html([^>]*)>/iu, `<html$1><head>${headMarkup}</head>`);
  }

  return `<!DOCTYPE html><html><head>${headMarkup}</head><body>${documentSource}</body></html>`;
}

function buildSharedPreviewHeadMarkup(options: BuildContentPreviewDocumentOptions): string {
  const title = escapeHtml(options.title?.trim() || 'Content Preview');
  const baseMarkup = options.baseUrl?.trim()
    ? `<base href="${escapeHtml(options.baseUrl.trim())}">`
    : '';

  return `${baseMarkup}<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>`;
}

export function resolveContentPreviewKind({
  kind = 'auto',
  language,
  path,
  value,
}: ResolveContentPreviewKindOptions): ResolvedContentPreviewKind {
  if (kind !== 'auto') {
    return kind;
  }

  const normalizedLanguage = normalizeValue(language);
  const extension = readPathExtension(path);

  if (
    SVG_LANGUAGES.has(normalizedLanguage) ||
    SVG_EXTENSIONS.has(extension) ||
    looksLikeSvgDocument(value)
  ) {
    return 'svg';
  }

  if (HTML_LANGUAGES.has(normalizedLanguage) || HTML_EXTENSIONS.has(extension)) {
    return 'html';
  }

  if (JSON_LANGUAGES.has(normalizedLanguage) || JSON_EXTENSIONS.has(extension)) {
    return 'text';
  }

  if (YAML_LANGUAGES.has(normalizedLanguage) || YAML_EXTENSIONS.has(extension)) {
    return 'text';
  }

  if (MARKDOWN_LANGUAGES.has(normalizedLanguage) || MARKDOWN_EXTENSIONS.has(extension)) {
    return 'markdown';
  }

  if (looksLikeHtmlDocument(value)) {
    return 'html';
  }

  if (looksLikeMarkdownDocument(value)) {
    return 'markdown';
  }

  if (looksLikeJsonDocument(value) || looksLikeYamlDocument(value)) {
    return 'text';
  }

  return 'text';
}

export function formatResolvedContentPreviewKindLabel(
  kind: ResolvedContentPreviewKind,
): string {
  switch (kind) {
    case 'html':
      return 'HTML';
    case 'markdown':
      return 'Markdown';
    case 'svg':
      return 'SVG';
    case 'text':
    default:
      return 'Text';
  }
}

export function resolveContentPreviewCodeLanguage(
  options: Pick<ResolveContentPreviewKindOptions, 'language' | 'path'>,
): string {
  const normalizedLanguage = normalizeValue(options.language);
  if (normalizedLanguage) {
    if (normalizedLanguage === 'jsonc') {
      return 'json';
    }

    if (
      TEXT_LANGUAGES.has(normalizedLanguage) ||
      CSV_LANGUAGES.has(normalizedLanguage) ||
      TSV_LANGUAGES.has(normalizedLanguage) ||
      isExplicitKeyValueSource(normalizedLanguage, options.path)
    ) {
      return 'text';
    }

    return normalizedLanguage;
  }

  const extension = readPathExtension(options.path);
  if (
    !extension ||
    TEXT_EXTENSIONS.has(extension) ||
    CSV_EXTENSIONS.has(extension) ||
    TSV_EXTENSIONS.has(extension) ||
    extension === 'jsonc' ||
    isExplicitKeyValueSource('', options.path)
  ) {
    return extension === 'jsonc' ? 'json' : 'text';
  }

  return extension;
}

export function isStructuredDataPreviewCandidate(
  options: ResolveContentPreviewKindOptions,
): boolean {
  const normalizedLanguage = normalizeValue(options.language);
  const extension = readPathExtension(options.path);

  if (
    isExplicitTabularSource(normalizedLanguage, extension) ||
    isExplicitKeyValueSource(normalizedLanguage, options.path)
  ) {
    return false;
  }

  return (
    JSON_LANGUAGES.has(normalizedLanguage) ||
    JSON_EXTENSIONS.has(extension) ||
    YAML_LANGUAGES.has(normalizedLanguage) ||
    YAML_EXTENSIONS.has(extension) ||
    TOML_LANGUAGES.has(normalizedLanguage) ||
    TOML_EXTENSIONS.has(extension) ||
    looksLikeJsonDocument(options.value) ||
    looksLikeYamlDocument(options.value)
  );
}

export function parseTabularDataPreviewValue(
  options: ResolveContentPreviewKindOptions,
): ParsedTabularDataPreviewValue | null {
  const normalizedLanguage = normalizeValue(options.language);
  if (isExplicitKeyValueSource(normalizedLanguage, options.path)) {
    return null;
  }

  const delimiter = resolveTabularDelimiter(options);
  const sourceValue = typeof options.value === 'string' ? options.value : '';

  if (!delimiter || !sourceValue.trim()) {
    return null;
  }

  if (
    sourceValue.length > CONTENT_PREVIEW_MAX_TABLE_LENGTH ||
    !hasLineCountAtMost(sourceValue, CONTENT_PREVIEW_MAX_TABLE_LINES)
  ) {
    return null;
  }

  const parsedRows = sourceValue
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => parseDelimitedTextLine(line, delimiter));

  if (parsedRows.length < 2) {
    return null;
  }

  const columnCount = parsedRows.reduce(
    (currentMax, row) => Math.max(currentMax, row.length),
    0,
  );

  if (columnCount < 2) {
    return null;
  }

  const rows = parsedRows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ''),
  );

  return {
    columnCount,
    delimiter,
    hasHeaderRow: inferTabularHeaderRow(rows),
    rows,
  };
}

export function parseKeyValuePreviewValue(
  options: ResolveContentPreviewKindOptions,
): ParsedKeyValuePreviewValue | null {
  const normalizedLanguage = normalizeValue(options.language);
  const format = resolveKeyValueFormat(normalizedLanguage, options.path);
  const sourceValue = typeof options.value === 'string' ? options.value : '';

  if (!format || !sourceValue.trim()) {
    return null;
  }

  if (
    sourceValue.length > CONTENT_PREVIEW_MAX_KEY_VALUE_LENGTH ||
    !hasLineCountAtMost(sourceValue, CONTENT_PREVIEW_MAX_KEY_VALUE_LINES)
  ) {
    return null;
  }

  switch (format) {
    case 'dotenv':
      return parseDotenvPreviewValue(sourceValue);
    case 'ini':
      return parseIniPreviewValue(sourceValue);
    case 'properties':
    default:
      return parsePropertiesPreviewValue(sourceValue);
  }
}

export function resolveContentPreviewDescriptor(
  options: ResolveContentPreviewKindOptions,
): ResolvedContentPreviewDescriptor {
  const sourceValue = typeof options.value === 'string' ? options.value : '';
  const language = typeof options.language === 'string' ? options.language : null;
  const path = typeof options.path === 'string' ? options.path : null;
  const kind = resolveContentPreviewKind(options);
  const codeLanguage = resolveContentPreviewCodeLanguage({
    language,
    path,
  });

  let presentation: ContentPreviewPresentation = 'text';
  let displayLabel = 'Text';
  let keyValueData: ParsedKeyValuePreviewValue | null = null;
  let structuredData: ParsedStructuredDataPreviewValue | null = null;
  let tabularData: ParsedTabularDataPreviewValue | null = null;
  const fallbackToCodeOrText = () => {
    if (codeLanguage !== 'text') {
      presentation = 'code';
      displayLabel = 'Code';
      return;
    }

    presentation = 'text';
    displayLabel = 'Text';
  };

  if (kind === 'html') {
    if (sourceValue.length > CONTENT_PREVIEW_MAX_EMBEDDED_DOCUMENT_LENGTH) {
      fallbackToCodeOrText();
    } else {
      presentation = 'html';
      displayLabel = 'HTML';
    }
  } else if (kind === 'markdown') {
    if (sourceValue.length > CONTENT_PREVIEW_MAX_MARKDOWN_LENGTH) {
      fallbackToCodeOrText();
    } else {
      presentation = 'markdown';
      displayLabel = 'Markdown';
    }
  } else if (kind === 'svg') {
    if (sourceValue.length > CONTENT_PREVIEW_MAX_EMBEDDED_DOCUMENT_LENGTH) {
      fallbackToCodeOrText();
    } else {
      presentation = 'svg';
      displayLabel = 'SVG';
    }
  } else {
    if (isStructuredDataPreviewCandidate({
      kind,
      language,
      path,
      value: sourceValue,
    })) {
      structuredData = parseStructuredDataPreviewValue({
        kind,
        language,
        path,
        value: sourceValue,
      });
      presentation = 'structured-data';
      displayLabel = 'Structured Data';
    } else {
      keyValueData = parseKeyValuePreviewValue({
        kind,
        language,
        path,
        value: sourceValue,
      });

      if (keyValueData !== null) {
        presentation = 'key-value';
        displayLabel = 'Config';
      } else {
        tabularData = parseTabularDataPreviewValue({
          kind,
          language,
          path,
          value: sourceValue,
        });

        if (tabularData !== null) {
          presentation = 'table';
          displayLabel = 'Data Table';
        } else if (codeLanguage !== 'text') {
          presentation = 'code';
          displayLabel = 'Code';
        } else {
          presentation = 'text';
          displayLabel = 'Text';
        }
      }
    }
  }

  return {
    codeLanguage,
    displayLabel,
    keyValueData,
    kind,
    language,
    path,
    presentation,
    shouldDefaultToSplit: presentation !== 'code' && presentation !== 'text',
    sourceValue,
    structuredData,
    tabularData,
  };
}

export function resolveContentPreviewDisplayLabel(
  options: ResolveContentPreviewKindOptions,
): string {
  return resolveContentPreviewDescriptor(options).displayLabel;
}

export function shouldDefaultToSplitContentWorkbench(
  options: ResolveContentPreviewKindOptions,
): boolean {
  return resolveContentPreviewDescriptor(options).shouldDefaultToSplit;
}

export function resolveContentPreviewSandbox(
  policy: ContentPreviewSandboxPolicy = 'balanced',
  sandboxOverride?: string | null,
): string {
  if (typeof sandboxOverride === 'string') {
    return sandboxOverride;
  }

  switch (policy) {
    case 'locked':
      return '';
    case 'trusted':
      return 'allow-downloads allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts';
    case 'balanced':
    default:
      return 'allow-forms allow-modals allow-popups allow-same-origin allow-scripts';
  }
}

export function buildHtmlPreviewDocument(
  value: string,
  options: BuildContentPreviewDocumentOptions = {},
): string {
  const headMarkup = buildSharedPreviewHeadMarkup(options);
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return injectHeadMarkup(
      '<!DOCTYPE html><html><body></body></html>',
      `${headMarkup}<style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#ffffff;color:#111827;}</style>`,
    );
  }

  if (looksLikeHtmlDocument(normalizedValue)) {
    return injectHeadMarkup(normalizedValue, headMarkup);
  }

  return `<!DOCTYPE html><html><head>${headMarkup}<style>body{margin:0;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif;background:#ffffff;color:#111827;}</style></head><body>${value}</body></html>`;
}

export function buildSvgPreviewDocument(
  value: string,
  options: BuildContentPreviewDocumentOptions = {},
): string {
  const headMarkup = buildSharedPreviewHeadMarkup(options);
  const normalizedValue = value.trim();
  const svgMarkup = normalizedValue || '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  return `<!DOCTYPE html><html><head>${headMarkup}<style>html,body{margin:0;min-height:100%;background:#ffffff;}body{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;}svg{max-width:100%;height:auto;box-shadow:0 18px 40px rgba(15,23,42,.08);border-radius:12px;}</style></head><body>${svgMarkup}</body></html>`;
}

export { parseStructuredDataPreviewValue };
