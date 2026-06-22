import type { BirdCoderChatMessage, ChatMessageViewSource } from '@sdkwork/birdcoder-pc-commons/chat/types';
import type { ProjectedActivityFileChange } from '@sdkwork/birdcoder-pc-commons/chat/types';
import { resolveProjectedActivityFileChanges } from '@sdkwork/birdcoder-pc-commons/chat/types';

export type ActivityFileChange = ProjectedActivityFileChange;

export {
  parseFileUpdateSummaryContent,
  resolveMessageCopyContent,
  resolveProjectedActivityFileChanges,
  resolveVisibleAssistantMessageContent,
  resolveVisibleMarkdownBlockContent,
  shouldHideMessageContentAsFileUpdateSummary,
  stripFileUpdateSummaryContent,
} from '@sdkwork/birdcoder-pc-commons/chat/types';

export function resolveMessageActivityFileChanges(
  message: BirdCoderChatMessage | ChatMessageViewSource,
): ActivityFileChange[] | undefined {
  const fileChanges = resolveProjectedActivityFileChanges(message);
  return fileChanges.length > 0 ? fileChanges : undefined;
}
