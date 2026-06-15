export type ChatMarkdownRenderMode = 'basic' | 'rich';

export const CHAT_RICH_MARKDOWN_MAX_CHARACTERS = 64000;

export interface ChatMarkdownSkillLike {
  name: string;
}

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
];

const EMPHASIS_PATTERN =
  /(^|[\s([{])(\*\*|__|\*|_)[^*_][^]*?(\*\*|__|\*|_)(?=$|[\s)\]},.!?:;])/u;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function hasKnownSkillMention(
  content: string,
  skills: readonly ChatMarkdownSkillLike[],
): boolean {
  return skills
    .map((skill) => skill.name.trim())
    .filter((name) => name.length > 0)
    .some((skillName) => {
      const skillMentionPattern = new RegExp(
        `\\bSkill\\s+${escapeRegExp(skillName)}(?=[,.!\\n]|\\sas\\b|$)`,
        'iu',
      );
      return skillMentionPattern.test(content);
    });
}

export function shouldUseRichChatMarkdown(
  content: string,
  mode: ChatMarkdownRenderMode = 'rich',
  skills: readonly ChatMarkdownSkillLike[] = [],
): boolean {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return false;
  }

  if (normalizedContent.length > CHAT_RICH_MARKDOWN_MAX_CHARACTERS) {
    return false;
  }

  if (hasKnownSkillMention(normalizedContent, skills)) {
    return true;
  }

  if (mode === 'basic' && normalizedContent.length < 24) {
    return CHAT_RICH_MARKDOWN_PATTERNS.some((pattern) => pattern.test(normalizedContent));
  }

  if (CHAT_RICH_MARKDOWN_PATTERNS.some((pattern) => pattern.test(normalizedContent))) {
    return true;
  }

  return EMPHASIS_PATTERN.test(normalizedContent);
}
