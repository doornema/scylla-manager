import { useEffect, useState } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import ScyllaGuideModal from '../components/ScyllaGuideModal';
import { Plus, Trash2, Shield, BookOpen, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Keyspaces() {
  const [keyspaces, setKeyspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const load = () => {
    setLoading(true);
    api.get('/keyspaces')
      .then((res) => setKeyspaces(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (name) => {
    if (!confirm(`آیا از حذف Keyspace «${name}» مطمئن هستید؟\nتمام جداول و داده‌های آن حذف خواهند شد!`)) return;
    try {
      await api.delete(`/keyspaces/${name}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'خطا در حذف');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Keyspace ها</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowGuide(true)}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <BookOpen size={16} /> راهنمای ScyllaDB
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} /> Keyspace جدید
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center py-12 text-gray-400 dark:text-gray-500">
            در حال بارگذاری...
          </p>
        ) : keyspaces.length === 0 ? (
          <p className="text-center py-12 text-gray-400 dark:text-gray-500">
            هیچ Keyspace یافت نشد
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">نام</th>
                  <th className="px-4 py-3">Durable Writes</th>
                  <th className="px-4 py-3">Replication</th>
                  <th className="px-4 py-3">استراتژی</th>
                  {isAdmin && <th className="px-4 py-3">عملیات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {keyspaces.map((ks) => {
                  const repl = ks.replication || {};
                  const strategy = repl.class || '—';
                  const isNetworkTopology = strategy === 'NetworkTopologyStrategy';
                  return (
                    <tr key={ks.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                        {ks.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            ks.durableWrites
                              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {ks.durableWrites ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 ltr-input" dir="ltr">
                        {JSON.stringify(repl)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            isNetworkTopology
                              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                              : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                          }`}
                          title={isNetworkTopology ? 'مناسب production' : 'فقط برای توسعه'}
                        >
                          {strategy.replace('Strategy', '')}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDelete(ks.name)}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                            title="حذف Keyspace"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ScyllaGuideModal open={showGuide} onClose={() => setShowGuide(false)} />

      <CreateKeyspaceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
      />
    </div>
  );
}

/* ============ مودال ساخت Keyspace ============ */

function CreateKeyspaceModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    strategy: 'NetworkTopologyStrategy',
    replicationFactor: 3,
    dcReplication: { dc1: 3 },
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newDc, setNewDc] = useState('');
  const [newRf, setNewRf] = useState(3);

  const reset = () => {
    setForm({
      name: '',
      strategy: 'NetworkTopologyStrategy',
      replicationFactor: 3,
      dcReplication: { dc1: 3 },
    });
    setError('');
    setNewDc('');
    setNewRf(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !/^[a-z][a-z0-9_]*$/.test(form.name)) {
      setError('نام Keyspace باید با حرف کوچک شروع شده و فقط شامل حروف کوچک، اعداد و _ باشد');
      return;
    }
    if (form.strategy === 'NetworkTopologyStrategy' && Object.keys(form.dcReplication).length === 0) {
      setError('حداقل یک Data Center با Replication Factor مشخص کنید');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        strategy: form.strategy,
        replicationFactor: form.strategy === 'SimpleStrategy' ? form.replicationFactor : 1,
      };
      await api.post('/keyspaces', payload);
      onCreated();
      onClose();
      reset();
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ساخت Keyspace');
    } finally {
      setLoading(false);
    }
  };

  const previewCql = () => {
    if (form.strategy === 'SimpleStrategy') {
      return `CREATE KEYSPACE IF NOT EXISTS ${form.name || '...'}
  WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': ${form.replicationFactor}
  };`;
    }
    const dcEntries = Object.entries(form.dcReplication)
      .map(([dc, rf]) => `    '${dc}': ${rf}`)
      .join(',\n');
    return `CREATE KEYSPACE IF NOT EXISTS ${form.name || '...'}
  WITH replication = {
    'class': 'NetworkTopologyStrategy',
${dcEntries}
  };`;
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="ایجاد Keyspace جدید" wide>
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-900">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* نام */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            نام Keyspace
          </label>
          <input
            className="input ltr-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="my_keyspace"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            فقط حروف کوچک، اعداد و _ — باید با حرف شروع شود
          </p>
        </div>

        {/* استراتژی */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            استراتژی تکرار (Replication Strategy)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, strategy: 'NetworkTopologyStrategy' })}
              className={`p-3 rounded-lg border-2 text-right transition-colors ${
                form.strategy === 'NetworkTopologyStrategy'
                  ? 'border-scylla-600 bg-scylla-50 dark:bg-scylla-950'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <div className="font-bold text-sm text-green-700 dark:text-green-300 flex items-center gap-1">
                <Shield size={14} /> NetworkTopology (توصیه‌شده)
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                RF جداگانه برای هر Data Center. از Rack آگاه است. مناسب production.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, strategy: 'SimpleStrategy' })}
              className={`p-3 rounded-lg border-2 text-right transition-colors ${
                form.strategy === 'SimpleStrategy'
                  ? 'border-scylla-600 bg-scylla-50 dark:bg-scylla-950'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <div className="font-bold text-sm text-red-700 dark:text-red-300 flex items-center gap-1">
                <Shield size={14} /> Simple (فقط توسعه)
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                یک RF برای کل کلاستر. از Rack ناآگاه. برای production توصیه نمی‌شود.
              </p>
            </button>
          </div>
        </div>

        {/* توضیحات استراتژی انتخاب‌شده */}
        <div className={`p-3 rounded-lg border text-xs ${
          form.strategy === 'NetworkTopologyStrategy'
            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {form.strategy === 'NetworkTopologyStrategy' ? (
            <>
              <p className="font-bold mb-1">✓ NetworkTopologyStrategy</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>RF مستقل برای هر Data Center</li>
                <li>replicaها را در Rackهای مختلف قرار می‌دهد (تحمل خرابی)</li>
                <li>مناسب محیط Multi-DC</li>
                <li>استاندارد ScyllaDB برای production</li>
              </ul>
            </>
          ) : (
            <>
              <p className="font-bold mb-1">⚠️ SimpleStrategy</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>یک RF برای تمام کلاستر</li>
                <li>اگر rackی از دست برود، ممکن است تمام replicaها از دست بروند</li>
                <li>برای تولید توصیه نمی‌شود</li>
                <li>فقط برای توسعه و تست محلی</li>
              </ul>
            </>
          )}
        </div>

        {/* RF تنظیمات */}
        {form.strategy === 'SimpleStrategy' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Replication Factor
            </label>
            <input
              type="number"
              min="1"
              max="10"
              className="input ltr-input"
              value={form.replicationFactor}
              onChange={(e) => setForm({ ...form, replicationFactor: parseInt(e.target.value) || 1 })}
              dir="ltr"
            />
            <p className="text-xs text-gray-400 mt-1">
              تعداد کپی‌های هر ردیف در کل کلاستر. برای production معمولاً ۳.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Replication Factor هر Data Center
            </label>
            <div className="space-y-2">
              {Object.entries(form.dcReplication).map(([dc, rf]) => (
                <div key={dc} className="flex items-center gap-2">
                  <input
                    className="input flex-1 ltr-input"
                    value={dc}
                    onChange={(e) => {
                      const newDcName = e.target.value;
                      const newRepl = { ...form.dcReplication };
                      delete newRepl[dc];
                      newRepl[newDcName] = rf;
                      setForm({ ...form, dcReplication: newRepl });
                    }}
                    dir="ltr"
                    placeholder="نام DC"
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    className="input w-20 ltr-input"
                    value={rf}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        dcReplication: { ...form.dcReplication, [dc]: parseInt(e.target.value) || 0 },
                      })
                    }
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newRepl = { ...form.dcReplication };
                      delete newRepl[dc];
                      setForm({ ...form, dcReplication: newRepl });
                    }}
                    className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-950 rounded"
                    title="حذف DC"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                className="input flex-1 ltr-input"
                value={newDc}
                onChange={(e) => setNewDc(e.target.value)}
                placeholder="نام DC جدید (مثلاً dc2)"
                dir="ltr"
              />
              <input
                type="number"
                min="0"
                max="10"
                className="input w-20 ltr-input"
                value={newRf}
                onChange={(e) => setNewRf(parseInt(e.target.value) || 0)}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => {
                  if (newDc) {
                    setForm({
                      ...form,
                      dcReplication: { ...form.dcReplication, [newDc]: newRf },
                    });
                    setNewDc('');
                    setNewRf(3);
                  }
                }}
                className="btn-ghost text-xs py-1.5 whitespace-nowrap"
              >
                افزودن DC
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              مجموع RF نباید از تعداد نودهای آن DC بیشتر باشد.
            </p>
          </div>
        )}

        {/* پیش‌نمایش */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">پیش‌نمایش کوئری:</p>
          <pre className="code-block">{previewCql()}</pre>
        </div>

        {/* راهنما */}
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
          <p className="font-bold mb-1 flex items-center gap-1">
            <Info size={12} /> راهنمای انتخاب RF
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><strong>RF=۱:</strong> بدون تحمل خطا — فقط تست</li>
            <li><strong>RF=۲:</strong> تحمل خرابی یک نود</li>
            <li><strong>RF=۳:</strong> حداقل توصیه‌شده production (تحمل ۱ نود با quorum)</li>
            <li><strong>RF=۵:</strong> برای کلاسترهای بزرگ با تحمل خطای بالا</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'در حال ساخت...' : 'ایجاد Keyspace'}
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