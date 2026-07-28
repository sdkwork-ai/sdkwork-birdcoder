import type {
  AgentSessionItemToolCallView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

export type ContextToolCallCategory = 'list' | 'read' | 'search';

export interface ContextToolCallPresentationGroup {
  calls: readonly AgentSessionItemToolCallView[];
  key: string;
  summary: Readonly<Record<ContextToolCallCategory, number>>;
  type: 'context';
}

export interface StandaloneToolCallPresentationItem {
  call: AgentSessionItemToolCallView;
  key: string;
  type: 'call';
}

export type ToolCallPresentationItem =
  | ContextToolCallPresentationGroup
  | StandaloneToolCallPresentationItem;

const CONTEXT_TOOL_CATEGORY_BY_NAME = new Map<string, ContextToolCallCategory>([
  ['codesearch', 'search'],
  ['code_search', 'search'],
  ['file_search', 'search'],
  ['find_files', 'search'],
  ['glob', 'search'],
  ['grep', 'search'],
  ['grep_search', 'search'],
  ['grepsearch', 'search'],
  ['list', 'list'],
  ['list_dir', 'list'],
  ['list_directory', 'list'],
  ['list_files', 'list'],
  ['listdir', 'list'],
  ['listdirectory', 'list'],
  ['listfiles', 'list'],
  ['ls', 'list'],
  ['read', 'read'],
  ['read_document', 'read'],
  ['read_file', 'read'],
  ['read_many_files', 'read'],
  ['read_text_file', 'read'],
  ['readdocument', 'read'],
  ['readfile', 'read'],
  ['readmanyfiles', 'read'],
  ['readtextfile', 'read'],
  ['search_file_content', 'search'],
  ['searchfilecontent', 'search'],
]);

function normalizeContextToolName(name: string): string {
  return name.trim().toLowerCase().replace(/[.\s-]+/gu, '_');
}

export function resolveContextToolCallCategory(
  call: AgentSessionItemToolCallView,
): ContextToolCallCategory | undefined {
  if (call.kind === 'mcp' || call.interaction) {
    return undefined;
  }

  return CONTEXT_TOOL_CATEGORY_BY_NAME.get(normalizeContextToolName(call.name));
}

export function groupToolCallsForPresentation(
  calls: readonly AgentSessionItemToolCallView[],
): readonly ToolCallPresentationItem[] {
  const items: ToolCallPresentationItem[] = [];
  let contextCalls: AgentSessionItemToolCallView[] = [];

  const flushContextCalls = () => {
    const firstCall = contextCalls[0];
    if (!firstCall) {
      return;
    }

    const summary: Record<ContextToolCallCategory, number> = {
      list: 0,
      read: 0,
      search: 0,
    };
    for (const call of contextCalls) {
      const category = resolveContextToolCallCategory(call);
      if (category) {
        summary[category] += 1;
      }
    }

    items.push({
      calls: contextCalls,
      key: `context:${firstCall.id}`,
      summary,
      type: 'context',
    });
    contextCalls = [];
  };

  for (const call of calls) {
    if (resolveContextToolCallCategory(call)) {
      contextCalls.push(call);
      continue;
    }

    flushContextCalls();
    items.push({
      call,
      key: `call:${call.id}`,
      type: 'call',
    });
  }

  flushContextCalls();
  return items;
}
