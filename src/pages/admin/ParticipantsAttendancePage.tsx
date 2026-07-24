import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { useParams } from 'react-router-dom';
import { UserCheck, Clock, Users, Pencil, Trash2, Search, Calendar, X, Check, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../store/useToastStore';

interface AttendanceRecord {
  id: string;
  participantName: string;
  participantEmail: string;
  userId: string;
  eventId: string;
  timestamp: string;
  status: string;
}

export const ParticipantsAttendancePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const { addToast } = useToastStore();
  
  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>('detailed');
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    participantName: '',
    participantEmail: '',
    timestamp: ''
  });

  // Location Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationForm, setLocationForm] = useState({ latitude: '', longitude: '', radius: '50' });

  const handleOpenLocationModal = async () => {
    setIsLocationModalOpen(true);
    if (!eventId) return;
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        const data = eventDoc.data();
        if (data.location) {
          setLocationForm({
            latitude: data.location.latitude?.toString() || '',
            longitude: data.location.longitude?.toString() || '',
            radius: data.location.radius?.toString() || '50'
          });
        }
      }
    } catch (error) {
      console.error("Error fetching location:", error);
    }
  };

  useEffect(() => {
    if (!eventId) return;

    const q = query(
      collection(db, 'attendance'),
      where('eventId', '==', eventId),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AttendanceRecord));

      // Sort by timestamp descending (newest first)
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecords(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching attendance:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [eventId]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this attendance record?')) {
      try {
        await deleteDoc(doc(db, 'attendance', id));
      } catch (error) {
        console.error('Error deleting record:', error);
      }
    }
  };

  const handleEdit = (record: AttendanceRecord) => {
    setEditingId(record.id);
    
    // Convert to local datetime string for input type="datetime-local"
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(new Date(record.timestamp).getTime() - tzoffset)).toISOString().slice(0, 16);
    
    setEditFormData({
      participantName: record.participantName,
      participantEmail: record.participantEmail,
      timestamp: localISOTime
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'attendance', id), {
        participantName: editFormData.participantName,
        participantEmail: editFormData.participantEmail,
        timestamp: new Date(editFormData.timestamp).toISOString()
      });
      setEditingId(null);
    } catch (error) {
      console.error('Error updating record:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveLocation = async () => {
    if (!eventId) return;
    
    const lat = parseFloat(locationForm.latitude);
    const lng = parseFloat(locationForm.longitude);
    const rad = parseFloat(locationForm.radius);
    
    if (isNaN(lat) || isNaN(lng) || isNaN(rad)) {
      addToast('Please enter valid numbers for latitude, longitude, and radius', 'error');
      return;
    }

    setIsUpdatingLocation(true);
    try {
      await updateDoc(doc(db, 'events', eventId), {
        location: { latitude: lat, longitude: lng, radius: rad }
      });
      addToast('Event location updated successfully', 'success');
      setIsLocationModalOpen(false);
    } catch (error) {
      console.error('Error updating location:', error);
      addToast('Failed to update event location', 'error');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.participantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          record.participantEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
    const matchesDate = dateFilter ? recordDate === dateFilter : true;

    return matchesSearch && matchesDate;
  });

  // Summary Data calculation
  const summaryData = React.useMemo(() => {
    const summary: Record<string, { name: string, email: string, days: number }> = {};
    filteredRecords.forEach(record => {
      if (!summary[record.userId]) {
        summary[record.userId] = { name: record.participantName, email: record.participantEmail, days: 0 };
      }
      if (record.status === 'Check In') {
        summary[record.userId].days += 1;
      }
    });
    return Object.values(summary).sort((a, b) => b.days - a.days);
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Participants Attendance</h1>
          <p className="text-muted-foreground">Monitor Participants Attendances</p>
        </div>
        <Button onClick={handleOpenLocationModal} className="gap-2 shrink-0">
          <MapPin className="w-4 h-4" />
          Update Event Location
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Check-Ins</p>
              <p className="text-2xl font-bold">{records.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Checked In</p>
              <p className="text-2xl font-bold">{records.filter(r => r.status === 'Check In').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Latest Check-In</p>
              <p className="text-sm font-semibold">
                {records.length > 0 ? formatTimestamp(records[0].timestamp) : 'No records'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Attendance Records
              </CardTitle>
              <CardDescription>Real-time attendance tracking for all participants.</CardDescription>
            </div>

            <div className="flex bg-muted p-1 rounded-lg self-start md:self-center">
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'detailed' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Detailed View
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'summary' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Summary View (Excel-like)
              </button>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-[250px]"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-[150px]"
                />
                {dateFilter && (
                  <button 
                    onClick={() => setDateFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-3"></div>
              <p className="text-muted-foreground">Loading attendance records...</p>
            </div>
          ) : viewMode === 'summary' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Participant Name</th>
                    <th className="px-6 py-3 font-semibold">Email ID</th>
                    <th className="px-6 py-3 font-semibold">Total Days Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map((data, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {data.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium">{data.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {data.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                          {data.days} Days
                        </span>
                      </td>
                    </tr>
                  ))}
                  {summaryData.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                        No attendance data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Participant Name</th>
                    <th className="px-6 py-3 font-semibold">Email ID</th>
                    <th className="px-6 py-3 font-semibold">Timestamp</th>
                    <th className="px-6 py-3 font-semibold">Check Status</th>
                    <th className="px-6 py-3 font-semibold text-center">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      {editingId === record.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editFormData.participantName}
                              onChange={(e) => setEditFormData({...editFormData, participantName: e.target.value})}
                              className="px-3 py-1.5 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="email"
                              value={editFormData.participantEmail}
                              onChange={(e) => setEditFormData({...editFormData, participantEmail: e.target.value})}
                              className="px-3 py-1.5 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="datetime-local"
                              value={editFormData.timestamp}
                              onChange={(e) => setEditFormData({...editFormData, timestamp: e.target.value})}
                              className="px-3 py-1.5 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveEdit(record.id)}
                                className="p-1.5 bg-green-100 text-green-600 hover:bg-green-200 rounded-md transition-colors"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {record.participantName?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <span className="font-medium">{record.participantName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {record.participantEmail}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTimestamp(record.timestamp)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(record)}
                                className="p-1.5 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-md transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(record.id)}
                                className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-md transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                            {records.length === 0 ? (
                              <UserCheck className="w-8 h-8 text-muted-foreground/50" />
                            ) : (
                              <Search className="w-8 h-8 text-muted-foreground/50" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {records.length === 0 ? 'No attendance records yet' : 'No records match your search'}
                            </p>
                            <p className="text-muted-foreground text-sm mt-1">
                              {records.length === 0 
                                ? 'Attendance will appear here when participants check in.'
                                : 'Try adjusting your filters.'}
                            </p>
                          </div>
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

      {/* Location Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg border-border">
            <CardHeader>
              <CardTitle>Update Event Location</CardTitle>
              <CardDescription>Enter the latitude and longitude for the event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Latitude</label>
                <input 
                  type="text" 
                  value={locationForm.latitude} 
                  onChange={(e) => setLocationForm({...locationForm, latitude: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. 12.9716"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Longitude</label>
                <input 
                  type="text" 
                  value={locationForm.longitude} 
                  onChange={(e) => setLocationForm({...locationForm, longitude: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. 77.5946"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Allowed Radius (meters)</label>
                <input 
                  type="text" 
                  value={locationForm.radius} 
                  onChange={(e) => setLocationForm({...locationForm, radius: e.target.value})}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. 50"
                />
              </div>
            </CardContent>
            <div className="flex justify-end gap-3 p-6 pt-0">
              <Button variant="ghost" onClick={() => setIsLocationModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveLocation} isLoading={isUpdatingLocation}>Save Location</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

