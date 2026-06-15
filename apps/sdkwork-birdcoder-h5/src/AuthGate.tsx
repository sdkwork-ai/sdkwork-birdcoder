import { type ReactNode } from 'react';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  // Auth gate follows APP_SDK_INTEGRATION_SPEC.md
  // Appbase IAM runtime owns login/session/refresh/logout
  return <>{children}</>;
}
