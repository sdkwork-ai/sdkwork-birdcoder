import { useEffect, useMemo, useRef, useState } from 'react';
import { isBlank } from '@sdkwork/utils/string';
import {
  buildDriveMediaResourceContentBlock,
  ensureBirdCoderMobileChatConversation,
  listBirdCoderMobileChatMessages,
  resolveChatAttachmentUploadProfile,
  sendBirdCoderMobileChatMessage,
  uploadBirdCoderChatAttachmentToDrive,
} from '@sdkwork/birdcoder-h5-core/sdk';
import { createChatMessage } from '../index.ts';
import { resolveChatPageMessages } from '../messages/chatPageMessages.ts';
import { useBirdCoderSettings } from '../state/settingsState.tsx';

export function ChatPage() {
  const { state: settings } = useBirdCoderSettings();
  const messagesCopy = useMemo(
    () => resolveChatPageMessages(settings.language),
    [settings.language],
  );
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => [] as ReturnType<typeof createChatMessage>[]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = useMemo(
    () => !isBlank(input) && !isSending && conversationId != null,
    [conversationId, input, isSending],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadConversation() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const id = await ensureBirdCoderMobileChatConversation();
        const history = await listBirdCoderMobileChatMessages(id);
        if (cancelled) {
          return;
        }
        setConversationId(id);
        setMessages(
          history.map((message) => ({
            ...createChatMessage(message.role, message.content, message.id),
            createdAt: message.createdAt,
          })),
        );
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
    void loadConversation();
    return () => {
      cancelled = true;
    };
  }, [messagesCopy.loadHistoryFailed]);

  async function persistUserMessage(content: string) {
    if (!conversationId) {
      throw new Error('Chat conversation is not ready.');
    }
    await sendBirdCoderMobileChatMessage(conversationId, content);
    const history = await listBirdCoderMobileChatMessages(conversationId);
    setMessages(
      history.map((message) => ({
        ...createChatMessage(message.role, message.content, message.id),
        createdAt: message.createdAt,
      })),
    );
  }

  async function handleAttachmentSelected(fileList: FileList | null) {
    const file = fileList?.item(0);
    if (!file || !conversationId) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const profile = resolveChatAttachmentUploadProfile(file);
      const uploadResult = await uploadBirdCoderChatAttachmentToDrive({
        file,
        profile,
      });
      const content = `${file.name}${buildDriveMediaResourceContentBlock(
        uploadResult.mediaResource,
        uploadResult.previewUrl,
      )}`.trim();
      await persistUserMessage(content);
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
        {messages.map((message) => (
          <article key={message.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{message.role}</div>
            <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
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
          if (!content || !conversationId) {
            return;
          }
          setIsSending(true);
          void persistUserMessage(content)
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
          disabled={isUploading || isLoading || conversationId == null}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
        >
          {isUploading ? messagesCopy.uploading : messagesCopy.attach}
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={messagesCopy.inputPlaceholder}
          disabled={isLoading || conversationId == null}
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
