# 🗄️ مستندات پایگاه داده سامانه (Database Dictionary & Schema)

این مستند تشریح‌کننده تمامی ۲۴ جدول اصلی و ساختار ذخیره‌سازی پروژه در دیتابیس MySQL 8 / PostgreSQL می‌باشد.

---

## ۱. فهرست جداول سامانه

| # | نام جدول | شرح عملکرد | کلیدهای اصلی و شاخص‌ها |
|---|---|---|---|
| ۱ | `system_users` | کاربران سیستم، سطوح دسترسی، هش رمز و پین امنیتی | `id` (PK), `username` (UK), `role`, `level` |
| ۲ | `students` | پرونده کامل اطلاعات فردی و تحصیلی طلاب | `id` (PK), `student_code` (UK), `national_id` |
| ۳ | `teachers` | اساتید، مدرسین، سوابق و تخصص‌ها | `id` (PK), `is_active` |
| ۴ | `classrooms` | مدرس‌ها، کلاس‌های درس و ظرفیت‌ها | `id` (PK) |
| ۵ | `programs` | دروس آموزشی، ساعات تشکیل و اساتید مربوطه | `id` (PK), `grade`, `teacher_id` |
| ۶ | `enrollments` | ثبت‌نام و انتساب طلاب به دوره‌ها و کلاس‌ها | `id` (PK), `(student_id, program_id)` (UK) |
| ۷ | `attendance` | ثبت حضور، غیاب، تاخیر و مرخصی روزانه طلاب | `id` (PK), `(student_id, date)` |
| ۸ | `oral_exams` | نمرات و ارزیابی آزمون‌های شفاهی فقه و اصول | `id` (PK), `student_id` |
| ۹ | `research_records`| مقالات و پژوهش‌های تحویلی طلاب و امتیازات | `id` (PK), `student_id` |
| ۱۰ | `presence_hours` | ساعات کارکرد و حضور کادر اداری و اساتید | `id` (PK), `(user_id, date)` |
| ۱۱ | `tuition_records` | محاسبات شهریه ماهانه و کسورات/پاداش‌ها | `id` (PK), `(period_id, student_id)` |
| ۱۲ | `finance_loans` | وام‌های قرض‌الحسنه طلاب و وضعیت اقساط | `id` (PK), `student_id` |
| ۱۳ | `finance_expenses`| اسناد هزینه‌ها، فاکتورها، ردیف‌های بودجه | `id` (PK), `date`, `category` |
| ۱۴ | `student_lockers` | وضعیت ۲۰۰ کمد، اشغال، خرابی و کلید یدک | `id` (PK), `locker_number` (UK) |
| ۱۵ | `locker_history_logs` | تاریخچه واگذاری، تخلیه و تعمیرات کمدها | `id` (PK), `locker_number` |
| ۱۶ | `student_requests`| سامانه گردش تقاضاهای اداری و رفاهی مراجعین | `id` (PK), `unit`, `student_id`, `status` |
| ۱۷ | `global_requests_config` | تنظیمات کلی نمایش و وضعیت ۳ واحد پاسخگو | `id` (PK) |
| ۱۸ | `unit_request_settings` | دسته‌بندی‌ها و پیام‌های هر واحد | `id` (PK), `unit` (UK) |
| ۱۹ | `anomaly_logs` | لاگ کشف ناهنجاری‌ها و وضعیت پیشین (رولبک) | `id` (PK), `severity`, `is_resolved` |
| ۲۰ | `audit_chain_logs`| زنجیره لاگ‌های حسابرسی با هش SHA-256 | `id` (PK), `sequence_number` (UK) |
| ۲۱ | `system_backups` | متادیتای نسخه‌های پشتیبان و چک‌سام سلامت | `id` (PK), `backup_type` |
| ۲۲ | `bug_reports` | سیستم ثبت گزارش باگ و ردیابی وضعیت | `id` (PK), `status` |
| ۲۳ | `user_feedback` | نظرات، پیشنهادات و امتیازدهی کاربران | `id` (PK) |
| ۲۴ | `error_logs` | لاگ خطاهای بحرانی سرور و استک تریس | `id` (PK), `created_at` |

---

## ۲. دیاگرام روابط کلیدی (Entity Relationships)

- **`system_users` (1) ─── (N) `presence_hours`**
- **`students` (1) ─── (N) `enrollments` ─── (1) `programs`**
- **`students` (1) ─── (N) `attendance`**
- **`students` (1) ─── (N) `oral_exams`**
- **`students` (1) ─── (N) `research_records`**
- **`students` (1) ─── (N) `tuition_records`**
- **`students` (1) ─── (N) `student_requests`**
- **`students` (1) ─── (0..1) `student_lockers`**
- **`student_lockers` (1) ─── (N) `locker_history_logs`**

---

## ۳. امنیت داده‌ها (Data Integrity)
- تمامی جداول از اینکودینگ `utf8mb4` با Collation برابر با `utf8mb4_unicode_ci` استفاده می‌کنند تا انواع حروف و اعراب بدون تخریب ذخیره گردند.
- فیلدهای حساسی چون `original_state`، `module_permissions` و `officers_status` از نوع داده بومی `JSON` برای انعطاف‌پذیری و کوئری‌زنی سریع بهره می‌برند.
