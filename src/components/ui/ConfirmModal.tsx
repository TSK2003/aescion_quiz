import React from 'react';
import { Button } from './Button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="pointer-events-auto w-full max-w-md"
            >
              <Card className="shadow-2xl border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/10 text-destructive rounded-full">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{title}</CardTitle>
                      <CardDescription className="mt-1.5">{description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardFooter className="flex justify-end gap-3 pt-4 border-t bg-muted/20">
                  <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                    {cancelText}
                  </Button>
                  <Button variant="destructive" onClick={onConfirm} isLoading={isLoading}>
                    {confirmText}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
