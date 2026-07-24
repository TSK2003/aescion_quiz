import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthListener } from './hooks/useAuthListener';

import { Navigate } from 'react-router-dom';
// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { UnauthorizedPage } from './pages/auth/UnauthorizedPage';

// Admin Layouts
import { AdminLayout } from './components/admin/AdminLayout';
import { EventAdminLayout } from './components/admin/EventAdminLayout';

// Admin Pages
import { EventsPage } from './pages/admin/EventsPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UsersPage } from './pages/admin/UsersPage';
import { CoursesPage } from './pages/admin/CoursesPage';
import { QuizzesPage } from './pages/admin/QuizzesPage';
import { QuizCreatePage } from './pages/admin/QuizCreatePage';
import { UserProfilePage } from './pages/admin/UserProfilePage';

import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { ParticipantsAttendancePage } from './pages/admin/ParticipantsAttendancePage';

// Participant
import { ParticipantLayout } from './components/participant/ParticipantLayout';
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard';
import { WaitingRoomPage } from './pages/participant/WaitingRoomPage';
import { LiveQuizPage } from './pages/participant/LiveQuizPage';
import { ParticipantResultsPage } from './pages/participant/ParticipantResultsPage';

// Shared
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LiveTV } from './pages/LiveTV';
import { Toaster } from './components/ui/Toaster';

function App() {
  useAuthListener();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        
        {/* Global Admin (No Sidebar) */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<EventsPage />} />
        </Route>

        {/* Event-Scoped Admin (With Sidebar) */}
        <Route path="/admin/events/:eventId" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <EventAdminLayout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userId" element={<UserProfilePage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="quizzes" element={<QuizzesPage />} />
          <Route path="quizzes/create" element={<QuizCreatePage />} />

          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="attendance" element={<ParticipantsAttendancePage />} />
        </Route>
        
        <Route path="/live-tv" element={<LiveTV />} />

        <Route path="/participant" element={
          <ProtectedRoute allowedRoles={['participant']}>
            <ParticipantLayout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<ParticipantDashboard />} />
          <Route path="quiz/:quizId/waiting" element={<WaitingRoomPage />} />
          <Route path="quiz/:quizId/live" element={<LiveQuizPage />} />
          <Route path="results/:quizId" element={<ParticipantResultsPage />} />
          {/* We'll add more participant routes here later */}
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
