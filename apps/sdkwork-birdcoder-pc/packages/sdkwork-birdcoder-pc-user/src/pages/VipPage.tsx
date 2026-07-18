/**
 * BirdCoder VIP / Token Plan page entry.
 *
 * This module preserves the `VipPage` export name for backward compatibility
 * with the shell's lazy-loading pipeline (`pageLoaders.ts` → `loadVipPage`),
 * while delegating to the new unified `BirdCoderTokenPlanPage` which uses
 * `@sdkwork/membership-pc-subscription/catalog`.
 */

import { useAuth } from '@sdkwork/birdcoder-pc-workbench';
import { BirdCoderTokenPlanPage } from '../token-plan/BirdCoderTokenPlanPage.tsx';

export interface VipPageProps {
  className?: string;
  messages?: Record<string, string>;
  onAuthenticationRequired?(): void;
}

function redirectToBirdCoderLogin(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const returnPath = window.location.hash || '#/vip';
  window.location.assign(`/#/auth/login?redirect=${encodeURIComponent(returnPath)}`);
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

export function VipPage({
  className,
  onAuthenticationRequired,
}: VipPageProps = {}) {
  const { user } = useAuth();

  if (!user) {
    (onAuthenticationRequired ?? redirectToBirdCoderLogin)();
    return (
      <main
        className={joinClassNames(
          'flex min-h-full items-center justify-center bg-[#0e0e11] px-6 text-zinc-100',
          className,
        )}
      >
        <section className="w-full max-w-sm space-y-2 text-center">
          <h1 className="text-lg font-semibold">Sign in required</h1>
          <p className="text-sm text-zinc-400">
            BirdCoder Token Plan details are available after authentication.
          </p>
        </section>
      </main>
    );
  }

  return (
    <BirdCoderTokenPlanPage
      className={joinClassNames('h-full', className)}
      onAuthenticationRequired={onAuthenticationRequired}
    />
  );
}

export { BirdCoderTokenPlanPage };
