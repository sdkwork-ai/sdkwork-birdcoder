interface AuthLoadingStateProps {
  message?: string;
}

export function AuthLoadingState({
  message = 'Validating SDKWork session...',
}: AuthLoadingStateProps) {
  return (
    <div
      aria-live="polite"
      className="flex min-h-48 items-center justify-center px-6 text-sm text-muted-foreground"
      role="status"
    >
      {message}
    </div>
  );
}
