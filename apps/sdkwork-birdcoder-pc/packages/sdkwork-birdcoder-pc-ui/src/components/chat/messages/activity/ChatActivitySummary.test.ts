import { describe, expect, it } from 'vitest';
import { resolveChatActivityActionLabel } from './ChatActivitySummary.tsx';

describe('chat activity action summary', () => {
  it('uses exact Codex singular and plural action semantics', () => {
    expect(resolveChatActivityActionLabel(0, 1)).toBe('Ran a command');
    expect(resolveChatActivityActionLabel(0, 2)).toBe('Ran commands');
    expect(resolveChatActivityActionLabel(1, 0)).toBe('Edited a file');
    expect(resolveChatActivityActionLabel(2, 0)).toBe('Edited files');
    expect(resolveChatActivityActionLabel(2, 3))
      .toBe('Edited files, ran commands');
    expect(resolveChatActivityActionLabel(1, 1))
      .toBe('Edited a file, ran a command');
  });

  it('keeps localized continuation grammar provider-neutral', () => {
    const translations: Record<string, string> = {
      'chat.activityCombinedSummary': '{{files}}，{{commands}}',
      'chat.activityEditedFilesSummary': '编辑了多个文件',
      'chat.activityRanCommandsContinuation': '运行了多个命令',
      'chat.activityRanCommandsSummary': '运行了多个命令',
    };
    const t = (key: string, options?: Record<string, unknown>) => {
      const template = translations[key] ?? key;
      return template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) =>
        String(options?.[name] ?? ''),
      );
    };

    expect(resolveChatActivityActionLabel(2, 3, t))
      .toBe('编辑了多个文件，运行了多个命令');
  });
});
