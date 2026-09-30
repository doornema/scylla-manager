import { useEffect, useState } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import {
  Plus, Pencil, Trash2, RefreshCw, KeyRound, Link2, Sparkles,
} from 'lucide-react';

/* ============ لیست کلمات فارسی برای تولید متن ============ */

const PERSIAN_WORDS = [
  'سلام', 'دنیا', 'کتاب', 'قلم', 'آسمان', 'دریا', 'کوه', 'جنگل', 'شهر', 'روستا',
  'مدرسه', 'دانشگاه', 'استاد', 'دانشجو', 'علم', 'هنر', 'موسیقی', 'نقاشی', 'شعر', 'داستان',
  'عشق', 'دوستی', 'خانواده', 'مادر', 'پدر', 'برادر', 'خواهر', 'فرزند', 'کودک', 'جوان',
  'زمان', 'ساعت', 'دقیقه', 'ثانیه', 'روز', 'شب', 'صبح', 'عصر', 'بهار', 'تابستان',
  'پاییز', 'زمستان', 'باران', 'برف', 'باد', 'خورشید', 'ماه', 'ستاره', 'ابر', 'آسمان',
  'گل', 'درخت', 'برگ', 'ریشه', 'میوه', 'سبزی', 'غذا', 'نان', 'آب', 'چای',
  'قهوه', 'شیر', 'عسل', 'شکر', 'نمک', 'فلفل', 'زردچوبه', 'دارچین', 'زعفران', 'هل',
  'پرواز', 'سفر', 'مقصد', 'جاده', 'خودرو', 'هواپیما', 'قطار', 'کشتی', 'بندر', 'فرودگاه',
  'پیروزی', 'شکست', 'امید', 'آرزو', 'رویا', 'هدف', 'برنامه', 'آینده', 'گذشته', 'حال',
  'دلیر', 'مهربان', 'دانا', 'توانا', 'زیبا', 'بزرگ', 'کوچک', 'بلند', 'کوتاه', 'سریع',
];

const PERSIAN_NAMES = [
  'علی', 'محمد', 'حسن', 'حسین', 'رضا', 'امیر', 'مهدی', 'سعید', 'حمید', 'مجید',
  'فاطمه', 'زهرا', 'مریم', 'سارا', 'نرگس', 'مینا', 'لیلا', 'شیما', 'نازنین', 'الهام',
];

const PERSIAN_CITIES = [
  'تهران', 'مشهد', 'اصفهان', 'شیراز', 'تبریز', 'کرج', 'اهواز', 'قم', 'کرمانشاه', 'ارومیه',
  'زاهدان', 'کرمان', 'همدان', 'یزد', 'اردبیل', 'بندرعباس', 'اراک', 'اسلامشهر', 'زنجان', 'سنندج',
];

