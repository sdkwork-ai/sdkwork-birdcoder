import { describe, expect, it } from 'vitest';
import type {
  AgentSessionItemToolCallView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import {
  humanizeToolCallName,
  resolveToolCallActionPresentation,
} from './toolCallActionPresentation.ts';

function createCall(
  overrides: Partial<AgentSessionItemToolCallView>,
): AgentSessionItemToolCallView {
  return {
    arguments: '{}',
    id: 'call-1',
    name: 'custom_tool',
    type: 'function',
    ...overrides,
  };
}

describe('tool call action presentation', () => {
  it('presents MCP calls as state-aware actions', () => {
    expect(resolveToolCallActionPresentation(createCall({
      kind: 'mcp',
      name: 'lookup_issue',
      serverName: 'linear',
      status: 'running',
    }))).toEqual({ displayName: 'linear / Lookup issue', label: '' });

    expect(resolveToolCallActionPresentation(createCall({
      kind: 'mcp',
      name: 'lookup_issue',
      serverName: 'linear',
      status: 'success',
    }))).toEqual({ displayName: 'linear / Lookup issue', label: '' });

    expect(resolveToolCallActionPresentation(createCall({
      kind: 'mcp',
      name: 'lookup_issue',
      serverName: 'linear',
      status: 'error',
    }))).toEqual({ displayName: 'linear / Lookup issue', label: 'Failed to call' });
  });

  it('uses Codex-aligned verbs for web and collaboration operations', () => {
    expect(resolveToolCallActionPresentation(createCall({
      kind: 'web',
      name: 'web_search',
      status: 'running',
    })).label).toBe('Searching the web');
    expect(resolveToolCallActionPresentation(createCall({
      kind: 'agent',
      name: 'spawn_agent',
      status: 'success',
      target: 'reviewer',
    }))).toEqual({ displayName: 'reviewer', label: 'Created' });
    expect(resolveToolCallActionPresentation(createCall({
      kind: 'agent',
      name: 'send_message',
      status: 'running',
      target: 'reviewer',
    })).label).toBe('Messaging');
    expect(resolveToolCallActionPresentation(createCall({
      kind: 'agent',
      name: 'wait_agent',
      status: 'waiting',
    })).label).toBe('Waiting for subagents');
  });

  it('never leaks provider-specific Thread terminology from dynamic tool names', () => {
    expect(humanizeToolCallName('send_message_to_thread')).toBe('Send message to session');
    expect(humanizeToolCallName('list_threads')).toBe('List sessions');
  });

  it('translates every provider-neutral tool kind across active, completed, and failed phases', () => {
    const cases = [
      ['approval', 'Requesting approval', 'Requested approval', 'Failed to request approval'],
      ['command', 'Running command', 'Ran command', 'Command failed'],
      ['file', 'Editing', 'Edited', 'Failed to edit'],
      ['mcp', '', '', 'Failed to call'],
      ['media', 'Inspecting image', 'Inspected image', 'Failed to inspect image'],
      ['question', 'Asking a question', 'Asked a question', 'Failed to ask a question'],
      ['search', 'Searching code', 'Searched code', 'Search failed'],
      ['skill', 'Loading skill', 'Loaded skill', 'Failed to load skill'],
      ['task', 'Updating task', 'Updated task', 'Failed to update task'],
      ['web', 'Searching the web', 'Searched the web', 'Web search failed'],
      ['other', 'Running', 'Ran', 'Failed to run'],
    ] as const;

    for (const [kind, activeLabel, completedLabel, failedLabel] of cases) {
      expect(resolveToolCallActionPresentation(createCall({ kind, status: 'running' })).label)
        .toBe(activeLabel);
      expect(resolveToolCallActionPresentation(createCall({ kind, status: 'success' })).label)
        .toBe(completedLabel);
      expect(resolveToolCallActionPresentation(createCall({ kind, status: 'error' })).label)
        .toBe(failedLabel);
    }
  });
});
