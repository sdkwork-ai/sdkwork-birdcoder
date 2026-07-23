import { handleBirdCoderSdkSessionAuthError } from './sdkSession.ts';

interface SdkErrorInterceptorClient {
  http: {
    addErrorInterceptor(interceptor: (error: Error) => void | Promise<void>): unknown;
  };
}

export function bindBirdCoderSdkSessionErrorHandler<TClient extends SdkErrorInterceptorClient>(
  client: TClient,
): TClient {
  client.http.addErrorInterceptor((error) => {
    handleBirdCoderSdkSessionAuthError(error);
  });
  return client;
}
