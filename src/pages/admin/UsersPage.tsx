import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useParams, useNavigate } from 'react-router-dom';
import { useToastStore } from '../../store/useToastStore';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Eye, GripVertical } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchName, setSearchName] = useState('');
  const { addToast } = useToastStore();
  const [userToDelete, setUserToDelete] = useState<string | null>(null);



  // Drag state
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const coursesQ = query(collection(db, 'courses'), where('eventId', '==', eventId));
      const coursesSnap = await getDocs(coursesQ);
      const fetchedCourses = coursesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setCourses(fetchedCourses);

      const q1 = query(collection(db, 'users'), where('eventId', '==', eventId));
      const q2 = query(collection(db, 'users'), where('eventIds', 'array-contains', eventId));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const userMap = new Map();
      snap1.docs.forEach(doc => userMap.set(doc.id, { id: doc.id, ...doc.data() } as any));
      snap2.docs.forEach(doc => userMap.set(doc.id, { id: doc.id, ...doc.data() } as any));
      
      const fetchedUsers = Array.from(userMap.values())
        .filter((user: any) => user.role === 'participant');
        
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      addToast(`User status updated to ${newStatus}`, 'success');
    } catch (error) {
      console.error("Error updating status:", error);
      addToast("Failed to update user status.", 'error');
    }
  };

  const handleUpdateCourse = async (userId: string, newCourseId: string) => {
    if (!newCourseId) return;
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      const updates: any = {};
      
      if (user.eventId === eventId) {
        updates.courseId = newCourseId;
      }
      
      if (user.enrollments) {
        const newEnrollments = user.enrollments.map((en: any) => {
          if (en.eventId === eventId) {
            return { ...en, courseId: newCourseId, courseName: getCourseName(newCourseId) };
          }
          return en;
        });
        updates.enrollments = newEnrollments;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', userId), updates);
        setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
        addToast("User course updated", 'success');
      }
    } catch (error) {
      console.error("Error updating course:", error);
      addToast("Failed to change user course.", 'error');
    }
  };

  const handleRemoveUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete));
      setUsers(users.filter(u => u.id !== userToDelete));
      addToast("User removed successfully", 'success');
    } catch (error) {
      console.error("Error removing user:", error);
      addToast("Failed to remove user.", 'error');
    } finally {
      setUserToDelete(null);
    }
  };

  // ── Question Set Drag & Drop ──
  const handleUpdateQuestionSet = async (userId: string, questionSet: 'A' | 'B' | null) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { questionSet: questionSet || '' });
      setUsers(users.map(u => u.id === userId ? { ...u, questionSet: questionSet || '' } : u));
    } catch (error) {
      console.error("Error updating question set:", error);
      addToast("Failed to update question set.", 'error');
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent, userId: string) => {
    setDraggedUserId(userId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', userId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedUserId(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetSet: 'A' | 'B' | null) => {
    e.preventDefault();
    const userId = e.dataTransfer.getData('text/plain');
    if (userId) {
      handleUpdateQuestionSet(userId, targetSet);
    }
  }, [users]);



  const filteredUsers = users.filter(u => {
    const matchesCourse = selectedCourse === 'all' || u.courseId === selectedCourse;
    const matchesName = u.name?.toLowerCase().includes(searchName.toLowerCase());
    return matchesCourse && matchesName;
  });

  const approvedUsers = users.filter(u => u.status === 'approved');
  const setAUsers = approvedUsers.filter(u => u.questionSet === 'A');
  const setBUsers = approvedUsers.filter(u => u.questionSet === 'B');
  const unassignedUsers = approvedUsers.filter(u => !u.questionSet || (u.questionSet !== 'A' && u.questionSet !== 'B'));



  const getUserCourseId = (user: any) => {
    if (user.eventId === eventId) return user.courseId;
    if (user.enrollments) {
      const en = user.enrollments.find((e: any) => e.eventId === eventId);
      if (en) return en.courseId;
    }
    return user.courseId;
  };

  const getCourseName = (courseId: string) => courses.find(c => c.id === courseId)?.name || courseId;

  const renderDraggableUser = (user: any) => (
    <div
      key={user.id}
      draggable
      onDragStart={(e) => handleDragStart(e, user.id)}
      onDragEnd={handleDragEnd}
      className={`flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:border-primary/30 group ${
        draggedUserId === user.id ? 'opacity-50 scale-95' : ''
      }`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary shrink-0" />
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
        {user.name?.charAt(0)?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate">{getCourseName(getUserCourseId(user))}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Approvals</h1>
          <p className="text-muted-foreground">Manage participant access to the platform.</p>
        </div>
        <div className="flex items-center gap-3">

          <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border shadow-sm">
            <label className="text-sm font-medium text-muted-foreground ml-2">Course:</label>
            <div className="relative">
              <select 
                value={selectedCourse} 
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="appearance-none text-sm bg-background border border-border focus:ring-2 focus:ring-primary rounded-md py-2 pl-3 pr-8 cursor-pointer hover:bg-secondary/50 transition-colors shadow-sm outline-none"
              >
                <option value="all">All Courses</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Participants Table */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Participants List</CardTitle>
              <CardDescription>View, approve, reject, modify, or remove users.</CardDescription>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="pl-8 pr-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-[250px]"
              />
              <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Email</th>
                    <th className="px-6 py-4 font-semibold">Password</th>
                    <th className="px-6 py-4 font-semibold">Course</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{user.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{user.password || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <div className="relative inline-block w-full">
                          <select 
                            value={getUserCourseId(user) || ''}  
                            onChange={(e) => handleUpdateCourse(user.id, e.target.value)}
                            className="appearance-none w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background cursor-pointer hover:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors pr-6 shadow-sm"
                          >
                            <option value="">No Course</option>
                            {courses.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-muted-foreground">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border border-1
                          ${user.status === 'approved' ? 'border-green-700 text-green-700' : 
                            user.status === 'pending' ? 'border-amber-700 text-amber-700' : 
                            'border-red-700 text-red-700'}`}>
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/admin/events/${eventId}/users/${user.id}`)} className="cursor-pointer gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                        {user.status === 'pending' && (
                          <>
                            <Button size="sm" onClick={() => handleUpdateStatus(user.id, 'approved')} className="bg-green-600 hover:bg-green-700 text-white shadow-sm cursor-pointer">Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(user.id, 'rejected')} className="cursor-pointer shadow-sm">Reject</Button>
                          </>
                        )}
                        {user.status === 'approved' && (
                          <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50 cursor-pointer" onClick={() => handleUpdateStatus(user.id, 'suspended')}>Suspend</Button>
                        )}
                        {(user.status === 'suspended' || user.status === 'rejected') && (
                          <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => handleUpdateStatus(user.id, 'approved')}>Restore</Button>
                        )}
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer" onClick={() => setUserToDelete(user.id)}>Remove</Button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <p>No participants found in this course.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Set Assignment - Drag & Drop */}
      {approvedUsers.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Question Set Assignment
            </CardTitle>
            <CardDescription>Drag and drop approved users between Set A and Set B. Changes save automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Set A */}
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'A')}
                className={`rounded-2xl border-2 border-dashed p-4 min-h-[200px] transition-all ${
                  draggedUserId ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-500/5' : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-sm">A</div>
                  <div>
                    <h3 className="font-semibold text-sm">Set A</h3>
                    <p className="text-xs text-muted-foreground">{setAUsers.length} participants</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {setAUsers.map(renderDraggableUser)}
                  {setAUsers.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed border-border/50 rounded-xl">
                      Drop users here for Set A
                    </div>
                  )}
                </div>
              </div>

              {/* Set B */}
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'B')}
                className={`rounded-2xl border-2 border-dashed p-4 min-h-[200px] transition-all ${
                  draggedUserId ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-500/5' : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold text-sm">B</div>
                  <div>
                    <h3 className="font-semibold text-sm">Set B</h3>
                    <p className="text-xs text-muted-foreground">{setBUsers.length} participants</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {setBUsers.map(renderDraggableUser)}
                  {setBUsers.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed border-border/50 rounded-xl">
                      Drop users here for Set B
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Unassigned */}
            {unassignedUsers.length > 0 && (
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null)}
                className={`rounded-2xl border-2 border-dashed p-4 transition-all ${
                  draggedUserId ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-500/5' : 'border-border bg-muted/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm">?</div>
                  <div>
                    <h3 className="font-semibold text-sm">Unassigned</h3>
                    <p className="text-xs text-muted-foreground">{unassignedUsers.length} participants need assignment</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {unassignedUsers.map(renderDraggableUser)}
                </div>
              </div>
            )}

            {approvedUsers.length > 0 && unassignedUsers.length === 0 && (
              <div className="text-center py-4 text-sm text-success font-medium">
                ✅ All approved users have been assigned to a question set.
              </div>
            )}
          </CardContent>
        </Card>
      )}



      <ConfirmModal
        isOpen={!!userToDelete}
        title="Remove User"
        description="Are you sure you want to permanently delete this user record? This action cannot be undone."
        confirmText="Remove User"
        onConfirm={handleRemoveUser}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};
