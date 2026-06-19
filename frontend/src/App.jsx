import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import './App.css';

// Pages — will be built out fully in Phase 2 UI step
// Importing lazily so missing pages don't block the app shell from loading
import { lazy, Suspense } from 'react';

const LoginPage     = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage  = lazy(() => import('./pages/RegisterPage.jsx'));
const DashboardPage = lazy(() => import('./pages/Dashboard.jsx'));
const ProfilePage   = lazy(() => import('./pages/ProfilePage.jsx'));
const MentorDashboard = lazy(() => import('./pages/MentorDashboard.jsx'));
const CourseBuilder   = lazy(() => import('./pages/CourseBuilder.jsx'));
const AdminPanel      = lazy(() => import('./pages/AdminPanel.jsx'));
const CoursesPage     = lazy(() => import('./pages/CoursesPage.jsx'));
const CoursePage      = lazy(() => import('./pages/CoursePage.jsx'));
const LearningPlayer  = lazy(() => import('./pages/LearningPlayer.jsx'));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div></div>}>
          <Routes>
            {/* Public routes */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/courses" element={
              <ProtectedRoute>
                <CoursesPage />
              </ProtectedRoute>
            } />
            <Route path="/courses/:courseId" element={
              <ProtectedRoute>
                <CoursePage />
              </ProtectedRoute>
            } />
            <Route path="/courses/:courseId/learn" element={
              <ProtectedRoute>
                <LearningPlayer />
              </ProtectedRoute>
            } />

            {/* Mentor-only routes */}
            <Route path="/mentor/dashboard" element={
              <ProtectedRoute allowedRoles={['MENTOR', 'ADMIN']}>
                <MentorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/mentor/courses/:courseId/builder" element={
              <ProtectedRoute allowedRoles={['MENTOR', 'ADMIN']}>
                <CourseBuilder />
              </ProtectedRoute>
            } />

            {/* Admin-only routes */}
            <Route path="/admin/portal" element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminPanel />
              </ProtectedRoute>
            } />

            {/* Catch-all: redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
