export type LightweightResolvedContentPreviewKind = 'html' | 'markdown' | 'svg' | 'text';
export type LightweightContentPreviewKind = LightweightResolvedContentPreviewKind | 'auto';

export interface LightweightResolveContentPreviewOptions {
  kind?: LightweightContentPreviewKind;
  language?: string | null;
  path?: string | null;
  value?: string | null;
}

const CSV_EXTENSIONS = new Set(['csv']);
const HTML_EXTENSIONS = new Set(['htm', 'html', 'xhtml']);
const INI_EXTENSIONS = new Set(['cfg', 'cnf', 'conf', 'ini']);
const JSON_EXTENSIONS = new Set(['json', 'jsonc']);
const MARKDOWN_EXTENSIONS = new Set(['markdown', 'md', 'mdown', 'mkd']);
const PROPERTIES_EXTENSIONS = new Set(['properties']);
const SVG_EXTENSIONS = new Set(['svg']);
const TSV_EXTENSIONS = new Set(['tsv']);
const TEXT_EXTENSIONS = new Set(['log', 'text', 'txt']);
const YAML_EXTENSIONS = new Set(['yaml', 'yml']);

const CSV_LANGUAGES = new Set(['csv']);
const HTML_LANGUAGES = new Set(['html', 'htm', 'xhtml', 'handlebars', 'vue']);
const INI_LANGUAGES = new Set(['cfg', 'conf', 'ini']);
const JSON_LANGUAGES = new Set(['json', 'jsonc']);
const MARKDOWN_LANGUAGES = new Set(['markdown', 'md', 'mdx']);
const PROPERTIES_LANGUAGES = new Set(['java-properties', 'properties']);
const SVG_LANGUAGES = new Set(['svg']);
const TEXT_LANGUAGES = new Set(['plaintext', 'plain text', 'text']);
const TSV_LANGUAGES = new Set(['tsv']);
const YAML_LANGUAGES = new Set(['yaml', 'yml']);

const INI_FILE_NAMES = new Set(['.editorconfig', '.gitconfig']);
const PROPERTIES_FILE_NAMES = new Set(['.npmrc']);

function normalizeValue(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
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

  if (/^---(?:\s|$)/mu.test(normalizedValue) || /^\.\.\.(?:\s|$)/mu.test(normalizedValue)) {
    return true;
  }

  return /^[\w-]+\s*:\s+/mu.test(normalizedValue);
}

function isExplicitKeyValueSource(
  normalizedLanguage: string,
  path: string | null | undefined,
): boolean {
  const extension = readPathExtension(path);
  const fileName = readPathFileName(path);

  return (
    INI_LANGUAGES.has(normalizedLanguage) ||
    PROPERTIES_LANGUAGES.has(normalizedLanguage) ||
    normalizedLanguage === 'dotenv' ||
    normalizedLanguage === 'env' ||
    INI_EXTENSIONS.has(extension) ||
    PROPERTIES_EXTENSIONS.has(extension) ||
    fileName === '.env' ||
    fileName.startsWith('.env.') ||
    INI_FILE_NAMES.has(fileName) ||
    PROPERTIES_FILE_NAMES.has(fileName)
  );
}

function resolveContentPreviewCodeLanguage(
  options: Pick<LightweightResolveContentPreviewOptions, 'language' | 'path'>,
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

export function resolveContentPreviewKindFast({
  kind = 'auto',
  language,
  path,
  value,
}: LightweightResolveContentPreviewOptions): LightweightResolvedContentPreviewKind {
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

export function shouldDefaultToSplitContentWorkbenchFast(
  options: LightweightResolveContentPreviewOptions,
): boolean {
  const resolvedKind = resolveContentPreviewKindFast(options);

  if (resolvedKind === 'html' || resolvedKind === 'markdown' || resolvedKind === 'svg') {
    return true;
  }

  return resolveContentPreviewCodeLanguage(options) === 'text';
}
