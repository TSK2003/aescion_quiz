import { create } from 'zustand';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'participant';
  status: 'pending' | 'approved' | 'rejected';
  courseId?: string;
  eventId?: string;
  questionSet?: 'A' | 'B';
  enrollments?: { eventId: string; eventName?: string; courseId: string; courseName?: string }[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

const getInitialUser = (): User | null => {
  try {
    const cached = localStorage.getItem('aescion_user_session');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
};

const initialUser = getInitialUser();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  isAuthenticated: !!initialUser,
  isLoading: !initialUser,
  setUser: (user) => {
    if (user) {
      localStorage.setItem('aescion_user_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('aescion_user_session');
    }
    set({ user, isAuthenticated: !!user, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
