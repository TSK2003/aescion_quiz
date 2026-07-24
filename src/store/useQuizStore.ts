import { create } from 'zustand';

interface Question {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

interface QuizState {
  quizId: string | null;
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<string, string>;
  timeLeft: number;
  perQuestionTimer: number;
  globalTimeLeft: number;
  totalTime: number;
  isSubmitting: boolean;
  setQuiz: (quizId: string, questions: Question[], durationSeconds: number, questionTimerSeconds?: number) => void;
  answerQuestion: (questionId: string, answer: string) => void;
  nextQuestion: () => void;
  setTimeLeft: (time: number) => void;
  setGlobalTimeLeft: (time: number) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  resetQuiz: () => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  quizId: null,
  questions: [],
  currentQuestionIndex: 0,
  answers: {},
  timeLeft: 30,
  perQuestionTimer: 30,
  globalTimeLeft: 1800,
  totalTime: 1800,
  isSubmitting: false,
  setQuiz: (quizId, questions, durationSeconds, questionTimerSeconds = 30) => set({ 
    quizId, 
    questions, 
    currentQuestionIndex: 0, 
    answers: {}, 
    perQuestionTimer: questionTimerSeconds,
    timeLeft: questionTimerSeconds,
    globalTimeLeft: durationSeconds,
    totalTime: durationSeconds
  }),
  answerQuestion: (questionId, answer) => set((state) => ({
    answers: { ...state.answers, [questionId]: answer }
  })),
  nextQuestion: () => set((state) => ({
    currentQuestionIndex: state.currentQuestionIndex + 1,
    timeLeft: state.perQuestionTimer || 30
  })),
  setTimeLeft: (time) => set({ timeLeft: time }),
  setGlobalTimeLeft: (time) => set({ globalTimeLeft: time }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  resetQuiz: () => set({ quizId: null, questions: [], currentQuestionIndex: 0, answers: {}, timeLeft: 30, perQuestionTimer: 30, globalTimeLeft: 1800, totalTime: 1800, isSubmitting: false })
}));
