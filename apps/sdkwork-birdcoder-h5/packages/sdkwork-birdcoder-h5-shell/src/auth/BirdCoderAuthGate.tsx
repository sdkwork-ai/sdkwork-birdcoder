import type { ReactNode } from 'react';
import { AuthGate } from '@sdkwork/birdcoder-pc-auth/AuthGate';
import { getBirdCoderIamRuntime } from '@sdkwork/birdcoder-h5-core';

interface BirdCoderAuthGateProps {
  children: ReactNode;
}

export function BirdCoderAuthGate({ children }: BirdCoderAuthGateProps) {
  // The shared auth renderer intentionally accepts a looser service contract
  // than the generated IAM runtime. The adapter is type-only; runtime behavior
  // remains the existing BirdCoder IAM runtime and session bridge.
  const getRuntime = getBirdCoderIamRuntime as unknown as Parameters<typeof AuthGate>[0]['getRuntime'];
  return <AuthGate getRuntime={getRuntime}>{children}</AuthGate>;
}
