import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSync } from './hooks/useSync';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import DeckList from './pages/DeckList';
import Review from './pages/Review';
import Generate from './pages/Generate';

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  useSync();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[700px] mx-auto">
        <Routes>
          <Route path="/" element={<DeckList />} />
          <Route path="/review" element={<Review />} />
          <Route path="/generate" element={<Generate />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<AuthenticatedLayout />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
