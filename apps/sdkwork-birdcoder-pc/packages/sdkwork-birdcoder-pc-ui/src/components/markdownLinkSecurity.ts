import { resolveAgentSessionItemMediaSource } from '@sdkwork/birdcoder-pc-contracts-commons';

interface ResolveSafeMarkdownHrefOptions {
  allowSkillLinks?: boolean;
}

const SAFE_MARKDOWN_LINK_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
]);

function isRelativeMarkdownHref(value: string): boolean {
  return (
    (value.startsWith('/') && !value.startsWith('//')) ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('#')
  );
}

function normalizeSkillMarkdownHref(value: string): string | null {
  if (!value.toLowerCase().startsWith('skill://')) {
    return null;
  }

  const skillNameSegment = value.slice('skill://'.length).trim();
  if (!skillNameSegment) {
    return null;
  }

  try {
    decodeURIComponent(skillNameSegment);
  } catch {
    return null;
  }

  return `skill://${skillNameSegment}`;
}

function decodeMarkdownFilePath(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function stripMarkdownFileLocation(value: string): string {
  const withoutFragment = value.replace(/#L?\d+(?:-L?\d+)?$/iu, '');
  return withoutFragment.replace(/:(\d+)(?::\d+)?$/u, '');
}

export function resolveMarkdownFilePath(href: unknown): string | null {
  if (typeof href !== 'string') {
    return null;
  }

  const normalizedHref = href.trim();
  if (!normalizedHref || normalizedHref.startsWith('#') || normalizedHref.startsWith('?')) {
    return null;
  }
  if (
    /^(?:https?|mailto|skill|javascript|data|vbscript):/iu.test(normalizedHref)
    || normalizedHref.startsWith('//')
  ) {
    return null;
  }

  let path = normalizedHref;
  if (/^file:/iu.test(path)) {
    try {
      const fileUrl = new URL(path);
      if (fileUrl.protocol.toLowerCase() !== 'file:') {
        return null;
      }
      path = fileUrl.pathname;
      if (/^\/[A-Za-z]:\//u.test(path)) {
        path = path.slice(1);
      }
    } catch {
      return null;
    }
  }

  const decodedPath = decodeMarkdownFilePath(path.replace(/[?#].*$/u, ''));
  if (
    !decodedPath
    || /^(?:https?|mailto|skill|javascript|data|vbscript):/iu.test(decodedPath)
  ) {
    return null;
  }
  const filePath = stripMarkdownFileLocation(decodedPath).trim();
  if (
    !filePath
    || filePath === '.'
    || filePath === '..'
    || filePath === '/'
    || /[\u0000-\u001f\u007f]/u.test(filePath)
    || (
      /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(filePath)
      && !/^[A-Za-z]:[\\/]/u.test(filePath)
    )
  ) {
    return null;
  }
  return filePath;
}

export function resolveSafeMarkdownHref(
  href: unknown,
  options: ResolveSafeMarkdownHrefOptions = {},
): string | null {
  if (typeof href !== 'string') {
    return null;
  }

  const normalizedHref = href.trim();
  if (!normalizedHref) {
    return null;
  }

  if (options.allowSkillLinks === true && normalizedHref.toLowerCase().startsWith('skill://')) {
    return normalizeSkillMarkdownHref(normalizedHref);
  }

  if (isRelativeMarkdownHref(normalizedHref)) {
    return normalizedHref;
  }

  try {
    const parsedUrl = new URL(normalizedHref);
    return SAFE_MARKDOWN_LINK_PROTOCOLS.has(parsedUrl.protocol.toLowerCase())
      ? normalizedHref
      : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a markdown image destination to a renderable `src`.
 *
 * react-markdown's default `urlTransform` blanks any URL whose first colon
 * precedes the first slash and is not an allowlisted protocol, which drops
 * Windows absolute paths (`C:/Users/...`), `file:` URLs and even `data:`
 * images. This resolver keeps safe inline media sources and local file
 * paths while still rejecting dangerous protocols.
 */
export function resolveSafeMarkdownImageSrc(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const mediaSource = resolveAgentSessionItemMediaSource(value, 'image');
  if (mediaSource) {
    return mediaSource;
  }

  return resolveMarkdownFilePath(value);
}

/**
 * Resolve a markdown link destination without blanking local file paths.
 *
 * The default react-markdown `urlTransform` would blank `skill://...` and
 * Windows absolute file paths (`E:/...`, `file:///...`) before the custom
 * `a` renderer can turn them into file-open buttons or skill chips.
 */
export function resolveSafeMarkdownHrefOrPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedHref = value.trim();
  if (!normalizedHref) {
    return null;
  }

  if (resolveMarkdownFilePath(normalizedHref) !== null) {
    return normalizedHref;
  }

  return resolveSafeMarkdownHref(normalizedHref, { allowSkillLinks: true });
}
