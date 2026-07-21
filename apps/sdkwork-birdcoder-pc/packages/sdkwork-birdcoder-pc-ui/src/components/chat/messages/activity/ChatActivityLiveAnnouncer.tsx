import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';
import {
  buildChatCommandLifecycleSnapshot,
  resolveChatCommandLiveAnnouncement,
  type ChatCommandLifecycleSnapshot,
  type ChatCommandLiveAnnouncement,
} from './chatCommandLifecycle.ts';

interface ChatActivityLiveAnnouncerProps {
  engineId?: string;
  isActive: boolean;
  isLive: boolean;
  messages: readonly BirdCoderChatMessage[];
  sessionId: string;
  t: ChatMessageTranslate;
}

interface ChatActivityAnnouncementScope {
  sessionId: string;
  snapshot: ChatCommandLifecycleSnapshot;
}

interface ChatActivityAnnouncementState {
  id: number;
  label: string;
}

function resolveChatActivityAnnouncementLabel(
  announcement: ChatCommandLiveAnnouncement,
  t: ChatMessageTranslate,
): string {
  if (announcement.kind === 'running') {
    return t('chat.commandsRunningSummary', { count: announcement.count });
  }
  if (announcement.kind === 'reply' && announcement.count === 1) {
    return t('chat.commandNeedsReply');
  }
  if (announcement.kind === 'approval' && announcement.count === 1) {
    return t('chat.commandNeedsApproval');
  }

  return t('chat.commandsWaitingSummary', { count: announcement.count });
}

export const ChatActivityLiveAnnouncer = memo(function ChatActivityLiveAnnouncer({
  engineId,
  isActive,
  isLive,
  messages,
  sessionId,
  t,
}: ChatActivityLiveAnnouncerProps) {
  const [announcement, setAnnouncement] = useState<ChatActivityAnnouncementState | null>(null);
  const announcementScopeRef = useRef<ChatActivityAnnouncementScope | null>(null);
  const announcementIdRef = useRef(0);
  const nextSnapshot = useMemo(
    () => buildChatCommandLifecycleSnapshot(messages, engineId),
    [engineId, messages],
  );

  useEffect(() => {
    const normalizedSessionId = sessionId.trim();
    const previousScope = announcementScopeRef.current;
    announcementScopeRef.current = {
      sessionId: normalizedSessionId,
      snapshot: nextSnapshot,
    };

    if (
      !previousScope
      || previousScope.sessionId !== normalizedSessionId
      || !isActive
      || !isLive
    ) {
      setAnnouncement(null);
      return;
    }

    const nextAnnouncement = resolveChatCommandLiveAnnouncement(
      previousScope.snapshot,
      nextSnapshot,
    );
    if (!nextAnnouncement) {
      return;
    }

    announcementIdRef.current += 1;
    setAnnouncement({
      id: announcementIdRef.current,
      label: resolveChatActivityAnnouncementLabel(nextAnnouncement, t),
    });
  }, [isActive, isLive, nextSnapshot, sessionId, t]);

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="sr-only"
      data-chat-activity-live-announcer="true"
      role="status"
    >
      {announcement ? <span key={announcement.id}>{announcement.label}</span> : null}
    </div>
  );
});
