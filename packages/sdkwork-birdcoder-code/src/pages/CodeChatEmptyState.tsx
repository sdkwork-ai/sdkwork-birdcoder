import { Zap } from 'lucide-react';

export function CodeChatEmptyState() {
  return (
    <div className="flex min-h-full w-full items-center justify-center pb-32">
      <div className="mx-auto mb-6 flex w-full max-w-2xl flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mb-6 border border-white/5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-500">
          <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
          <Zap size={36} className="text-blue-400 relative z-10" />
        </div>
        <h1
          className="text-3xl font-semibold text-white mb-3 tracking-tight animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
          style={{ animationDelay: '50ms' }}
        >
          What do you want to build?
        </h1>
        <p
          className="text-[15px] text-gray-400 leading-relaxed animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
          style={{ animationDelay: '100ms' }}
        >
          Describe your idea, ask a question, or paste some code to get started. I can help you
          write code, debug errors, or build entire features.
        </p>
      </div>
    </div>
  );
}
