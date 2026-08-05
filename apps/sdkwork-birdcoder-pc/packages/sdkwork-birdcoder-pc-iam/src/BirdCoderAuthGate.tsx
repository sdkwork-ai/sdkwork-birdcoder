import type { ReactNode } from 'react';
import { AuthGate, type LoadBirdCoderAuthPageOptions } from '@sdkwork/birdcoder-pc-auth';
import { getBirdCoderIamRuntime } from '@sdkwork/birdcoder-pc-infrastructure/services/iamRuntime';

interface BirdCoderAuthGateProps {
  children: ReactNode;
}

export function BirdCoderAuthGate({ children }: BirdCoderAuthGateProps) {
  return <AuthGate getRuntime={getBirdCoderIamRuntime as unknown as LoadBirdCoderAuthPageOptions['getRuntime']}>{children}</AuthGate>;
}
