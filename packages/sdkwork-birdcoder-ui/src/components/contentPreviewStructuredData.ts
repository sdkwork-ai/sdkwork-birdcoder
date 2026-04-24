import { parse as parseJsonc } from 'jsonc-parser';
import { parse as parseToml } from 'smol-toml';
import { parseDocument } from 'yaml';
import type {
  ParsedStructuredDataPreviewValue,
  ResolveContentPreviewKindOptions,
} from './contentPreview.ts';

const CONTENT_PREVIEW_MAX_STRUCTURED_DATA_LENGTH = 250_000;
const JSON_EXTENSIONS = new Set(['json', 'jsonc']);
const TOML_EXTENSIONS = new Set(['toml']);
const YAML_EXTENSIONS = new Set(['yaml', 'yml']);
const JSON_LANGUAGES = new Set(['json', 'jsonc']);
const TOML_LANGUAGES = new Set(['toml']);
const YAML_LANGUAGES = new Set(['yaml', 'yml']);

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

export function parseStructuredDataPreviewValue(
  options: ResolveContentPreviewKindOptions,
): ParsedStructuredDataPreviewValue | null {
  const normalizedLanguage = normalizeValue(options.language);
  const extension = readPathExtension(options.path);
  const value = typeof options.value === 'string' ? options.value.trim() : '';

  if (!value || value.length > CONTENT_PREVIEW_MAX_STRUCTURED_DATA_LENGTH) {
    return null;
  }

  const isJsonSource =
    JSON_LANGUAGES.has(normalizedLanguage) ||
    JSON_EXTENSIONS.has(extension) ||
    looksLikeJsonDocument(value);
  const isJsoncSource =
    normalizedLanguage === 'jsonc' || extension === 'jsonc';
  const isTomlSource =
    TOML_LANGUAGES.has(normalizedLanguage) ||
    TOML_EXTENSIONS.has(extension);
  const isYamlSource =
    YAML_LANGUAGES.has(normalizedLanguage) ||
    YAML_EXTENSIONS.has(extension) ||
    looksLikeYamlDocument(value);

  if (isJsoncSource) {
    try {
      return {
        format: 'jsonc',
        value: parseJsonc(value) as unknown,
      };
    } catch {
      return null;
    }
  }

  if (isJsonSource) {
    try {
      return {
        format: 'json',
        value: JSON.parse(value) as unknown,
      };
    } catch {
      return null;
    }
  }

  if (isTomlSource) {
    try {
      return {
        format: 'toml',
        value: parseToml(value) as unknown,
      };
    } catch {
      return null;
    }
  }

  if (!isYamlSource) {
    return null;
  }

  try {
    const document = parseDocument(value);
    if (document.errors.length > 0) {
      return null;
    }

    return {
      format: 'yaml',
      value: document.toJS() as unknown,
    };
  } catch {
    return null;
  }
}
