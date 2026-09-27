import QueryRunner from '../components/QueryRunner';

export default function Query() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          اجرای کوئری CQL
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          هر کوئری CQL را اجرا کنید و نتیجه یا خطای کامل را ببینید
        </p>
      </div>
      <QueryRunner />
    </div>
  );
}