import assert from 'node:assert/strict';

import type { AgentSessionItemView } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import {
  areChatTranscriptMessagePropsEqual,
  type ChatTranscriptMessageProps,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/ChatTranscriptMessage.tsx';
import type { ChatMessageRenderContext } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/types.ts';

const historicalMessage: AgentSessionItemView = {
  content: 'Stable historical response',
  createdAt: '2026-07-29T00:00:00.000Z',
  id: 'message-historical',
  role: 'assistant',
  sessionId: 'session-row-memo',
  turnId: 'turn-historical',
};
const activeMessage: AgentSessionItemView = {
  content: 'Streaming',
  createdAt: '2026-07-29T00:00:01.000Z',
  id: 'message-active',
  role: 'assistant',
  sessionId: 'session-row-memo',
  turnId: 'turn-active',
};
const copyMessageToClipboard = () => undefined;
const renderMarkdownContent = (content: string) => content;
const toggleDisclosure = () => undefined;

function createContext(
  allMessages: readonly AgentSessionItemView[],
  overrides: Partial<ChatMessageRenderContext> = {},
): ChatMessageRenderContext {
  return {
    actionTarget: null,
    allMessages,
    copyMessageToClipboard,
    environment: null,
    expandedDisclosureKeys: new Set(),
    index: 0,
    layout: 'main',
    renderMarkdownContent,
    sessionId: 'session-row-memo',
    showMessageActions: false,
    toggleDisclosure,
    turn: {
      isActiveTail: false,
      isEnd: true,
      isStart: true,
      key: 'turn:turn-historical',
      position: 'only',
    },
    ...overrides,
  };
}

function createProps(
  context: ChatMessageRenderContext,
  overrides: Partial<ChatTranscriptMessageProps> = {},
): ChatTranscriptMessageProps {
  return {
    activitySummary: null,
    context,
    index: 0,
    layout: 'main',
    message: historicalMessage,
    messageRenderKey: 'session-row-memo:message-historical',
    sessionId: 'session-row-memo',
    transcriptIndex: 0,
    ...overrides,
  };
}

const stableContext = createContext([historicalMessage, activeMessage]);
const streamedContext = createContext(
  [historicalMessage, { ...activeMessage, content: 'Streaming delta' }],
  {
    expandedDisclosureKeys: stableContext.expandedDisclosureKeys,
    turn: { ...stableContext.turn },
  },
);

assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(stableContext),
    createProps(streamedContext),
  ),
  true,
  'A streamed tail update must not rerender a stable historical transcript row.',
);

const nonOwningActionContext = createContext([historicalMessage, activeMessage], {
  actionTarget: { endIndex: 1, startIndex: 0 },
  expandedDisclosureKeys: stableContext.expandedDisclosureKeys,
  showMessageActions: false,
});
assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(nonOwningActionContext),
    createProps(createContext([
      historicalMessage,
      { ...activeMessage, content: 'Streaming action-range delta' },
    ], {
      actionTarget: { endIndex: 1, startIndex: 0 },
      expandedDisclosureKeys: stableContext.expandedDisclosureKeys,
      showMessageActions: false,
    })),
  ),
  true,
  'Only the terminal row that renders grouped actions may observe action-range updates.',
);

const historicalActionContext = createContext([historicalMessage, activeMessage], {
  actionTarget: { endIndex: 1, startIndex: 0 },
  expandedDisclosureKeys: stableContext.expandedDisclosureKeys,
  showMessageActions: true,
});
assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(historicalActionContext),
    createProps(createContext([
      historicalMessage,
      { ...activeMessage, content: 'Updated grouped response' },
    ], {
      actionTarget: { endIndex: 1, startIndex: 0 },
      expandedDisclosureKeys: stableContext.expandedDisclosureKeys,
      showMessageActions: true,
    })),
  ),
  false,
  'A row that owns grouped message actions must refresh when a message in its action range changes.',
);

assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(stableContext),
    createProps(stableContext, {
      message: { ...historicalMessage, content: 'Updated historical response' },
    }),
  ),
  false,
  'A row must rerender when its own source message changes.',
);

assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(stableContext),
    createProps(createContext([historicalMessage, activeMessage], {
      expandedDisclosureKeys: stableContext.expandedDisclosureKeys,
      turn: { ...stableContext.turn, isActiveTail: true },
    })),
  ),
  false,
  'A row must rerender when its turn presentation changes semantically.',
);

const unrelatedDisclosureContext = createContext([historicalMessage, activeMessage], {
  expandedDisclosureKeys: new Set([
    'session-row-memo\u0001turn-active\u0001reasoning',
  ]),
});
assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(stableContext),
    createProps(unrelatedDisclosureContext),
  ),
  true,
  'Expanding a disclosure in another turn must not rerender a stable historical row.',
);

const ownedDisclosureContext = createContext([historicalMessage, activeMessage], {
  expandedDisclosureKeys: new Set([
    'session-row-memo\u0001message-historical\u0001reasoning',
  ]),
});
assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(stableContext),
    createProps(ownedDisclosureContext),
  ),
  false,
  'A row must rerender when one of its own disclosure keys changes.',
);

const processDisclosureContext = createContext([historicalMessage, activeMessage], {
  expandedDisclosureKeys: new Set([
    'turn:turn-historical\u0001turn-process',
  ]),
  turnProcess: {
    isActive: false,
    itemCount: 0,
    items: [],
    key: 'turn:turn-historical',
    processBlockCount: 0,
    targetIndex: 0,
  },
});
assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(createContext([historicalMessage, activeMessage], {
      turnProcess: {
        isActive: false,
        itemCount: 0,
        items: [],
        key: 'turn:turn-historical',
        processBlockCount: 0,
        targetIndex: 0,
      },
    })),
    createProps(processDisclosureContext),
  ),
  false,
  'A row that owns a turn process must observe its process disclosure key.',
);

assert.equal(
  areChatTranscriptMessagePropsEqual(
    createProps(stableContext),
    createProps(stableContext, { transcriptIndex: 48 }),
  ),
  false,
  'A prepended row must refresh its global transcript index without changing its React identity.',
);

console.log('universal chat row memo contract passed.');
