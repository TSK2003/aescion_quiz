import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, query, getDocs, doc, getDoc, deleteDoc, updateDoc, addDoc, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Link, useParams } from 'react-router-dom';
import { useToastStore } from '../../store/useToastStore';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Clock, Edit3, X, Check } from 'lucide-react';

export const QuizzesPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingQuiz, setStartingQuiz] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);

  // Edit Timers Modal State
  const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
  const [editQuestionTimer, setEditQuestionTimer] = useState<number>(30);
  const [editDuration, setEditDuration] = useState<number>(30);
  const [savingTimer, setSavingTimer] = useState(false);

  const fetchQuizzes = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'quizzes'), where('eventId', '==', eventId));
      const querySnapshot = await getDocs(q);
      const fetchedQuizzes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(fetchedQuizzes.filter((q: any) => q.status !== 'archived'));
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, [eventId]);

  const handleDelete = async () => {
    if (!quizToDelete) return;
    try {
      await deleteDoc(doc(db, 'quizzes', quizToDelete));
      setQuizzes(quizzes.filter(q => q.id !== quizToDelete));
      addToast("Quiz deleted successfully", 'success');
    } catch (error) {
      console.error("Error deleting quiz:", error);
      addToast("Failed to delete quiz", 'error');
    } finally {
      setQuizToDelete(null);
    }
  };

  const handleOpenEditTimer = (quiz: any) => {
    setEditingQuiz(quiz);
    setEditQuestionTimer(quiz.questionTimer || 30);
    setEditDuration(quiz.duration || 30);
  };

  const handleSaveTimer = async () => {
    if (!editingQuiz) return;
    setSavingTimer(true);
    try {
      const updatedAt = new Date().toISOString();
      const newQuestionTimer = Number(editQuestionTimer) || 30;
      const newDuration = Number(editDuration) || 30;

      await updateDoc(doc(db, 'quizzes', editingQuiz.id), {
        questionTimer: newQuestionTimer,
        duration: newDuration,
        updatedAt
      });

      setQuizzes(quizzes.map(q => q.id === editingQuiz.id ? { 
        ...q, 
        questionTimer: newQuestionTimer, 
        duration: newDuration, 
        updatedAt 
      } : q));

      addToast("Quiz timers updated successfully!", 'success');
      setEditingQuiz(null);
    } catch (error) {
      console.error("Error saving timer", error);
      addToast("Failed to update quiz timers.", 'error');
    } finally {
      setSavingTimer(false);
    }
  };

  const handleStartQuiz = async (quiz: any) => {
    if (!eventId || startingQuiz) return;
    setStartingQuiz(quiz.id);

    try {
      const eventSnap = await getDoc(doc(db, 'events', eventId));
      const isInterview = eventSnap.exists() && eventSnap.data().eventType === 'interview';

      // 1. Fetch approved users for this event
      const q1 = query(collection(db, 'users'), where('eventId', '==', eventId));
      const q2 = query(collection(db, 'users'), where('eventIds', 'array-contains', eventId));
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      const userMap = new Map();
      snap1.docs.forEach(doc => userMap.set(doc.id, { id: doc.id, ...doc.data() } as any));
      snap2.docs.forEach(doc => userMap.set(doc.id, { id: doc.id, ...doc.data() } as any));

      const approvedUsers = Array.from(userMap.values()).filter(u => {
        if (u.role !== 'participant' || u.status !== 'approved') return false;
        if (isInterview || quiz.courseId === eventId) return true;
        let userCourseId = u.courseId;
        if (u.eventId !== eventId && u.enrollments) {
          const en = u.enrollments.find((e: any) => e.eventId === eventId);
          if (en) userCourseId = en.courseId;
        }
        return userCourseId === quiz.courseId;
      });

      if (approvedUsers.length === 0) {
        addToast("No approved users found for this session. Please approve users first.", 'error');
        setStartingQuiz(null);
        return;
      }

      // 2. Fetch question sets for this quiz
      const qSetsQ = query(collection(db, 'questionSets'), where('quizId', '==', quiz.id));
      const qSetsSnap = await getDocs(qSetsQ);

      let setA_Id = '';
      let setB_Id = '';
      qSetsSnap.forEach(d => {
        if (d.data().setName === 'A') setA_Id = d.id;
        if (d.data().setName === 'B') setB_Id = d.id;
      });

      if (!setA_Id || !setB_Id) {
        addToast("Question sets A and B not found for this quiz.", 'error');
        setStartingQuiz(null);
        return;
      }

      // 3. Batch create participant records
      const batch = writeBatch(db);
      let assignedCount = 0;
      let skippedCount = 0;

      approvedUsers.forEach((userItem, idx) => {
        const userSet = idx % 2 === 0 ? 'A' : 'B';
        const qSetDocId = userSet === 'A' ? setA_Id : setB_Id;
        const participantRef = doc(db, 'participants', `${quiz.id}_${userItem.id}`);

        batch.set(participantRef, {
          userId: userItem.id,
          userName: userItem.name,
          userEmail: userItem.email,
          courseId: userItem.courseId || '',
          quizId: quiz.id,
          eventId: eventId,
          questionSetId: userSet,
          qSetDocId: qSetDocId,
          status: 'waiting',
          updatedAt: serverTimestamp()
        }, { merge: true });

        assignedCount++;
      });

      // 4. Update quiz status to active
      const updatedAt = new Date().toISOString();
      const quizRef = doc(db, 'quizzes', quiz.id);
      batch.update(quizRef, { status: 'active', isAssigned: true, updatedAt });

      await batch.commit();

      // Audit log
      await addDoc(collection(db, 'auditLogs'), {
        timestamp: new Date().toISOString(),
        userId: 'admin',
        eventType: 'Quiz Started (Auto-Assigned)',
        eventId: eventId,
        metadata: { quizId: quiz.id, assignedCount, skippedCount }
      });

      setQuizzes(quizzes.map(q => q.id === quiz.id ? { ...q, status: 'active', updatedAt } : q));

      if (skippedCount > 0) {
        addToast(`Quiz started! ${assignedCount} participants assigned. ${skippedCount} users skipped.`, 'warning');
      } else {
        addToast(`Quiz started! ${assignedCount} participants assigned successfully.`, 'success');
      }
    } catch (error) {
      console.error("Error starting quiz:", error);
      addToast("Failed to start quiz.", 'error');
    } finally {
      setStartingQuiz(null);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const updatedAt = new Date().toISOString();
      await updateDoc(doc(db, 'quizzes', id), { status: newStatus, updatedAt });
      setQuizzes(quizzes.map(q => q.id === id ? { ...q, status: newStatus, updatedAt } : q));
      addToast(`Quiz status updated to ${newStatus}`, 'success');
    } catch (error) {
      console.error("Error updating quiz status:", error);
      addToast("Failed to update quiz status", 'error');
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-muted-foreground">Manage your assessments, edit timers, and start/stop live sessions.</p>
        </div>

        <Link to={`/admin/events/${eventId}/quizzes/create`}>
          <Button>Create New Quiz</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Quizzes</CardTitle>
          <CardDescription>Overview of all quizzes with custom per-question & total timers.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading quizzes...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Quiz Name</th>
                    <th className="px-6 py-3">Questions</th>
                    <th className="px-6 py-3">Timers</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map(quiz => (
                    <tr key={quiz.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">
                        <div>{quiz.name}</div>
                        <div className="text-xs text-muted-foreground">{quiz.courseName || 'General Session'}</div>
                      </td>
                      <td className="px-6 py-4">{quiz.totalQuestions} Questions</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="font-semibold text-primary">{quiz.questionTimer || 30}s</span> per question
                            <div className="text-xs text-muted-foreground">{quiz.duration || 30} mins total</div>
                          </div>
                          <button 
                            onClick={() => handleOpenEditTimer(quiz)}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            title="Edit Timers"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                        {quiz.status === 'active' && quiz.updatedAt && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <div>Started: <span className="text-foreground font-medium">{formatTime(quiz.updatedAt)}</span></div>
                            <div>Est. End: <span className="text-foreground font-medium">{formatTime(new Date(new Date(quiz.updatedAt).getTime() + ((quiz.duration || 30) * 60000)).toISOString())}</span></div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                          ${quiz.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' : 
                            quiz.status === 'draft' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                            'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                          {quiz.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleOpenEditTimer(quiz)}
                            className="cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Timer
                          </Button>
                          {quiz.status === 'draft' && (
                            <Button 
                              size="sm" 
                              onClick={() => handleStartQuiz(quiz)} 
                              isLoading={startingQuiz === quiz.id}
                              className="bg-green-600 hover:bg-green-700 cursor-pointer text-white"
                            >
                              Start Quiz
                            </Button>
                          )}
                          {quiz.status === 'active' && (
                            <>
                              <Link to={`/live-tv`} target="_blank">
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-md ring-1 ring-blue-500 ring-offset-1 ring-offset-background animate-pulse">Live Monitor</Button>
                              </Link>
                              <Button size="sm" onClick={() => handleUpdateStatus(quiz.id, 'completed')} className="bg-amber-600 hover:bg-amber-700 cursor-pointer text-white">Stop Quiz</Button>
                            </>
                          )}
                          <Button size="sm" variant="destructive" className="cursor-pointer" onClick={() => setQuizToDelete(quiz.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {quizzes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No quizzes found. Create one to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Timer Modal */}
      {editingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Edit Quiz Timers
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editingQuiz.name}</p>
              </div>
              <button 
                onClick={() => setEditingQuiz(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modalQuestionTimer">Per-Question Time Limit</Label>
                <select
                  id="modalQuestionTimer"
                  value={editQuestionTimer}
                  onChange={(e) => setEditQuestionTimer(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                >
                  <option value={15}>15 Seconds per question</option>
                  <option value={30}>30 Seconds per question</option>
                  <option value={45}>45 Seconds per question</option>
                  <option value={60}>60 Seconds per question (1 min)</option>
                  <option value={90}>90 Seconds per question (1.5 min)</option>
                  <option value={120}>120 Seconds per question (2 min)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modalDuration">Total Quiz Duration (Minutes)</Label>
                <Input
                  id="modalDuration"
                  type="number"
                  min={5}
                  max={180}
                  value={editDuration}
                  onChange={(e) => setEditDuration(Number(e.target.value))}
                  placeholder="30"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setEditingQuiz(null)} disabled={savingTimer}>
                Cancel
              </Button>
              <Button onClick={handleSaveTimer} isLoading={savingTimer} className="bg-primary text-primary-foreground">
                <Check className="w-4 h-4 mr-1.5" />
                Save Timers
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!quizToDelete}
        title="Delete Quiz"
        description="Are you sure you want to delete this quiz? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setQuizToDelete(null)}
      />
    </div>
  );
};
