import { describe, expect, it } from 'vitest';
import {
  resolveChatActivityActionLabel,
  resolveChatActivitySummaryLabel,
  resolveChatActivitySummarySegments,
} from './ChatActivitySummary.tsx';

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

  it('builds segments in the exact Codex desktop order', () => {
    expect(resolveChatActivitySummarySegments({
      fileCount: 2,
      commandCount: 1,
      mcpSources: [
        { key: 'github', name: 'github', count: 3, runningCount: 0 },
        { key: 'browser-use', name: 'browser-use', count: 1, runningCount: 0 },
      ],
      unnamedMcpToolCallCount: 2,
      loadedToolCount: 4,
      explorationCount: 1,
      webSearchCount: 2,
      runningWebSearchCount: 1,
    })).toEqual([
      { kind: 'mcp-sources', sources: 'github, the browser' },
      { kind: 'loaded-tools', count: 4 },
      { kind: 'called-tools', count: 2 },
      { kind: 'file-changes', count: 2 },
      { kind: 'exploration', count: 1 },
      { kind: 'commands', count: 1 },
      { kind: 'web-search', count: 2 },
    ]);
  });

  it('renders a leading-cased multi-segment label with mid-sentence continuations', () => {
    expect(resolveChatActivitySummaryLabel({
      fileCount: 2,
      commandCount: 3,
      mcpSources: [{ key: 'github', name: 'github', count: 1, runningCount: 0 }],
      loadedToolCount: 1,
      webSearchCount: 1,
    })).toBe('Used github, loaded a tool, edited files, ran commands, searched the web');
  });

  it('uses singular continuation forms for single counts', () => {
    expect(resolveChatActivitySummaryLabel({
      fileCount: 1,
      commandCount: 1,
      loadedToolCount: 1,
    })).toBe('Loaded a tool, edited a file, ran a command');
  });

  it('falls back to the two-segment label when no extended segments exist', () => {
    expect(resolveChatActivitySummaryLabel({ fileCount: 2, commandCount: 3 }))
      .toBe('Edited files, ran commands');
  });
});