/* ============ توابع تولید مقدار تصادفی ============ */

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateTimeUUID() {
  // UUID نسخه ۱ (time-based) — تقریبی
  const now = Date.now();
  const timeLow = (now & 0xffffffff).toString(16).padStart(8, '0');
  const timeMid = ((now / 0x100000000) & 0xffff).toString(16).padStart(4, '0');
  const timeHi = ((now / 0x1000000000000) & 0x0fff | 0x1000).toString(16).padStart(4, '0');
  const clockSeq = (randomInt(0, 0x3fff) | 0x8000).toString(16).padStart(4, '0');
  const node = Array.from({ length: 6 }, () => randomInt(0, 255).toString(16).padStart(2, '0')).join('');
  return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`;
}

function generateRandomPersianText(wordCount = 3) {
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(randomFrom(PERSIAN_WORDS));
  }
  return words.join(' ');
}

function generateBlobHex(bytes = 8) {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return '0x' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * تولید مقدار تصادفی بر اساس نوع CQL.
 * نوع ممکن است ساده باشد (text, uuid) یا پارامتری (list<text>, map<text, int>).
 */
function generateRandomValue(rawType) {
  if (!rawType) return '';
  const type = String(rawType).trim().toLowerCase();

  // ========== UUID و TimeUUID ==========
  if (type === 'uuid') return generateUUID();
  if (type === 'timeuuid') return generateTimeUUID();

  // ========== اعداد صحیح ==========
  if (type === 'tinyint') return String(randomInt(0, 127));
  if (type === 'smallint') return String(randomInt(0, 32767));
  if (type === 'int') return String(randomInt(0, 2147483647));
  if (type === 'bigint') return String(randomInt(0, Number.MAX_SAFE_INTEGER));
  if (type === 'varint') return String(randomInt(0, 1e15));
  if (type === 'counter') return String(randomInt(1, 1000));

  // ========== اعداد اعشاری ==========
  if (type === 'float' || type === 'double') {
    return (Math.random() * 1000).toFixed(4);
  }
  if (type === 'decimal') {
    return (Math.random() * 10000).toFixed(2);
  }

  // ========== بولی ==========
  if (type === 'boolean' || type === 'bool') {
    return Math.random() > 0.5 ? 'true' : 'false';
  }

  // ========== تاریخ و زمان ==========
  if (type === 'timestamp') {
    return new Date().toISOString();
  }
  if (type === 'date') {
    const d = new Date(Date.now() - randomInt(0, 365 * 24 * 60 * 60 * 1000));
    return d.toISOString().split('T')[0];
  }
  if (type === 'time') {
    const h = String(randomInt(0, 23)).padStart(2, '0');
    const m = String(randomInt(0, 59)).padStart(2, '0');
    const s = String(randomInt(0, 59)).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  if (type === 'duration') {
    return `${randomInt(1, 30)}d${randomInt(0, 23)}h${randomInt(0, 59)}m`;
  }

  // ========== شبکه ==========
  if (type === 'inet') {
    return `${randomInt(1, 254)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
  }

  // ========== باینری ==========
  if (type === 'blob') {
    return generateBlobHex(randomInt(4, 16));
  }

  // ========== ASCII ==========
  if (type === 'ascii') {
    return Math.random().toString(36).substring(2, 12);
  }

  // ========== متن (text / varchar) ==========
  if (type === 'text' || type === 'varchar' || type.startsWith('text') || type.startsWith('varchar')) {
    return generateRandomPersianText(randomInt(2, 4));
  }

  // ========== مجموعه‌ها (Collection) ==========
  // list<T> یا set<T>
  const listMatch = type.match(/^(list|set)<(.+)>$/);
  if (listMatch) {
    const innerType = listMatch[2].trim();
    const count = randomInt(1, 3);
    const items = [];
    for (let i = 0; i < count; i++) {
      // برای inner type ساده، generateRandomValue را صدا می‌زنیم
      if (!innerType.includes('<')) {
        items.push(generateRandomValue(innerType));
      } else {
        items.push('item');
      }
    }
    // برای list، [] می‌سازیم (شبیه‌سازی JSON)
    return JSON.stringify(items);
  }

  // map<K, V>
  const mapMatch = type.match(/^map<([^,]+),\s*(.+)>$/);
  if (mapMatch) {
    const keyType = mapMatch[1].trim();
    const valueType = mapMatch[2].trim();
    const count = randomInt(1, 3);
    const obj = {};
    for (let i = 0; i < count; i++) {
      const k = !keyType.includes('<') ? generateRandomValue(keyType) : `key${i}`;
      const v = !valueType.includes('<') ? generateRandomValue(valueType) : `val${i}`;
      obj[k] = v;
    }
    return JSON.stringify(obj);
  }

  // ========== frozen<...> ==========
  if (type.startsWith('frozen<')) {
    const inner = type.slice(7, -1);
    // اگر frozen یک مجموعه است، مقدار ساده تولید کن
    if (inner.startsWith('list') || inner.startsWith('set')) {
      const items = [generateRandomPersianText(1), generateRandomPersianText(1)];
      return JSON.stringify(items);
    }
    if (inner.startsWith('map')) {
      return JSON.stringify({ key1: 'value1', key2: 'value2' });
    }
    return generateRandomValue(inner);
  }

  // ========== tuple<...> ==========
  if (type.startsWith('tuple<')) {
    const inner = type.slice(6, -1);
    const parts = inner.split(',').map((p) => p.trim());
    const values = parts.map((p) => generateRandomValue(p));
    return JSON.stringify(values);
  }

  // ========== پیش‌فرض ============
  return generateRandomPersianText(2);
}

