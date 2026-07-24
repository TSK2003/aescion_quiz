import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { useQuizStore } from '../../store/useQuizStore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

export const LiveQuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { 
    questions, currentQuestionIndex, answers, timeLeft, globalTimeLeft, totalTime, isSubmitting,
    setQuiz, answerQuestion, nextQuestion, setTimeLeft, setGlobalTimeLeft, setSubmitting, resetQuiz 
  } = useQuizStore();

  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const lastViolationTimeRef = useRef<number>(0);

  const requestFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => console.log("Fullscreen Error:", err));
    }
  };

  const handleViolation = useCallback(async (type: string) => {
    if (!quizId || !user) return;
    
    // Prevent double triggers within 2 seconds (e.g. blur + visibilitychange firing together)
    const now = Date.now();
    if (now - lastViolationTimeRef.current < 2000) return;
    lastViolationTimeRef.current = now;

    // Log violation
    await addDoc(collection(db, 'violations'), {
      userId: user.uid,
      quizId,
      type,
      timestamp: new Date().toISOString()
    });

    setWarnings(prev => {
      if (prev >= 3) return prev; // Already disqualifying

      const newWarnings = prev + 1;
      if (newWarnings >= 3) {
        // Terminate Quiz
        setWarningMessage("You have been disqualified due to repeated rule violations.");
        setShowWarningModal(true);
        setTimeout(() => handleAutoSubmit(true), 3000);
      } else {
        setWarningMessage(`WARNING ${newWarnings}/3: You have violated exam rules (${type}). Continuing to do so will result in disqualification.`);
        setShowWarningModal(true);
      }
      return newWarnings;
    });
  }, [quizId, user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleViolation('Tab Switch / Minimize');
    };
    const handleBlur = () => {
      handleViolation('Lost Window Focus (Tab Switch)');
    };
    const handleContextMenu = (e: Event) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') || 
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 'c') ||
        (e.ctrlKey && e.key === 'v')
      ) {
        e.preventDefault();
        handleViolation('Developer Tools / Copy Paste');
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation('Exited Fullscreen');
        // Removed setTimeout requestFullscreen as it requires a user gesture. 
        // It's now handled by the 'I Understand' button click.
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation('Copy / Paste Action');
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave? Your progress may be lost.";
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Aggressively detect floating windows or system overlays that might bypass events
    const focusCheckInterval = setInterval(() => {
      if (!document.hasFocus()) {
        handleViolation('Lost Window Focus (Floating Window / Notification Shade)');
      }
    }, 1500);

    requestFullscreen();

    return () => {
      clearInterval(focusCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [handleViolation]);

  useEffect(() => {
    const initializeQuiz = async () => {
      if (!quizId || !user) return;
      try {
        const participantRef = doc(db, 'participants', `${quizId}_${user.uid}`);
        const participantSnap = await getDoc(participantRef);
        
        if (!participantSnap.exists()) {
          navigate('/participant/dashboard');
          return;
        }

        const pData = participantSnap.data();
        if (pData.status === 'completed' || pData.status === 'disqualified') {
          navigate(`/participant/results/${quizId}`);
          return;
        }

        if (pData.startTime) {
          startTimeRef.current = pData.startTime.toMillis?.() || Date.now();
        } else {
          startTimeRef.current = Date.now();
        }

        let durationMinutes = 30; // default
        const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
        if (quizSnap.exists()) {
          durationMinutes = quizSnap.data().duration || 30;
        }

        // Calculate actual remaining time
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTimeRef.current) / 1000);
        let remainingSeconds = (durationMinutes * 60) - elapsedSeconds;
        if (remainingSeconds < 0) remainingSeconds = 0;

        const qSetId = pData.qSetDocId;
        const qSetSnap = await getDoc(doc(db, 'questionSets', qSetId));
        
        if (qSetSnap.exists()) {
          const qsData = qSetSnap.data();
          const loadedQuestions = qsData.questions.map((q: any, index: number) => ({ id: `q${index}`, ...q }));
          setQuiz(quizId, loadedQuestions, remainingSeconds);
        }
      } catch (err) {
        console.error("Error loading quiz data", err);
      } finally {
        setLoading(false);
      }
    };

    initializeQuiz();
    return () => resetQuiz();
  }, [quizId, user, navigate, setQuiz, resetQuiz]);

  const handleAutoSubmit = useCallback(async (isDisqualified = false) => {
    if (!quizId || !user || isSubmitting) return;
    setSubmitting(true);
    
    try {
      let score = 0;
      let correctCount = 0;
      let wrongCount = 0;

      if (!isDisqualified) {
        questions.forEach((q) => {
          if (answers[q.id] === q.correctAnswer) {
            score += 1;
            correctCount++;
          } else if (answers[q.id]) {
            wrongCount++;
          }
        });
      }

      const totalQuestions = questions.length;
      const percentage = isDisqualified ? 0 : (score / totalQuestions) * 100;
      const timeTaken = isDisqualified ? 0 : Math.floor((Date.now() - startTimeRef.current) / 1000);

      // Update participant
      await setDoc(doc(db, 'participants', `${quizId}_${user.uid}`), {
        status: isDisqualified ? 'disqualified' : 'completed',
        endTime: serverTimestamp(),
        score: isDisqualified ? 0 : score,
        answers: isDisqualified ? {} : answers
      }, { merge: true });

      // Create result
      await setDoc(doc(db, 'results', `${quizId}_${user.uid}`), {
        userId: user.uid,
        userName: user.name,
        courseId: user.courseId || '',
        quizId,
        score: isDisqualified ? 0 : score,
        percentage,
        correctAnswers: isDisqualified ? 0 : correctCount,
        wrongAnswers: isDisqualified ? 0 : wrongCount,
        isDisqualified,
        timeTaken,
        completedAt: serverTimestamp()
      });

      // Audit Log
      await addDoc(collection(db, 'auditLogs'), {
        timestamp: new Date().toISOString(),
        userId: user.uid,
        eventType: isDisqualified ? 'Quiz Disqualified' : 'Quiz Submitted',
        metadata: { quizId, score: isDisqualified ? 0 : score }
      });

      navigate(`/participant/dashboard`); // Or results page
    } catch (err) {
      console.error("Submit error", err);
    } finally {
      setSubmitting(false);
    }
  }, [quizId, user, questions, answers, isSubmitting, navigate, setSubmitting, totalTime, globalTimeLeft]);

  // Timer Effect
  useEffect(() => {
    if (loading || isSubmitting || questions.length === 0) return;

    if (globalTimeLeft <= 0) {
      handleAutoSubmit();
      return;
    }

    if (timeLeft === 0) {
      updateLiveResult(); // Push result before moving next
      if (currentQuestionIndex < questions.length - 1) {
        nextQuestion();
      } else {
        handleAutoSubmit();
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    globalTimerRef.current = setTimeout(() => {
      setGlobalTimeLeft(globalTimeLeft - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (globalTimerRef.current) clearTimeout(globalTimerRef.current);
    };
  }, [timeLeft, globalTimeLeft, loading, isSubmitting, questions.length, currentQuestionIndex, nextQuestion, handleAutoSubmit, setTimeLeft, setGlobalTimeLeft]);

  if (loading) return <div className="flex justify-center items-center h-screen">Loading Quiz Environment...</div>;

  const question = questions[currentQuestionIndex];
  if (!question) return null;

  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleManualNext = () => {
    updateLiveResult(); // Push result before moving next
    if (isLastQuestion) {
      handleAutoSubmit();
    } else {
      nextQuestion();
    }
  };

  const updateLiveResult = async () => {
    if (!quizId || !user) return;
    
    let score = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        score += 1;
      }
    });

    const currentTimeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      await setDoc(doc(db, 'results', `${quizId}_${user.uid}`), {
        userId: user.uid,
        userName: user.name,
        courseId: user.courseId || '',
        quizId,
        score,
        lastAnswerAt: serverTimestamp(),
        isDisqualified: false,
        timeTaken: currentTimeTaken
      }, { merge: true });
    } catch (e) {
      console.error('Error updating live result', e);
    }
  };

  const handleSelectAnswer = (questionId: string, answer: string) => {
    answerQuestion(questionId, answer);
    // Removed updateLiveResult from here. It will run on 'Next Question'.
  };

  return (
    <div className="max-w-3xl mx-auto w-full pt-8 select-none" ref={containerRef}>
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm font-medium text-muted-foreground">
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
        <div className={`px-4 py-2 rounded-full font-bold text-lg flex items-center gap-4 ${timeLeft <= 5 ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-primary/10 text-primary'}`}>
          <span className="text-sm border-r border-current pr-4">Total: {Math.floor(globalTimeLeft / 60)}:{String(globalTimeLeft % 60).padStart(2, '0')}</span>
          <span>{timeLeft}s</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="mb-6 shadow-md border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl leading-relaxed">{question.text}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {['A', 'B', 'C', 'D'].map((opt) => {
                const key = `option${opt}` as keyof typeof question;
                const isSelected = answers[question.id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelectAnswer(question.id, opt)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/10 ring-1 ring-primary' 
                        : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                  >
                    <span className="inline-block w-6 font-bold text-muted-foreground mr-2">{opt}.</span>
                    {question[key]}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleManualNext} isLoading={isSubmitting}>
          {isLastQuestion ? 'Submit Quiz' : 'Next Question'}
        </Button>
      </div>
      
      {warnings > 0 && (
        <div className="mt-8 p-3 bg-destructive/10 text-destructive text-sm text-center rounded-md font-medium">
          Warning: Activity violations detected ({warnings}/3). Exam will auto-terminate at 3.
        </div>
      )}

      {/* Custom Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-destructive ring-1 ring-destructive/50 overflow-hidden"
            >
              <div className="bg-destructive p-4 text-destructive-foreground font-bold text-lg flex items-center justify-center">
                ⚠️ Security Warning
              </div>
              <div className="p-6 text-center space-y-4">
                <p className="text-foreground font-medium">{warningMessage}</p>
                {warnings < 3 && (
                  <Button 
                    className="w-full cursor-pointer" 
                    variant="destructive" 
                    onClick={() => {
                      setShowWarningModal(false);
                      requestFullscreen();
                    }}
                  >
                    I Understand, Return to Quiz
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
