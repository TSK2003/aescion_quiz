import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, query, onSnapshot, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Award, TrendingUp, MonitorPlay, CheckCircle2, ListChecks } from 'lucide-react';

import logo from '../assets/hero.png';

export const LiveTV: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [courses, setCourses] = useState<Record<string, string>>({});
  const [activeUsers, setActiveUsers] = useState<Set<string>>(new Set());
  
  // New state for Answers Mode
  const [mode, setMode] = useState<'leaderboard' | 'answers'>('leaderboard');
  const [completedQuiz, setCompletedQuiz] = useState<any>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const coursesMap: Record<string, string> = {};
        coursesSnap.forEach(doc => {
          coursesMap[doc.id] = doc.data().name;
        });
        setCourses(coursesMap);
      } catch (err) {
        console.error("Failed to fetch courses for Live TV:", err);
      }
    };
    
    let unsubscribeUsers: any;
    let unsubscribeQuizzes: any;

    const setupLiveTV = async () => {
      try {
        const eventsQuery = query(collection(db, 'events'), where('status', '==', 'active'));
        const eventSnap = await getDocs(eventsQuery);
        if (eventSnap.empty) return;
        const activeEventId = eventSnap.docs[0].id;

        // 1. Listen to Active Users
        const usersQuery = query(collection(db, 'users'), where('eventId', '==', activeEventId));
        unsubscribeUsers = onSnapshot(usersQuery, (snap) => {
          const userIds = new Set(snap.docs.map(doc => doc.id));
          setActiveUsers(userIds);
        });

        // 2. Listen to Quizzes for this event
        const quizzesQuery = query(collection(db, 'quizzes'), where('eventId', '==', activeEventId));
        unsubscribeQuizzes = onSnapshot(quizzesQuery, async (snap) => {
          const quizzes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          
          const validQuizzes = quizzes.filter(q => q.status === 'active' || q.status === 'completed');
          
          // Sort quizzes by updatedAt descending to find the most recently modified one
          validQuizzes.sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          
          if (validQuizzes.length > 0) {
            const latestQuiz = validQuizzes[0];
            
            if (latestQuiz.status === 'completed') {
              // Quiz just finished! Switch to answers mode
              setCompletedQuiz(latestQuiz);
              setActiveQuizId(null);
              setMode('answers');
              
              // Fetch the questions for this quiz to show the answers
              if (latestQuiz.questionSetId) {
                const qSetDoc = await getDoc(doc(db, 'questionSets', latestQuiz.questionSetId));
                if (qSetDoc.exists()) {
                  const qsData = qSetDoc.data();
                  setQuestions(qsData.questions.map((q: any, index: number) => ({ id: `q${index}`, ...q })));
                }
              }
            } else {
              // Quiz is active or draft, show leaderboard
              setMode('leaderboard');
              setCompletedQuiz(null);
              setActiveQuizId(latestQuiz.id);
            }
          }
        });

      } catch (err) {
        console.error("Failed to setup Live TV:", err);
      }
    };

    fetchCourses();
    setupLiveTV();
    
    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeQuizzes) unsubscribeQuizzes();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'leaderboard' || !activeQuizId) {
      setResults([]);
      return;
    }

    const q = query(collection(db, 'results'), where('quizId', '==', activeQuizId));
    const unsubscribe = onSnapshot(q, (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      data.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (a.timeTaken !== undefined && b.timeTaken !== undefined) {
          return a.timeTaken - b.timeTaken;
        }
        const timeA = a.lastAnswerAt?.toMillis?.() || a.completedAt?.toMillis?.() || new Date(a.lastAnswerAt || a.completedAt || 0).getTime() || 0;
        const timeB = b.lastAnswerAt?.toMillis?.() || b.completedAt?.toMillis?.() || new Date(b.lastAnswerAt || b.completedAt || 0).getTime() || 0;
        return timeA - timeB;
      });
      
      setResults(data.slice(0, 10));
    });

    const refreshInterval = setInterval(() => {
      setResults(prevResults => [...prevResults]);
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [activeUsers, mode, activeQuizId]);

  const getRankIcon = (index: number, result: any) => {
    if (result.isDisqualified) return <div className="w-8 h-8 flex items-center justify-center font-bold text-red-500 text-xl">✗</div>;
    switch(index) {
      case 0: return <Trophy className="w-8 h-8 text-yellow-500 drop-shadow-md" />;
      case 1: return <Medal className="w-8 h-8 text-slate-400 drop-shadow-md" />;
      case 2: return <Award className="w-8 h-8 text-amber-700 drop-shadow-md" />;
      default: return <div className="w-8 h-8 flex items-center justify-center font-bold text-slate-400">#{index + 1}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden selection:bg-primary/30 font-sans">
      
      {/* Header */}
      <header className="px-8 md:px-12 py-6 bg-card border-b border-border shadow-sm z-10 flex justify-between items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 hidden sm:block">
            <img src={logo} alt="AESCION Logo" className="h-12 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
              {mode === 'leaderboard' ? 'LIVE LEADERBOARD' : 'ASSESSMENT REVIEW'}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base font-medium flex items-center gap-2">
              {mode === 'leaderboard' ? (
                <><TrendingUp className="w-4 h-4 text-primary" /> Real-time Assessment Standings</>
              ) : (
                <><ListChecks className="w-4 h-4 text-primary" /> Correct Answers for {completedQuiz?.name}</>
              )}
            </p>
          </div>
        </div>
        
        {mode === 'leaderboard' ? (
          <div className="flex items-center gap-3 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20 relative z-10">
             <div className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </div>
            <span className="text-sm md:text-base font-bold tracking-widest uppercase text-red-600 dark:text-red-500">LIVE</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-success/10 px-4 py-2 rounded-full border border-success/20 relative z-10">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-sm md:text-base font-bold tracking-widest uppercase text-success">COMPLETED</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={`flex-1 p-6 md:p-12 relative ${mode === 'answers' ? 'bg-background overflow-y-auto' : 'bg-secondary/30'}`}>
        <div className="max-w-6xl mx-auto w-full relative z-10">
          
          {mode === 'leaderboard' ? (
            <>
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-[80px_1fr_2fr_100px_120px] gap-6 px-8 py-4 mb-4 text-muted-foreground font-bold uppercase tracking-wider text-xs border-b border-border/50">
                <div className="text-center">Rank</div>
                <div>Participant Name</div>
                <div>Course Track</div>
                <div className="text-center">Time</div>
                <div className="text-right">Score</div>
              </div>

              {/* List */}
              <div className="space-y-3 md:space-y-4">
                <AnimatePresence mode="popLayout">
                  {results.map((result, index) => {
                    return (
                      <motion.div
                        key={result.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 350, damping: 25, mass: 1 }}
                        className={`grid grid-cols-[60px_1fr_100px] md:grid-cols-[80px_1fr_2fr_100px_120px] gap-4 md:gap-6 px-6 md:px-8 py-5 md:py-6 items-center rounded-2xl border transition-all relative overflow-hidden group ${
                          result.isDisqualified ? 'bg-red-50/80 border-red-300 dark:bg-red-900/30 dark:border-red-800 shadow-sm' :
                          index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-100/30 border-yellow-200 shadow-lg shadow-yellow-500/10 dark:from-yellow-500/10 dark:border-yellow-500/30' :
                          index === 1 ? 'bg-gradient-to-r from-slate-50 to-slate-100/50 border-slate-200 shadow-md dark:from-slate-800/50 dark:border-slate-700' :
                          index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100/30 border-orange-200 shadow-md dark:from-orange-500/10 dark:border-orange-500/30' :
                          'bg-card border-border shadow-sm hover:shadow-md hover:border-border/80'
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                        
                        <div className="flex justify-center relative z-10">
                          {getRankIcon(index, result)}
                        </div>
                        
                        <div className="relative z-10 flex flex-col justify-center min-w-0">
                          <div className={`text-md sm:text-2xl font-semibold truncate tracking-tight ${result.isDisqualified ? 'text-red-700 dark:text-red-400' : 'text-black dark:text-black'}`}>
                            {result.userName}
                          </div>
                          <div className="md:hidden text-xs text-muted-foreground truncate mt-0.5">
                            {courses[result.courseId] || result.courseId}
                          </div>
                        </div>
                        
                        <div className="hidden md:block relative z-10 min-w-0">
                           <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold truncate max-w-full ${result.isDisqualified ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-secondary text-secondary-foreground'}`}>
                             {courses[result.courseId] || result.courseId}
                           </span>
                        </div>

                        <div className="hidden md:flex relative z-10 justify-center">
                           <span className={`text-sm font-bold px-3 py-1 rounded-md ${result.isDisqualified ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/50' : 'text-slate-600 bg-slate-100/80 dark:bg-slate-800 dark:text-slate-300'}`}>
                             {result.timeTaken !== undefined && !result.isDisqualified
                               ? `${Math.floor(result.timeTaken / 60)}m ${result.timeTaken % 60}s` 
                               : '--:--'}
                           </span>
                        </div>
                        
                        <div className="text-right relative z-10 flex flex-col justify-center items-end">
                          <span className={`text-3xl md:text-4xl font-black ${
                            result.isDisqualified ? 'text-red-600 dark:text-red-500 drop-shadow-sm' : 
                            'text-black drop-shadow-sm'
                          }`}>
                            {result.isDisqualified ? 'DQ' : result.score}
                          </span>
                          {result.isDisqualified && <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-500 tracking-widest mt-1">Disqualified</span>}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {results.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                      <MonitorPlay className="w-10 h-10 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Waiting for Results</h3>
                    <p className="text-muted-foreground mt-2 max-w-md">The live leaderboard will automatically update as soon as participants start submitting their assessments.</p>
                  </motion.div>
                )}
              </div>
            </>
          ) : (
            /* Answers Mode */
            <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {questions.map((q, index) => (
                <div key={q.id} className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden group transition-all hover:shadow-md">
                  <div className="p-6 md:p-8">
                    <div className="flex gap-4 items-start">
                      <div className="w-10 h-10 shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-6">
                        <h3 className="text-xl md:text-2xl font-semibold leading-relaxed text-foreground">
                          {q.question}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {['A', 'B', 'C', 'D'].map((opt: string) => {
                            const optionKey = `option${opt}` as keyof typeof q;
                            const optionText = q[optionKey] as string;
                            const isCorrect = q.correctAnswer === opt;
                            return (
                              <div 
                                key={opt} 
                                className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between text-black ${
                                  isCorrect 
                                    ? 'bg-success/10 border-success ring-4 ring-success/20' 
                                    : 'bg-muted/30 border-transparent opacity-70'
                                }`}
                              >
                                <span className={`text-base md:text-lg font-medium ${isCorrect ? 'font-bold' : ''}`}>
                                  <span className="font-bold mr-2">{opt}.</span>
                                  {optionText}
                                </span>
                                {isCorrect && <CheckCircle2 className="w-6 h-6 text-success shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {questions.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">Loading questions...</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
