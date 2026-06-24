import { useMemo, useState } from 'react';
import { createChatMessage } from '../index.ts';

export function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => [
    createChatMessage('assistant', 'BirdCoder H5 chat is connected to the mobile shell route catalog.'),
  ]);

  const canSend = useMemo(() => input.trim().length > 0, [input]);

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-4">
      <div>
        <h2 className="text-base font-semibold">Chat</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mobile chat surface wired through the H5 route catalog and shell router.
        </p>
      </div>
      <div className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-3">
        {messages.map((message) => (
          <article key={message.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{message.role}</div>
            <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const content = input.trim();
          if (!content) {
            return;
          }
          setMessages((current) => [...current, createChatMessage('user', content)]);
          setInput('');
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message BirdCoder"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
