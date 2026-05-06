const INTERNAL_SEARCH_EXCLUDED_PREFIXES = [
  'prompts/',
  'release/',
  'step/',
  'superpowers/',
  `${String.fromCodePoint(0x67b6, 0x6784)}/`,
];

export const publicDocsSrcExclude = [
  'prompts/**',
  'release/**',
  'step/**',
  'superpowers/**',
  `${String.fromCodePoint(0x67b6, 0x6784)}/**`,
];

export function normalizeSearchPagePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function shouldIndexSearchPage(relativePath: string): boolean {
  const normalizedPath = normalizeSearchPagePath(relativePath);
  return !INTERNAL_SEARCH_EXCLUDED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

type SearchRenderEnv = {
  relativePath?: string;
  frontmatter?: {
    search?: boolean;
  };
};

type SearchMarkdownRenderer = {
  render: (src: string, env: SearchRenderEnv) => string;
};

export const localSearchOptions = {
  _render(src: string, env: SearchRenderEnv, md: SearchMarkdownRenderer) {
    if (!shouldIndexSearchPage(env.relativePath ?? '')) {
      return '';
    }

    const html = md.render(src, env);
    return env.frontmatter?.search === false ? '' : html;
  },
};
