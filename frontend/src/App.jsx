import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute.jsx';
import { lazy, Suspense } from 'react';
import './App.css';

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage.jsx'));
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage.jsx'));
const DashboardPage = lazy(() => import('./pages/Dashboard.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter.jsx'));
const CourseBuilder = lazy(() => import('./pages/CourseBuilder.jsx'));
const QAPage = lazy(() => import('./pages/QAPage.jsx'));
const PaymentLogs = lazy(() => import('./pages/PaymentLogs.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const AdminPanel = lazy(() => import('./pages/AdminPanel.jsx'));
const AdminReports = lazy(() => import('./pages/AdminReports.jsx'));
const CoursesPage = lazy(() => import('./pages/CoursesPage.jsx'));
const CoursePage = lazy(() => import('./pages/CoursePage.jsx'));
const LearningPlayer = lazy(() => import('./pages/LearningPlayer.jsx'));
const MyCourses = lazy(() => import('./pages/MyCourses.jsx'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess.jsx'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage.jsx'));

const Fallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100svh', background: '#FDF9F9' }}>
    <div style={{ width: 32, height: 32, border: '2.5px solid #e8d5d5', borderTopColor: '#6B1A1A', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
  </div>
);

function AppContent() {
  const { user } = useAuth();
  return (
    <NotificationProvider user={user}>
      <BrowserRouter>
        <Suspense fallback={<Fallback />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Protected (Profile Completion Required) */}
            <Route path="/complete-profile" element={<ProtectedRoute requireProfileComplete={false}><CompleteProfilePage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationCenter /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
            <Route path="/my-courses" element={<ProtectedRoute><MyCourses /></ProtectedRoute>} />
            <Route path="/courses/:courseId" element={<ProtectedRoute><CoursePage /></ProtectedRoute>} />
            <Route path="/courses/:courseId/learn" element={<ProtectedRoute><LearningPlayer /></ProtectedRoute>} />
            <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
            <Route path="/announcements/:announcementId" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />

            {/* Mentor */}
            <Route path="/mentor/courses/:courseId/builder" element={<ProtectedRoute allowedRoles={['MENTOR', 'ADMIN']}><CourseBuilder /></ProtectedRoute>} />
            {/* Q&A page (All authenticated users) */}
            <Route path="/qa" element={<ProtectedRoute><QAPage /></ProtectedRoute>} />
            <Route path="/mentor/payments" element={<ProtectedRoute allowedRoles={['MENTOR', 'ADMIN']}><PaymentLogs /></ProtectedRoute>} />
            <Route path="/mentor/analytics" element={<ProtectedRoute allowedRoles={['MENTOR', 'ADMIN']}><AnalyticsPage /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin/portal" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminPanel /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminReports /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </NotificationProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;