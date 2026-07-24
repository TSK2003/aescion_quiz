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
import { Folder, Plus, Calendar, Trash2, ShieldAlert, Clock } from 'lucide-react';
import { TimePicker } from '../../components/ui/TimePicker';
import { useToastStore } from '../../store/useToastStore';
import { motion } from 'framer-motion';

export const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // Event Form State
  const [newEventName, setNewEventName] = useState('');
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
    if (!newEventName.trim() || !newEventDays.trim()) return;

    const trimmedName = newEventName.trim();
    const isDuplicate = events.some(
      (event) => event.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      addToast("An event with this name already exists.", "error");
      return;
    }
    
    const startTime = `${startHour}:${startMinute} ${startAmPm}`;
    const endTime = `${endHour}:${endMinute} ${endAmPm}`;

    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'events'), {
        name: trimmedName,
        days: newEventDays.trim(),
        startTime,
        endTime,
        createdAt: serverTimestamp(),
        status: 'inactive'
      });
      setEvents([...events, { 
        id: docRef.id, 
        name: trimmedName, 
        days: newEventDays.trim(),
        startTime,
        endTime,
        status: 'inactive' 
      }]);
      setNewEventName('');
      setNewEventDays('');
      addToast("Event created successfully", "success");
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
      
      // Set all currently active events to inactive
      const activeEventsQuery = query(collection(db, 'events'), where('status', '==', 'active'));
      const activeSnap = await getDocs(activeEventsQuery);
      
      activeSnap.forEach((activeDoc) => {
        if (activeDoc.id !== eventId) {
          batch.update(doc(db, 'events', activeDoc.id), { status: 'inactive' });
        }
      });
      
      // Set the target event to active
      batch.update(doc(db, 'events', eventId), { status: 'active' });
      
      await batch.commit();
      
      // Update local state
      setEvents(events.map(event => ({
        ...event,
        status: event.id === eventId ? 'active' : 'inactive'
      })));
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
      // 1. Re-authenticate admin
      const credential = EmailAuthProvider.credential(auth.currentUser.email, adminPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // 2. Delete the event from Firestore
      await deleteDoc(doc(db, 'events', eventToDelete));
      
      setEvents(events.filter(ev => ev.id !== eventToDelete));
      addToast('Event deleted successfully', 'success');
      
      // Reset modal state
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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage all your assessment events. Select an event to manage its users, courses, and quizzes.</p>
        </div>
      </div>

      <Card className="border-primary/20 shadow-sm bg-primary/5">
        <CardContent className="p-6">
          <form onSubmit={handleCreateEvent} className="flex flex-col gap-4 xl:flex-row xl:items-end xl:flex-wrap w-full">
            <div className="flex-[2] space-y-2 min-w-[200px]">
              <label className="text-sm font-semibold text-foreground">Event Name</label>
              <Input 
                type="text" 
                placeholder="e.g. Spring Campus Hiring 2026"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                required
              />
            </div>
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
            
            <Button type="submit" isLoading={isCreating} className="gap-2 shrink-0 h-10 whitespace-nowrap px-6">
              <Plus className="w-4 h-4" />
              Create Event
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event, index) => (
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
                  <div className="p-2 bg-primary/10 rounded-lg text-primary mb-2">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${event.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {event.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex gap-2">
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
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Created recently
                  </div>
                  {event.duration && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Duration: {event.duration}
                    </div>
                  )}
                  {event.days && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Duration: {event.days}
                    </div>
                  )}
                  {event.startTime && event.endTime && (
                    <div className="flex items-center gap-1 mt-0.5 text-xs">
                      <Clock className="w-3 h-3" />
                      {event.startTime} - {event.endTime}
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col justify-end">
                
                  <div className="w-full p-4 bg-muted text-center text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                    Manage Event &rarr;
                  </div>
              </CardContent>
            </Card>
            </Link>
            </motion.div>
          ))}
          {events.length === 0 && (
            <div className="col-span-full">
              <EmptyState 
                title="No Events Found"
                description="Get started by creating your first assessment event using the form above."
                icon={<Folder className="w-8 h-8" />}
              />
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={!!eventToDelete}
        onClose={() => {
          setEventToDelete(null);
          setAdminPassword('');
          setDeleteError('');
        }}
        title="Security Verification"
        description="You are about to permanently delete an event. This action cannot be undone. Please enter your admin password to confirm."
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
