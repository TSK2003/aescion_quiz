import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, doc, where, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { useParams } from 'react-router-dom';
import { useToastStore } from '../../store/useToastStore';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const CoursesPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { addToast } = useToastStore();
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  const fetchCourses = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'courses'), where('eventId', '==', eventId));
      const querySnapshot = await getDocs(q);
      const fetchedCourses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCourses(fetchedCourses);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [eventId]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCourseName.trim();
    if (!trimmedName || !eventId) return;
    
    // Check for duplicate course names (case-insensitive)
    const isDuplicate = courses.some(course => course.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      addToast("A course with this name already exists", "error");
      return;
    }

    setIsAdding(true);
    try {
      const docRef = await addDoc(collection(db, 'courses'), {
        name: trimmedName,
        description: newCourseDesc.trim(),
        eventId: eventId,
        createdAt: new Date().toISOString()
      });
      setCourses([...courses, { id: docRef.id, name: trimmedName, description: newCourseDesc.trim(), eventId }]);
      setNewCourseName('');
      setNewCourseDesc('');
      addToast("Course created successfully", 'success');
    } catch (error) {
      console.error("Error adding course:", error);
      addToast("Failed to create course", 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      const batch = writeBatch(db);

      // 1. Delete course doc
      batch.delete(doc(db, 'courses', courseToDelete));

      // 2. Delete quizzes for this course
      const qQuery = query(collection(db, 'quizzes'), where('courseId', '==', courseToDelete));
      const qSnap = await getDocs(qQuery);
      qSnap.docs.forEach(d => batch.delete(d.ref));

      // 3. Delete questionSets for this course
      const qsQuery = query(collection(db, 'questionSets'), where('courseId', '==', courseToDelete));
      const qsSnap = await getDocs(qsQuery);
      qsSnap.docs.forEach(d => batch.delete(d.ref));

      // 4. Delete participants for this course
      const pQuery = query(collection(db, 'participants'), where('courseId', '==', courseToDelete));
      const pSnap = await getDocs(pQuery);
      pSnap.docs.forEach(d => batch.delete(d.ref));

      // 5. Delete results for this course
      const rQuery = query(collection(db, 'results'), where('courseId', '==', courseToDelete));
      const rSnap = await getDocs(rQuery);
      rSnap.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();

      setCourses(courses.filter(c => c.id !== courseToDelete));
      addToast("Course and all associated data deleted successfully from Firebase", 'success');
    } catch (error) {
      console.error("Error deleting course:", error);
      addToast("Failed to delete course", 'error');
    } finally {
      setCourseToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Programs & Specialization Tracks</h1>
        <p className="text-muted-foreground">Manage assessment domains, modules, and specialization tracks for participants.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Add Program / Track</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="courseName">Track / Program Name</Label>
                  <Input 
                    id="courseName" 
                    placeholder="e.g., Technical Assessment - Batch A" 
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courseDesc">Description (Optional)</Label>
                  <Input 
                    id="courseDesc" 
                    placeholder="Short description" 
                    value={newCourseDesc}
                    onChange={(e) => setNewCourseDesc(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" isLoading={isAdding}>
                  Create Course
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Existing Courses</CardTitle>
              <CardDescription>All available courses in the platform.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {courses.map(course => (
                    <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                      <div>
                        <h3 className="font-semibold">{course.name}</h3>
                        {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
                        <div className="text-xs text-muted-foreground mt-1">ID: {course.id}</div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => setCourseToDelete(course.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
                  {courses.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      No courses created yet.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!courseToDelete}
        title="Delete Course"
        description="Are you sure you want to delete this course? This might break existing assignments."
        confirmText="Delete"
        onConfirm={handleDeleteCourse}
        onCancel={() => setCourseToDelete(null)}
      />
    </div>
  );
};
