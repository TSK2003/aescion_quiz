import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToastStore } from '../../store/useToastStore';
import { Modal } from '../../components/ui/Modal';
import { Label } from '../../components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Mail, BookOpen, Shield, Calendar, Trophy, Target, AlertTriangle, ClipboardCheck, TrendingUp } from 'lucide-react';

export const UserProfilePage: React.FC = () => {
  const { eventId, userId } = useParams<{ eventId: string; userId: string }>();
  const navigate = useNavigate();

  const [userData, setUserData] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [quizNames, setQuizNames] = useState<Record<string, string>>({});
  const [courseName, setCourseName] = useState('');
  const [loading, setLoading] = useState(true);

  const { addToast } = useToastStore();
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [availableEvents, setAvailableEvents] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isGranting, setIsGranting] = useState(false);

  const openGrantModal = async () => {
    setIsGrantModalOpen(true);
    if (availableEvents.length === 0) {
      const eventsSnap = await getDocs(collection(db, 'events'));
      setAvailableEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      if (!selectedEventId) {
        setAvailableCourses([]);
        return;
      }
      const coursesQ = query(collection(db, 'courses'), where('eventId', '==', selectedEventId));
      const coursesSnap = await getDocs(coursesQ);
      setAvailableCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchCourses();
  }, [selectedEventId]);

  const handleGrantAccess = async () => {
    if (!selectedEventId || !selectedCourseId || !userId) {
      addToast('Please select both an event and a course.', 'error');
      return;
    }
    setIsGranting(true);
    try {
      const eventName = availableEvents.find(e => e.id === selectedEventId)?.name || selectedEventId;
      const courseNameStr = availableCourses.find(c => c.id === selectedCourseId)?.name || selectedCourseId;
      
      const newEnrollment = {
        eventId: selectedEventId,
        eventName: eventName,
        courseId: selectedCourseId,
        courseName: courseNameStr
      };

      await updateDoc(doc(db, 'users', userId), {
        enrollments: arrayUnion(newEnrollment),
        eventIds: arrayUnion(selectedEventId)
      });

      addToast('Event access granted successfully!', 'success');
      setIsGrantModalOpen(false);
      
      const updatedUser = { ...userData };
      if (!updatedUser.enrollments) updatedUser.enrollments = [];
      updatedUser.enrollments.push(newEnrollment);
      setUserData(updatedUser);
    } catch (error) {
      console.error("Failed to grant access", error);
      addToast('Failed to grant access', 'error');
    } finally {
      setIsGranting(false);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      if (!userId || !eventId) return;
      setLoading(true);

      try {
        // 1. Fetch user data
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const uData = userDoc.data();

          if (uData.enrollments && Array.isArray(uData.enrollments)) {
            for (let i = 0; i < uData.enrollments.length; i++) {
              const en = uData.enrollments[i];
              if (!en.eventName && en.eventId) {
                const eDoc = await getDoc(doc(db, 'events', en.eventId));
                if (eDoc.exists()) en.eventName = eDoc.data().name;
              }
              if (!en.courseName && en.courseId) {
                const cDoc = await getDoc(doc(db, 'courses', en.courseId));
                if (cDoc.exists()) en.courseName = cDoc.data().name;
              }
            }
          }

          setUserData({ id: userDoc.id, ...uData });

          // Get course name
          if (uData.courseId) {
            const courseDoc = await getDoc(doc(db, 'courses', uData.courseId));
            if (courseDoc.exists()) {
              setCourseName(courseDoc.data().name);
            }
          }
        }

        // 2. Fetch results
        const resultsQ = query(collection(db, 'results'), where('userId', '==', userId));
        const resultsSnap = await getDocs(resultsQ);
        const fetchedResults = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        fetchedResults.sort((a, b) => {
          const timeA = a.completedAt?.toMillis?.() || new Date(a.completedAt || 0).getTime() || 0;
          const timeB = b.completedAt?.toMillis?.() || new Date(b.completedAt || 0).getTime() || 0;
          return timeB - timeA;
        });
        setResults(fetchedResults);

        // 3. Fetch quiz names for results
        const quizIds = [...new Set(fetchedResults.map(r => r.quizId))];
        const qNames: Record<string, string> = {};
        for (const qid of quizIds) {
          const quizDoc = await getDoc(doc(db, 'quizzes', qid));
          if (quizDoc.exists()) {
            qNames[qid] = quizDoc.data().name;
          } else {
            qNames[qid] = qid;
          }
        }
        setQuizNames(qNames);

        // 4. Fetch violations
        const violationsQ = query(collection(db, 'violations'), where('userId', '==', userId));
        const violationsSnap = await getDocs(violationsQ);
        const fetchedViolations = violationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        fetchedViolations.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setViolations(fetchedViolations);

        // 5. Fetch attendance
        const attendanceQ = query(collection(db, 'attendance'), where('userId', '==', userId));
        const attendanceSnap = await getDocs(attendanceQ);
        const fetchedAttendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        fetchedAttendance.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setAttendance(fetchedAttendance);

      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [userId, eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground font-medium">Loading user profile...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-2xl font-bold">User Not Found</h2>
        <Button onClick={() => navigate(`/admin/events/${eventId}/users`)}>Back to Users</Button>
      </div>
    );
  }

  // Compute stats
  const totalQuizzes = results.length;
  const avgScore = totalQuizzes > 0 ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / totalQuizzes) : 0;
  const bestScore = totalQuizzes > 0 ? Math.round(Math.max(...results.map(r => r.percentage || 0))) : 0;
  const dqCount = results.filter(r => r.isDisqualified).length;
  const totalViolations = violations.length;
  const totalAttendance = attendance.length;

  // Chart data
  const chartData = results.map((r, i) => ({
    name: quizNames[r.quizId]?.substring(0, 15) || `Quiz ${i + 1}`,
    score: r.percentage || 0,
  })).reverse();

  const formatTimestamp = (ts: string) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('en-IN', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata'
      });
    } catch { return ts; }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Back button and Actions */}
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={() => navigate(`/admin/events/${eventId}/users`)} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Button>
        <Button onClick={openGrantModal} size="sm" className="bg-primary hover:bg-primary/90 text-white cursor-pointer">
          Grant Event Access
        </Button>
      </div>

      {/* User Info Card */}
      <Card className="overflow-hidden border-0 ring-1 ring-border/50 shadow-md">
        <div className="h-2 bg-gradient-to-r from-primary via-blue-500 to-purple-500"></div>
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary flex items-center justify-center text-3xl font-black shrink-0">
              {userData.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{userData.name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    userData.status === 'approved' ? 'border-green-500 text-green-700 bg-green-50' :
                    userData.status === 'pending' ? 'border-amber-500 text-amber-700 bg-amber-50' :
                    'border-red-500 text-red-700 bg-red-50'
                  }`}>
                    {userData.status?.toUpperCase()}
                  </span>
                  {userData.questionSet && (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      userData.questionSet === 'A' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-purple-100 text-purple-700 border border-purple-300'
                    }`}>
                      Set {userData.questionSet}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{userData.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <span>{courseName || 'No Course'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="w-4 h-4 text-primary shrink-0" />
                  <span>{userData.mobile || 'No Mobile'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <span>{userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-IN') : '—'}</span>
                </div>
              </div>

              {/* Enrolled Events List */}
              {userData.enrollments && userData.enrollments.length > 0 && (
                <div className="pt-4 mt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold mb-2 text-foreground">Enrolled Events & Courses</h3>
                  <div className="flex flex-wrap gap-2">
                    {userData.enrollments.map((en: any, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-muted rounded-full text-xs font-medium border text-muted-foreground">
                        {en.eventName || en.eventId} — {en.courseName || en.courseId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Quizzes Taken', value: totalQuizzes, icon: Target, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Avg Score', value: `${avgScore}%`, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Best Score', value: `${bestScore}%`, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Disqualified', value: dqCount, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'Violations', value: totalViolations, icon: Shield, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Attendance', value: totalAttendance, icon: ClipboardCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        ].map((stat, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-black">{stat.value}</div>
              <div className="text-xs font-medium text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Performance Over Time</CardTitle>
            <CardDescription>Score percentage across all quizzes taken.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} fontSize={12} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`${value}%`, 'Score']}
                />
                <Bar dataKey="score" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Quiz Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-primary" />Quiz Results History</CardTitle>
          <CardDescription>All assessment results for this participant.</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No quiz results yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Quiz Name</th>
                    <th className="px-6 py-3 font-semibold">Score</th>
                    <th className="px-6 py-3 font-semibold">Percentage</th>
                    <th className="px-6 py-3 font-semibold">Correct</th>
                    <th className="px-6 py-3 font-semibold">Wrong</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{quizNames[r.quizId] || r.quizId}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-lg">{r.score}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${r.percentage || 0}%` }}></div>
                          </div>
                          <span className="text-sm font-medium">{Math.round(r.percentage || 0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-green-600 font-medium">{r.correctAnswers || 0}</td>
                      <td className="px-6 py-4 text-red-600 font-medium">{r.wrongAnswers || 0}</td>
                      <td className="px-6 py-4">
                        {r.isDisqualified ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">Disqualified</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Violations Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" />Violations Log</CardTitle>
          <CardDescription>All rule violations recorded during assessments.</CardDescription>
        </CardHeader>
        <CardContent>
          {violations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No violations recorded</p>
              <p className="text-xs mt-1">Clean record! 🎉</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Quiz</th>
                    <th className="px-6 py-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {violations.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                          {v.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{quizNames[v.quizId] || v.quizId}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatTimestamp(v.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-purple-500" />Attendance History</CardTitle>
          <CardDescription>Daily check-in records for this participant.</CardDescription>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No attendance records</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendance.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        {a.timestamp ? new Date(a.timestamp).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{formatTimestamp(a.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isGrantModalOpen} onClose={() => setIsGrantModalOpen(false)} title="Grant Event Access">
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Select Event</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">-- Choose an Event --</option>
              {availableEvents
                .filter(e => !(userData.enrollments || []).some((en: any) => en.eventId === e.id))
                .map(e => (
                  <option key={e.id} value={e.id}>{e.name} {e.status === 'active' ? '(Active)' : ''}</option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Select Course</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={!selectedEventId || availableCourses.length === 0}
            >
              <option value="">-- Choose a Course --</option>
              {availableCourses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {selectedEventId && availableCourses.length === 0 && (
              <p className="text-xs text-amber-600">No courses available for this event.</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsGrantModalOpen(false)}>Cancel</Button>
            <Button onClick={handleGrantAccess} isLoading={isGranting} disabled={!selectedEventId || !selectedCourseId}>
              Grant Access
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
