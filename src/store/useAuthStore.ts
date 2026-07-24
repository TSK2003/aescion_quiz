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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
}));
