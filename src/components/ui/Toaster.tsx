import React from 'react';
import { useToastStore } from '../../store/useToastStore';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Toaster: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none w-full max-w-sm sm:max-w-md">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            layout
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md ${
              toast.type === 'success' ? 'bg-success/10 text-success-foreground border-success/20 dark:bg-success/20' :
              toast.type === 'error' ? 'bg-destructive/10 text-destructive-foreground border-destructive/20 dark:bg-destructive/20' :
              toast.type === 'warning' ? 'bg-warning/10 text-warning-foreground border-warning/20 dark:bg-warning/20' :
              'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-success" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-warning" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-primary" />}
            </div>
            
            <div className="flex-1 flex flex-col gap-1">
              <h4 className={`text-sm font-semibold ${
                toast.type === 'success' ? 'text-success dark:text-green-400' :
                toast.type === 'error' ? 'text-destructive dark:text-red-400' :
                toast.type === 'warning' ? 'text-warning dark:text-orange-400' :
                'text-primary dark:text-blue-400'
              }`}>
                {toast.title}
              </h4>
              {toast.description && (
                <p className="text-sm opacity-90 leading-snug">{toast.description}</p>
              )}
            </div>
            
            <button 
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
