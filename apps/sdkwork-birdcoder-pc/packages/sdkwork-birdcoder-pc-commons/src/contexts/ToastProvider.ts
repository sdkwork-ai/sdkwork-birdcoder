import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);
const MAX_VISIBLE_TOASTS = 4;
const TOAST_AUTO_DISMISS_MS = 3000;

function createToastId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const toastsRef = useRef<Toast[]>([]);

  const publishToasts = useCallback((nextToasts: Toast[]) => {
    toastsRef.current = nextToasts;
    setToasts(nextToasts);
  }, []);

  const clearToastTimeout = useCallback((id: string) => {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (!timeoutId) {
      return;
    }

    clearTimeout(timeoutId);
    toastTimeoutsRef.current.delete(id);
  }, []);

  const removeToast = useCallback((id: string) => {
    clearToastTimeout(id);
    const nextToasts = toastsRef.current.filter((toast) => toast.id !== id);
    publishToasts(nextToasts);
  }, [clearToastTimeout, publishToasts]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = createToastId();
    const nextToast = { id, message, type };
    const previousToasts = [...toastsRef.current, nextToast];
    const overflowCount = Math.max(0, previousToasts.length - MAX_VISIBLE_TOASTS);
    previousToasts.slice(0, overflowCount).forEach((toast) => clearToastTimeout(toast.id));
    publishToasts(previousToasts.slice(-MAX_VISIBLE_TOASTS));

    const timeoutId = setTimeout(() => {
      removeToast(id);
    }, TOAST_AUTO_DISMISS_MS);
    toastTimeoutsRef.current.set(id, timeoutId);
  }, [clearToastTimeout, publishToasts, removeToast]);

  useEffect(() => {
    return () => {
      for (const timeoutId of toastTimeoutsRef.current.values()) {
        clearTimeout(timeoutId);
      }

      toastTimeoutsRef.current.clear();
      toastsRef.current = [];
    };
  }, []);

  return React.createElement(
    ToastContext.Provider,
    { value: { addToast } },
    children,
    React.createElement(
      'div',
      { className: 'fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none' },
      ...toasts.map((toast) =>
        React.createElement(
          'div',
          {
            key: toast.id,
            className:
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-white/10 bg-[#18181b] text-sm font-medium text-gray-200 animate-in slide-in-from-bottom-5 fade-in duration-300',
          },
          toast.type === 'success'
            ? React.createElement(CheckCircle, { size: 16, className: 'text-emerald-500' })
            : null,
          toast.type === 'error'
            ? React.createElement(AlertCircle, { size: 16, className: 'text-red-500' })
            : null,
          toast.type === 'info'
            ? React.createElement(Info, { size: 16, className: 'text-blue-500' })
            : null,
          React.createElement('span', null, toast.message),
          React.createElement(
            'button',
            {
              onClick: () => removeToast(toast.id),
              className: 'ml-2 text-gray-500 hover:text-gray-300 transition-colors',
            },
            React.createElement(X, { size: 14 }),
          ),
        ),
      ),
    ),
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
