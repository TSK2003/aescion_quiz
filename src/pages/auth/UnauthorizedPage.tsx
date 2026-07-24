import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { auth } from '../../config/firebase';
import { signOut } from 'firebase/auth';

export const UnauthorizedPage: React.FC = () => {
  const { user, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/login');
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'participant' && user.status === 'approved') {
        navigate('/participant/dashboard');
      }
    }
  }, [user, isLoading, navigate]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        {user?.status === 'pending' ? (
          <>
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Account Pending Approval</h1>
            <p className="text-muted-foreground">
              Your registration has been received. Please wait for an administrator to approve your account before you can access assessments.
            </p>
          </>
        ) : user?.status === 'rejected' ? (
          <>
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Account Rejected</h1>
            <p className="text-muted-foreground">
              Your account has been rejected. Please contact the administrator for more details.
            </p>
          </>
        ) : null}
        
        {user && (user.status === 'pending' || user.status === 'rejected') && (
          <div className="pt-6">
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Go to Login Page
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
