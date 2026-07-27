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
