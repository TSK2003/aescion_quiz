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

export const AdminLayout: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isDashboard = location.pathname === '/admin/dashboard' || location.pathname === '/admin';

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/participant/dashboard');
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border/50 supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isDashboard && <BackButton />}
            {!isDashboard && <div className="h-6 w-px bg-border hidden sm:block"></div>}
            <img src={logo} alt="AESCION Logo" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold leading-none">{user?.name}</span>
              <span className="text-xs text-muted-foreground mt-1">Administrator</span>
            </div>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-6 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <PageWrapper>
            <Outlet />
          </PageWrapper>
        </div>
      </main>
    </div>
  );
};
