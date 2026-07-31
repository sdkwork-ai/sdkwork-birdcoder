import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ChatTurnRenderBoundaryProps {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKey: unknown;
}

interface ChatTurnRenderBoundaryState {
  error: Error | null;
}

export class ChatTurnRenderBoundary extends Component<
  ChatTurnRenderBoundaryProps,
  ChatTurnRenderBoundaryState
> {
  state: ChatTurnRenderBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ChatTurnRenderBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(previousProps: ChatTurnRenderBoundaryProps): void {
    if (
      this.state.error
      && !Object.is(previousProps.resetKey, this.props.resetKey)
    ) {
      this.setState({ error: null });
    }
  }

  private readonly retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    return this.state.error
      ? this.props.fallback(this.retry)
      : this.props.children;
  }
}
