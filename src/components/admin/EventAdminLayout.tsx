import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { auth, db } from '../../config/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { PageWrapper } from '../ui/PageWrapper';
import { Button } from '../ui/Button';
import { LogOut, LayoutDashboard, Users, BookOpen, PenTool, ShieldAlert, ClipboardCheck, Menu, X } from 'lucide-react';
import { cn } from '../../utils/cn';

import logo from '../../assets/hero1.png';

export const EventAdminLayout: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useParams<{ eventId: string }>();
  const [eventName, setEventName] = useState<string>('Loading Event...');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/participant/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const docSnap = await getDoc(doc(db, 'events', eventId));
        if (docSnap.exists()) {
          setEventName(docSnap.data().name);
        } else {
          setEventName('Event Not Found');
        }
      } catch (err) {
        setEventName('Error Loading Event');
      }
    };
    fetchEvent();
  }, [eventId]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'Event Overview', path: `/admin/events/${eventId}/dashboard`, icon: LayoutDashboard },
    { name: 'Users & Approvals', path: `/admin/events/${eventId}/users`, icon: Users },
    { name: 'Courses', path: `/admin/events/${eventId}/courses`, icon: BookOpen },
    { name: 'Quizzes', path: `/admin/events/${eventId}/quizzes`, icon: PenTool },
    { name: 'Audit Logs', path: `/admin/events/${eventId}/audit-logs`, icon: ShieldAlert },
    { name: 'Participants Attendance', path: `/admin/events/${eventId}/attendance`, icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border/50 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Hamburger for mobile */}
            <button
              className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-secondary/80 transition-colors flex-shrink-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')} className="gap-1 text-muted-foreground hover:bg-secondary/80 px-2 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              <span className="hidden sm:inline text-sm">Back</span>
            </Button>
            <div className="h-5 w-px bg-border hidden sm:block flex-shrink-0"></div>
            <Link to="/admin/dashboard" className="flex items-center gap-2 group min-w-0">
              <img src={logo} alt="AESCION Logo" className="h-7 sm:h-8 w-auto object-contain flex-shrink-0" />
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="text-sm font-bold leading-none">Events</span>
                <span className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]">{eventName}</span>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full hidden lg:inline-block border border-primary/20 truncate max-w-[120px]">
              {eventName}
            </span>
            <div className="flex-col items-end hidden sm:flex">
              <span className="text-sm font-bold leading-none truncate max-w-[100px]">{user?.name}</span>
              <span className="text-xs text-muted-foreground mt-0.5">Administrator</span>
            </div>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2 sm:px-3">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-1.5 text-sm">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile overlay sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <nav className="absolute left-0 top-14 sm:top-16 bottom-0 w-72 bg-card shadow-2xl overflow-y-auto border-r border-border">
            <div className="p-4 space-y-1">
              <div className="mb-4 px-2">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Event Menu</h2>
                <p className="text-xs text-primary font-medium mt-1 truncate">{eventName}</p>
              </div>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}
                    className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all",
                      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden w-full">
        {/* Desktop sidebar */}
        <aside className="w-60 bg-card/50 backdrop-blur-sm border-r border-border/50 hidden md:block overflow-y-auto flex-shrink-0">
          <nav className="p-4 space-y-1">
            <div className="mb-4 px-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Event Menu</h2>
            </div>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}
                  className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group cursor-pointer",
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
          <PageWrapper>
            <Outlet />
          </PageWrapper>
        </main>
      </div>
    </div>
  );
};
