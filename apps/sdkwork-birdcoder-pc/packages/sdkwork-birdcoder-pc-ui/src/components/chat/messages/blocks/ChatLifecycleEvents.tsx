import type { AgentSessionItemLifecycleEventView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import { ChatLifecycleEventRow } from './ChatLifecycleEventRow.tsx';

interface ChatLifecycleEventsProps {
  copyMessageToClipboard: (content: string) => void;
  disclosureScopeKey: string;
  events: readonly AgentSessionItemLifecycleEventView[];
  expandedDisclosureKeys: ReadonlySet<string>;
  t?: ChatMessageTranslate;
  toggleDisclosure: (key: string) => void;
}

export function ChatLifecycleEvents({
  copyMessageToClipboard,
  disclosureScopeKey,
  events,
  expandedDisclosureKeys,
  t,
  toggleDisclosure,
}: ChatLifecycleEventsProps) {
  if (events.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-chat-lifecycle-events="true">
      {events.map((event) => {
        const disclosureKey = `${disclosureScopeKey}\u0001${event.id}`;
        return (
          <ChatLifecycleEventRow
            key={event.id}
            copyMessageToClipboard={copyMessageToClipboard}
            event={event}
            isExpanded={expandedDisclosureKeys.has(disclosureKey)}
            onToggle={() => toggleDisclosure(disclosureKey)}
            t={t}
          />
        );
      })}
    </div>
  );
}
