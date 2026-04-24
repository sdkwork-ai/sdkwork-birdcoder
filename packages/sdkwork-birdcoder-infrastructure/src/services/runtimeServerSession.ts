import {
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
} from "@sdkwork/birdcoder-core";
import {
  createUserCenterStandardTokenHeaders,
  createUserCenterRuntimeSessionBinding,
  type UserCenterTokenBundle,
} from "@sdkwork/user-center-core-pc-react";

const runtimeServerSessionBinding = createUserCenterRuntimeSessionBinding({
  storagePlan: BIRDCODER_USER_CENTER_STORAGE_PLAN,
});
const runtimeServerTokenHeaders = createUserCenterStandardTokenHeaders(
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
);
const RUNTIME_SERVER_DEFAULT_TOKEN_TYPE = "Bearer";

function normalizeOptionalTokenValue(value: unknown): string | undefined {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  return normalizedValue || undefined;
}

function createRuntimeServerSyntheticTokenBundle(
  sessionId: string,
): UserCenterTokenBundle {
  return {
    accessToken: sessionId,
    authToken: sessionId,
    sessionToken: sessionId,
    tokenType: RUNTIME_SERVER_DEFAULT_TOKEN_TYPE,
  };
}

export function getRuntimeServerSessionHeaderName(): string {
  return runtimeServerSessionBinding.getSessionHeaderName();
}

export function readRuntimeServerSessionId(): string | null {
  return runtimeServerSessionBinding.readSessionToken();
}

export function readRuntimeServerTokenBundle(): UserCenterTokenBundle {
  return runtimeServerSessionBinding.readTokenBundle();
}

export function writeRuntimeServerSessionId(sessionId: string): string {
  const normalizedSessionId = runtimeServerSessionBinding.writeSessionToken(sessionId);
  runtimeServerSessionBinding.writeTokenBundle(
    createRuntimeServerSyntheticTokenBundle(normalizedSessionId),
  );
  return normalizedSessionId;
}

export function writeRuntimeServerTokenBundle(
  bundle: UserCenterTokenBundle,
): UserCenterTokenBundle {
  const sessionToken =
    normalizeOptionalTokenValue(bundle.sessionToken)
    ?? normalizeOptionalTokenValue(bundle.authToken)
    ?? normalizeOptionalTokenValue(bundle.accessToken);
  const authToken = normalizeOptionalTokenValue(bundle.authToken) ?? sessionToken;
  const accessToken = normalizeOptionalTokenValue(bundle.accessToken) ?? sessionToken;
  const refreshToken = normalizeOptionalTokenValue(bundle.refreshToken);
  const tokenType =
    normalizeOptionalTokenValue(bundle.tokenType)
    ?? (authToken || accessToken || sessionToken
      ? RUNTIME_SERVER_DEFAULT_TOKEN_TYPE
      : undefined);

  return runtimeServerSessionBinding.writeTokenBundle({
    ...(accessToken ? { accessToken } : {}),
    ...(authToken ? { authToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(sessionToken ? { sessionToken } : {}),
    ...(tokenType ? { tokenType } : {}),
  });
}

export function clearRuntimeServerSessionId(): void {
  runtimeServerSessionBinding.clearTokenBundle();
}

export function resolveRuntimeServerSessionHeaders(): Record<string, string | undefined> {
  const tokenBundle = runtimeServerSessionBinding.readTokenBundle();
  const sessionToken =
    normalizeOptionalTokenValue(tokenBundle.sessionToken)
    ?? runtimeServerSessionBinding.resolveProtectedToken();
  const authToken =
    normalizeOptionalTokenValue(tokenBundle.authToken)
    ?? normalizeOptionalTokenValue(tokenBundle.accessToken)
    ?? sessionToken
    ?? undefined;
  const accessToken =
    normalizeOptionalTokenValue(tokenBundle.accessToken)
    ?? normalizeOptionalTokenValue(tokenBundle.authToken)
    ?? sessionToken
    ?? undefined;
  const refreshToken = normalizeOptionalTokenValue(tokenBundle.refreshToken);
  const tokenType =
    normalizeOptionalTokenValue(tokenBundle.tokenType)
    ?? RUNTIME_SERVER_DEFAULT_TOKEN_TYPE;

  return {
    [runtimeServerSessionBinding.getSessionHeaderName()]: sessionToken,
    [runtimeServerTokenHeaders.accessTokenHeaderName]: accessToken,
    [runtimeServerTokenHeaders.authorizationHeaderName]:
      authToken ? `${tokenType} ${authToken}` : undefined,
    [runtimeServerTokenHeaders.refreshTokenHeaderName]: refreshToken,
  };
}
