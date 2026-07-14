import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { lazy, Suspense } from 'react';
import './App.css';

const LandingPage         = lazy(() => import('./pages/LandingPage.jsx'));
const LoginPage           = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage        = lazy(() => import('./pages/RegisterPage.jsx'));
const VerifyEmailPage     = lazy(() => import('./pages/VerifyEmailPage.jsx'));
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage.jsx'));
const DashboardPage       = lazy(() => import('./pages/Dashboard.jsx'));
const ProfilePage         = lazy(() => import('./pages/ProfilePage.jsx'));
const NotificationCenter  = lazy(() => import('./pages/NotificationCenter.jsx'));
const MentorDashboard     = lazy(() => import('./pages/MentorDashboard.jsx'));
const CourseBuilder       = lazy(() => import('./pages/CourseBuilder.jsx'));
const AdminPanel          = lazy(() => import('./pages/AdminPanel.jsx'));
const AdminReports        = lazy(() => import('./pages/AdminReports.jsx'));
const CoursesPage         = lazy(() => import('./pages/CoursesPage.jsx'));
const CoursePage          = lazy(() => import('./pages/CoursePage.jsx'));
const LearningPlayer      = lazy(() => import('./pages/LearningPlayer.jsx'));
const MyCourses           = lazy(() => import('./pages/MyCourses.jsx'));

const Fallback = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100svh',background:'#FDF9F9'}}>
    <div style={{width:32,height:32,border:'2.5px solid #e8d5d5',borderTopColor:'#6B1A1A',borderRadius:'50%',animation:'spin 0.75s linear infinite'}} />
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
            <Route path="/"         element={<LandingPage />} />
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Protected (Profile Completion Required) */}
            <Route path="/complete-profile" element={<ProtectedRoute requireProfileComplete={false}><CompleteProfilePage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/profile"   element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationCenter /></ProtectedRoute>} />
            <Route path="/courses"   element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
            <Route path="/my-courses" element={<ProtectedRoute><MyCourses /></ProtectedRoute>} />
            <Route path="/courses/:courseId"       element={<ProtectedRoute><CoursePage /></ProtectedRoute>} />
            <Route path="/courses/:courseId/learn" element={<ProtectedRoute><LearningPlayer /></ProtectedRoute>} />

            {/* Mentor */}
            <Route path="/mentor/dashboard"                    element={<ProtectedRoute allowedRoles={['MENTOR','ADMIN']}><MentorDashboard /></ProtectedRoute>} />
            <Route path="/mentor/courses/:courseId/builder"    element={<ProtectedRoute allowedRoles={['MENTOR','ADMIN']}><CourseBuilder /></ProtectedRoute>} />

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
