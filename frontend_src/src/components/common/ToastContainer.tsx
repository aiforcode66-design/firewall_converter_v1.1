import React from 'react';
import { CheckCircle2, XCircle, X, LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

export interface Toast {
  id: number | string;
  message: string;
  type: 'success' | 'error';
}

interface ToastProps {
  id: number | string;
  message: string;
  type: 'success' | 'error';
  onRemove: (id: number | string) => void;
}

const Toast: React.FC<ToastProps> = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ id, message, type, onRemove }, ref) => {
    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, x: 50, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={clsx(
          "flex items-center gap-3 p-4 bg-gray-800/95 backdrop-blur rounded shadow-xl text-sm text-gray-200 pointer-events-auto relative pr-8 border-l-4",
          type === 'success' ? "border-emerald-500" : "border-rose-500"
        )}
      >
        {type === 'success' ? (
          <CheckCircle2 className="text-emerald-400 w-5 h-5 flex-shrink-0" />
        ) : (
          <XCircle className="text-rose-400 w-5 h-5 flex-shrink-0" />
        )}
        <span className="font-medium">{message}</span>

        <button
          onClick={() => onRemove(id)}
          className="absolute right-2 top-2 p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-700/50 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </motion.div>
    );
  }
);

Toast.displayName = 'Toast';

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: number | string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onRemove={removeToast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
