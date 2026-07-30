import { useEffect, useMemo, useRef, useState } from 'react';
import { isBlank } from '@sdkwork/utils/string';
import {
  ensureBirdCoderAssistantSession,
  listBirdCoderAssistantSessionItems,
  resolveAgentSessionAttachmentUploadProfile,
  submitBirdCoderAssistantTurn,
  type BirdCoderAgentSessionItemView,
  type BirdCoderAssistantTurnOptions,
  uploadBirdCoderAgentSessionAttachmentToDrive,
} from '@sdkwork/birdcoder-h5-core/sdk';
import { DEFAULT_LIST_PAGE_SIZE } from '@sdkwork/utils/pagination';
import { resolveChatPageMessages } from '../messages/chatPageMessages.ts';
import { useBirdCoderSettings } from '../state/settingsState.tsx';

function mergeSessionItems(
  current: readonly BirdCoderAgentSessionItemView[],
  incoming: readonly BirdCoderAgentSessionItemView[],
): BirdCoderAgentSessionItemView[] {
  const itemsById = new Map(current.map((item) => [item.itemId, item]));
  for (const item of incoming) {
    itemsById.set(item.itemId, item);
  }
  return [...itemsById.values()].sort((left, right) => {
    const leftSequence = BigInt(left.sequence);
    const rightSequence = BigInt(right.sequence);
    return leftSequence < rightSequence ? -1 : leftSequence > rightSequence ? 1 : 0;
  });
}

export function ChatPage() {
  const { state: settings } = useBirdCoderSettings();
  const messagesCopy = useMemo(
    () => resolveChatPageMessages(settings.language),
    [settings.language],
  );
  const [input, setInput] = useState('');
  const [sessionItems, setSessionItems] = useState<BirdCoderAgentSessionItemView[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [earlierLoadError, setEarlierLoadError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasEarlierItems, setHasEarlierItems] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = useMemo(
    () => !isBlank(input) && !isSending && sessionId != null,
    [input, isSending, sessionId],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      setIsLoading(true);
      setLoadError(null);
      setSessionId(null);
      setSessionItems([]);
      setNextCursor(null);
      setHasEarlierItems(false);
      try {
        const session = await ensureBirdCoderAssistantSession();
        const page = await listBirdCoderAssistantSessionItems(session.sessionId, {
          pageSize: DEFAULT_LIST_PAGE_SIZE,
        });
        if (cancelled) {
          return;
        }
        setSessionId(session.sessionId);
        setSessionItems(page.items);
        setNextCursor(page.pageInfo.nextCursor);
        setHasEarlierItems(page.pageInfo.hasMore);
      } catch {
        if (cancelled) {
          return;
        }
        setLoadError(messagesCopy.loadHistoryFailed);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, messagesCopy.loadHistoryFailed]);

  async function handleLoadEarlier() {
    if (!sessionId || !hasEarlierItems || !nextCursor || isLoadingEarlier) {
      return;
    }
    setEarlierLoadError(null);
    setIsLoadingEarlier(true);
    try {
      const page = await listBirdCoderAssistantSessionItems(sessionId, {
        cursor: nextCursor,
        pageSize: DEFAULT_LIST_PAGE_SIZE,
      });
      setSessionItems((current) => mergeSessionItems(current, page.items));
      setNextCursor(page.pageInfo.nextCursor);
      setHasEarlierItems(page.pageInfo.hasMore);
    } catch {
      setEarlierLoadError(messagesCopy.loadEarlierFailed);
    } finally {
      setIsLoadingEarlier(false);
    }
  }

  async function submitUserTurn(
    content: string,
    driveRefs?: BirdCoderAssistantTurnOptions['driveRefs'],
  ) {
    if (!sessionId) {
      throw new Error('Assistant session is not ready.');
    }
    const completedItems = await submitBirdCoderAssistantTurn(sessionId, content, {
      driveRefs,
    });
    setSessionItems((current) => mergeSessionItems(current, completedItems));
  }

  async function handleAttachmentSelected(fileList: FileList | null) {
    const file = fileList?.item(0);
    if (!file || !sessionId) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const profile = resolveAgentSessionAttachmentUploadProfile(file);
      const uploadResult = await uploadBirdCoderAgentSessionAttachmentToDrive({
        file,
        profile,
        sessionId,
      });
      await submitUserTurn(file.name, [uploadResult.driveRef]);
    } catch {
      setUploadError(messagesCopy.uploadFailed);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-4">
      <div>
        <h2 className="text-base font-semibold">{messagesCopy.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messagesCopy.description}
        </p>
      </div>
      <div className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{messagesCopy.loadingHistory}</p>
        ) : null}
        {!isLoading && hasEarlierItems && !earlierLoadError ? (
          <button
            type="button"
            disabled={isLoadingEarlier}
            onClick={() => void handleLoadEarlier()}
            className="self-center rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            {isLoadingEarlier ? messagesCopy.loadingEarlier : messagesCopy.loadEarlier}
          </button>
        ) : null}
        {earlierLoadError ? (
          <div className="flex items-center justify-center gap-2 text-sm text-destructive" role="alert">
            <span>{earlierLoadError}</span>
            <button
              type="button"
              onClick={() => void handleLoadEarlier()}
              className="rounded-xl border border-destructive px-3 py-1 text-sm"
            >
              {messagesCopy.retry}
            </button>
          </div>
        ) : null}
        {!isLoading && !loadError && sessionItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messagesCopy.emptyHistory}</p>
        ) : null}
        {sessionItems.map((item) => (
          <article key={item.itemId} className="rounded-xl bg-muted px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.role}</div>
            <p className="mt-1 whitespace-pre-wrap">{item.content}</p>
          </article>
        ))}
      </div>
      {loadError ? (
        <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            className="rounded-xl border border-destructive px-3 py-1 text-sm"
          >
            {messagesCopy.retry}
          </button>
        </div>
      ) : null}
      {uploadError ? (
        <p className="text-sm text-destructive" role="alert">
          {uploadError}
        </p>
      ) : null}
      {sendError ? (
        <p className="text-sm text-destructive" role="alert">
          {sendError}
        </p>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const content = input.trim();
          if (!content || !sessionId) {
            return;
          }
          setSendError(null);
          setIsSending(true);
          void submitUserTurn(content)
            .then(() => {
              setInput('');
            })
            .catch(() => {
              setSendError(messagesCopy.sendFailed);
            })
            .finally(() => {
              setIsSending(false);
            });
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            void handleAttachmentSelected(event.target.files);
          }}
        />
        <button
          type="button"
          disabled={isUploading || isLoading || sessionId == null}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
        >
          {isUploading ? messagesCopy.uploading : messagesCopy.attach}
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={messagesCopy.inputPlaceholder}
          disabled={isLoading || sessionId == null}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isSending ? messagesCopy.sending : messagesCopy.send}
        </button>
      </form>
    </div>
  );
}
