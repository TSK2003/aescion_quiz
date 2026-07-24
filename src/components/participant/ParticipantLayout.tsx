import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../config/firebase';
import { signOut } from 'firebase/auth';
import { BackButton } from '../ui/BackButton';
import { PageWrapper } from '../ui/PageWrapper';
import { Button } from '../ui/Button';
import { LogOut } from 'lucide-react';
import logo from '../../assets/hero1.png';

export const ParticipantLayout: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isExamActive = location.pathname.includes('/quiz/') || location.pathname.includes('/results/');

  const isDashboard = location.pathname === '/participant/dashboard' || location.pathname === '/participant';
  const hideBackButton = isExamActive || isDashboard;

  useEffect(() => {
    if (user && user.role !== 'participant') {
      navigate('/admin/dashboard');
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border/50 supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!hideBackButton && <BackButton />}
            {!hideBackButton && <div className="h-6 w-px bg-border hidden sm:block"></div>}
            <img src={logo} alt="AESCION Logo" className="h-8 w-auto object-contain" />
          </div> 
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold leading-none">{user?.name}</span>
              <span className="text-xs text-muted-foreground mt-1">Participant</span>
            </div>
            {!isExamActive && (
              <Button onClick={handleLogout} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 p-6 sm:p-8 flex flex-col max-w-7xl mx-auto w-full">
        <PageWrapper className="flex-1 flex flex-col">
          <Outlet />
        </PageWrapper>
      </main>
    </div>
  );
};
