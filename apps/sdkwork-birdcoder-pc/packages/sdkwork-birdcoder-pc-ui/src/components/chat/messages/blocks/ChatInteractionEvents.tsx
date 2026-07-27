import type { AgentSessionItemInteractionView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import { ChatInteractionEventRow } from './ChatInteractionEventRow.tsx';

interface ChatInteractionEventsProps {
  copyMessageToClipboard: (content: string) => void;
  disclosureScopeKey: string;
  expandedDisclosureKeys: ReadonlySet<string>;
  interactions: readonly AgentSessionItemInteractionView[];
  t?: ChatMessageTranslate;
  toggleDisclosure: (key: string) => void;
}

export function ChatInteractionEvents({
  copyMessageToClipboard,
  disclosureScopeKey,
  expandedDisclosureKeys,
  interactions,
  t,
  toggleDisclosure,
}: ChatInteractionEventsProps) {
  if (interactions.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-chat-interactions="true">
      {interactions.map((interaction) => {
        const disclosureKey = `${disclosureScopeKey}\u0001${interaction.id}`;
        return (
          <ChatInteractionEventRow
            key={interaction.id}
            copyMessageToClipboard={copyMessageToClipboard}
            interaction={interaction}
            isExpanded={expandedDisclosureKeys.has(disclosureKey)}
            onToggle={() => toggleDisclosure(disclosureKey)}
            t={t}
          />
        );
      })}
    </div>
  );
}
