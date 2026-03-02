import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'danger';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
}

interface ToastContextType {
  pushToast: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toastStyles: Record<ToastType, string> = {
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  success: 'border-green-500/30 bg-green-500/10 text-green-200',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
  danger: 'border-red-500/30 bg-red-500/10 text-red-200',
};

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs = 3200) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, message, type, durationMs }]);
      window.setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast]
  );

  const value = useMemo<ToastContextType>(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 w-[min(92vw,360px)]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-3 py-2 text-sm shadow-xl backdrop-blur-sm animate-slide-up ${toastStyles[toast.type]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
