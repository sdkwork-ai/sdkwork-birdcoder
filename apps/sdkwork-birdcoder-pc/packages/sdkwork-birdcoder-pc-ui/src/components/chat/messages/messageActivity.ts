import type { AgentSessionItemView, AgentSessionItemViewSource } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { AgentSessionActivityFileChangeView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { resolveAgentSessionActivityFileChangeViews } from '@sdkwork/birdcoder-pc-workbench/chat/types';

export type ActivityFileChange = AgentSessionActivityFileChangeView;

export {
  parseFileUpdateSummaryContent,
  resolveSessionItemCopyContent,
  resolveAgentSessionActivityFileChangeViews,
  resolveVisibleAssistantSessionItemContent,
  resolveAgentSessionItemVisibleMarkdownContent,
  shouldHideSessionItemContentAsFileUpdateSummary,
  stripFileUpdateSummaryContent,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

export function resolveMessageActivityFileChanges(
  message: AgentSessionItemView | AgentSessionItemViewSource,
): ActivityFileChange[] | undefined {
  const fileChanges = resolveAgentSessionActivityFileChangeViews(message);
  return fileChanges.length > 0 ? fileChanges : undefined;
}
