import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './Button';

export const BackButton: React.FC<{ className?: string }> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      // Fallback if no history
      if (location.pathname.startsWith('/admin')) {
        navigate('/admin/dashboard');
      } else if (location.pathname.startsWith('/participant')) {
        navigate('/participant/dashboard');
      } else {
        navigate('/');
      }
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleBack} 
      className={`gap-1 sm:gap-2 px-2 sm:px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/80 ${className || ''}`}
    >
      <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="hidden sm:inline">Back</span>
    </Button>
  );
};
