import { handleBirdCoderSdkSessionAuthError } from './sdkSession.ts';

interface SdkErrorInterceptorClient {
  http?: {
    addErrorInterceptor(interceptor: (error: Error) => void | Promise<void>): unknown;
  };
}

export function bindBirdCoderSdkSessionErrorHandler<TClient>(
  client: TClient,
): TClient {
  // External app SDKs do not expose an HTTP error interceptor; only bind
  // when the client actually supports it.
  const candidate = client as SdkErrorInterceptorClient;
  if (candidate.http?.addErrorInterceptor) {
    candidate.http.addErrorInterceptor((error) => {
      handleBirdCoderSdkSessionAuthError(error);
    });
  }
  return client;
}
