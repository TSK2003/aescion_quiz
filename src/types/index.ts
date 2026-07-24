export type UserRole = 'admin' | 'participant';

export type UserStatus = 'pending' | 'approved' | 'blocked';

export type QuestionSet = 'A' | 'B';

export interface UserEnrollment {
  eventId: string;
  courseId: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  mobile?: string;
  role: UserRole;
  status: UserStatus;
  courseId?: string;
  eventId?: string;
  questionSet?: QuestionSet;
  eventIds?: string[];
  enrollments?: UserEnrollment[];
  password?: string;
  createdAt: string;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'upcoming' | 'completed' | 'archived';
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface Course {
  id: string;
  eventId: string;
  name: string;
  code?: string;
  description?: string;
  createdAt: string;
}

export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number; // 0-based index
  marks?: number;
}

export interface Quiz {
  id: string;
  eventId: string;
  courseId: string;
  title: string;
  description?: string;
  set: QuestionSet;
  durationMinutes: number;
  questionTimeSeconds: number; // e.g. 15 seconds per question
  totalQuestions: number;
  totalMarks: number;
  passPercentage: number;
  questions: Question[];
  status: 'draft' | 'published' | 'live' | 'completed';
  createdAt: string;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  quizId: string;
  quizTitle: string;
  eventId: string;
  courseId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  violationsCount: number;
  disqualified: boolean;
  answers: Record<string, number>;
  startedAt: string;
  completedAt?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  details: string;
  category: 'security' | 'exam' | 'admin' | 'auth';
  timestamp: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  eventId: string;
  courseId: string;
  status: 'present' | 'absent' | 'excused';
  checkedInAt: string;
}
