import type { ReactNode } from 'react';
import { AuthGate } from '@sdkwork/birdcoder-pc-auth';
import { getBirdCoderIamRuntime } from '@sdkwork/birdcoder-pc-infrastructure/services/iamRuntime';

interface BirdCoderAuthGateProps {
  children: ReactNode;
}

export function BirdCoderAuthGate({ children }: BirdCoderAuthGateProps) {
  return <AuthGate getRuntime={getBirdCoderIamRuntime}>{children}</AuthGate>;
}
