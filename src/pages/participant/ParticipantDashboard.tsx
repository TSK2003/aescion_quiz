import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, ClipboardCheck, CalendarCheck, XCircle } from 'lucide-react';

interface CheckInRecord {
  id: string;
  status: string;
  timestamp: string;
}

/**
 * Get current date/time in IST (India Standard Time, UTC+5:30).
 * Returns a Date object representing the current IST time.
 */
const getISTNow = (): Date => {
  const now = new Date();
  // IST is UTC+5:30 => offset = 5*60 + 30 = 330 minutes
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 330 * 60000);
};

/**
 * Get today's "attendance day" key in IST.
 * The attendance day resets at 8:00 AM IST.
 * If current IST time is before 8:00 AM, it belongs to the previous day's attendance cycle.
 */
const getAttendanceDayKey = (): string => {
  const ist = getISTNow();
  // If before 8:00 AM IST, treat as previous day
  if (ist.getHours() < 8) {
    ist.setDate(ist.getDate() - 1);
  }
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const dd = String(ist.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Extract the attendance day key from a timestamp string.
 * Uses the same 8 AM IST cutoff logic.
 */
const getDayKeyFromTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 330 * 60000);
  if (ist.getHours() < 8) {
    ist.setDate(ist.getDate() - 1);
  }
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const dd = String(ist.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const ParticipantDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([]);
  const [historyQuizzes, setHistoryQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Attendance state
  const [checkInRecords, setCheckInRecords] = useState<CheckInRecord[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.eventId || !user?.courseId || !user?.uid) return;
      try {
        const enrollments = user.enrollments || [{ eventId: user.eventId, courseId: user.courseId }];
        
        // Fetch active events to know which quizzes can be started
        const eventsSnap = await getDocs(collection(db, 'events'));
        const activeEventIds = eventsSnap.docs.filter(d => d.data().status === 'active').map(d => d.id);

        let allQuizzes: any[] = [];
        for (const en of enrollments) {
          if (!en.eventId || !en.courseId) continue;
          const q = query(
            collection(db, 'quizzes'),
            where('eventId', '==', en.eventId),
            where('courseId', '==', en.courseId)
          );
          const snap = await getDocs(q);
          allQuizzes.push(...snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
        }
        allQuizzes = Array.from(new Map(allQuizzes.map(q => [q.id, q])).values());

        const available: any[] = [];
        const history: any[] = [];
        const completedQuizIds = new Set<string>();

        // 1. Fetch ALL history directly from results
        const resultsQ = query(collection(db, 'results'), where('userId', '==', user.uid));
        const resultsSnap = await getDocs(resultsQ);

        for (const rDoc of resultsSnap.docs) {
          const rData = rDoc.data();
          completedQuizIds.add(rData.quizId);
          
          let quizName = 'Unknown Quiz';
          let quizDesc = '';
          try {
            const qDoc = await getDoc(doc(db, 'quizzes', rData.quizId));
            if (qDoc.exists()) {
              quizName = qDoc.data().name;
              quizDesc = qDoc.data().description || '';
            }
          } catch (e) {}

          history.push({
            id: rData.quizId,
            name: quizName,
            description: quizDesc,
            score: rData.score,
            isDisqualified: rData.isDisqualified,
            completedAt: rData.completedAt?.toMillis?.() || 0
          });
        }

        // 2. Also check participants for disqualified/completed that might not have a result
        // Note: participants are keyed by `${quizId}_${userId}` but we might not be able to query by userId if it's not a field.
        // Wait, does participants have userId as a field? Let's assume we just check the current enrolled quizzes for available/history.

        for (const quiz of allQuizzes) {
          if (completedQuizIds.has(quiz.id)) continue; // Already in history

          const participantDoc = await getDoc(doc(db, 'participants', `${quiz.id}_${user.uid}`));
          let hasCompleted = false;
          let isDisqualified = false;
          let score = 0;

          if (participantDoc.exists()) {
            const pData = participantDoc.data();
            if (pData.status === 'completed' || pData.status === 'disqualified') {
              hasCompleted = true;
              isDisqualified = pData.status === 'disqualified';
              score = pData.score || 0;
            }
          }

          if (hasCompleted) {
            history.push({ ...quiz, score, isDisqualified });
            completedQuizIds.add(quiz.id);
          } else if (quiz.status === 'active' && activeEventIds.includes(quiz.eventId)) {
            available.push(quiz);
          }
        }
        
        history.sort((a, b) => b.completedAt - a.completedAt);

        setAvailableQuizzes(available);
        setHistoryQuizzes(history);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  // Listen for attendance records in real-time
  useEffect(() => {
    if (!user?.uid || !user?.eventId) return;

    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid),
      where('eventId', '==', user.eventId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        status: doc.data().status,
        timestamp: doc.data().timestamp,
      } as CheckInRecord));

      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setCheckInRecords(data);
    });

    return () => unsubscribe();
  }, [user]);

  // Check if already checked in today (based on 8AM IST reset)
  const hasCheckedInToday = useMemo(() => {
    const todayKey = getAttendanceDayKey();
    return checkInRecords.some(record => getDayKeyFromTimestamp(record.timestamp) === todayKey);
  }, [checkInRecords]);

  const handleCheckIn = async () => {
    if (!user?.uid || !user?.eventId || isCheckingIn || hasCheckedInToday) return;

    setIsCheckingIn(true);

    let targetLat: number, targetLng: number, allowedRadius: number;

    try {
      const eventDoc = await getDoc(doc(db, 'events', user.eventId));
      const eventData = eventDoc.data();
      
      if (!eventData?.location?.latitude || !eventData?.location?.longitude || !eventData?.location?.radius) {
        alert("Attendance location has not been configured by the admin yet.");
        setIsCheckingIn(false);
        return;
      }
      
      targetLat = parseFloat(eventData.location.latitude);
      targetLng = parseFloat(eventData.location.longitude);
      allowedRadius = parseFloat(eventData.location.radius);
    } catch (error) {
      console.error("Error fetching event location:", error);
      alert("Failed to verify location requirements. Please try again.");
      setIsCheckingIn(false);
      return;
    }

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setIsCheckingIn(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371e3; // Radius of the earth in m
          const dLat = (lat2 - lat1) * (Math.PI / 180);
          const dLon = (lon2 - lon1) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        const distance = getDistanceFromLatLonInM(userLat, userLng, targetLat, targetLng);

        if (distance > allowedRadius) {
          alert(`Incorrect Location. You are ${Math.round(distance)}m away. You must be within ${allowedRadius}m of the premises to check in.`);
          setIsCheckingIn(false);
          return;
        }

        try {
          const now = new Date().toISOString();
          await addDoc(collection(db, 'attendance'), {
            userId: user.uid,
            participantName: user.name || 'Unknown',
            participantEmail: user.email || 'Unknown',
            eventId: user.eventId,
            status: 'Check In',
            timestamp: now,
          });
        } catch (error) {
          console.error('Error checking in:', error);
          alert('Failed to check in. Please try again.');
        } finally {
          setIsCheckingIn(false);
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Unable to retrieve your location. Please ensure location permissions are granted.");
        setIsCheckingIn(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  const formatDateOnly = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading your dashboard...</div>;
  }

  const handleSwitchEvent = async (enrollment: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        eventId: enrollment.eventId,
        courseId: enrollment.courseId
      });
      window.location.reload();
    } catch (err) {
      console.error("Failed to switch event", err);
      alert("Failed to switch event.");
    }
  };

  return (
    <div className="space-y-10 w-full pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.name}. Here are your assessments.</p>
        </div>
        
        {user?.enrollments && user.enrollments.length > 1 && (
          <div className="bg-card p-3 rounded-xl border shadow-sm flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Current Event:</span>
            <select 
              className="flex h-9 w-full sm:w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={`${user.eventId}|${user.courseId}`}
              onChange={(e) => {
                const [eId, cId] = e.target.value.split('|');
                const selected = user?.enrollments?.find((en: any) => en.eventId === eId && en.courseId === cId);
                if (selected) handleSwitchEvent(selected);
              }}
            >
              {user?.enrollments?.map((en: any, i: number) => (
                <option key={i} value={`${en.eventId}|${en.courseId}`}>
                  {en.eventName || en.eventId} - {en.courseName || en.courseId}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Available Assessments Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Available Assessments
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableQuizzes.length === 0 ? (
            <Card className="col-span-full border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium">No Active Assessments</h3>
                <p className="text-muted-foreground mt-1">There are no active assessments right now. Please wait for an administrator to start one.</p>
              </CardContent>
            </Card>
          ) : (
            availableQuizzes.map((quiz) => (
              <Card key={quiz.id} className="overflow-hidden border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-primary h-2 w-full animate-pulse"></div>
                <CardHeader>
                  <CardTitle className="text-xl">{quiz.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm mb-6 text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <span className="font-medium">Questions: {quiz.totalQuestions}</span>
                    <span className="font-medium text-primary">Duration: {quiz.duration}m</span>
                  </div>
                  <Button className="w-full text-base" onClick={() => navigate(`/participant/quiz/${quiz.id}/waiting`)}>
                    Enter Waiting Room
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* History Section */}
      <section className="space-y-4 pt-4 border-t border-border/50">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
          Assessment History
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {historyQuizzes.length === 0 ? (
            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-xl border-dashed">
              You haven't completed any assessments yet.
            </div>
          ) : (
            historyQuizzes.map((quiz) => (
              <Card key={quiz.id} className="overflow-hidden bg-card/50">
                <div className={`h-1.5 w-full ${quiz.isDisqualified ? 'bg-destructive/50' : 'bg-success/50'}`}></div>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-1">{quiz.name}</h3>
                      <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium ${quiz.isDisqualified ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                        {quiz.isDisqualified ? 'Disqualified' : 'Completed'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-2xl font-bold">{quiz.score}</span>
                      <span className="text-xs text-muted-foreground">Score</span>
                    </div>
                  </div>
                  <Link to={`/participant/results/${quiz.id}`}>
                    <Button variant="outline" className="w-full">
                      View Detailed Results
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Attendance Section */}
      <section className="space-y-4 pt-4 border-t border-border/50">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Attendance
        </h2>

        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Check In Button */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Mark Your Attendance</p>
                <p className="text-xs text-muted-foreground">
                  {hasCheckedInToday
                    ? 'You have already checked in today. Next check-in available tomorrow.'
                    : 'Click the button to check in for today.'}
                </p>
              </div>
              <button
                id="attendance-checkin-btn"
                onClick={handleCheckIn}
                disabled={hasCheckedInToday || isCheckingIn}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white
                  shadow-lg transition-all duration-300 transform
                  ${hasCheckedInToday
                    ? 'bg-red-500 cursor-not-allowed opacity-90 shadow-red-500/25'
                    : 'bg-green-500 hover:bg-green-600 hover:shadow-green-500/40 hover:scale-105 active:scale-95 shadow-green-500/30 cursor-pointer'
                  }
                  disabled:hover:scale-100
                `}
              >
                {hasCheckedInToday ? (
                  <>
                    <XCircle className="w-5 h-5" />
                    Checked In
                  </>
                ) : isCheckingIn ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Check In
                  </>
                )}
              </button>
            </div>

            {/* Attendance History Table */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-primary" />
                Check-In History
              </h3>
              {checkInRecords.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Date</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkInRecords.map((record) => (
                        <tr key={record.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 font-medium">
                            <div className="flex items-center gap-2">
                              <CalendarCheck className="w-3.5 h-3.5 text-primary" />
                              {formatDateOnly(record.timestamp)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTimestamp(record.timestamp)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed bg-muted/10">
                  <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="font-medium">No attendance records yet</p>
                  <p className="text-xs mt-1">Your daily check-in history will appear here.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

    </div>
  );
};


