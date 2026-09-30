import { useEffect, useState, useRef } from 'react';
import api from '../api/client';
import {
  Download, Upload, Database, AlertCircle, Check,
  Loader, FileArchive, Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Backup() {
  const [keyspaces, setKeyspaces] = useState([]);
  const [selectedKs, setSelectedKs] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');

  const [restoreFile, setRestoreFile] = useState(null);
  const [targetKs, setTargetKs] = useState('');
  const [restoreOptions, setRestoreOptions] = useState({
    skipSchema: false,
    skipData: false,
    truncateFirst: false,
  });
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreError, setRestoreError] = useState('');

  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api.get('/keyspaces').then((res) => {
      setKeyspaces(res.data);
      if (res.data.length > 0) setSelectedKs(res.data[0].name);
    });
  }, []);

  const handleBackup = async () => {
    if (!selectedKs) return;
    setBackupLoading(true);
    setBackupError('');
    try {
      const response = await api.get(`/backup/download/${selectedKs}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `${selectedKs}-backup-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setBackupError(err.response?.data?.error || 'خطا در دانلود بک‌آپ');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile || !targetKs) return;
    setRestoreLoading(true);
    setRestoreError('');
    setRestoreResult(null);

    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('targetKeyspace', targetKs);
      formData.append('skipSchema', String(restoreOptions.skipSchema));
      formData.append('skipData', String(restoreOptions.skipData));
      formData.append('truncateFirst', String(restoreOptions.truncateFirst));

      const res = await api.post('/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
      });
      setRestoreResult(res.data);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setRestoreError(err.response?.data?.error || 'خطا در ریستور');
    } finally {
      setRestoreLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="card text-center py-12">
        <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          فقط ادمین‌ها می‌توانند به بک‌آپ و ریستور دسترسی داشته باشند
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        بک‌آپ و ریستور
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============ بک‌آپ ============ */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Download size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                بک‌آپ Keyspace
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                دانلود کامل داده‌ها و schema به‌صورت ZIP
              </p>
            </div>
          </div>

          {backupError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-lg">
              {backupError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                انتخاب Keyspace
              </label>
              <select
                className="input"
                value={selectedKs}
                onChange={(e) => setSelectedKs(e.target.value)}
              >
                {keyspaces.map((ks) => (
                  <option key={ks.name} value={ks.name}>{ks.name}</option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1">فایل خروجی شامل:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>فایل <code>schema.cql</code> — کوئری‌های CREATE TABLE و CREATE INDEX</li>
                <li>پوشه <code>data/</code> — فایل CSV برای هر جدول</li>
              </ul>
            </div>

            <button
              onClick={handleBackup}
              disabled={backupLoading || !selectedKs}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {backupLoading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  در حال آماده‌سازی...
                </>
              ) : (
                <>
                  <FileArchive size={16} />
                  دانلود بک‌آپ
                </>
              )}
            </button>
          </div>
        </div>

        {/* ============ ریستور ============ */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
              <Upload size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                ریستور Keyspace
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                بازیابی از فایل بک‌آپ ZIP
              </p>
            </div>
          </div>

          {restoreError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-lg">
              {restoreError}
            </div>
          )}

          {restoreResult && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-sm">
              <p className="font-bold text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                <Check size={16} /> ریستور با موفقیت انجام شد
              </p>
              <ul className="text-xs text-green-700 dark:text-green-300 space-y-0.5">
                <li>Schema: {restoreResult.schemaExecuted ? '✓ اجرا شد' : '— رد شد'}</li>
                <li>جداول ریستور شده: {restoreResult.tablesRestored.length}</li>
                {restoreResult.tablesRestored.map((t) => (
                  <li key={t.table} className="mr-4">
                    • {t.table}: {t.rows} ردیف
                  </li>
                ))}
                {restoreResult.errors.length > 0 && (
                  <li className="text-amber-600 dark:text-amber-400 mt-1">
                    ⚠️ {restoreResult.errors.length} خطا رخ داد
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                فایل بک‌آپ (ZIP)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="input text-sm"
              />
              {restoreFile && (
                <p className="text-xs text-gray-500 mt-1">
                  {restoreFile.name} ({(restoreFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Keyspace مقصد
              </label>
              <input
                className="input ltr-input"
                value={targetKs}
                onChange={(e) => setTargetKs(e.target.value)}
                placeholder="نام Keyspace مقصد"
                dir="ltr"
              />
              <p className="text-xs text-gray-400 mt-1">
                جدول‌ها در این Keyspace ساخته یا بازنویسی می‌شوند
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreOptions.skipSchema}
                  onChange={(e) =>
                    setRestoreOptions({ ...restoreOptions, skipSchema: e.target.checked })
                  }
                />
                <span className="text-gray-700 dark:text-gray-300">
                  رد کردن ساخت schema (جدول‌ها از قبل وجود دارند)
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreOptions.skipData}
                  onChange={(e) =>
                    setRestoreOptions({ ...restoreOptions, skipData: e.target.checked })
                  }
                />
                <span className="text-gray-700 dark:text-gray-300">
                  رد کردن داده‌ها (فقط schema را اجرا کن)
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreOptions.truncateFirst}
                  onChange={(e) =>
                    setRestoreOptions({ ...restoreOptions, truncateFirst: e.target.checked })
                  }
                />
                <span className="text-gray-700 dark:text-gray-300">
                  <Trash2 size={12} className="inline ml-1" />
                  پاک کردن داده‌های قبلی جدول قبل از ریستور
                </span>
              </label>
            </div>

            <button
              onClick={handleRestore}
              disabled={restoreLoading || !restoreFile || !targetKs}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {restoreLoading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  در حال ریستور...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  شروع ریستور
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}