import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = theme === 'light' ? 'روشن' : theme === 'dark' ? 'تاریک' : 'سیستم';

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg
        hover:bg-gray-100 dark:hover:bg-gray-800
        text-gray-600 dark:text-gray-300
        transition-colors"
      title={`تم فعلی: ${label} (برای تغییر کلیک کنید)`}
      aria-label={`تغییر تم - فعلی: ${label}`}
    >
      <Icon size={18} />
    </button>
  );
}