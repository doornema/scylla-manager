import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Dashboard() {
  const [cluster, setCluster] = useState(null);
  const [keyspaces, setKeyspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/monitor/cluster'),
      api.get('/keyspaces'),
    ])
      .then(([clusterRes, ksRes]) => {
        setCluster(clusterRes.data);
        setKeyspaces(ksRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        در حال بارگذاری...
      </div>
    );
  }

  const local = cluster?.local || {};
  const peers = cluster?.peers || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">داشبورد</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <StatCard title="نام کلاستر" value={local.cluster_name || '-'} />
        <StatCard title="نسخه ScyllaDB" value={local.release_version || '-'} />
        <StatCard title="تعداد گره‌ها" value={peers.length + 1} />
        <StatCard title="تعداد Keyspace" value={keyspaces.length} />
        <StatCard title="Data Center" value={local.data_center || '-'} />
        <StatCard title="Rack" value={local.rack || '-'} />
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          اطلاعات اتصال
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoItem label="Listen Address" value={local.listen_address} />
          <InfoItem label="RPC Address" value={local.rpc_address} />
          <InfoItem label="CQL Version" value={local.cql_version} />
          <InfoItem label="Protocol" value={local.native_protocol_version} />
          <InfoItem label="Partitioner" value={local.partitioner} />
          <InfoItem label="Schema Version" value={local.schema_version} />
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          گره‌های کلاستر
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">آدرس</th>
                <th className="px-4 py-3">Data Center</th>
                <th className="px-4 py-3">Rack</th>
                <th className="px-4 py-3">نسخه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                  {local.listen_address}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {local.data_center}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {local.rack}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {local.release_version}
                </td>
              </tr>
              {peers.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {p.peer}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {p.data_center}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {p.rack}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {p.release_version}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{value}</p>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="font-mono text-gray-700 dark:text-gray-300 text-xs mt-0.5 break-all ltr-input" dir="ltr">
        {value || '-'}
      </p>
    </div>
  );
}