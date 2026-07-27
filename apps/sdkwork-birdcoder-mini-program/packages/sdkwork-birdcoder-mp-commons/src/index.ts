export type BirdCoderViewStateKind =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'permission-denied'
  | 'unavailable'
  | 'error';

export interface BirdCoderViewState<TData> {
  readonly kind: BirdCoderViewStateKind;
  readonly data?: TData;
  readonly message?: string;
  readonly retryable: boolean;
}

export function createLoadingState<TData>(): BirdCoderViewState<TData> {
  return { kind: 'loading', retryable: false };
}
