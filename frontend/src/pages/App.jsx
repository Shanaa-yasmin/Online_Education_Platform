import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { lazy, Suspense } from 'react';
import './App.css';

const LandingPage     = lazy(() => import('./pages/LandingPage.jsx'));
const LoginPage       = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage    = lazy(() => import('./pages/RegisterPage.jsx'));
const DashboardPage   = lazy(() => import('./pages/Dashboard.jsx'));
const ProfilePage     = lazy(() => import('./pages/ProfilePage.jsx'));
const MentorDashboard = lazy(() => import('./pages/MentorDashboard.jsx'));
const CourseBuilder   = lazy(() => import('./pages/CourseBuilder.jsx'));
const AdminPanel      = lazy(() => import('./pages/AdminPanel.jsx'));
const CoursesPage     = lazy(() => import('./pages/CoursesPage.jsx'));
const CoursePage      = lazy(() => import('./pages/CoursePage.jsx'));
const LearningPlayer  = lazy(() => import('./pages/LearningPlayer.jsx'));

const Fallback = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100svh',background:'#F5F5F5'}}>
    <div style={{width:32,height:32,border:'2.5px solid #e4e4e4',borderTopColor:'#309D8E',borderRadius:'50%',animation:'spin 0.75s linear infinite'}} />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Fallback />}>
          <Routes>
            {/* Public */}
            <Route path="/"         element={<LandingPage />} />
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/profile"   element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/courses"   element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
            <Route path="/courses/:courseId"       element={<ProtectedRoute><CoursePage /></ProtectedRoute>} />
            <Route path="/courses/:courseId/learn" element={<ProtectedRoute><LearningPlayer /></ProtectedRoute>} />

            {/* Mentor */}
            <Route path="/mentor/dashboard"                    element={<ProtectedRoute allowedRoles={['MENTOR','ADMIN']}><MentorDashboard /></ProtectedRoute>} />
            <Route path="/mentor/courses/:courseId/builder"    element={<ProtectedRoute allowedRoles={['MENTOR','ADMIN']}><CourseBuilder /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin/portal" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminPanel /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
