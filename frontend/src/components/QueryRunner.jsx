import { useState } from 'react';
import { Play, Copy, Check, AlertCircle, Clock, Trash2 } from 'lucide-react';
import api from '../api/client';
import CqlEditor from './CqlEditor';

const SAMPLE_QUERIES = [
  {
    label: 'لیست Keyspace ها',
    cql: 'SELECT * FROM system_schema.keyspaces;',
  },
  {
    label: 'لیست جداول',
    cql: 'SELECT keyspace_name, table_name FROM system_schema.tables;',
  },
  {
    label: 'اطلاعات کلاستر',
    cql: 'SELECT cluster_name, release_version FROM system.local;',
  },
  {
    label: 'گره‌های کلاستر',
    cql: 'SELECT peer, data_center, rack FROM system.peers;',
  },
  {
    label: 'پارتیشن‌های بزرگ',
    cql: 'SELECT * FROM system.large_partitions LIMIT 20;',
  },
  {
    label: 'نمونه ساخت جدول',
    cql: `CREATE TABLE my_keyspace.my_table (
  id uuid,
  name text,
  created_at timestamp,
  PRIMARY KEY ((id))
);`,
  },
];

export default function QueryRunner() {
  const [cql, setCql] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const runQuery = async () => {
    if (!cql.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/query/run', { cql });
      setResult(res.data);
    } catch (err) {
      setResult({
        success: false,
        error: {
          message: err.response?.data?.error || err.message,
          code: err.code || 'NETWORK_ERROR',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  };

  const copyResult = () => {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearEditor = () => {
    setCql('');
    setResult(null);
  };

  return (
    <div className="space-y-4">
      {/* ============ ویرایشگر ============ */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              CQL Editor
            </span>
            {cql && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {cql.split('\n').length} خط
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
              Ctrl+Enter برای اجرا
            </span>
            {cql && (
              <button
                onClick={clearEditor}
                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                title="پاک کردن"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={runQuery}
              disabled={loading || !cql.trim()}
              className="btn-primary flex items-center gap-1.5 text-sm py-1.5"
            >
              <Play size={14} />
              {loading ? 'در حال اجرا...' : 'اجرا'}
            </button>
          </div>
        </div>

        <div
          dir="ltr"
          onKeyDown={handleKeyDown}
          className="bg-white dark:bg-black"
        >
          <CqlEditor
            value={cql}
            onChange={setCql}
            height="220px"
            placeholder="-- کوئری CQL خود را اینجا بنویسید..."
          />
        </div>
      </div>

      {/* ============ نمونه کوئری‌ها ============ */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400 dark:text-gray-500">نمونه‌ها:</span>
        {SAMPLE_QUERIES.map((q) => (
          <button
            key={q.label}
            onClick={() => setCql(q.cql)}
            className="px-3 py-1 text-xs rounded-full
              bg-gray-100 dark:bg-gray-800
              text-gray-600 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-gray-700
              transition-colors"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* ============ نتیجه ============ */}
      {result && (
        <div className="card p-0 overflow-hidden">
          {result.success ? (
            <>
              {/* هدر موفق */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    ✓ موفق
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock size={12} /> {result.duration}ms
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {result.rowCount} ردیف
                  </span>
                </div>
                <button
                  onClick={copyResult}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'کپی شد' : 'کپی JSON'}
                </button>
              </div>

              {/* هشدارها */}
              {result.warnings?.length > 0 && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs border-b border-amber-100 dark:border-amber-900">
                  ⚠️ {result.warnings.join(' | ')}
                </div>
              )}

              {/* خروجی applied (برای DDL/DML) */}
              {result.applied !== null && result.applied !== undefined && (
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs border-b border-blue-100 dark:border-blue-900">
                  ✓ کوئری با موفقیت اجرا شد (تغییرات اعمال شد)
                </div>
              )}

              {/* داده */}
              {result.rows.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">
                  {result.applied !== null && result.applied !== undefined
                    ? 'کوئری اجرا شد — نتیجه‌ای برای نمایش نیست'
                    : 'کوئری با موفقیت اجرا شد اما نتیجه‌ای برنگرداند'}
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs uppercase sticky top-0">
                      <tr>
                        {result.columns.map((c) => (
                          <th key={c.name} className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="font-medium">{c.name}</div>
                            <div className="text-[10px] text-gray-400 normal-case font-normal mt-0.5">
                              {c.type}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {result.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          {result.columns.map((c) => (
                            <td
                              key={c.name}
                              className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate font-mono text-xs ltr-input"
                              dir="ltr"
                              title={formatCellText(row[c.name])}
                            >
                              {formatCell(row[c.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            /* ============ خطا ============ */
            <div className="p-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-red-700 dark:text-red-300 text-sm">
                    خطا در اجرای کوئری
                  </h4>
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 break-words font-mono ltr-input" dir="ltr">
                    {result.error.message}
                  </p>
                  {result.error.code && (
                    <p className="mt-1 text-xs text-red-500">
                      کد خطا: <code>{result.error.code}</code>
                    </p>
                  )}
                  {result.error.info && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-500 cursor-pointer">
                        جزئیات بیشتر
                      </summary>
                      <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-x-auto ltr-input" dir="ltr">
                        {JSON.stringify(result.error.info, null, 2)}
                      </pre>
                    </details>
                  )}

                  {/* راهنمای رفع خطاهای رایج */}
                  {getErrorHint(result.error.message) && (
                    <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900">
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        <strong>💡 راهنما:</strong> {getErrorHint(result.error.message)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============ Helper Functions ============ */

function formatCell(value) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic">null</span>;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatCellText(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * راهنمای رفع خطاهای رایج CQL
 */
function getErrorHint(message) {
  if (!message) return null;
  const msg = message.toLowerCase();

  if (msg.includes('syntax error')) {
    return 'سینتکس کوئری را بررسی کنید. برای compression از کلید sstable_compression استفاده کنید، نه class.';
  }
  if (msg.includes('unconfigured table') || msg.includes('unconfigured keyspace')) {
    return 'جدول یا Keyspace مورد نظر وجود ندارد. ابتدا آن را ایجاد کنید یا نام را بررسی کنید.';
  }
  if (msg.includes('already exists')) {
    return 'این جدول/ایندکس از قبل وجود دارد. از IF NOT EXISTS استفاده کنید یا نام دیگری انتخاب کنید.';
  }
  if (msg.includes('invalid') && msg.includes('compression')) {
    return 'برای compression فقط از این کلاس‌ها استفاده کنید: LZ4Compressor، SnappyCompressor، DeflateCompressor، ZstdCompressor (بدون نام پکیج).';
  }
  if (msg.includes('primary key') || msg.includes('partition key')) {
    return 'Primary Key نامعتبر است. مطمئن شوید که حداقل یک ستون به‌عنوان Partition Key تعریف شده باشد.';
  }
  if (msg.includes('undefined column')) {
    return 'ستون استفاده‌شده در کوئری وجود ندارد. نام ستون‌ها را بررسی کنید.';
  }
  if (msg.includes('cannot execute this query') || msg.includes('not supported')) {
    return 'این کوئری در ScyllaDB پشتیبانی نمی‌شود. برخی دستورات CQL در سایلا محدود هستند.';
  }
  return null;
}