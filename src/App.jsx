import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Clients from './pages/Clients';
import MyPoints from './pages/MyPoints';
import PrizeDesigner from './pages/PrizeDesigner';
import BusinessSettings from './pages/BusinessSettings';
import StaffManagement from './pages/StaffManagement';
import PlatformControl from './pages/PlatformControl';
import KPIDashboard from './pages/KPIDashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ActivityHistory from './pages/ActivityHistory';
import Subscription from './pages/Subscription';
import { useAuth } from './context/AuthContext';
import BackNavigationHandler from './components/BackNavigationHandler';
// Registro de PWA movido a main.jsx para máxima compatibilidad
// Splash Screen desactivada para restaurar PWA original

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  
  const isExpired = user.businessStatus?.is_expired && !user.is_super_admin;
  
  // If expired, and NOT on subscription page, redirect to subscription
  if (isExpired && window.location.pathname !== '/subscription') {
    return <Navigate to="/subscription" replace />;
  }
  
  return children;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const isExpired = user.businessStatus?.is_expired && !user.is_super_admin;
  const role = user.role;
  
  // Special case: allow access to subscription page for admins even if expired
  if (window.location.pathname === '/subscription') {
    if (role === 'admin') return children;
    // For cashiers, we allow them to enter the page so ProtectedRoute doesn't loop them,
    // but the Subscription page itself should handle the limited view.
    return children; 
  }

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user || !user.is_super_admin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  // const [showSplash, setShowSplash] = useState(true);

  return (
    <Router>
      {/* showSplash && <SplashScreen onComplete={() => setShowSplash(false)} /> */}
      {/* Notificación PWA desactivada para forzar el banner nativo del navegador */}
      <BackNavigationHandler />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-points"
          element={
            <ProtectedRoute>
              <MyPoints />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity-history"
          element={
            <ProtectedRoute>
              <ActivityHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prizes"
          element={
            <AdminRoute>
              <PrizeDesigner />
            </AdminRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <AdminRoute>
              <BusinessSettings />
            </AdminRoute>
          }
        />
        <Route
          path="/settings/staff"
          element={
            <AdminRoute>
              <StaffManagement />
            </AdminRoute>
          }
        />
        <Route
          path="/kpi"
          element={
            <AdminRoute>
              <KPIDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <AdminRoute>
              <Subscription />
            </AdminRoute>
          }
        />
        <Route
          path="/platform-admin"
          element={
            <SuperAdminRoute>
              <PlatformControl />
            </SuperAdminRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
