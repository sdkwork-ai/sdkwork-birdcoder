import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';

export interface ChatTranscriptTurnPresentation {
  isActiveTail: boolean;
  isEnd: boolean;
  isStart: boolean;
  key: string;
  position: 'only' | 'start' | 'middle' | 'end';
}

function resolveCanonicalTurnKey(message: AgentSessionItemView): string {
  const turnId = message.turnId?.trim();
  return turnId ? `turn:${turnId}` : '';
}

export function buildChatTranscriptTurnPresentations(
  messages: readonly AgentSessionItemView[],
  isLive: boolean,
): readonly ChatTranscriptTurnPresentation[] {
  const keys: string[] = [];
  let fallbackTurnKey = 'turn:leading';

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const canonicalTurnKey = resolveCanonicalTurnKey(message);
    if (canonicalTurnKey) {
      keys.push(canonicalTurnKey);
      fallbackTurnKey = canonicalTurnKey;
      continue;
    }

    if (message.role === 'user') {
      fallbackTurnKey = `turn:user:${message.id.trim() || index}`;
    }
    keys.push(fallbackTurnKey);
  }

  return keys.map((key, index) => {
    const isStart = index === 0 || keys[index - 1] !== key;
    const isEnd = index === keys.length - 1 || keys[index + 1] !== key;
    return {
      isActiveTail: isLive && index === keys.length - 1,
      isEnd,
      isStart,
      key,
      position: isStart
        ? (isEnd ? 'only' : 'start')
        : (isEnd ? 'end' : 'middle'),
    };
  });
}
