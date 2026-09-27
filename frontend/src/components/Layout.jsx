import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      className="min-h-screen flex bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors"
      dir="rtl"
    >
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800
            px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30"
        >
          <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 pr-12 lg:pr-0">
            پنل مدیریت ScyllaDB
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400">
              {user?.username} ({user?.role})
            </span>
            <button
              onClick={handleLogout}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}