/* ============ آیا این نوع از تولید خودکار پشتیبانی می‌کند؟ ============ */

function isAutoGeneratable(rawType) {
  if (!rawType) return false;
  const t = String(rawType).toLowerCase();
  // همه انواع پایه پشتیبانی می‌شوند
  return true;
}

/* ============ کامپوننت اصلی ============ */

export default function DataExplorer() {
  const [keyspaces, setKeyspaces] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedKs, setSelectedKs] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [flashField, setFlashField] = useState(null);

  useEffect(() => {
    api.get('/keyspaces').then((res) => setKeyspaces(res.data));
  }, []);

  useEffect(() => {
    if (!selectedKs) return;
    api.get(`/tables/${selectedKs}`).then((res) => {
      setTables(res.data);
      setSelectedTable('');
      setRows([]);
      setColumns([]);
    });
  }, [selectedKs]);

  const loadData = async () => {
    if (!selectedKs || !selectedTable) return;
    setLoading(true);
    setError('');
    try {
      const [rowsRes, schemaRes] = await Promise.all([
        api.get(`/data/${selectedKs}/${selectedTable}`, { params: { limit: 200 } }),
        api.get(`/tables/${selectedKs}/${selectedTable}/schema`),
      ]);
      setRows(rowsRes.data);
      setColumns(schemaRes.data);
    } catch (e) {
      setError(e.response?.data?.error || 'خطا در بارگذاری داده');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTable]);

  const openCreate = () => {
    const init = {};
    columns.forEach((c) => (init[c.name] = ''));
    setFormData(init);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (row) => {
    const data = {};
    columns.forEach((c) => (data[c.name] = row[c.name] ?? ''));
    setFormData(data);
    setEditing(row);
    setShowForm(true);
  };

  const handleGenerate = (fieldName, type) => {
    const value = generateRandomValue(type);
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    // افکت visual
    setFlashField(fieldName);
    setTimeout(() => setFlashField(null), 400);
  };

  const handleGenerateAll = () => {
    const newData = { ...formData };
    columns.forEach((c) => {
      // اگر فیلد خالی است، پر کن
      if (!newData[c.name] || newData[c.name] === '') {
        newData[c.name] = generateRandomValue(c.type);
      }
    });
    setFormData(newData);
    setFlashField('__all__');
    setTimeout(() => setFlashField(null), 500);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  try {
    if (editing) {
      // ✅ جدا کردن فیلدهای Primary Key از فیلدهای عادی
      const pkCols = columns.filter(
        (c) => c.kind === 'partition_key' || c.kind === 'clustering'
      );
      const pkNames = pkCols.map((c) => c.name);

      // فقط فیلدهای غیر-PK را در data قرار بده
      const updateData = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (!pkNames.includes(key)) {
          updateData[key] = value;
        }
      });

      // ساخت WHERE از روی Primary Key ها
      const whereParts = [];
      const whereParams = [];
      pkCols.forEach((c) => {
        whereParts.push(`${c.name} = ?`);
        whereParams.push(formData[c.name]);
      });

      await api.put('/data', {
        keyspace: selectedKs,
        table: selectedTable,
        data: updateData,           // ✅ فقط فیلدهای غیر-PK
        where: whereParts.join(' AND '),
        whereParams,
      });
    } else {
      await api.post('/data', {
        keyspace: selectedKs,
        table: selectedTable,
        data: formData,
      });
    }
    setShowForm(false);
    loadData();
  } catch (err) {
    setError(err.response?.data?.error || 'خطا در ذخیره');
  }
};

  const handleDelete = async (row) => {
    if (!confirm('آیا از حذف این ردیف مطمئن هستید؟')) return;
    try {
      const pkCols = columns.filter(
        (c) => c.kind === 'partition_key' || c.kind === 'clustering'
      );
      const whereParts = [];
      const whereParams = [];
      pkCols.forEach((c) => {
        whereParts.push(`${c.name} = ?`);
        whereParams.push(row[c.name]);
      });
      await api.delete('/data', {
        data: {
          keyspace: selectedKs,
          table: selectedTable,
          where: whereParts.join(' AND '),
          whereParams,
        },
      });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'خطا در حذف');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        مرور و مدیریت داده
      </h2>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input w-full sm:w-48"
            value={selectedKs}
            onChange={(e) => setSelectedKs(e.target.value)}
          >
            <option value="">انتخاب Keyspace</option>
            {keyspaces.map((ks) => (
              <option key={ks.name} value={ks.name}>
                {ks.name}
              </option>
            ))}
          </select>

          <select
            className="input w-full sm:w-48"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            disabled={!selectedKs}
          >
            <option value="">انتخاب جدول</option>
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            className="btn-ghost flex items-center gap-2"
            disabled={!selectedTable}
          >
            <RefreshCw size={16} /> بارگذاری
          </button>

          {selectedTable && (
            <button
              onClick={openCreate}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> ردیف جدید
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-900">
          {error}
        </div>
      )}

      {selectedTable && (
        <div className="card overflow-hidden p-0">
          {loading ? (
            <p className="text-center py-12 text-gray-400 dark:text-gray-500">
              در حال بارگذاری...
            </p>
          ) : rows.length === 0 ? (
            <p className="text-center py-12 text-gray-400 dark:text-gray-500">
              داده‌ای یافت نشد
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs uppercase sticky top-0">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.name} className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {c.kind === 'partition_key' && (
                            <KeyRound size={12} className="text-blue-500" />
                          )}
                          {c.kind === 'clustering' && (
                            <Link2 size={12} className="text-purple-500" />
                          )}
                          {c.name}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      {columns.map((c) => (
                        <td
                          key={c.name}
                          className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs truncate font-mono text-xs"
                        >
                          {formatCell(row[c.name])}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="text-scylla-600 hover:text-scylla-800 dark:text-scylla-400 dark:hover:text-scylla-300"
                            title="ویرایش"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'ویرایش ردیف' : 'ایجاد ردیف جدید'}
        wide
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 روی <Sparkles size={12} className="inline" /> کنار هر فیلد بزنید تا مقدار تصادفی مناسب نوع آن تولید شود.
          </p>
          <button
            type="button"
            onClick={handleGenerateAll}
            className="btn-ghost text-xs py-1.5 flex items-center gap-1"
            title="تولید مقادیر برای فیلدهای خالی"
          >
            <Sparkles size={12} /> تولید همه خالی‌ها
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {columns.map((c) => {
            const isPK = c.kind === 'partition_key' || c.kind === 'clustering';
            const canGenerate = isAutoGeneratable(c.type);
            const isFlashing = flashField === c.name || flashField === '__all__';
            return (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isPK && (
                      <KeyRound
                        size={12}
                        className={c.kind === 'partition_key' ? 'text-blue-500' : 'text-purple-500'}
                      />
                    )}
                    {c.name}
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">
                      ({c.type})
                    </span>
                  </label>

                  {canGenerate && (
                    <button
                      type="button"
                      onClick={() => handleGenerate(c.name, c.type)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded
                        text-scylla-600 dark:text-scylla-400
                        hover:bg-scylla-50 dark:hover:bg-scylla-950
                        transition-colors"
                      title={`تولید مقدار تصادفی ${c.type}`}
                    >
                      <Sparkles size={12} /> تولید
                    </button>
                  )}
                </div>

                <input
                  className={`input ltr-input transition-all duration-300 ${
                    isFlashing
                      ? 'ring-2 ring-scylla-400 dark:ring-scylla-500 bg-scylla-50/50 dark:bg-scylla-950/50'
                      : ''
                  }`}
                  value={formData[c.name] ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, [c.name]: e.target.value })
                  }
                  placeholder={getPlaceholder(c.type)}
                  dir="ltr"
                />

                {canGenerate && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {getTypeHint(c.type)}
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button type="submit" className="btn-primary flex-1">ذخیره</button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-ghost flex-1"
            >
              انصراف
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ============ Helper Functions ============ */

function formatCell(value) {
  if (value === null || value === undefined) return <span className="text-gray-400">null</span>;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getPlaceholder(type) {
  if (!type) return '';
  const t = String(type).toLowerCase();
  if (t === 'uuid' || t === 'timeuuid') return 'مثلاً 550e8400-e29b-41d4-a716-446655440000';
  if (t === 'timestamp') return '2025-01-15T10:30:00.000Z';
  if (t === 'date') return '2025-01-15';
  if (t === 'time') return '14:30:00';
  if (t === 'boolean') return 'true یا false';
  if (t === 'blob') return '0x1a2b3c...';
  if (t === 'inet') return '192.168.1.1';
  if (['int', 'bigint', 'smallint', 'tinyint', 'varint', 'counter'].includes(t)) return 'عدد صحیح';
  if (['float', 'double', 'decimal'].includes(t)) return 'عدد اعشاری';
  if (t.startsWith('list') || t.startsWith('set')) return '["item1", "item2"]';
  if (t.startsWith('map')) return '{"key": "value"}';
  return getTypeHint(t);
}

function getTypeHint(type) {
  if (!type) return '';
  const t = String(type).toLowerCase();
  if (t === 'uuid') return 'شناسه یکتای تصادفی — با هر تولید مقدار جدید می‌سازد';
  if (t === 'timeuuid') return 'UUID زمان‌محور — مرتب بر اساس زمان تولید';
  if (t === 'timestamp') return 'زمان فعلی به فرمت ISO 8601';
  if (t === 'date') return 'تاریخ تصادفی در یک سال گذشته';
  if (t === 'time') return 'ساعت تصادفی';
  if (t === 'boolean') return 'مقدار تصادفی true یا false';
  if (t === 'blob') return 'داده باینری تصادفی به فرمت hex';
  if (t === 'inet') return 'آدرس IPv4 تصادفی';
  if (t === 'ascii') return 'رشته ASCII تصادفی';
  if (t === 'tinyint') return 'عدد بین ۰ تا ۱۲۷';
  if (t === 'smallint') return 'عدد بین ۰ تا ۳۲۷۶۷';
  if (t === 'int') return 'عدد بین ۰ تا ۲ میلیارد';
  if (t === 'bigint') return 'عدد صحیح بزرگ';
  if (t === 'varint') return 'عدد صحیح با دقت دلخواه';
  if (t === 'counter') return 'مقدار شمارنده تصادفی';
  if (['float', 'double'].includes(t)) return 'عدد اعشاری تصادفی';
  if (t === 'decimal') return 'عدد اعشاری با دقت بالا';
  if (t === 'text' || t === 'varchar') return 'متن فارسی تصادفی';
  if (t === 'duration') return 'مدت زمان تصادفی';
  if (t.startsWith('list') || t.startsWith('set')) return 'آرایه JSON از مقادیر تصادفی';
  if (t.startsWith('map')) return 'شیء JSON با کلید-مقدار تصادفی';
  if (t.startsWith('frozen')) return 'مقدار frozen تصادفی';
  if (t.startsWith('tuple')) return 'تاپل JSON تصادفی';
  return 'مقدار تصادفی بر اساس نوع';
}