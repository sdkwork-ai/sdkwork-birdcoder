/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  t: (key: string) => string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

type SurfaceErrorBoundaryProps = ErrorBoundaryProps & {
  onRecover: () => void;
  surface: string;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-full w-full bg-[#0e0e11] text-white items-center justify-center p-8">
          <AlertTriangle size={48} className="text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">{this.props.t('app.somethingWentWrong')}</h1>
          <p className="text-gray-400 mb-6 text-center max-w-md">
            {this.props.t('app.unexpectedError')}
          </p>
          <div className="bg-[#18181b] p-4 rounded-lg border border-white/10 w-full max-w-2xl overflow-auto text-sm text-red-400 font-mono">
            {(import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD
              ? this.props.t('app.unexpectedErrorReload')
              : this.state.error?.toString()}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {this.props.t('app.reloadApplication')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundaryWithTranslation = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  return <ErrorBoundary t={t}>{children}</ErrorBoundary>;
};

class SurfaceErrorBoundary extends Component<SurfaceErrorBoundaryProps, ErrorBoundaryState> {
  declare props: SurfaceErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: SurfaceErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught ${this.props.surface} surface error:`, error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#0e0e11] p-8 text-white">
        <AlertTriangle size={40} className="mb-4 text-red-500" />
        <h2 className="mb-2 text-xl font-semibold">
          {this.props.t('app.somethingWentWrong')}
        </h2>
        <p className="mb-5 max-w-md text-center text-sm text-gray-400">
          {this.props.t('app.unexpectedError')}
        </p>
        {(import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD ? null : (
          <div className="mb-5 max-h-40 w-full max-w-2xl overflow-auto border border-white/10 bg-[#18181b] p-3 font-mono text-xs text-red-400">
            {this.state.error?.toString()}
          </div>
        )}
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          onClick={this.props.onRecover}
        >
          {this.props.t('common.backToApp')}
        </button>
      </div>
    );
  }
}

export function SurfaceErrorBoundaryWithTranslation({
  children,
  onRecover,
  surface,
}: {
  children: React.ReactNode;
  onRecover: () => void;
  surface: string;
}) {
  const { t } = useTranslation();
  return (
    <SurfaceErrorBoundary onRecover={onRecover} surface={surface} t={t}>
      {children}
    </SurfaceErrorBoundary>
  );
}
