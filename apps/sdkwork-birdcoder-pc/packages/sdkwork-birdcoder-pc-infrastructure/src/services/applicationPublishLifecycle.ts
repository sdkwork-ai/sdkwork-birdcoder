import { ApplicationPublishError } from './interfaces/IApplicationPublishService.ts';

function readErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'object' && error !== null) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return undefined;
}

function readHostDiagnostic(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const diagnostic = (error as Record<string, unknown>).diagnostic;
  if (typeof diagnostic !== 'object' || diagnostic === null) {
    return undefined;
  }
  const record = diagnostic as Record<string, unknown>;
  const parts = [record.stderr, record.stdout]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map((value) => value.trim());
  return parts.length === 0
    ? undefined
    : parts.join('\n').slice(0, 16 * 1024);
}

export function toApplicationPublishOperationError(
  code: ConstructorParameters<typeof ApplicationPublishError>[0],
  fallbackMessage: string,
  cause: unknown,
): ApplicationPublishError {
  if (cause instanceof ApplicationPublishError) {
    return cause;
  }
  return new ApplicationPublishError(
    code,
    readErrorMessage(cause) ?? fallbackMessage,
    {
      cause,
      details: readHostDiagnostic(cause),
    },
  );
}

export function readStagedArtifactIds(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const artifacts = (value as Record<string, unknown>).artifacts;
  if (!Array.isArray(artifacts)) {
    return [];
  }
  return artifacts.flatMap((artifact) => {
    if (typeof artifact !== 'object' || artifact === null) return [];
    const artifactId = (artifact as Record<string, unknown>).artifactId;
    return typeof artifactId === 'string' && artifactId.trim()
      ? [artifactId.trim()]
      : [];
  });
}

export async function settleApplicationPublishOperationWithin(
  operation: Promise<unknown>,
  timeoutMillis: number,
): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMillis);
    operation.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}
