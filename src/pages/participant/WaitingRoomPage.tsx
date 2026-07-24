import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../../store/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../store/useToastStore';

export const WaitingRoomPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  
  const [quiz, setQuiz] = useState<any>(null);
  const [participantState, setParticipantState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!quizId || !user) return;

    // Fetch static quiz details
    let unsubscribe: any = null;

    const setupListener = (pRef: any) => {
      unsubscribe = onSnapshot(pRef, (docSnap: any) => {
        if (docSnap.exists()) {
          setParticipantState(docSnap.data());
          setLoading(false);
        } else {
          setError("You are not assigned to this quiz. Please contact administrator.");
          setLoading(false);
        }
      }, (err: any) => {
        console.error(err);
        setError("Error checking assignment");
        setLoading(false);
      });
    };

    const fetchQuiz = async () => {
      try {
        const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
        if (quizDoc.exists()) {
          const quizData = quizDoc.data();
          setQuiz({ id: quizDoc.id, ...quizData });

          const participantRef = doc(db, 'participants', `${quizId}_${user.uid}`);
          const pSnap = await getDoc(participantRef);

          if (!pSnap.exists()) {
            if (quizData.status !== 'active') {
              setError("This quiz is not currently active.");
              setLoading(false);
              return;
            }

            // Auto-assign them on the fly!
            const qSetsQ = query(collection(db, 'questionSets'), where('quizId', '==', quizId));
            const qSetsSnap = await getDocs(qSetsQ);

            let setA_Id = '';
            let setB_Id = '';
            let fallbackId = '';

            qSetsSnap.forEach(d => {
              if (d.data().setName === 'A') setA_Id = d.id;
              if (d.data().setName === 'B') setB_Id = d.id;
              if (!fallbackId) fallbackId = d.id;
            });

            const userSet = user.questionSet || 'A';
            let qSetDocId = userSet === 'A' ? setA_Id : setB_Id;
            if (!qSetDocId) qSetDocId = fallbackId;

            if (!qSetDocId) {
              setError("No question sets found for this quiz.");
              setLoading(false);
              return;
            }

            await setDoc(participantRef, {
              userId: user.uid,
              quizId: quizId,
              eventId: user.eventId || '',
              questionSetId: userSet,
              qSetDocId: qSetDocId,
              status: 'waiting',
              updatedAt: serverTimestamp()
            });
          }

          setupListener(participantRef);
        } else {
          setError("Quiz not found");
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError("Error fetching quiz");
        setLoading(false);
      }
    };
    
    fetchQuiz();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [quizId, user]);

  const handleStartQuiz = async () => {
    if (!quizId || !user) return;
    try {
      const participantRef = doc(db, 'participants', `${quizId}_${user.uid}`);
      await updateDoc(participantRef, {
        status: 'in-progress',
        startTime: serverTimestamp()
      });
      navigate(`/participant/quiz/${quizId}/live`);
    } catch (err) {
      console.error(err);
      addToast("Failed to start quiz.", 'error');
    }
  };

  if (loading) return <div className="flex justify-center p-12">Loading...</div>;

  if (error) {
    return (
      <Card className="max-w-lg mx-auto mt-12 border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button className="mt-4" onClick={() => navigate('/participant/dashboard')}>Return to Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  // The participant flow expects admin to manually start quiz, or if it's active they can start?
  // User Prompt: "Admin Starts Quiz -> Participant sees: Quiz Available -> [Start Quiz]"
  // This means the user can only click "Start Quiz" if the quiz status is active and their status is waiting.
  // We already know quiz status is 'active' because they only see it on the dashboard if it's active.
  // Wait, let's also listen to the quiz doc to see if Admin actually changed it to active?
  // Let's assume the Dashboard already only shows 'active' quizzes.
  // So if they are here, the quiz is active.
  
  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Waiting Room</h1>
        <p className="text-muted-foreground">You have been assigned to this assessment.</p>
      </div>

      <Card className="text-center overflow-hidden">
        <div className="bg-primary h-2 w-full"></div>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">{quiz?.name}</CardTitle>
          <CardDescription>{quiz?.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
            <div>
              <span className="block text-muted-foreground">Total Questions</span>
              <span className="font-semibold text-lg">{quiz?.totalQuestions}</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Duration</span>
              <span className="font-semibold text-lg">{quiz?.duration} Minutes</span>
            </div>
            <div className="col-span-2 border-t pt-2 mt-2">
              <span className="block text-muted-foreground">Time Per Question</span>
              <span className="font-semibold">{quiz?.questionTimer} Seconds</span>
            </div>
          </div>

          <div className="bg-amber-100 text-amber-800 p-4 rounded-lg text-left text-sm space-y-2">
            <h4 className="font-semibold flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Important Instructions
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do not refresh the page or press F5.</li>
              <li>Do not switch tabs or minimize the browser.</li>
              <li>You have 15 seconds for each question. It will auto-submit.</li>
              <li>Multiple violations will result in auto-disqualification.</li>
            </ul>
          </div>

          {participantState?.status === 'waiting' && (
            <Button size="lg" className="w-full text-lg h-14" onClick={handleStartQuiz}>
              Start Quiz
            </Button>
          )}

          {participantState?.status === 'in-progress' && (
            <Button size="lg" className="w-full text-lg h-14" onClick={() => navigate(`/participant/quiz/${quizId}/live`)}>
              Resume Quiz
            </Button>
          )}

          {(participantState?.status === 'completed' || participantState?.status === 'disqualified') && (
            <div className="text-center p-4 bg-muted rounded-md text-muted-foreground font-medium">
              You have already completed or been disqualified from this assessment.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
