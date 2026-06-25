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
            {import.meta.env.PROD ? this.props.t('app.unexpectedErrorReload') : this.state.error?.toString()}
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
