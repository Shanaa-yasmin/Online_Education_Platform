import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * ProtectedRoute - Guards a route against unauthenticated access.
 * @param {object} props
 * @param {React.ReactNode} props.children - The protected page component.
 * @param {string[]} [props.allowedRoles] - Optional list of roles allowed to access this route.
 */
export function ProtectedRoute({ children, allowedRoles, requireProfileComplete = true }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Verifying credentials...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireProfileComplete && !user.profile_complete) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
