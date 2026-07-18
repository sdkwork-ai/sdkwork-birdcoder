import { useEffect } from 'react';
import {
  useAuth,
} from '@sdkwork/birdcoder-pc-workbench';

export interface UserPageProps {
  className?: string;
  onAuthenticationRequired?(): void;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

export function UserPage({
  className,
  onAuthenticationRequired,
}: UserPageProps = {}) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      onAuthenticationRequired?.();
    }
  }, [onAuthenticationRequired, user]);

  if (!user) {
    return (
      <main
        className={joinClassNames(
          'flex min-h-full items-center justify-center bg-zinc-50 px-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100',
          className,
        )}
      >
        <section className="w-full max-w-sm space-y-2 text-center">
          <h1 className="text-lg font-semibold">Sign in required</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            BirdCoder account details are available after authentication.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      className={joinClassNames(
        'min-h-full bg-zinc-50 px-6 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100',
        className,
      )}
    >
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-zinc-900 text-lg font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">
            {(user.name || user.email || user.id).trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{user.name || user.email}</h1>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
          </div>
        </header>
      </section>
    </main>
  );
}
