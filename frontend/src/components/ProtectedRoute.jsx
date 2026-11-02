import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, restoring } = useAuth();

  if (restoring) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center dark:bg-[#0b1326]">
        <div className="flex items-center gap-3 text-gray-400 dark:text-[#8d95b0]">
          <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
