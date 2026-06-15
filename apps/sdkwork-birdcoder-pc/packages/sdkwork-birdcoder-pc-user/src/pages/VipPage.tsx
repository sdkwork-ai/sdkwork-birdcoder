import { useEffect, useMemo, useState } from 'react';
import {
  useAuth,
} from '@sdkwork/birdcoder-pc-commons';
import {
  createBirdCoderVipController,
  type BirdCoderVipState,
} from '../vip-surface.ts';

export interface VipPageProps {
  className?: string;
  messages?: Record<string, string>;
  onAuthenticationRequired?(): void;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

function createInitialState(): BirdCoderVipState {
  return {
    current: null,
    isAuthenticated: false,
    packageGroups: [],
  };
}

export function VipPage({
  className,
  onAuthenticationRequired,
}: VipPageProps = {}) {
  const { user } = useAuth();
  const [state, setState] = useState<BirdCoderVipState>(() => createInitialState());
  const [status, setStatus] = useState<LoadStatus>('idle');
  const controller = useMemo(
    () =>
      createBirdCoderVipController({
        user,
      }),
    [user],
  );

  useEffect(() => {
    if (!user) {
      setState(createInitialState());
      setStatus('idle');
      onAuthenticationRequired?.();
      return;
    }

    let active = true;
    setStatus('loading');
    controller
      .load()
      .then((nextState) => {
        if (active) {
          setState(nextState);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) {
          setState(createInitialState());
          setStatus('error');
        }
      });

    return () => {
      active = false;
    };
  }, [controller, onAuthenticationRequired, user]);

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
            BirdCoder membership details are available after authentication.
          </p>
        </section>
      </main>
    );
  }

  const current = state.current;

  return (
    <main
      className={joinClassNames(
        'min-h-full bg-zinc-50 px-6 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100',
        className,
      )}
    >
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2 border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            Commerce Membership
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Membership</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {user.email}
              </p>
            </div>
            <span className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium capitalize text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
              {current?.status ?? (status === 'loading' ? 'loading' : 'inactive')}
            </span>
          </div>
        </header>

        {status === 'error' && (
          <section className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            Membership data could not be loaded.
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Plan" value={current?.planName ?? 'Free'} />
          <Metric label="Points" value={current?.points ?? '0'} />
          <Metric label="Total spent" value={current?.totalSpent ?? '0'} />
          <Metric label="Remaining days" value={current?.remainingDays ?? '0'} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Package groups</h2>
            {status === 'loading' && (
              <div className="rounded-md border border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                Loading membership catalog.
              </div>
            )}
            {status !== 'loading' && state.packageGroups.length === 0 && (
              <div className="rounded-md border border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                No membership packages are available.
              </div>
            )}
            {state.packageGroups.map((group) => (
              <section
                className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                key={group.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{group.name}</h3>
                    {group.description && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {group.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">{group.sortWeight}</span>
                </div>
                {group.packages.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {group.packages.map((item) => (
                      <article
                        className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                        key={item.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-medium">{item.name}</h4>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {item.durationDays} days
                            </p>
                          </div>
                          <span className="text-sm font-semibold">{item.price}</span>
                        </div>
                        {item.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                              <span
                                className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                key={tag}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          <aside className="space-y-3">
            <h2 className="text-base font-semibold">Benefits</h2>
            {current?.benefits.length ? (
              current.benefits.map((benefit) => (
                <div
                  className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                  key={benefit.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{benefit.name}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {benefit.claimed ? 'Claimed' : 'Open'}
                    </span>
                  </div>
                  {benefit.description && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {benefit.description}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-md border border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                No membership benefits are active.
              </div>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-semibold">{value}</p>
    </div>
  );
}
