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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      try {
        const session = await ensureBirdCoderAssistantSession();
        const latestPage = Math.max(
          1,
          Math.ceil(session.itemCount / DEFAULT_LIST_PAGE_SIZE),
        );
        const items = await listBirdCoderAssistantSessionItems(session.sessionId, {
          page: latestPage,
          pageSize: DEFAULT_LIST_PAGE_SIZE,
        });
        if (cancelled) {
          return;
        }
        setSessionId(session.sessionId);
        setSessionItems(items);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : messagesCopy.loadHistoryFailed;
        setLoadError(isBlank(message) ? messagesCopy.loadHistoryFailed : message);
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
  }, [messagesCopy.loadHistoryFailed]);

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Drive upload failed.';
      setUploadError(isBlank(message) ? 'Drive upload failed.' : message);
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
        {sessionItems.map((item) => (
          <article key={item.itemId} className="rounded-xl bg-muted px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.role}</div>
            <p className="mt-1 whitespace-pre-wrap">{item.content}</p>
          </article>
        ))}
      </div>
      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
      {uploadError ? (
        <p className="text-sm text-destructive" role="alert">
          {uploadError}
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
          setIsSending(true);
          void submitUserTurn(content)
            .then(() => {
              setInput('');
            })
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : messagesCopy.sendFailed;
              setLoadError(isBlank(message) ? messagesCopy.sendFailed : message);
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
