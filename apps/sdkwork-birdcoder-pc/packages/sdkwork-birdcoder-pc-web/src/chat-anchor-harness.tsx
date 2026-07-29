import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import '@sdkwork/birdcoder-pc-shell/styles';
import { ChatTranscriptAnchorRail } from '../../sdkwork-birdcoder-pc-ui/src/components/ChatTranscriptAnchorRail.tsx';

const messages = [
  ['user-1', 'user', 'First anchor input'],
  ['assistant-1', 'assistant', 'First anchor output'],
  ['user-2', 'user', 'Second anchor input'],
  ['assistant-2', 'assistant', 'Second anchor output'],
  ['user-3', 'user', 'Third anchor input'],
  ['assistant-3', 'assistant', 'Third anchor output'],
] .map(([id, role, content], index) => ({
  content,
  createdAt: `2026-07-29T00:00:0${index}.000Z`,
  id,
  role,
  sessionId: 'anchor-harness',
})) as AgentSessionItemView[];

function Harness() {
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');

  return (
    <main className="flex min-h-screen items-stretch bg-[#151515] p-8 text-white">
      <section
        aria-label="Conversation harness"
        className="relative min-h-[720px] flex-1 overflow-hidden border border-white/10 bg-[#0e0e11]"
      >
        <div className="h-[590px] overflow-y-auto px-16 py-8">
          <div className="mx-auto max-w-3xl space-y-8">
            {messages.map((message) => (
              <article key={message.id} className="text-sm text-gray-300">
                {message.content}
              </article>
            ))}
          </div>
        </div>
        <ChatTranscriptAnchorRail
          canUseInput
          copyInputLabel="Copy input"
          copyOutputLabel="Copy output"
          inputLabel="Input"
          label="Conversation map"
          messages={messages}
          onCopyContent={(content) => void navigator.clipboard.writeText(content)}
          onSelectTurn={() => undefined}
          onUseInput={(content) => {
            setInputValue(content);
            window.requestAnimationFrame(() => composerRef.current?.focus());
          }}
          outputLabel="Output"
          turnLabel="Go to conversation turn"
          useInputLabel="Use in composer"
        />
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#151515] p-5">
          <textarea
            ref={composerRef}
            aria-label="Composer"
            className="h-20 w-full resize-none rounded border border-white/10 bg-[#202022] p-3 text-sm text-white outline-none focus:border-blue-400"
            onChange={(event) => setInputValue(event.target.value)}
            value={inputValue}
          />
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
