import type { AgentSessionItemView, ChatMessageViewSource } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ActivityFileChangeView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { resolveActivityFileChangeViews } from '@sdkwork/birdcoder-pc-workbench/chat/types';

export type ActivityFileChange = ActivityFileChangeView;

export {
  parseFileUpdateSummaryContent,
  resolveMessageCopyContent,
  resolveActivityFileChangeViews,
  resolveVisibleAssistantMessageContent,
  resolveVisibleMarkdownBlockContent,
  shouldHideMessageContentAsFileUpdateSummary,
  stripFileUpdateSummaryContent,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';

export function resolveMessageActivityFileChanges(
  message: AgentSessionItemView | ChatMessageViewSource,
): ActivityFileChange[] | undefined {
  const fileChanges = resolveActivityFileChangeViews(message);
  return fileChanges.length > 0 ? fileChanges : undefined;
}
