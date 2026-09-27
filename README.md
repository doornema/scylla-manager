<div align="center">

# 🚀 ScyllaDB Web Manager

### پنل مدیریت و مانیتورینگ حرفه‌ای برای ScyllaDB

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![ScyllaDB](https://img.shields.io/badge/ScyllaDB-6.2-FF6F61?style=for-the-badge&logo=scylladb&logoColor=white)](https://www.scylladb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**یک پنل وب کامل، امن و مدرن برای مدیریت تمام‌عیار پایگاه‌داده ScyllaDB**

[معرفی](#-معرفی) • [ویژگی‌ها](#-ویژگیها) • [نصب سریع](#-نصب-سریع) • [مستندات](#-مستندات) • [امنیت](#-امنیت)

</div>

---

## 📖 معرفی

**ScyllaDB Web Manager** یک رابط کاربری تحت وب کامل برای مدیریت پایگاه‌داده ScyllaDB است. این پروژه به شما اجازه می‌دهد تا بدون نیاز به `cqlsh` یا ابزارهای خط فرمان، به‌صورت بصری و امن با تمام جنبه‌های ScyllaDB کار کنید — از ساخت Keyspace و طراحی جدول‌های پیشرفته تا مرور داده‌ها، مدیریت ایندکس‌ها، اجرای کوئری‌های CQL و مانیتورینگ زنده کلاستر.

با معماری تک‌کانتینری و استقرار آسان با Docker Compose، این پنل در چند دقیقه روی هر زیرساختی بالا می‌آید.

---

## ✨ ویژگی‌ها

### 🎯 مدیریت کامل داده

- **Keyspace Management** — ایجاد، حذف و مشاهده Keyspace ها با پشتیبانی از `SimpleStrategy` و `NetworkTopologyStrategy`
- **Table Designer پیشرفته** — طراحی جدول با تمام گزینه‌های CQL:
  - Partition Key و Clustering Key با ترتیب ASC/DESC
  - ستون‌های Static
  - Compaction: STCS, LCS, TWCS, ICS
  - Compression: LZ4, Snappy, Deflate, Zstd
  - Caching سفارشی
  - TTL پیش‌فرض، gc_grace_seconds، bloom filter
- **CRUD کامل داده** — درج، ویرایش، حذف و مرور داده‌ها با رابط بصری
- **🎲 Auto-Generate مقادیر** — تولید مقدار تصادفی هوشمند برای هر نوع CQL (UUID, متن فارسی, عدد, تاریخ, ...)
- **Secondary Indexes** — ساخت و مدیریت ایندکس‌های ثانویه با پشتیبانی از `KEYS`, `VALUES`, `ENTRIES`, `FULL`

### 🔍 ابزارهای حرفه‌ای

- **CQL Editor پیشرفته** — ویرایشگر با شماره خط، رنگ‌آمیزی هوشمند سینتکس، تکمیل خودکار و کنترول از طریق `Ctrl+Enter`
- **کوئری ساخت جدول** — مشاهده کوئری کامل `CREATE TABLE` + `CREATE INDEX` ها با قابلیت کپی
- **راهنمای جامع ScyllaDB** — مستندات درون‌برنامه‌ای شامل توضیح کامل انواع داده، استراتژی‌ها و بهترین روش‌ها

### 📊 مانیتورینگ

- **Cluster Info** — نام کلاستر، نسخه، Data Center، Rack، Tokens
- **Node Status** — وضعیت گره‌ها، Load، Partitionها
- **Large Partitions** — شناسایی پارتیشن‌های بزرگ برای بهینه‌سازی
- **Size Estimates** — تخمین حجم و تعداد ردیف‌ها

### 🎨 تجربه کاربری

- **Dark Mode** — با سه حالت روشن / تاریک / سیستم و ذخیره در localStorage
- **ریسپانسیو کامل** — تجربه روان روی موبایل، تبلت و دسکتاپ
- **RTL** — طراحی راست‌به‌چپ مخصوص کاربران فارسی‌زبان
- **UI مدرن** — Tailwind CSS با طراحی مینیمال و کاربرپسند

### 🔐 امنیت

- **JWT Authentication** — توکن با انقضای قابل تنظیم
- **Rate Limiting** — محدودیت درخواست‌ها و تلاش‌های ورود
- **Helmet.js** — هدرهای امنیتی HTTP
- **Zod Validation** — اعتبارسنجی کامل ورودی‌ها
- **Prepared Statements** — جلوگیری از CQL Injection
- **Role-Based Access** — تفکیک دسترسی ادمین و کاربر عادی

---

## 🏗️ معماری
