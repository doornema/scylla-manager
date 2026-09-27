import { useState } from 'react';
import Modal from './Modal';
import {
  Database, KeyRound, Link2, Zap, HardDrive, Layers,
  Shield, Clock, Filter, BookOpen,
} from 'lucide-react';

export default function ScyllaGuideModal({ open, onClose }) {
  const [section, setSection] = useState('overview');

  const sections = [
    { id: 'overview', label: 'ScyllaDB چیست؟', icon: Database },
    { id: 'keyspace', label: 'Keyspace و تکرار', icon: Shield },
    { id: 'datatypes', label: 'انواع داده', icon: Layers },
    { id: 'primarykey', label: 'کلید اصلی', icon: KeyRound },
    { id: 'compaction', label: 'Compaction', icon: HardDrive },
    { id: 'caching', label: 'Caching', icon: Layers },
    { id: 'compression', label: 'Compression', icon: Filter },
    { id: 'ttl', label: 'TTL و gc_grace', icon: Clock },
    { id: 'index', label: 'ایندکس', icon: Zap },
  ];

  return (
    <Modal open={open} onClose={onClose} title="راهنمای جامع ScyllaDB" wide>
      <div className="flex flex-col md:flex-row gap-4 min-h-[500px]">
        {/* منوی کناری */}
        <div className="w-full md:w-48 flex-shrink-0 md:border-l md:border-gray-100 md:dark:border-gray-800 md:pl-4">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  section === id
                    ? 'bg-scylla-50 dark:bg-scylla-950 text-scylla-700 dark:text-scylla-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* محتوا */}
        <div className="flex-1 overflow-y-auto max-h-[600px] md:pr-2">
          {section === 'overview' && <OverviewSection />}
          {section === 'keyspace' && <KeyspaceSection />}
          {section === 'datatypes' && <DataTypesSection />}
          {section === 'primarykey' && <PrimaryKeySection />}
          {section === 'compaction' && <CompactionSection />}
          {section === 'caching' && <CachingSection />}
          {section === 'compression' && <CompressionSection />}
          {section === 'ttl' && <TtlSection />}
          {section === 'index' && <IndexSection />}
        </div>
      </div>
    </Modal>
  );
}

