import React, { useEffect, useState } from 'react';
import { db, auth } from '../../config/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, doc, writeBatch, where, deleteDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ShieldAlert, Clock, GraduationCap, Briefcase } from 'lucide-react';
import { TimePicker } from '../../components/ui/TimePicker';
import { useToastStore } from '../../store/useToastStore';
import { motion } from 'framer-motion';

export const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // Event Form State
  const [newEventName, setNewEventName] = useState('');
  const [eventType, setEventType] = useState<'assessment' | 'interview'>('assessment');
  const [newEventDays, setNewEventDays] = useState('');
  
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [startAmPm, setStartAmPm] = useState('AM');
  
  const [endHour, setEndHour] = useState('05');
  const [endMinute, setEndMinute] = useState('00');
  const [endAmPm, setEndAmPm] = useState('PM');
  
  const { addToast } = useToastStore();
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'events'));
      const querySnapshot = await getDocs(q);
      const fetchedEvents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    if (eventType === 'assessment' && !newEventDays.trim()) return;

    const trimmedName = newEventName.trim();
    const isDuplicate = events.some(
      (event) => event.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      addToast("An event with this name already exists.", "error");
      return;
    }

    setIsCreating(true);
    try {
      const eventData: any = {
        name: trimmedName,
        eventType,
        createdAt: serverTimestamp(),
        status: 'inactive'
      };

      if (eventType === 'assessment') {
        eventData.days = newEventDays.trim();
        eventData.startTime = `${startHour}:${startMinute} ${startAmPm}`;
        eventData.endTime = `${endHour}:${endMinute} ${endAmPm}`;
      }

      const docRef = await addDoc(collection(db, 'events'), eventData);
      setEvents([...events, { 
        id: docRef.id, 
        ...eventData
      }]);
      setNewEventName('');
      setNewEventDays('');
      addToast(`${eventType === 'interview' ? 'Interview' : 'Assessment event'} created successfully`, "success");
    } catch (err) {
      console.error("Error creating event", err);
      addToast("Failed to create event", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetActiveEvent = async (eventId: string) => {
    try {
      const batch = writeBatch(db);
      
      const activeEventsQuery = query(collection(db, 'events'), where('status', '==', 'active'));
      const activeSnap = await getDocs(activeEventsQuery);
      
      activeSnap.forEach((activeDoc) => {
        if (activeDoc.id !== eventId) {
          batch.update(doc(db, 'events', activeDoc.id), { status: 'inactive' });
        }
      });
      
      batch.update(doc(db, 'events', eventId), { status: 'active' });
      
      await batch.commit();
      
      setEvents(events.map(event => ({
        ...event,
        status: event.id === eventId ? 'active' : 'inactive'
      })));
      addToast("Active event updated", "success");
    } catch (error) {
      console.error("Error setting active event:", error);
    }
  };

  const handleDeleteEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventToDelete || !auth.currentUser?.email) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, adminPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      await deleteDoc(doc(db, 'events', eventToDelete));
      
      setEvents(events.filter(ev => ev.id !== eventToDelete));
      addToast('Event deleted successfully', 'success');
      
      setEventToDelete(null);
      setAdminPassword('');
    } catch (error: any) {
      console.error("Error deleting event:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setDeleteError("Incorrect password. Please try again.");
      } else {
        setDeleteError("Failed to delete event. " + error.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const assessmentEvents = events.filter(e => !e.eventType || e.eventType === 'assessment');
  const interviewEvents = events.filter(e => e.eventType === 'interview');

  const renderEventCard = (event: any, index: number) => {
    const isInterview = event.eventType === 'interview';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        key={event.id}
      >
        <Link to={`/admin/events/${event.id}/dashboard`} className="w-full block h-full">
          <Card className="hover:shadow-md transition-shadow border-border overflow-hidden flex flex-col cursor-pointer group">
            <CardHeader className="bg-secondary/30 border-b border-border pb-4 group-hover:bg-secondary/50 transition-colors">
              <div className="flex justify-between items-start">
                <div className={`p-2.5 rounded-xl mb-2 ${isInterview ? 'bg-purple-500/10 text-purple-600' : 'bg-primary/10 text-primary'}`}>
                  {isInterview ? <Briefcase className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isInterview ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isInterview ? 'Interview' : 'Assessment'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${event.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {event.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    {event.status !== 'active' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSetActiveEvent(event.id);
                        }}
                      >
                        Set Active
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEventToDelete(event.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
              <CardTitle className="text-xl">{event.name}</CardTitle>
              <CardDescription className="flex flex-col gap-1 mt-1">
                {!isInterview && event.days && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Duration: {event.days}
                  </div>
                )}
                {!isInterview && event.startTime && event.endTime && (
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    {event.startTime} - {event.endTime}
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col justify-end">
              <div className={`w-full p-3.5 text-center text-sm font-medium transition-colors ${isInterview ? 'bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white' : 'bg-muted text-primary hover:bg-primary hover:text-primary-foreground'}`}>
                Manage {isInterview ? 'Interview' : 'Event'} &rarr;
              </div>
            </CardContent>
          </Card>
        </Link>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events & Interviews Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your assessment events and candidate interview sessions in distinct organized sections.</p>
        </div>
      </div>

      {/* Creation Form */}
      <Card className="border-primary/20 shadow-sm bg-primary/5">
        <CardContent className="p-6">
          <form onSubmit={handleCreateEvent} className="flex flex-col gap-4 xl:flex-row xl:items-end xl:flex-wrap w-full">
            <div className="flex-[2] space-y-2 min-w-[200px]">
              <label className="text-sm font-semibold text-foreground">Name</label>
              <Input 
                type="text" 
                placeholder={eventType === 'interview' ? 'e.g. Internship Batch - 2' : 'e.g. Spring Campus Hiring 2026'}
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                required
              />
            </div>

            <div className="flex-1 space-y-2 min-w-[160px]">
              <label className="text-sm font-semibold text-foreground">Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as 'assessment' | 'interview')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer shadow-sm"
              >
                <option value="assessment">Assessment Event</option>
                <option value="interview">Interview</option>
              </select>
            </div>

            {eventType === 'assessment' && (
              <>
                <div className="flex-1 space-y-2 min-w-[120px]">
                  <label className="text-sm font-semibold text-foreground">Duration</label>
                  <Input 
                    type="text" 
                    placeholder="e.g. 15 days"
                    value={newEventDays}
                    onChange={(e) => setNewEventDays(e.target.value)}
                    required
                  />
                </div>
                
                <div className="flex-1 space-y-2 min-w-[180px]">
                  <label className="text-sm font-semibold text-foreground">Start Time</label>
                  <TimePicker
                    hour={startHour}
                    minute={startMinute}
                    amPm={startAmPm}
                    onHourChange={setStartHour}
                    onMinuteChange={setStartMinute}
                    onAmPmChange={setStartAmPm}
                  />
                </div>
                
                <div className="flex-1 space-y-2 min-w-[180px]">
                  <label className="text-sm font-semibold text-foreground">End Time</label>
                  <TimePicker
                    hour={endHour}
                    minute={endMinute}
                    amPm={endAmPm}
                    onHourChange={setEndHour}
                    onMinuteChange={setEndMinute}
                    onAmPmChange={setEndAmPm}
                  />
                </div>
              </>
            )}
            
            <Button type="submit" isLoading={isCreating} className="gap-2 shrink-0 h-10 whitespace-nowrap px-6">
              <Plus className="w-4 h-4" />
              {eventType === 'interview' ? 'Add Interview' : 'Create Event'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        /* Split Layout: Left side Assessment Events, Right side Interviews */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Assessment Events */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Assessment Events</h2>
                  <p className="text-xs text-muted-foreground">Exams and quiz assessments</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {assessmentEvents.length} Total
              </span>
            </div>

            <div className="space-y-4">
              {assessmentEvents.map((event, index) => renderEventCard(event, index))}
              {assessmentEvents.length === 0 && (
                <EmptyState 
                  title="No Assessment Events"
                  description="Create an assessment event using the form above."
                  icon={<GraduationCap className="w-8 h-8" />}
                />
              )}
            </div>
          </div>

          {/* Right Column: Interviews */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Interviews</h2>
                  <p className="text-xs text-muted-foreground">Candidate interview sessions</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                {interviewEvents.length} Total
              </span>
            </div>

            <div className="space-y-4">
              {interviewEvents.map((event, index) => renderEventCard(event, index))}
              {interviewEvents.length === 0 && (
                <EmptyState 
                  title="No Interviews Found"
                  description="Select 'Interview' in the type dropdown above to create an interview session."
                  icon={<Briefcase className="w-8 h-8" />}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!eventToDelete}
        onClose={() => {
          setEventToDelete(null);
          setAdminPassword('');
          setDeleteError('');
        }}
        title="Security Verification"
        description="You are about to permanently delete this item. This action cannot be undone. Please enter your admin password to confirm."
      >
        <form onSubmit={handleDeleteEvent} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Admin Password</label>
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter your password"
              error={!!deleteError}
              required
              autoFocus
            />
            {deleteError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/>{deleteError}</p>}
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setEventToDelete(null);
                setAdminPassword('');
                setDeleteError('');
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              isLoading={isDeleting}
            >
              Confirm Deletion
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
