import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage } from './pages/ChatPage';
import { Spinner } from './components/ui/Spinner';
import { JSX } from 'react';

// ─── Route Guards ─────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RequireOrg({ children }: { children: JSX.Element }) {
  const { isAuthenticated, orgId } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!orgId) return <Navigate to="/onboarding" replace />;
  return children;
}

function RootRedirect() {
  const { isAuthenticated, orgId } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!orgId) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireOrg>
            <DashboardPage />
          </RequireOrg>
        }
      />
      {/* Public chat — no auth required */}
      <Route path="/chat/:slug" element={<ChatPage />} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
