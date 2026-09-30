import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Keyspaces from './pages/Keyspaces';
import Tables from './pages/Tables';
import DataExplorer from './pages/DataExplorer';
import Monitor from './pages/Monitor';
import Query from './pages/Query';
import Backup from './pages/Backup';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        در حال بارگذاری...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="keyspaces" element={<Keyspaces />} />
              <Route path="tables" element={<Tables />} />
              <Route path="data" element={<DataExplorer />} />
              <Route path="query" element={<Query />} />
              <Route path="monitor" element={<Monitor />} />
              <Route path="backup" element={<Backup />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}