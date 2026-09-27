import { useEffect, useState } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import ScyllaGuideModal from '../components/ScyllaGuideModal';
import {
  Plus, Trash2, Columns, Info, Zap, Copy, Check,
  ChevronDown, ChevronUp, Code, KeyRound, Link2,
  BookOpen, Filter, Clock, Layers, HardDrive,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CQL_TYPES = [
  { value: 'text', label: 'text', desc: 'رشته UTF-8 — برای نام، توضیحات، متن' },
  { value: 'int', label: 'int', desc: 'عدد صحیح ۳۲ بیتی — برای شناسه‌های کوچک' },
  { value: 'bigint', label: 'bigint', desc: 'عدد صحیح ۶۴ بیتی — برای timestamp، شناسه‌های بزرگ' },
  { value: 'uuid', label: 'uuid', desc: 'شناسه یکتای ۱۲۸ بیتی — کلید تصادفی' },
  { value: 'timeuuid', label: 'timeuuid', desc: 'UUID نسخه ۱ — ترتیب‌پذیر بر اساس زمان' },
  { value: 'timestamp', label: 'timestamp', desc: 'زمان (میلی‌ثانیه از epoch 1970)' },
  { value: 'date', label: 'date', desc: 'تاریخ بدون زمان' },
  { value: 'time', label: 'time', desc: 'زمان بدون تاریخ' },
  { value: 'boolean', label: 'boolean', desc: 'مقدار true/false' },
  { value: 'float', label: 'float', desc: 'اعشاری ۳۲ بیتی — دقت پایین' },
  { value: 'double', label: 'double', desc: 'اعشاری ۶۴ بیتی — دقت بالا' },
  { value: 'decimal', label: 'decimal', desc: 'اعشاری با دقت دلخواه — مالی' },
  { value: 'blob', label: 'blob', desc: 'داده باینری — فایل، تصویر' },
  { value: 'inet', label: 'inet', desc: 'آدرس IP (v4 یا v6)' },
  { value: 'ascii', label: 'ascii', desc: 'رشته ASCII (نه UTF-8)' },
  { value: 'counter', label: 'counter', desc: 'شمارنده توزیع‌شده — فقط افزایش/کاهش' },
  { value: 'smallint', label: 'smallint', desc: 'عدد صحیح ۱۶ بیتی' },
  { value: 'tinyint', label: 'tinyint', desc: 'عدد صحیح ۸ بیتی' },
  { value: 'varint', label: 'varint', desc: 'عدد صحیح با دقت دلخواه' },
  { value: 'duration', label: 'duration', desc: 'مدت زمان (ماه، روز، نانوثانیه)' },
];

const COMPACTION_STRATEGIES = [
  {
    value: 'SizeTieredCompactionStrategy',
    label: 'SizeTiered (STCS)',
    desc: 'ادغام SSTableهای هم‌اندازه — مناسب نوشتن سنگین. عیب: space amplification تا ۴۰۰٪',
  },
  {
    value: 'LeveledCompactionStrategy',
    label: 'Leveled (LCS)',
    desc: 'SSTableهای کوچک ثابت در سطوح — مناسب خواندن مکرر. عیب: write amplification دو برابر',
  },
  {
    value: 'TimeWindowCompactionStrategy',
    label: 'TimeWindow (TWCS)',
    desc: 'پنجره‌های زمانی جداگانه — فقط برای داده‌های سری‌زمانی با TTL یکسان',
  },
  {
    value: 'IncrementalCompactionStrategy',
    label: 'Incremental (ICS)',
    desc: 'ترکیب STCS و LCS — فقط در ScyllaDB Enterprise',
  },
];

const COMPRESSION_CLASSES = [
  { value: 'LZ4Compressor', label: 'LZ4 (پیش‌فرض)', desc: 'تعادل خوب سرعت و نسبت فشرده‌سازی' },
  { value: 'SnappyCompressor', label: 'Snappy', desc: 'سریع‌تر اما نسبت فشرده‌سازی کمتر' },
  { value: 'DeflateCompressor', label: 'Deflate', desc: 'نسبت فشرده‌سازی بالا اما کندتر' },
  { value: 'ZstdCompressor', label: 'Zstd', desc: 'نسبت فشرده‌سازی بالا با سرعت خوب' },
];

const INDEX_TYPES = [
  { value: 'regular', label: 'معمولی', desc: 'ایندکس روی یک ستون — ساده‌ترین و پرکاربردترین' },
  { value: 'KEYS', label: 'KEYS', desc: 'ایندکس روی کلیدهای Map — WHERE m CONTAINS KEY 4' },
  { value: 'VALUES', label: 'VALUES', desc: 'ایندکس روی مقادیر Map/Set/List — WHERE m CONTAINS 3' },
  { value: 'ENTRIES', label: 'ENTRIES', desc: 'ایندکس روی ورودی‌های Map — WHERE m[1] = 2' },
  { value: 'FULL', label: 'FULL', desc: 'ایندکس کامل مجموعه frozen' },
  { value: 'FULLKEYS', label: 'FULL KEYS', desc: 'ایندکس کامل کلیدهای مجموعه frozen' },
];

export default function Tables() {
  const [keyspaces, setKeyspaces] = useState([]);
  const [selectedKs, setSelectedKs] = useState('');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableInfo, setTableInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api.get('/keyspaces').then((res) => {
      setKeyspaces(res.data);
      if (res.data.length > 0 && !selectedKs) setSelectedKs(res.data[0].name);
    });
  }, []);

  useEffect(() => {
    if (!selectedKs) return;
    api.get(`/tables/${selectedKs}`).then((res) => setTables(res.data));
    setSelectedTable('');
    setTableInfo(null);
  }, [selectedKs]);

  useEffect(() => {
    if (!selectedKs || !selectedTable) return;
    setLoadingInfo(true);
    api.get(`/tables/${selectedKs}/${selectedTable}/info`)
      .then((res) => setTableInfo(res.data))
      .catch(console.error)
      .finally(() => setLoadingInfo(false));
  }, [selectedKs, selectedTable]);

  const handleDelete = async (table) => {
    if (!confirm(`آیا از حذف جدول «${table}» مطمئن هستید؟`)) return;
    try {
      await api.delete(`/tables/${selectedKs}/${table}`);
      const res = await api.get(`/tables/${selectedKs}`);
      setTables(res.data);
      if (selectedTable === table) {
        setSelectedTable('');
        setTableInfo(null);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'خطا در حذف');
    }
  };

  const copyCql = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reloadInfo = () => {
    if (!selectedKs || !selectedTable) return;
    setLoadingInfo(true);
    api.get(`/tables/${selectedKs}/${selectedTable}/info`)
      .then((res) => setTableInfo(res.data))
      .finally(() => setLoadingInfo(false));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">جدول‌ها</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowGuide(true)}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <BookOpen size={16} /> راهنمای ScyllaDB
          </button>
          <select
            className="input w-40 sm:w-48"
            value={selectedKs}
            onChange={(e) => setSelectedKs(e.target.value)}
          >
            {keyspaces.map((ks) => (
              <option key={ks.name} value={ks.name}>{ks.name}</option>
            ))}
          </select>
          {isAdmin && selectedKs && (
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> جدول جدید
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            لیست جداول ({tables.length})
          </h3>
          {tables.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">هیچ جدولی یافت نشد</p>
          ) : (
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {tables.map((t) => (
                <div
                  key={t}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedTable === t
                      ? 'bg-scylla-50 dark:bg-scylla-950 border-scylla-200 dark:border-scylla-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-100 dark:border-gray-800'
                  }`}
                  onClick={() => setSelectedTable(t)}
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {t}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card lg:col-span-2">
          {!selectedTable ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              یک جدول را از لیست سمت راست انتخاب کنید
            </div>
          ) : loadingInfo ? (
            <div className="text-center py-16 text-gray-400 text-sm">در حال بارگذاری...</div>
          ) : tableInfo ? (
            <TableInfoPanel
              info={tableInfo}
              onCopyCql={copyCql}
              copied={copied}
              onRefresh={reloadInfo}
              onAddIndex={() => setShowIndexModal(true)}
              isAdmin={isAdmin}
            />
          ) : null}
        </div>
      </div>

      <ScyllaGuideModal open={showGuide} onClose={() => setShowGuide(false)} />

      <CreateTableModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        keyspace={selectedKs}
        onCreated={() => {
          api.get(`/tables/${selectedKs}`).then((res) => setTables(res.data));
        }}
      />

      {selectedTable && (
        <CreateIndexModal
          open={showIndexModal}
          onClose={() => setShowIndexModal(false)}
          keyspace={selectedKs}
          table={selectedTable}
          columns={tableInfo?.columns || []}
          onCreated={reloadInfo}
        />
      )}
    </div>
  );
}

/* ============ پنل اطلاعات جدول ============ */

function TableInfoPanel({ info, onCopyCql, copied, onRefresh, onAddIndex, isAdmin }) {
  const [tab, setTab] = useState('columns');

  const tabs = [
    { id: 'columns', label: 'ستون‌ها', icon: Columns, count: info.columns.length },
    { id: 'indexes', label: 'ایندکس‌ها', icon: Zap, count: info.indexes.length },
    { id: 'options', label: 'تنظیمات', icon: Info },
    { id: 'cql', label: 'کوئری ساخت', icon: Code },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {info.table}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {info.estimatedRows !== null ? `≈ ${info.estimatedRows.toLocaleString()} ردیف` : ''}
            {info.sizeEstimates.length > 0 && (
              <span className="mr-3">
                ≈ {formatBytes(info.sizeEstimates.reduce((s, e) => s + Number(e.mean_partition_size || 0) * Number(e.partitions_count || 0), 0))}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="btn-ghost text-xs py-1.5">به‌روزرسانی</button>
          {isAdmin && (
            <button onClick={onAddIndex} className="btn-primary text-xs py-1.5 flex items-center gap-1">
              <Plus size={12} /> ایندکس جدید
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800 mb-4 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === id
                ? 'border-scylla-600 text-scylla-700 dark:text-scylla-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icon size={14} />
            {label}
            {count !== undefined && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-800">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'columns' && <ColumnsTab columns={info.columns} />}
      {tab === 'indexes' && <IndexesTab indexes={info.indexes} keyspace={info.keyspace} onRefresh={onRefresh} />}
      {tab === 'options' && <OptionsTab options={info.options} />}
      {tab === 'cql' && (
        <CqlTab
          cql={info.cql}
          indexCqls={info.indexCqls}
          fullCql={info.fullCql}
          onCopy={onCopyCql}
          copied={copied}
        />
      )}
    </div>
  );
}

function ColumnsTab({ columns }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right">
        <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs uppercase">
          <tr>
            <th className="px-3 py-2">ستون</th>
            <th className="px-3 py-2">نوع</th>
            <th className="px-3 py-2">نقش</th>
            <th className="px-3 py-2">موقعیت</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {columns.map((c) => (
            <tr key={c.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">
                {c.kind === 'partition_key' && <KeyRound size={12} className="inline ml-1 text-blue-500" />}
                {c.kind === 'clustering' && <Link2 size={12} className="inline ml-1 text-purple-500" />}
                {c.name}
              </td>
              <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{c.type}</td>
              <td className="px-3 py-2">
                {c.kind === 'partition_key' && <span className="badge-pk">Partition Key</span>}
                {c.kind === 'clustering' && <span className="badge-ck">Clustering</span>}
                {c.kind === 'static' && <span className="badge-static">Static</span>}
                {c.kind === 'regular' && <span className="badge-regular">Regular</span>}
              </td>
              <td className="px-3 py-2 text-xs text-gray-400">{c.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IndexesTab({ indexes, keyspace, onRefresh }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const handleDrop = async (indexName) => {
    if (!confirm(`حذف ایندکس «${indexName}»؟`)) return;
    try {
      await api.delete(`/indexes/${keyspace}/${indexName}`);
      onRefresh();
    } catch (e) {
      alert(e.response?.data?.error || 'خطا در حذف ایندکس');
    }
  };

  if (indexes.length === 0) {
    return <p className="text-center py-8 text-gray-400 text-sm">هیچ ایندکسی روی این جدول وجود ندارد</p>;
  }

  return (
    <div className="space-y-2">
      {indexes.map((idx) => (
        <div
          key={idx.name}
          className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm text-gray-800 dark:text-gray-200 truncate">
                {idx.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                نوع: <code>{idx.kind}</code>
                {idx.options?.target && (
                  <> — هدف: <code>{typeof idx.options.target === 'string' ? idx.options.target : JSON.stringify(idx.options.target)}</code></>
                )}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => handleDrop(idx.name)}
                className="text-red-500 hover:text-red-700 flex-shrink-0 mr-2"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OptionsTab({ options }) {
  const entries = [
    ['Compaction', options.compaction],
    ['Compression', options.compression],
    ['Caching', options.caching],
    ['Default TTL', options.default_time_to_live],
    ['GC Grace Seconds', options.gc_grace_seconds],
    ['Bloom Filter FP Chance', options.bloom_filter_fp_chance],
    ['Speculative Retry', options.speculative_retry],
    ['Read Repair Chance', options.read_repair_chance],
    ['CDC', options.cdc],
    ['Comment', options.comment],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');

  if (entries.length === 0) {
    return <p className="text-center py-8 text-gray-400 text-sm">تنظیمات خاصی یافت نشد</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([label, value]) => (
        <div key={label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function CqlTab({ cql, indexCqls = [], fullCql, onCopy, copied }) {
  const [view, setView] = useState('all');

  if (!cql) {
    return <p className="text-center py-8 text-gray-400 text-sm">کوئری در دسترس نیست</p>;
  }

  const combined = fullCql || (indexCqls.length > 0
    ? `${cql}\n\n-- Indexes --\n${indexCqls.join('\n')}`
    : cql);

  const shown = view === 'table' ? cql : combined;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex gap-1">
          <button
            onClick={() => setView('all')}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              view === 'all'
                ? 'bg-scylla-100 dark:bg-scylla-950 text-scylla-700 dark:text-scylla-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            همه (جدول + ایندکس‌ها)
          </button>
          <button
            onClick={() => setView('table')}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              view === 'table'
                ? 'bg-scylla-100 dark:bg-scylla-950 text-scylla-700 dark:text-scylla-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            فقط جدول
          </button>
        </div>
        <button
          onClick={() => onCopy(shown)}
          className="btn-ghost text-xs py-1.5 flex items-center gap-1"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'کپی شد' : 'کپی'}
        </button>
      </div>

      <pre className="code-block">{shown}</pre>

      {indexCqls.length > 0 && view === 'all' && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
          شامل {indexCqls.length} ایندکس روی این جدول. برای ساخت مجدد، همه را به ترتیب اجرا کنید.
        </p>
      )}
    </div>
  );
}

/* ============ مودال ساخت جدول پیشرفته ============ */

function CreateTableModal({ open, onClose, keyspace, onCreated }) {
  const [tab, setTab] = useState('columns');
  const [form, setForm] = useState({
    table: '',
    columns: [{ name: '', type: 'text', kind: 'regular' }],
    partitionKey: [],
    clusteringKey: [],
    clusteringOrder: {},
    options: {},
  });
  const [advanced, setAdvanced] = useState({
    compaction: false, caching: false, compression: false, ttl: false, misc: false,
  });
  const [error, setError] = useState('');
  const [generatedCql, setGeneratedCql] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setForm({
      table: '',
      columns: [{ name: '', type: 'text', kind: 'regular' }],
      partitionKey: [],
      clusteringKey: [],
      clusteringOrder: {},
      options: {},
    });
    setAdvanced({ compaction: false, caching: false, compression: false, ttl: false, misc: false });
    setTab('columns');
    setError('');
    setGeneratedCql('');
  };

  const addColumn = () =>
    setForm({ ...form, columns: [...form.columns, { name: '', type: 'text', kind: 'regular' }] });

  const removeColumn = (i) => {
    const col = form.columns[i];
    setForm({
      ...form,
      columns: form.columns.filter((_, idx) => idx !== i),
      partitionKey: form.partitionKey.filter((p) => p !== col.name),
      clusteringKey: form.clusteringKey.filter((c) => c !== col.name),
    });
  };

  const updateColumn = (i, key, value) => {
    const cols = [...form.columns];
    const oldName = cols[i].name;
    cols[i][key] = value;
    const newForm = { ...form, columns: cols };

    if (key === 'name' && oldName && oldName !== value) {
      newForm.partitionKey = form.partitionKey.map((p) => (p === oldName ? value : p));
      newForm.clusteringKey = form.clusteringKey.map((c) => (c === oldName ? value : c));
    }
    setForm(newForm);
  };

  const togglePK = (colName) => {
    const pk = form.partitionKey.includes(colName)
      ? form.partitionKey.filter((p) => p !== colName)
      : [...form.partitionKey, colName];
    setForm({
      ...form,
      partitionKey: pk,
      clusteringKey: form.clusteringKey.filter((c) => c !== colName),
    });
  };

  const toggleCK = (colName) => {
    const ck = form.clusteringKey.includes(colName)
      ? form.clusteringKey.filter((c) => c !== colName)
      : [...form.clusteringKey, colName];
    setForm({
      ...form,
      clusteringKey: ck,
      partitionKey: form.partitionKey.filter((p) => p !== colName),
    });
  };

  const setOption = (path, value) => {
    setForm((f) => {
      const opts = { ...f.options };
      if (path.includes('.')) {
        const [parent, child] = path.split('.');
        opts[parent] = { ...(opts[parent] || {}), [child]: value };
      } else {
        opts[path] = value;
      }
      return { ...f, options: opts };
    });
  };

  useEffect(() => {
    if (!form.table || form.columns.length === 0 || form.partitionKey.length === 0) {
      setGeneratedCql('');
      return;
    }
    setGeneratedCql(buildPreviewCql(keyspace, form));
  }, [form, keyspace]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.table || !/^[a-z][a-z0-9_]*$/.test(form.table)) {
      setError('نام جدول باید با حرف کوچک شروع شده و فقط شامل حروف کوچک، اعداد و _ باشد');
      return;
    }
    const validCols = form.columns.filter((c) => c.name && c.type);
    if (validCols.length === 0) {
      setError('حداقل یک ستون معتبر لازم است');
      return;
    }
    if (form.partitionKey.length === 0) {
      setError('حداقل یک ستون باید Partition Key باشد');
      return;
    }

    setLoading(true);
    try {
      await api.post('/tables', {
        keyspace,
        table: form.table,
        columns: validCols,
        partitionKey: form.partitionKey,
        clusteringKey: form.clusteringKey.length > 0 ? form.clusteringKey : undefined,
        clusteringOrder: Object.keys(form.clusteringOrder).length > 0 ? form.clusteringOrder : undefined,
        options: form.options,
      });
      onCreated();
      onClose();
      reset();
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ساخت جدول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="ساخت جدول پیشرفته" wide>
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-900">
          {error}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800 mb-4 overflow-x-auto">
        {[
          { id: 'columns', label: 'ستون‌ها و کلید' },
          { id: 'options', label: 'تنظیمات پیشرفته' },
          { id: 'preview', label: 'پیش‌نمایش و توضیحات' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-scylla-600 text-scylla-700 dark:text-scylla-400'
                : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {tab === 'columns' && (
          <ColumnsStep
            form={form}
            setForm={setForm}
            addColumn={addColumn}
            removeColumn={removeColumn}
            updateColumn={updateColumn}
            togglePK={togglePK}
            toggleCK={toggleCK}
          />
        )}

        {tab === 'options' && (
          <OptionsStep
            form={form}
            advanced={advanced}
            setAdvanced={setAdvanced}
            setOption={setOption}
          />
        )}

        {tab === 'preview' && (
          <PreviewStep
            form={form}
            keyspace={keyspace}
            generatedCql={generatedCql}
          />
        )}

        <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-gray-800 mt-4">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'در حال ساخت...' : 'ساخت جدول'}
          </button>
          <button
            type="button"
            onClick={() => { onClose(); reset(); }}
            className="btn-ghost flex-1"
          >
            انصراف
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ColumnsStep({ form, setForm, addColumn, removeColumn, updateColumn, togglePK, toggleCK }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          نام جدول
        </label>
        <input
          className="input ltr-input"
          value={form.table}
          onChange={(e) => setForm({ ...form, table: e.target.value })}
          placeholder="my_table"
          dir="ltr"
        />
        <p className="text-xs text-gray-400 mt-1">
          فقط حروف کوچک، اعداد و _ — باید با حرف شروع شود
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            ستون‌ها
          </label>
          <button type="button" onClick={addColumn} className="text-sm text-scylla-600 hover:text-scylla-700">
            + افزودن ستون
          </button>
        </div>

        <div className="space-y-2">
          {form.columns.map((col, i) => {
            const isPK = form.partitionKey.includes(col.name) && col.name;
            const isCK = form.clusteringKey.includes(col.name) && col.name;
            const typeInfo = CQL_TYPES.find((t) => t.value === col.type);
            return (
              <div
                key={i}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
              >
                <div className="flex gap-2 items-start flex-wrap">
                  <input
                    className="input flex-1 min-w-[120px] ltr-input"
                    placeholder="نام ستون"
                    value={col.name}
                    onChange={(e) => updateColumn(i, 'name', e.target.value)}
                    dir="ltr"
                  />
                  <select
                    className="input w-32 ltr-input"
                    value={col.type}
                    onChange={(e) => updateColumn(i, 'type', e.target.value)}
                    dir="ltr"
                    title={typeInfo?.desc}
                  >
                    {CQL_TYPES.map((t) => (
                      <option key={t.value} value={t.value} title={t.desc}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input w-28"
                    value={col.kind || 'regular'}
                    onChange={(e) => updateColumn(i, 'kind', e.target.value)}
                    title="معمولی: یک مقدار در هر ردیف — Static: یک مقدار مشترک برای کل پارتیشن"
                  >
                    <option value="regular">معمولی</option>
                    <option value="static">Static</option>
                  </select>
                  {form.columns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeColumn(i)}
                      className="text-red-500 p-2"
                      title="حذف ستون"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {typeInfo && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5 pr-1">
                    <span className="font-mono text-scylla-600 dark:text-scylla-400">{typeInfo.label}:</span>{' '}
                    {typeInfo.desc}
                  </p>
                )}

                <div className="flex gap-3 mt-2 text-xs flex-wrap">
                  <label className="flex items-center gap-1 cursor-pointer" title="کلید توزیع داده بین نودها">
                    <input
                      type="radio"
                      checked={!!isPK}
                      onChange={() => togglePK(col.name)}
                      disabled={!col.name}
                    />
                    <span className="flex items-center gap-1">
                      <KeyRound size={11} className="text-blue-500" />
                      Partition Key
                    </span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer" title="ترتیب ردیف‌ها در پارتیشن">
                    <input
                      type="radio"
                      checked={!!isCK}
                      onChange={() => toggleCK(col.name)}
                      disabled={!col.name || isPK}
                    />
                    <span className="flex items-center gap-1">
                      <Link2 size={11} className="text-purple-500" />
                      Clustering Key
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {form.clusteringKey.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ترتیب Clustering (اختیاری)
          </label>
          <div className="space-y-2">
            {form.clusteringKey.map((ck) => (
              <div key={ck} className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400 w-32">{ck}</span>
                <select
                  className="input w-40"
                  value={form.clusteringOrder[ck] || 'ASC'}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      clusteringOrder: { ...form.clusteringOrder, [ck]: e.target.value },
                    })
                  }
                >
                  <option value="ASC">ASC (صعودی — قدیمی‌تر اول)</option>
                  <option value="DESC">DESC (نزولی — جدیدتر اول)</option>
                </select>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            ASC: قدیمی‌ترین ردیف اول بازگردانده می‌شود — مناسب برای خواندن سری‌زمانی به ترتیب
            <br />
            DESC: جدیدترین ردیف اول — مناسب برای نمایش آخرین N ردیف
          </p>
        </div>
      )}

      {form.partitionKey.length > 0 && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 text-xs">
          <p className="text-blue-700 dark:text-blue-300">
            <strong>Primary Key:</strong>{' '}
            <code>
              ({form.partitionKey.join(', ')})
              {form.clusteringKey.length > 0 ? `, ${form.clusteringKey.join(', ')}` : ''}
            </code>
          </p>
          <p className="text-blue-600 dark:text-blue-400 mt-1 text-[10px]">
            Partition Key: توزیع داده بین نودها — Clustering Key: ترتیب ردیف‌ها در پارتیشن
          </p>
        </div>
      )}
    </div>
  );
}

function OptionsStep({ form, advanced, setAdvanced, setOption }) {
  const opts = form.options;
  const toggle = (key) => setAdvanced({ ...advanced, [key]: !advanced[key] });

  const currentCompaction = opts.compaction?.class || 'SizeTieredCompactionStrategy';
  const currentCompression = opts.compression?.class || 'LZ4Compressor';

  return (
    <div className="space-y-3">
      <AccordionSection
        title="استراتژی Compaction"
        description="فرآیند ادغام SSTableها — انتخاب اشتباه می‌تواند کارایی را به شدت کاهش دهد"
        enabled={advanced.compaction}
        onToggle={() => toggle('compaction')}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Class</label>
            <select
              className="input ltr-input"
              value={currentCompaction}
              onChange={(e) => setOption('compaction.class', e.target.value)}
              dir="ltr"
            >
              {COMPACTION_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              {COMPACTION_STRATEGIES.find((s) => s.value === currentCompaction)?.desc}
            </p>
          </div>

          {currentCompaction === 'SizeTieredCompactionStrategy' && (
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label="bucket_high"
                value={opts.compaction?.bucket_high}
                onChange={(v) => setOption('compaction.bucket_high', v)}
                placeholder="1.5"
                hint="حداکثر نسبت اندازه برای ادغام — پیش‌فرض ۱.۵"
              />
              <NumberInput
                label="bucket_low"
                value={opts.compaction?.bucket_low}
                onChange={(v) => setOption('compaction.bucket_low', v)}
                placeholder="0.5"
                hint="حداقل نسبت اندازه برای ادغام — پیش‌فرض ۰.۵"
              />
              <NumberInput
                label="min_threshold"
                value={opts.compaction?.min_threshold}
                onChange={(v) => setOption('compaction.min_threshold', v)}
                placeholder="4"
                hint="حداقل SSTable برای شروع compaction"
              />
              <NumberInput
                label="max_threshold"
                value={opts.compaction?.max_threshold}
                onChange={(v) => setOption('compaction.max_threshold', v)}
                placeholder="32"
                hint="حداکثر SSTable قبل از اجبار به compaction"
              />
            </div>
          )}

          {currentCompaction === 'LeveledCompactionStrategy' && (
            <NumberInput
              label="sstable_size_in_mb"
              value={opts.compaction?.sstable_size_in_mb}
              onChange={(v) => setOption('compaction.sstable_size_in_mb', v)}
              placeholder="160"
              hint="اندازه هدف SSTable در هر level — پیش‌فرض ۱۶۰MB"
            />
          )}

          {currentCompaction === 'TimeWindowCompactionStrategy' && (
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                label="window_size"
                value={opts.compaction?.window_size}
                onChange={(v) => setOption('compaction.window_size', v)}
                placeholder="1d یا 1h یا 30m"
                hint="بازه زمانی هر پنجره — واحد: y, mo, w, d, h, m, s"
              />
              <div>
                <label className="block text-xs text-gray-500 mb-1">timestamp_resolution</label>
                <select
                  className="input ltr-input"
                  value={opts.compaction?.timestamp_resolution || ''}
                  onChange={(e) => setOption('compaction.timestamp_resolution', e.target.value)}
                  dir="ltr"
                >
                  <option value="">پیش‌فرض (MICROSECONDS)</option>
                  <option value="MICROSECONDS">MICROSECONDS</option>
                  <option value="MILLISECONDS">MILLISECONDS</option>
                  <option value="SECONDS">SECONDS</option>
                </select>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  دقت timestamp داده‌ها — پیش‌فرض میکروثانیه
                </p>
              </div>
            </div>
          )}
        </div>
      </AccordionSection>

      <AccordionSection
        title="Caching"
        description="نگهداری داده‌های پرکاربرد در حافظه برای کاهش I/O دیسک"
        enabled={advanced.caching}
        onToggle={() => toggle('caching')}
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">keys</label>
            <select
              className="input ltr-input"
              value={opts.caching?.keys || 'ALL'}
              onChange={(e) => setOption('caching.keys', e.target.value)}
              dir="ltr"
            >
              <option value="ALL">ALL</option>
              <option value="NONE">NONE</option>
            </select>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              ALL: cache کلیدهای پارتیشن (کاهش I/O در lookup)
              <br />
              NONE: صرفه‌جویی در حافظه
            </p>
          </div>
          <div>
            <TextInput
              label="rows_per_partition"
              value={opts.caching?.rows_per_partition}
              onChange={(v) => setOption('caching.rows_per_partition', v)}
              placeholder="ALL یا 500"
              hint="ALL: تمام ردیف‌ها (پارتیشن کوچک) — عدد: N ردیف اول (پارتیشن بزرگ)"
            />
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        title="Compression"
        description="فشرده‌سازی داده‌ها روی دیسک — تعادل بین سرعت و فضا"
        enabled={advanced.compression}
        onToggle={() => toggle('compression')}
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Class</label>
            <select
              className="input ltr-input"
              value={currentCompression}
              onChange={(e) => setOption('compression.class', e.target.value)}
              dir="ltr"
            >
              {COMPRESSION_CLASSES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              {COMPRESSION_CLASSES.find((c) => c.value === currentCompression)?.desc}
            </p>
          </div>
          <NumberInput
            label="chunk_length_in_kb"
            value={opts.compression?.chunk_length_in_kb}
            onChange={(v) => setOption('compression.chunk_length_in_kb', v)}
            placeholder="64"
            hint="اندازه بلوک فشرده‌سازی — مقادیر کمتر = فشرده‌سازی بهتر، overhead بیشتر"
          />
        </div>
      </AccordionSection>

      <AccordionSection
        title="Default TTL (ثانیه)"
        description="انقضای خودکار داده‌ها — مناسب داده‌های سری‌زمانی، لاگ، session"
        enabled={advanced.ttl}
        onToggle={() => toggle('ttl')}
      >
        <NumberInput
          label="default_time_to_live"
          value={opts.ttl}
          onChange={(v) => setOption('ttl', v)}
          placeholder="0 = بدون انقضا"
          hint="مدت زمان (ثانیه) تا انقضای خودکار هر ردیف. ۰ = غیرفعال"
        />
        {opts.ttl > 0 && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            💡 داده‌ها پس از {formatDuration(opts.ttl)} منقضی می‌شوند.
          </p>
        )}
      </AccordionSection>

      <AccordionSection
        title="تنظیمات دیگر"
        description="gc_grace_seconds، bloom filter و توضیحات جدول"
        enabled={advanced.misc}
        onToggle={() => toggle('misc')}
      >
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="gc_grace_seconds"
            value={opts.gcGrace}
            onChange={(v) => setOption('gcGrace', v)}
            placeholder="864000"
            hint="مدت زمان نگهداری tombstone قبل از حذف نهایی — پیش‌فرض ۱۰ روز"
          />
          <NumberInput
            label="bloom_filter_fp_chance"
            value={opts.bloomFilter}
            onChange={(v) => setOption('bloomFilter', v)}
            step="0.001"
            placeholder="0.01"
            hint="احتمال false positive فیلتر Bloom — کمتر = دقیق‌تر، حافظه بیشتر"
          />
          <div className="col-span-2">
            <TextInput
              label="comment"
              value={opts.comment}
              onChange={(v) => setOption('comment', v)}
              placeholder="توضیحات جدول (اختیاری)"
              hint="در system_schema.tables ذخیره می‌شود"
            />
          </div>
        </div>
      </AccordionSection>
    </div>
  );
}

function AccordionSection({ title, description, enabled, onToggle, children }) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-right"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</div>
          {description && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{description}</div>
          )}
        </div>
        <span className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0 mr-2">
          {enabled ? 'فعال' : 'غیرفعال'}
          {enabled ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {enabled && <div className="p-4">{children}</div>}
    </div>
  );
}

function NumberInput({ label, value, onChange, placeholder, step, hint }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        className="input ltr-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        placeholder={placeholder}
        step={step}
        dir="ltr"
      />
      {hint && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        className="input ltr-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
      />
      {hint && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

/* ============ تب پیش‌نمایش با تحلیل کامل ============ */

function PreviewStep({ form, keyspace, generatedCql }) {
  const analysis = analyzeTable(form);

  if (!analysis) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
        برای دیدن پیش‌نمایش، نام جدول، ستون‌ها و کلید اصلی را تکمیل کنید
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          کوئری CQL که اجرا خواهد شد:
        </p>
        <pre className="code-block">{generatedCql}</pre>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Info size={16} className="text-scylla-600" />
          تحلیل کامل کوئری و ویژگی‌های این جدول
        </h4>

        <AnalysisSection title="ساختار ستون‌ها و کلید اصلی" icon={Columns}>
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {analysis.columns.length} ستون تعریف شده:
              </p>
              <ul className="mt-1 space-y-1">
                {analysis.columns.map((c) => {
                  const role = form.partitionKey.includes(c.name)
                    ? 'Partition Key'
                    : form.clusteringKey.includes(c.name)
                    ? 'Clustering Key'
                    : c.kind === 'static'
                    ? 'Static'
                    : 'Regular';
                  const roleColor = form.partitionKey.includes(c.name)
                    ? 'text-blue-600 dark:text-blue-400'
                    : form.clusteringKey.includes(c.name)
                    ? 'text-purple-600 dark:text-purple-400'
                    : c.kind === 'static'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-gray-500 dark:text-gray-400';
                  return (
                    <li key={c.name} className="flex items-center gap-2">
                      <code className="font-mono text-gray-700 dark:text-gray-300">{c.name}</code>
                      <span className="text-gray-400">({c.type})</span>
                      <span className={`text-[10px] font-medium ${roleColor}`}>— {role}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="p-2 rounded bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900">
              <p className="font-medium text-blue-800 dark:text-blue-200">Partition Key:</p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                <code className="font-mono">{form.partitionKey.join(', ')}</code>
                {' '}— تعیین‌کننده نود(های) نگهدارنده داده. تمام ردیف‌های یک پارتیشن روی یک نود ذخیره می‌شوند.
              </p>
            </div>

            {form.clusteringKey.length > 0 && (
              <div className="p-2 rounded bg-purple-50 dark:bg-purple-950 border border-purple-100 dark:border-purple-900">
                <p className="font-medium text-purple-800 dark:text-purple-200">Clustering Key:</p>
                <p className="text-purple-700 dark:text-purple-300 mt-1">
                  <code className="font-mono">{form.clusteringKey.join(', ')}</code>
                  {' '}— تعیین‌کننده ترتیب ردیف‌ها در یک پارتیشن.
                </p>
                {Object.entries(form.clusteringOrder).map(([col, dir]) => (
                  <p key={col} className="text-purple-700 dark:text-purple-300 mt-1 text-[10px]">
                    ستون <code>{col}</code> با ترتیب <strong>{dir}</strong>{' '}
                    {dir === 'DESC'
                      ? '— جدیدترین ردیف اول بازگردانده می‌شود (مناسب آخرین N ردیف)'
                      : '— قدیمی‌ترین ردیف اول (پیش‌فرض)'}
                  </p>
                ))}
              </div>
            )}
          </div>
        </AnalysisSection>

        {form.options.compaction && (
          <AnalysisSection title="استراتژی Compaction" icon={HardDrive}>
            <div className="text-xs space-y-2">
              <p>
                <strong>Class:</strong>{' '}
                <code className="font-mono text-scylla-600">
                  {form.options.compaction.class}
                </code>
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {getCompactionDescription(form.options.compaction.class)}
              </p>

              {form.options.compaction.bucket_high !== undefined && (
                <p>
                  <strong>bucket_high = {form.options.compaction.bucket_high}:</strong>{' '}
                  حداکثر نسبت اندازه برای ادغام SSTableها.
                </p>
              )}
              {form.options.compaction.bucket_low !== undefined && (
                <p>
                  <strong>bucket_low = {form.options.compaction.bucket_low}:</strong>{' '}
                  حداقل نسبت اندازه برای ادغام.
                </p>
              )}
              {form.options.compaction.min_threshold !== undefined && (
                <p>
                  <strong>min_threshold = {form.options.compaction.min_threshold}:</strong>{' '}
                  حداقل تعداد SSTable برای شروع compaction.
                </p>
              )}
              {form.options.compaction.max_threshold !== undefined && (
                <p>
                  <strong>max_threshold = {form.options.compaction.max_threshold}:</strong>{' '}
                  حداکثر تعداد SSTable قبل از اجبار به compaction.
                </p>
              )}
              {form.options.compaction.sstable_size_in_mb !== undefined && (
                <p>
                  <strong>sstable_size_in_mb = {form.options.compaction.sstable_size_in_mb}:</strong>{' '}
                  اندازه هدف SSTable در LCS. مقادیر بیشتر = SSTable بزرگ‌تر، compaction کمتر.
                </p>
              )}
              {form.options.compaction.window_size && (
                <p>
                  <strong>window_size = {form.options.compaction.window_size}:</strong>{' '}
                  پنجره زمانی در TWCS. SSTableها در بازه‌های زمانی جداگانه compact می‌شوند.
                </p>
              )}
              {form.options.compaction.timestamp_resolution && (
                <p>
                  <strong>timestamp_resolution = {form.options.compaction.timestamp_resolution}:</strong>{' '}
                  دقت timestamp در TWCS.
                </p>
              )}
            </div>
          </AnalysisSection>
        )}

        {form.options.caching && (
          <AnalysisSection title="تنظیمات Caching" icon={Layers}>
            <div className="text-xs space-y-2">
              {form.options.caching.keys && (
                <p>
                  <strong>keys = '{form.options.caching.keys}':</strong>{' '}
                  {form.options.caching.keys === 'ALL'
                    ? 'cache کلیدهای پارتیشن فعال — کاهش I/O دیسک در lookup'
                    : 'cache کلیدهای پارتیشن غیرفعال — صرفه‌جویی در حافظه'}
                </p>
              )}
              {form.options.caching.rows_per_partition && (
                <p>
                  <strong>rows_per_partition = '{form.options.caching.rows_per_partition}':</strong>{' '}
                  {form.options.caching.rows_per_partition === 'ALL'
                    ? 'تمام ردیف‌های هر پارتیشن cache می‌شوند — مناسب پارتیشن‌های کوچک'
                    : `${form.options.caching.rows_per_partition} ردیف اول هر پارتیشن cache می‌شود — مناسب پارتیشن‌های بزرگ`}
                </p>
              )}
            </div>
          </AnalysisSection>
        )}

        {form.options.compression && (
          <AnalysisSection title="Compression" icon={Filter}>
            <div className="text-xs space-y-2">
              <p>
                <strong>Class:</strong>{' '}
                <code className="font-mono text-scylla-600">
                  {form.options.compression.class}
                </code>
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {getCompressionDescription(form.options.compression.class)}
              </p>
              {form.options.compression.chunk_length_in_kb && (
                <p>
                  <strong>chunk_length_in_kb = {form.options.compression.chunk_length_in_kb}:</strong>{' '}
                  اندازه بلوک فشرده‌سازی. مقادیر کمتر = فشرده‌سازی بهتر، overhead بیشتر.
                </p>
              )}
            </div>
          </AnalysisSection>
        )}

        {form.options.ttl > 0 && (
          <AnalysisSection title="TTL پیش‌فرض" icon={Clock}>
            <p className="text-xs">
              <strong>default_time_to_live = {form.options.ttl} ثانیه</strong>
              <span className="block text-gray-600 dark:text-gray-400 mt-1">
                داده‌های این جدول پس از <strong>{formatDuration(form.options.ttl)}</strong> به‌طور
                خودکار منقضی می‌شوند. مناسب داده‌های سری‌زمانی، لاگ‌ها و sessionها.
              </span>
            </p>
          </AnalysisSection>
        )}

        {(form.options.gcGrace !== undefined ||
          form.options.bloomFilter !== undefined ||
          form.options.comment) && (
          <AnalysisSection title="تنظیمات دیگر" icon={Info}>
            <div className="text-xs space-y-2">
              {form.options.gcGrace !== undefined && (
                <p>
                  <strong>gc_grace_seconds = {form.options.gcGrace}:</strong>{' '}
                  مدت زمان نگهداری tombstone قبل از حذف نهایی. پیش‌فرض ۸۶۴۰۰۰ (۱۰ روز).
                </p>
              )}
              {form.options.bloomFilter !== undefined && (
                <p>
                  <strong>bloom_filter_fp_chance = {form.options.bloomFilter}:</strong>{' '}
                  احتمال false positive فیلتر Bloom. مقادیر کمتر = دقت بیشتر، حافظه بیشتر.
                </p>
              )}
              {form.options.comment && (
                <p>
                  <strong>comment = '{form.options.comment}':</strong>{' '}
                  توضیحات جدول — در system_schema.tables ذخیره می‌شود.
                </p>
              )}
            </div>
          </AnalysisSection>
        )}

        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
          <h5 className="font-bold text-xs text-gray-700 dark:text-gray-300 mb-2">
            خلاصه ویژگی‌های این جدول
          </h5>
          <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
            <li>✓ {analysis.columns.length} ستون</li>
            <li>✓ {form.partitionKey.length} Partition Key</li>
            {form.clusteringKey.length > 0 && (
              <li>✓ {form.clusteringKey.length} Clustering Key</li>
            )}
            {form.options.compaction && (
              <li>✓ Compaction: {form.options.compaction.class.replace('CompactionStrategy', '')}</li>
            )}
            {form.options.compression && (
              <li>✓ Compression: {form.options.compression.class.replace('Compressor', '')}</li>
            )}
            {form.options.caching && (
              <li>✓ Caching: keys={form.options.caching.keys || 'ALL'}</li>
            )}
            {form.options.ttl > 0 && <li>✓ TTL: {formatDuration(form.options.ttl)}</li>}
            {form.options.gcGrace !== undefined && (
              <li>✓ gc_grace: {form.options.gcGrace}s</li>
            )}
          </ul>
        </div>

        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
          <p className="font-bold mb-1">💡 توصیه‌های طراحی ScyllaDB</p>
          <ul className="list-disc list-inside space-y-1">
            <li>برای داده‌های سری‌زمانی از TWCS با TTL یکسان استفاده کنید</li>
            <li>برای جداول read-heavy از LCS استفاده کنید</li>
            <li>Partition Key را طوری انتخاب کنید که توزیع یکنواخت داشته باشد</li>
            <li>از partitionهای بزرگ (بیش از ۱۰۰MB) خودداری کنید</li>
            <li>برای جستجوی روی ستون‌های غیرکلید، ایندکس ثانویه بسازید</li>
            <li>طراحی بر اساس query انجام دهید، نه بر اساس موجودیت</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function AnalysisSection({ title, icon: Icon, children }) {
  return (
    <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
      <h5 className="font-bold text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
        <Icon size={14} className="text-scylla-600" />
        {title}
      </h5>
      {children}
    </div>
  );
}

/* ============ مودال ساخت ایندکس ============ */

function CreateIndexModal({ open, onClose, keyspace, table, columns, onCreated }) {
  const [form, setForm] = useState({
    indexName: '',
    column: '',
    type: 'regular',
    customClass: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const regularColumns = columns.filter((c) => c.kind === 'regular' || c.kind === 'clustering');

  useEffect(() => {
    if (regularColumns.length > 0 && !form.column) {
      setForm((f) => ({ ...f, column: regularColumns[0].name }));
    }
  }, [columns]);

  const previewCql = () => {
    if (!form.column) return '';
    let target = form.column;
    if (form.type === 'KEYS') target = `KEYS(${form.column})`;
    else if (form.type === 'VALUES') target = `VALUES(${form.column})`;
    else if (form.type === 'ENTRIES') target = `ENTRIES(${form.column})`;
    else if (form.type === 'FULL') target = `FULL(${form.column})`;
    else if (form.type === 'FULLKEYS') target = `FULL(KEYS(${form.column}))`;

    let cql = `CREATE INDEX`;
    if (form.indexName) cql += ` ${form.indexName}`;
    cql += ` ON ${keyspace}.${table} (${target})`;
    if (form.customClass) cql += ` USING '${form.customClass}'`;
    return cql + ';';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.column) {
      setError('یک ستون انتخاب کنید');
      return;
    }
    setLoading(true);
    try {
      await api.post('/indexes', {
        keyspace,
        table,
        indexName: form.indexName || undefined,
        column: form.column,
        type: form.type,
        customClass: form.customClass || undefined,
      });
      onCreated();
      onClose();
      setForm({ indexName: '', column: regularColumns[0]?.name || '', type: 'regular', customClass: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ساخت ایندکس');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = INDEX_TYPES.find((t) => t.value === form.type);

  return (
    <Modal open={open} onClose={onClose} title={`ساخت ایندکس روی ${table}`}>
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ستون هدف
          </label>
          <select
            className="input ltr-input"
            value={form.column}
            onChange={(e) => setForm({ ...form, column: e.target.value })}
            dir="ltr"
          >
            <option value="">انتخاب کنید...</option>
            {regularColumns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            ایندکس روی ستون‌های غیر از کلید اصلی ساخته می‌شود
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            نوع ایندکس
          </label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {INDEX_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {selectedType && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selectedType.desc}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            نام ایندکس (اختیاری)
          </label>
          <input
            className="input ltr-input"
            value={form.indexName}
            onChange={(e) => setForm({ ...form, indexName: e.target.value })}
            placeholder="اگر خالی بماند، خودکار ساخته می‌شود"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            پیش‌فرض: {'{table}_{column}_idx'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            کلاس سفارشی (اختیاری)
          </label>
          <input
            className="input ltr-input"
            value={form.customClass}
            onChange={(e) => setForm({ ...form, customClass: e.target.value })}
            placeholder="org.apache.cassandra.index.sasi.SASIIndex"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            فقط برای ایندکس‌های سفارشی — در حالت عادی خالی بگذارید
          </p>
        </div>

        {form.column && (
          <div>
            <p className="text-xs text-gray-500 mb-1">پیش‌نمایش کوئری:</p>
            <pre className="code-block">{previewCql()}</pre>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'در حال ساخت...' : 'ساخت ایندکس'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            انصراف
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ============ Helper Functions ============ */

function buildPreviewCql(keyspace, form) {
  const cols = form.columns
    .filter((c) => c.name && c.type)
    .map((c) => {
      let def = `  ${c.name} ${c.type}`;
      if (c.kind === 'static') def += ' STATIC';
      return def;
    });

  if (cols.length === 0) return '';

  let pk = form.partitionKey.length === 1
    ? `(${form.partitionKey[0]})`
    : `((${form.partitionKey.join(', ')}))`;
  if (form.clusteringKey.length > 0) {
    pk += `, ${form.clusteringKey.join(', ')}`;
  }

  let cql = `CREATE TABLE ${keyspace}.${form.table} (\n${cols.join(',\n')},\n  PRIMARY KEY (${pk})\n)`;

  const withParts = [];
  const o = form.options;

  if (o.compaction) {
    const parts = [`'class': '${o.compaction.class}'`];
    Object.entries(o.compaction).forEach(([k, v]) => {
      if (k !== 'class' && v !== undefined) {
        parts.push(`'${k}': ${typeof v === 'string' ? `'${v}'` : v}`);
      }
    });
    withParts.push(`  compaction = {${parts.join(', ')}}`);
  }
  if (o.caching) {
    const parts = [];
    if (o.caching.keys) parts.push(`'keys': '${o.caching.keys}'`);
    if (o.caching.rows_per_partition) parts.push(`'rows_per_partition': '${o.caching.rows_per_partition}'`);
    if (parts.length > 0) withParts.push(`  caching = {${parts.join(', ')}}`);
  }
  if (o.compression) {
    const parts = [`'class': '${o.compression.class}'`];
    if (o.compression.chunk_length_in_kb) parts.push(`'chunk_length_in_kb': ${o.compression.chunk_length_in_kb}`);
    withParts.push(`  compression = {${parts.join(', ')}}`);
  }
  if (o.ttl) withParts.push(`  default_time_to_live = ${o.ttl}`);
  if (o.gcGrace !== undefined) withParts.push(`  gc_grace_seconds = ${o.gcGrace}`);
  if (o.bloomFilter !== undefined) withParts.push(`  bloom_filter_fp_chance = ${o.bloomFilter}`);
  if (o.comment) withParts.push(`  comment = '${o.comment}'`);

  if (withParts.length > 0) cql += `\nWITH\n${withParts.join(' AND\n')};`;
  else cql += ';';

  return cql;
}

function analyzeTable(form) {
  if (!form.table || form.columns.length === 0 || form.partitionKey.length === 0) {
    return null;
  }
  return {
    columns: form.columns.filter((c) => c.name && c.type),
    partitionKey: form.partitionKey,
    clusteringKey: form.clusteringKey,
    options: form.options,
  };
}

function getCompactionDescription(strategy) {
  const map = {
    SizeTieredCompactionStrategy:
      'ادغام SSTableهای هم‌اندازه. مناسب نوشتن سنگین (write-heavy). ' +
      'read/write amplification پایین اما space amplification تا ۴۰۰٪.',
    LeveledCompactionStrategy:
      'SSTableهای کوچک ثابت (۱۶۰MB) در سطوح. مناسب خواندن مکرر (read-heavy). ' +
      'خواندن سریع (فقط ۱ SSTable در هر level) اما write amplification دو برابر.',
    TimeWindowCompactionStrategy:
      'SSTableها در پنجره‌های زمانی جداگانه compact می‌شوند. ' +
      'فقط برای داده‌های سری‌زمانی با TTL یکسان. با TTL یکسان، حذف کامل SSTable ممکن است.',
    IncrementalCompactionStrategy:
      'ترکیب STCS و LCS. amplification متعادل. فقط در ScyllaDB Enterprise موجود است.',
  };
  return map[strategy] || '';
}

function getCompressionDescription(cls) {
  const map = {
    LZ4Compressor: 'LZ4 — پیش‌فرض. تعادل خوب سرعت و نسبت فشرده‌سازی.',
    SnappyCompressor: 'Snappy — سریع‌تر اما نسبت فشرده‌سازی کمتر.',
    DeflateCompressor: 'Deflate — نسبت فشرده‌سازی بالا اما کندتر.',
    ZstdCompressor: 'Zstd — نسبت فشرده‌سازی بالا با سرعت خوب.',
  };
  return map[cls] || '';
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} ثانیه`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} دقیقه`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} ساعت`;
  return `${Math.round(seconds / 86400)} روز`;
}