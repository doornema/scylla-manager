import { useEffect, useState } from 'react';
import api from '../api/client';
import { Activity, HardDrive, Database, RefreshCw } from 'lucide-react';

export default function Monitor() {
  const [cluster, setCluster] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [largePartitions, setLargePartitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [c, n, lp] = await Promise.all([
        api.get('/monitor/cluster'),
        api.get('/monitor/nodes'),
        api.get('/monitor/large-partitions'),
      ]);
      setCluster(c.data);
      setNodes(n.data);
      setLargePartitions(lp.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <p className="text-center py-12 text-gray-400 dark:text-gray-500">
        در حال بارگذاری...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">مانیتورینگ</h2>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RefreshCw size={16} /> به‌روزرسانی
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <MetricCard
          icon={Database}
          title="گره‌های فعال"
          value={nodes.length + 1}
          color="blue"
        />
        <MetricCard
          icon={HardDrive}
          title="پارتیشن‌های بزرگ"
          value={largePartitions.length}
          color="amber"
        />
        <MetricCard
          icon={Activity}
          title="وضعیت کلاستر"
          value={cluster?.local?.cluster_name ? 'سالم' : 'نامشخص'}
          color="green"
        />
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          وضعیت گره‌ها
        </h3>
        {nodes.length === 0 ? (
          <p className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
            اطلاعات گره‌ها در دسترس نیست
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">آدرس</th>
                  <th className="px-4 py-3">DC</th>
                  <th className="px-4 py-3">Rack</th>
                  <th className="px-4 py-3">وضعیت</th>
                  <th className="px-4 py-3">Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {nodes.map((n, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {n.address}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{n.dc}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{n.rack}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          n.status === 'NORMAL'
                            ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {n.load || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          پارتیشن‌های بزرگ
        </h3>
        {largePartitions.length === 0 ? (
          <p className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
            پارتیشن بزرگی یافت نشد
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Keyspace</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Partition Key</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {largePartitions.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {p.keyspace_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {p.table_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-xs">
                      {p.partition_key}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {(Number(p.partition_size) / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {p.rows}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, title, value, color }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
    green: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg flex-shrink-0 ${colors[color]}`}>
        <Icon size={24} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}