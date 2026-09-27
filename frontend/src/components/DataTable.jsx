export default function DataTable({ columns, rows, emptyMessage = 'داده‌ای یافت نشد' }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right">
        <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 uppercase text-xs">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}