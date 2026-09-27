import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ورود');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center
        bg-gradient-to-br from-scylla-900 to-scylla-700
        dark:from-gray-950 dark:to-gray-900
        p-4 transition-colors"
      dir="rtl"
    >
      {/* دکمه تغییر تم */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 left-4 p-2 rounded-lg
          bg-white/10 hover:bg-white/20
          dark:bg-gray-800 dark:hover:bg-gray-700
          text-white transition-colors backdrop-blur-sm"
        title="تغییر تم"
      >
        <ThemeIcon size={20} />
      </button>

      <div
        className="rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md
          bg-white dark:bg-gray-900
          border border-transparent dark:border-gray-800
          transition-colors"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            ورود به پنل مدیریت
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            ScyllaDB Web Manager
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 text-sm rounded-lg border
              bg-red-50 dark:bg-red-950
              text-red-700 dark:text-red-300
              border-red-100 dark:border-red-900"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              نام کاربری
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input ltr-input"
              placeholder="admin"
              required
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              رمز عبور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input ltr-input"
              placeholder="••••••••"
              required
              dir="ltr"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
          پیش‌فرض: admin / admin123
        </p>
      </div>
    </div>
  );
}