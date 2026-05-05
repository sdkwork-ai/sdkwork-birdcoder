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
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('#')
  );
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
    return normalizedHref;
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
