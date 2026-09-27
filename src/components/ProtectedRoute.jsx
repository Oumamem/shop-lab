import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from './ui.jsx';
import Forbidden from '../pages/Forbidden.jsx';

export default function ProtectedRoute({ role }) {
  const { user, loading, sessionExpired } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}${sessionExpired ? '&expired=1' : ''}`} replace />;
  }
  if (role && user.role !== role) return <Forbidden />;
  return <Outlet />;
}
