import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { FolderSearch } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  title, 
  description, 
  actionLabel, 
  onAction,
  icon
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-xl bg-muted/20"
    >
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
        {icon || <FolderSearch className="w-8 h-8" />}
      </div>
      <h3 className="text-xl font-bold tracking-tight mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
};
