import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Clients from './pages/Clients';
import MyPoints from './pages/MyPoints';
import PrizeDesigner from './pages/PrizeDesigner';
import BusinessSettings from './pages/BusinessSettings';
import StaffManagement from './pages/StaffManagement';
import { useAuth } from './context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  // Basic security check: Only 'admin' role can access admin-only pages
  // Cashiers/Staff are blocked from here
  const role = user.user_metadata?.role;
  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Register />} />
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
      </Routes>
    </Router>
  );
}

export default App;
