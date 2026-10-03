# 🏛️ معماری و دیاگرام جریان داده سامانه (Architecture & System Design)

## ۱. نمای کلی معماری (System Architecture)

این سامانه از الگوی **Monolithic Decoupled Full-Stack** با تفکیک واضح لایه‌ها بهره می‌برد:

```text
+--------------------------------------------------------------------------+
|                        Frontend Layer (React 19 SPA)                     |
|  - Components: Sidebar, StudentRequestsPortal, Lockers, AnomalyDetection |
|  - State & Auth: AuthContext, MentorContext, IndexedDB (localDb)         |
|  - Styling: Tailwind CSS v4, Motion (Animations)                         |
+------------------------------------+-------------------------------------+
                                     |  REST API / JSON / SSE Event Bus
                                     v
+--------------------------------------------------------------------------+
|                        Backend Layer (Node.js + Express)                 |
|  - Routing: server.ts (/api/auth, /api/data, /api/anomalies, /health)    |
|  - Security: JWT Access/Refresh, Bcrypt, RateLimit, CSRF, Audit Chaining |
|  - Engines: AnomalyEngine, BackupEngine, AuditChainEngine                |
|  - ORM / Abstraction: databaseAbstraction.ts                             |
+------------------------------------+-------------------------------------+
                                     |  Connection Pool (TCP / Unix Socket)
                                     v
+--------------------------------------------------------------------------+
|                        Persistence Layer (Database)                      |
|  - MySQL 8.0+ / PostgreSQL (Relational Engine, Foreign Keys, JSON Index) |
|  - File Storage: JSON Snapshots, Automated Backups, Public Uploads       |
+--------------------------------------------------------------------------+
```

---

## ۲. لایه‌های سیستم

### ۲.۱. لایه کلاینت (Frontend)
- **React 19 + Vite 6:** رندرینگ بسیار سریع با بهره‌گیری از هوک‌های تابعی و ساختار ماژولار.
- **IndexedDB Local Cache (`localDb.ts`):** ذخیره‌سازی محلی داده‌ها برای عملکرد آفلاین و بدون تاخیر در سمت کلاینت با سینک خوش‌بینانه (Optimistic Updates).
- **کنترل دسترسی گرانولار (Granular RBAC):** سیستم ۳ سطحی با قابلیت شخصی‌سازی دسترسی هر تب برای هر کاربر از طریق `modulePermissions`.

### ۲.۲. لایه سرور (Backend)
- **Express.js (`server.ts`):** سرور مرکزی هماهنگ‌کننده احراز هویت، اعتبارسنجی Zod، و پراکسی دیتابیس.
- **میدل‌ویرهای امنیتی:**
  - `cors`: کنترل منشأ و هدرهای مجاز.
  - `rateLimit`: محدودسازی نرخ تلاش‌های ورود برای جلوگیری از حملات Brute-force.
  - `trust proxy`: سازگاری با ریورس پراکسی‌های کلودفلر، رانفلر، و Nginx.
- **موتورهای اختصاصی:**
  - `serverAnomalyEngine.ts`: مانیتورینگ تغییرات مشکوک و جهش‌های غیرعادی با قابلیت رولبک.
  - `serverAuditChain.ts`: زنجیره هش امنیتی SHA-256 غیرقابل دستکاری.
  - `serverBackupEngine.ts`: پشتیبان‌گیری تراکنشی با تولید چک‌سام سلامت.

### ۲.۳. لایه پایگاه داده (Database)
- اتصال به MySQL 8 از طریق `mysql2/promise` با Connection Pooling.
- پشتیبانی کامل از دیتابیس‌های PostgreSQL / Supabase از طریق لایه انتزاعی `databaseAbstraction.ts`.

---

## ۳. جریان داده در احراز هویت (Authentication Flow)

```text
[ کاربر ] ---> [ فرم ورود ] ---> [ POST /api/auth/login ]
                                            |
                                            v
                                 [ بررسی Rate Limit ]
                                            |
                                            v
                                 [ بررسی پسورد (Bcrypt) ]
                                            |
                                            v
                              [ تولید Access Token (15 دقیقه) ]
                              [ تولید Refresh Token (7 روز) ]
                                            |
                                            v
                              [ ثبت لاگ امنیتی در audit_chain ]
                                            |
                                            v
[ پاسخ به کاربر با توکن + کوکی امن HttpOnly ] <---+
```