function GuideSection({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <BookOpen size={18} className="text-scylla-600" />
        {title}
      </h3>
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function InfoBox({ title, children, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    green: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    amber: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    red: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  };
  return (
    <div className={`p-3 rounded-lg border text-xs ${colors[color]}`}>
      <p className="font-bold mb-1">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function OverviewSection() {
  return (
    <GuideSection title="ScyllaDB چیست؟">
      <p>
        ScyllaDB یک پایگاه داده NoSQL توزیع‌شده، با کارایی بالا و سازگار با Cassandra است.
        برخلاف Cassandra که با Java نوشته شده، ScyllaDB با ++C نوشته شده و از معماری
        <strong> Shard-per-Core</strong> استفاده می‌کند — هر هسته CPU یک shard مستقل با
        حافظه، cache و I/O اختصاصی خود دارد.
      </p>

      <InfoBox title="ویژگی‌های کلیدی" color="green">
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Shard-per-Core — بدون قفل، بدون Garbage Collector</li>
          <li>عملکرد پیش‌بینی‌پذیر با تأخیر p99 زیر میلی‌ثانیه</li>
          <li>سازگاری کامل با زبان CQL</li>
          <li>پشتیبانی بومی از Multi-DC و Rack Awareness</li>
          <li>Tablets — معماری جدید توزیع داده (جایگزین vnodes)</li>
        </ul>
      </InfoBox>

      <h4 className="font-bold text-gray-800 dark:text-gray-200 mt-4">سلسله‌مراتب داده</h4>
      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 font-mono text-xs ltr-input" dir="ltr">
        <pre>{`Cluster
 └── Keyspace (استراتژی تکرار)
      └── Table (ساختار و تنظیمات)
           └── Partition (کلید پارتیشن)
                └── Row (Clustering Key + ستون‌ها)`}</pre>
      </div>
    </GuideSection>
  );
}

function KeyspaceSection() {
  return (
    <GuideSection title="Keyspace و استراتژی تکرار">
      <p>
        Keyspace بالاترین سطح سازمان‌دهی داده در ScyllaDB است. هر Keyspace شامل مجموعه‌ای
        از جداول است و <strong>استراتژی تکرار (Replication Strategy)</strong> را تعیین می‌کند.
      </p>

      <div className="grid grid-cols-1 gap-3 mt-3">
        <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <h4 className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2">
            <Shield size={16} /> SimpleStrategy
          </h4>
          <p className="text-xs mt-2 text-red-700 dark:text-red-300">
            یک عدد تکرار (RF) برای کل کلاستر. داده‌ها را روی نودهای متوالی ring پخش می‌کند.
          </p>
          <ul className="text-xs mt-2 space-y-1 text-red-700 dark:text-red-300 list-disc list-inside">
            <li>از Rack و Data Center آگاه نیست</li>
            <li>برای محیط production توصیه نمی‌شود</li>
            <li>در Tablet-based keyspaces قابل تغییر به NetworkTopology نیست</li>
            <li>فقط برای توسعه و تست</li>
          </ul>
          <pre className="mt-2 text-[10px] bg-red-100 dark:bg-red-900/50 p-2 rounded font-mono ltr-input" dir="ltr">
{`CREATE KEYSPACE my_ks WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 3
};`}
          </pre>
        </div>

        <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <h4 className="font-bold text-green-800 dark:text-green-200 flex items-center gap-2">
            <Shield size={16} /> NetworkTopologyStrategy (توصیه‌شده)
          </h4>
          <p className="text-xs mt-2 text-green-700 dark:text-green-300">
            RF جداگانه برای هر Data Center. از Rack و Availability Zone آگاه است.
          </p>
          <ul className="text-xs mt-2 space-y-1 text-green-700 dark:text-green-300 list-disc list-inside">
            <li>تنها استراتژی مناسب برای production</li>
            <li>replicaها را در rackهای مختلف قرار می‌دهد</li>
            <li>از Multi-DC پشتیبانی می‌کند</li>
            <li>در ScyllaDB پیش‌فرض است</li>
          </ul>
          <pre className="mt-2 text-[10px] bg-green-100 dark:bg-green-900/50 p-2 rounded font-mono ltr-input" dir="ltr">
{`CREATE KEYSPACE my_ks WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'dc1': 3,
  'dc2': 2
};`}
          </pre>
        </div>
      </div>

      <InfoBox title="Tablets در مقابل Vnodes" color="blue">
        ScyllaDB 6.0+ به طور پیش‌فرض از Tablets استفاده می‌کند — واحدهای کوچک‌تر و
        متعادل‌تر توزیع داده. مزایا: مقیاس‌پذیری تا ۳۰ برابر سریع‌تر، استفاده بهینه
        از فضا (تا ۹۰٪)، توزیع خودکار.
        برای غیرفعال کردن: <code>AND tablets = {'{'} 'enabled': false {'}'}</code>
      </InfoBox>
    </GuideSection>
  );
}

function DataTypesSection() {
  const scalarTypes = [
    { name: 'text / varchar', desc: 'رشته UTF-8 — نام، توضیحات', use: 'همه‌جا' },
    { name: 'int', desc: 'عدد صحیح ۳۲ بیتی', use: 'شناسه‌های کوچک' },
    { name: 'bigint', desc: 'عدد صحیح ۶۴ بیتی', use: 'timestamp، شناسه بزرگ' },
    { name: 'uuid', desc: 'شناسه یکتای ۱۲۸ بیتی', use: 'کلید تصادفی' },
    { name: 'timeuuid', desc: 'UUID نسخه ۱ — ترتیب‌پذیر زمانی', use: 'کلید ترتیب‌پذیر' },
    { name: 'timestamp', desc: 'زمان (میلی‌ثانیه از epoch)', use: 'زمان رویداد' },
    { name: 'boolean', desc: 'true / false', use: 'وضعیت‌ها' },
    { name: 'float / double', desc: 'اعشاری ۳۲/۶۴ بیتی', use: 'محاسبات عددی' },
    { name: 'decimal', desc: 'اعشاری دقت دلخواه', use: 'مالی' },
    { name: 'blob', desc: 'داده باینری', use: 'فایل، تصویر' },
    { name: 'inet', desc: 'آدرس IP', use: 'آدرس شبکه' },
    { name: 'counter', desc: 'شمارنده توزیع‌شده', use: 'شمارش' },
  ];

  const collectionTypes = [
    { name: 'list<T>', desc: 'لیست مرتب', example: 'list<text>' },
    { name: 'set<T>', desc: 'مجموعه یکتا', example: 'set<int>' },
    { name: 'map<K,V>', desc: 'نگاشت کلید-مقدار', example: 'map<text, int>' },
    { name: 'frozen<...>', desc: 'مجموعه غیرقابل تغییر (سبک‌تر)', example: 'frozen<list<int>>' },
  ];

  return (
    <GuideSection title="انواع داده (Data Types)">
      <h4 className="font-bold text-gray-800 dark:text-gray-200">انواع پایه (Scalar)</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-3 py-2 font-medium">نوع</th>
              <th className="px-3 py-2 font-medium">توضیح</th>
              <th className="px-3 py-2 font-medium">کاربرد</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {scalarTypes.map((t) => (
              <tr key={t.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 font-mono text-scylla-600 dark:text-scylla-400">{t.name}</td>
                <td className="px-3 py-2">{t.desc}</td>
                <td className="px-3 py-2 text-gray-500">{t.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="font-bold text-gray-800 dark:text-gray-200 mt-6">انواع مجموعه (Collection)</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-3 py-2 font-medium">نوع</th>
              <th className="px-3 py-2 font-medium">توضیح</th>
              <th className="px-3 py-2 font-medium">مثال</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {collectionTypes.map((t) => (
              <tr key={t.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 font-mono text-purple-600 dark:text-purple-400">{t.name}</td>
                <td className="px-3 py-2">{t.desc}</td>
                <td className="px-3 py-2 font-mono text-gray-500">{t.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InfoBox title="frozen در مقابل غیر-frozen" color="amber">
        یک مجموعه <strong>frozen</strong> فقط به‌صورت کامل قابل نوشتن است — نمی‌توانید
        عناصر را جداگانه اضافه/حذف کنید. اما frozen سبک‌تر است و به‌صورت blob ذخیره می‌شود.
        برای مجموعه‌هایی که به‌ندرت تغییر می‌کنند، frozen انتخاب بهتری است.
      </InfoBox>
    </GuideSection>
  );
}

function PrimaryKeySection() {
  return (
    <GuideSection title="کلید اصلی (Primary Key)">
      <pre className="p-3 rounded-lg bg-gray-900 dark:bg-black text-green-400 text-xs font-mono ltr-input" dir="ltr">
{`PRIMARY KEY ((partition_key1, partition_key2), clustering1, clustering2)`}
      </pre>

      <div className="grid grid-cols-1 gap-3 mt-4">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm flex items-center gap-2">
            <KeyRound size={14} /> Partition Key
          </h4>
          <p className="text-xs mt-1 text-blue-700 dark:text-blue-300">
            تعیین‌کننده نود نگهدارنده داده. می‌تواند یک ستون یا ترکیبی از چند ستون باشد.
            تمام ردیف‌های یک پارتیشن روی یک نود ذخیره می‌شوند.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
          <h4 className="font-bold text-purple-800 dark:text-purple-200 text-sm flex items-center gap-2">
            <Link2 size={14} /> Clustering Key
          </h4>
          <p className="text-xs mt-1 text-purple-700 dark:text-purple-300">
            تعیین‌کننده ترتیب ردیف‌ها در یک پارتیشن. اختیاری است. می‌تواند ترتیب صعودی (ASC)
            یا نزولی (DESC) داشته باشد.
          </p>
        </div>
      </div>

      <InfoBox title="قانون طلایی طراحی" color="red">
        در ScyllaDB طراحی بر اساس <strong>query</strong> انجام می‌شود، نه بر اساس موجودیت.
        هر query باید یک جدول جداگانه داشته باشد. این برخلاف پایگاه‌داده‌های رابطه‌ای است.
      </InfoBox>
    </GuideSection>
  );
}

function CompactionSection() {
  const strategies = [
    {
      name: 'SizeTiered (STCS)',
      desc: 'ادغام SSTableهای هم‌اندازه (پیش‌فرض: ۴ عدد)',
      best: 'نوشتن سنگین (write-heavy)',
      pros: 'read/write amplification پایین',
      cons: 'space amplification تا ۴۰۰٪',
    },
    {
      name: 'Leveled (LCS)',
      desc: 'SSTableهای کوچک ثابت (۱۶۰MB) در سطوح',
      best: 'خواندن مکرر (read-heavy)',
      pros: 'خواندن سریع، اتلاف فضای حداکثر ۱۰٪',
      cons: 'write amplification دو برابر',
    },
    {
      name: 'TimeWindow (TWCS)',
      desc: 'پنجره‌های زمانی جداگانه',
      best: 'داده‌های سری‌زمانی (time-series)',
      pros: 'با TTL یکسان، حذف کامل SSTable',
      cons: 'فقط برای time-series',
    },
    {
      name: 'Incremental (ICS)',
      desc: 'ترکیب STCS و LCS',
      best: 'ترکیبی از خواندن/نوشتن',
      pros: 'amplification متعادل',
      cons: 'فقط Enterprise',
    },
  ];

  return (
    <GuideSection title="استراتژی‌های Compaction">
      <p>
        Compaction فرآیند ادغام SSTableها برای کاهش read/write/space amplification است.
      </p>

      <div className="space-y-3 mt-3">
        {strategies.map((s) => (
          <div key={s.name} className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{s.name}</h4>
            <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">{s.desc}</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
              <span className="text-green-600 dark:text-green-400">✓ {s.pros}</span>
              <span className="text-red-600 dark:text-red-400">✗ {s.cons}</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">مناسب برای: {s.best}</p>
          </div>
        ))}
      </div>

      <InfoBox title="پارامترهای کلیدی" color="blue">
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li><code>bucket_high/bucket_low</code> — نسبت اندازه برای STCS</li>
          <li><code>min/max_threshold</code> — حداقل/حداکثر SSTable (پیش‌فرض: ۴/۳۲)</li>
          <li><code>sstable_size_in_mb</code> — اندازه SSTable در LCS (پیش‌فرض: ۱۶۰)</li>
          <li><code>window_size</code> — پنجره زمانی در TWCS (مثلاً 1d)</li>
        </ul>
      </InfoBox>
    </GuideSection>
  );
}

function CachingSection() {
  return (
    <GuideSection title="Caching">
      <p>ScyllaDB دو نوع cache برای هر جدول دارد:</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm">Key Cache</h4>
          <p className="text-xs mt-1 text-blue-700 dark:text-blue-300">
            نگاشت کلید پارتیشن به موقعیت SSTable — کاهش I/O دیسک.
            مقدار: <code>'keys': 'ALL'</code> یا <code>'NONE'</code>
          </p>
        </div>
        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
          <h4 className="font-bold text-purple-800 dark:text-purple-200 text-sm">Row Cache</h4>
          <p className="text-xs mt-1 text-purple-700 dark:text-purple-300">
            ذخیره کل ردیف‌های یک پارتیشن — مناسب پارتیشن‌های کوچک و hot.
            مقدار: <code>'rows_per_partition': 'ALL'</code> یا عدد
          </p>
        </div>
      </div>

      <InfoBox title="توصیه" color="green">
        برای داده‌های سری‌زمانی با پارتیشن‌های بزرگ، <code>rows_per_partition: '500'</code>{' '}
        پیشنهاد می‌شود. برای پارتیشن‌های کوچک، <code>'ALL'</code> مناسب است.
      </InfoBox>
    </GuideSection>
  );
}

function CompressionSection() {
  return (
    <GuideSection title="Compression">
      <p>ScyllaDB از چهار الگوریتم فشرده‌سازی پشتیبانی می‌کند:</p>

      <div className="space-y-2 mt-3">
        {[
          { name: 'LZ4Compressor', desc: 'پیش‌فرض — تعادل خوب سرعت و نسبت' },
          { name: 'SnappyCompressor', desc: 'سریع‌تر اما نسبت کمتر' },
          { name: 'DeflateCompressor', desc: 'نسبت بالا اما کندتر' },
          { name: 'ZstdCompressor', desc: 'نسبت بالا با سرعت خوب' },
        ].map((c) => (
          <div key={c.name} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
            <code className="text-xs font-mono text-scylla-600 dark:text-scylla-400 w-40">{c.name}</code>
            <span className="text-xs text-gray-600 dark:text-gray-400">{c.desc}</span>
          </div>
        ))}
      </div>

      <InfoBox title="chunk_length_in_kb" color="blue">
        اندازه بلوک فشرده‌سازی (پیش‌فرض: 64KB). مقادیر کوچک‌تر = فشرده‌سازی بهتر
        اما overhead بیشتر.
      </InfoBox>
    </GuideSection>
  );
}

function TtlSection() {
  return (
    <GuideSection title="TTL و gc_grace_seconds">
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm">default_time_to_live (TTL)</h4>
          <p className="text-xs mt-1 text-blue-700 dark:text-blue-300">
            مدت زمان (ثانیه) تا انقضای خودکار داده. مقدار ۰ = غیرفعال.
            مثال: <code>default_time_to_live = 86400</code> (۱ روز)
          </p>
        </div>

        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
          <h4 className="font-bold text-amber-800 dark:text-amber-200 text-sm">gc_grace_seconds</h4>
          <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">
            مدت زمان (ثانیه) که tombstone (علامت حذف) باید باقی بماند.
            پیش‌فرض: 864000 (۱۰ روز).
          </p>
        </div>
      </div>

      <InfoBox title="نکته حیاتی" color="red">
        اگر TTL بزرگ‌تر از gc_grace_seconds باشد، داده منقضی‌شده هرگز tombstone
        تولید نمی‌کند. این می‌تواند باعث مصرف بی‌رویه فضا شود.
      </InfoBox>

      <InfoBox title="Bloom Filter" color="blue">
        پارامتر <code>bloom_filter_fp_chance</code> احتمال false positive فیلتر
        Bloom را تعیین می‌کند. پیش‌فرض: 0.01 (۱٪). مقادیر کمتر = دقت بیشتر
        اما حافظه بیشتر.
      </InfoBox>
    </GuideSection>
  );
}

function IndexSection() {
  const indexes = [
    { name: 'regular', desc: 'ایندکس معمولی روی یک ستون', example: 'CREATE INDEX ON users (email)' },
    { name: 'KEYS(v)', desc: 'ایندکس روی کلیدهای Map', example: 'WHERE m CONTAINS KEY 4' },
    { name: 'VALUES(v)', desc: 'ایندکس روی مقادیر Map/Set/List', example: 'WHERE m CONTAINS 3' },
    { name: 'ENTRIES(v)', desc: 'ایندکس روی ورودی‌های Map', example: 'WHERE m[1] = 2' },
    { name: 'FULL(v)', desc: 'ایندکس کامل مجموعه frozen', example: 'روی کل مجموعه' },
    { name: 'FULL(KEYS(v))', desc: 'ایندکس کامل کلیدهای frozen', example: 'ترکیبی' },
  ];

  return (
    <GuideSection title="ایندکس‌های ثانویه">
      <p>
        ScyllaDB از ایندکس‌های ثانویه روی ستون‌های غیر از کلید پارتیشن پشتیبانی می‌کند.
      </p>

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-xs text-right border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-3 py-2 font-medium">نوع</th>
              <th className="px-3 py-2 font-medium">توضیح</th>
              <th className="px-3 py-2 font-medium">مثال</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {indexes.map((t) => (
              <tr key={t.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 font-mono text-scylla-600 dark:text-scylla-400">{t.name}</td>
                <td className="px-3 py-2">{t.desc}</td>
                <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{t.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InfoBox title="نام‌گذاری پیش‌فرض" color="blue">
        نام پیش‌فرض ایندکس: <code>{'{table}_{column}_idx'}</code> — مثلاً{' '}
        <code>users_email_idx</code>. اگر نام تکراری باشد، <code>_1</code>،{' '}
        <code>_2</code> و... اضافه می‌شود.
      </InfoBox>
    </GuideSection>
  );
}