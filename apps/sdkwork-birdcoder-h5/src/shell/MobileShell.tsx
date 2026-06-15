import { type ReactNode } from 'react';

interface MobileShellProps {
  children: ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between px-4 h-12">
          <h1 className="text-lg font-semibold">BirdCoder</h1>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <nav className="sticky bottom-0 bg-background border-t">
        <div className="flex justify-around h-14">
          <button className="flex flex-col items-center justify-center flex-1">
            <span className="text-xs">Chat</span>
          </button>
          <button className="flex flex-col items-center justify-center flex-1">
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
