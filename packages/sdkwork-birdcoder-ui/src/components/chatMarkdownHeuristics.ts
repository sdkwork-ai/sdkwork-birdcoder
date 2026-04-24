export type ChatMarkdownRenderMode = 'basic' | 'rich';

const CHAT_RICH_MARKDOWN_PATTERNS = [
  /```/u,
  /^#{1,6}\s+/mu,
  /^\s*[-*+]\s+/mu,
  /^\s*\d+\.\s+/mu,
  /^\s*>\s+/mu,
  /^\s*\|.+\|\s*$/mu,
  /\[[^\]]+\]\([^)]+\)/u,
  /`[^`\n]+`/u,
  /<([a-z][\w-]*)(?:\s[^>]*)?>/iu,
  /\bSkill\s+[a-zA-Z0-9][a-zA-Z0-9\s-]*/u,
];

const EMPHASIS_PATTERN =
  /(^|[\s([{])(\*\*|__|\*|_)[^*_][^]*?(\*\*|__|\*|_)(?=$|[\s)\]},.!?:;])/u;

export function shouldUseRichChatMarkdown(
  content: string,
  mode: ChatMarkdownRenderMode = 'rich',
): boolean {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return false;
  }

  if (mode === 'basic' && normalizedContent.length < 24) {
    return CHAT_RICH_MARKDOWN_PATTERNS.some((pattern) => pattern.test(normalizedContent));
  }

  if (CHAT_RICH_MARKDOWN_PATTERNS.some((pattern) => pattern.test(normalizedContent))) {
    return true;
  }

  return EMPHASIS_PATTERN.test(normalizedContent);
}
