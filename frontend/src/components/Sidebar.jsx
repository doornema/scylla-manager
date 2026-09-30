import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Database, Table2, Activity, Eye, Terminal, Menu, X,HardDriveDownload
} from 'lucide-react';
import { useState } from 'react';

const links = [
  { to: '/', label: 'داشبورد', icon: LayoutDashboard },
  { to: '/keyspaces', label: 'Keyspace ها', icon: Database },
  { to: '/tables', label: 'جدول‌ها', icon: Table2 },
  { to: '/data', label: 'مرور داده', icon: Eye },
  { to: '/query', label: 'اجرای کوئری', icon: Terminal },
  { to: '/monitor', label: 'مانیتورینگ', icon: Activity },
  { to: '/backup', label: 'بک‌آپ و ریستور', icon: HardDriveDownload },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* دکمه منوی موبایل */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 right-3 z-50 p-2 rounded-lg
          bg-white dark:bg-gray-900
          border border-gray-200 dark:border-gray-800
          shadow-md text-gray-700 dark:text-gray-200"
        aria-label="باز کردن منو"
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* سایدبار */}
      <aside
        className={`
          fixed lg:static inset-y-0 right-0 z-50
          w-64 bg-white dark:bg-gray-900
          border-l border-gray-200 dark:border-gray-800
          flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-scylla-700 dark:text-scylla-400">
              ScyllaDB
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              مدیریت و مانیتورینگ
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1 text-gray-500 dark:text-gray-400"
            aria-label="بستن منو"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-scylla-50 dark:bg-scylla-950 text-scylla-700 dark:text-scylla-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 text-center">
          نسخه ۱.۰.۰
        </div>
      </aside>
    </>
  );
}