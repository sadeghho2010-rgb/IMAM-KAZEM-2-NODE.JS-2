-- ==============================================================================
-- اسکریپت جامع و کامل سخت‌سازی امنیت، تفکیک دسترسی و RLS در Supabase
-- نسخه نهایی (پوشش کامل ۱۶ جدول اصلی + جدول اختصاصی کاربران system_users)
-- ==============================================================================

-- ==============================================================================
-- گام ۰: اطمینان از وجود جدول اختصاصی کاربران سیستم (system_users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  level INT NOT NULL DEFAULT 3,
  role_title TEXT,
  allowed_tabs JSONB DEFAULT '[]'::jsonb,
  must_change_password BOOLEAN DEFAULT false,
  failed_login_attempts INT DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- مرحله ۱: فعال‌سازی اجباری Row Level Security (RLS) روی تمام ۱۷ جدول
-- ==============================================================================
ALTER TABLE IF EXISTS public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tuition_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cloud_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oral_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.counseling_session_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workflow_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lunch_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lunch_reservations ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- مرحله ۲: پاک‌سازی و حذف تمامی پالیسی‌های باز و ناامن قبلی (DROP ALL POLICIES)
-- برای تمام ۱۷ جدول سیستم
-- ==============================================================================
-- ۱. system_users
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.system_users;
DROP POLICY IF EXISTS "Public read system_users" ON public.system_users;
DROP POLICY IF EXISTS "Service Role full access system_users" ON public.system_users;

-- ۲. audit_logs
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit Logs service role only" ON public.audit_logs;
DROP POLICY IF EXISTS "Service Role full access audit_logs" ON public.audit_logs;

-- ۳. tuition_records
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.tuition_records;
DROP POLICY IF EXISTS "Financial records service role only" ON public.tuition_records;
DROP POLICY IF EXISTS "Service Role full access tuition_records" ON public.tuition_records;

-- ۴. finance_expenses
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.finance_expenses;
DROP POLICY IF EXISTS "Finance expenses service role only" ON public.finance_expenses;
DROP POLICY IF EXISTS "Service Role full access finance_expenses" ON public.finance_expenses;

-- ۵. cloud_backups
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.cloud_backups;
DROP POLICY IF EXISTS "Service Role full access cloud_backups" ON public.cloud_backups;

-- ۶. app_collections
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.app_collections;
DROP POLICY IF EXISTS "Public Read for non-sensitive collections" ON public.app_collections;
DROP POLICY IF EXISTS "Client read non_sensitive collections" ON public.app_collections;
DROP POLICY IF EXISTS "Service Role full access app_collections" ON public.app_collections;

-- ۷. programs
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.programs;
DROP POLICY IF EXISTS "Client read programs" ON public.programs;
DROP POLICY IF EXISTS "Public read programs" ON public.programs;
DROP POLICY IF EXISTS "Service Role full access programs" ON public.programs;

-- ۸. students
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.students;
DROP POLICY IF EXISTS "Client read students" ON public.students;
DROP POLICY IF EXISTS "Service Role full access students" ON public.students;

-- ۹. teachers
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.teachers;
DROP POLICY IF EXISTS "Client read teachers" ON public.teachers;
DROP POLICY IF EXISTS "Service Role full access teachers" ON public.teachers;

-- ۱۰. attendance
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.attendance;
DROP POLICY IF EXISTS "Client read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Service Role full access attendance" ON public.attendance;

-- ۱۱. study_stats
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.study_stats;
DROP POLICY IF EXISTS "Client read study_stats" ON public.study_stats;
DROP POLICY IF EXISTS "Service Role full access study_stats" ON public.study_stats;

-- ۱۲. oral_exams
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.oral_exams;
DROP POLICY IF EXISTS "Client read oral_exams" ON public.oral_exams;
DROP POLICY IF EXISTS "Service Role full access oral_exams" ON public.oral_exams;

-- ۱۳. counseling_session_grades
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.counseling_session_grades;
DROP POLICY IF EXISTS "Client read counseling" ON public.counseling_session_grades;
DROP POLICY IF EXISTS "Service Role full access counseling" ON public.counseling_session_grades;

-- ۱۴. todos
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.todos;
DROP POLICY IF EXISTS "Client read todos" ON public.todos;
DROP POLICY IF EXISTS "Service Role full access todos" ON public.todos;

-- ۱۵. workflow_items
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.workflow_items;
DROP POLICY IF EXISTS "Client read workflow" ON public.workflow_items;
DROP POLICY IF EXISTS "Service Role full access workflow" ON public.workflow_items;

-- ۱۶. lunch_periods
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.lunch_periods;
DROP POLICY IF EXISTS "Client read lunch_periods" ON public.lunch_periods;
DROP POLICY IF EXISTS "Service Role full access lunch_periods" ON public.lunch_periods;

-- ۱۷. lunch_reservations
DROP POLICY IF EXISTS "Allow all for anon and auth" ON public.lunch_reservations;
DROP POLICY IF EXISTS "Client read lunch_reservations" ON public.lunch_reservations;
DROP POLICY IF EXISTS "Service Role full access lunch_reservations" ON public.lunch_reservations;

-- ==============================================================================
-- مرحله ۳: ابطال دسترسی‌های سطح دیتابیس (REVOKE) برای نقش عمومی anon
-- بر روی تمام جداول فوق‌حساس و مالی، دسترسی anon کاملاً سلب می‌شود (دسترسی صفر)
-- ==============================================================================
REVOKE ALL ON TABLE public.system_users FROM anon, public;
REVOKE ALL ON TABLE public.audit_logs FROM anon, public;
REVOKE ALL ON TABLE public.tuition_records FROM anon, public;
REVOKE ALL ON TABLE public.finance_expenses FROM anon, public;
REVOKE ALL ON TABLE public.cloud_backups FROM anon, public;

-- سلب دسترسی ویرایش/حذف برنامه‌های آموزشی عمومی از anon
REVOKE INSERT, UPDATE, DELETE ON TABLE public.programs FROM anon, public;

-- ==============================================================================
-- مرحله ۴: تعریف پالیسی‌های جدید سخت‌سازی شده (CREATE POLICIES)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- بخش الف: اعطای دسترسی نامحدود به Service Role برای تمام ۱۷ جدول
-- (چون بک‌اند Express سرور با SUPABASE_SECRET_KEY تمام این جدول‌ها را مدیریت می‌کند)
-- ------------------------------------------------------------------------------
CREATE POLICY "SR_all_system_users" ON public.system_users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_audit_logs" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_tuition_records" ON public.tuition_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_finance_expenses" ON public.finance_expenses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_cloud_backups" ON public.cloud_backups FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_app_collections" ON public.app_collections FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_programs" ON public.programs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_students" ON public.students FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_teachers" ON public.teachers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_attendance" ON public.attendance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_study_stats" ON public.study_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_oral_exams" ON public.oral_exams FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_counseling" ON public.counseling_session_grades FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_todos" ON public.todos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_workflow" ON public.workflow_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_lunch_periods" ON public.lunch_periods FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR_all_lunch_reservations" ON public.lunch_reservations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- بخش ب: جدول عمومی برنامه‌های آموزشی (programs)
-- فقط مشاهده (SELECT) برای عموم/anon آزاد است؛ هیچ کاربری با anon حق تغییر ندارد
-- ------------------------------------------------------------------------------
CREATE POLICY "Anon_select_programs" ON public.programs
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ------------------------------------------------------------------------------
-- بخش ج: جدول کلکسیون‌های عمومی (app_collections)
-- مسدودسازی مطلق کلکسیون‌های system_users و audit_logs در برابر کلاینت anon
-- ------------------------------------------------------------------------------
CREATE POLICY "Anon_select_non_sensitive_collections" ON public.app_collections
  FOR SELECT
  TO anon, authenticated
  USING (collection_name NOT IN ('system_users', 'audit_logs', 'tuition_records', 'finance_expenses'));

CREATE POLICY "Anon_modify_non_sensitive_collections" ON public.app_collections
  FOR ALL
  TO anon, authenticated
  USING (collection_name NOT IN ('system_users', 'audit_logs', 'tuition_records', 'finance_expenses'))
  WITH CHECK (collection_name NOT IN ('system_users', 'audit_logs', 'tuition_records', 'finance_expenses'));

-- ------------------------------------------------------------------------------
-- بخش د: جداول عملیاتی آموزشی و انضباطی کلاینت (همگام‌سازی آفلاین به آنلاین)
-- (دانش‌آموزان، اساتید، حضور غیاب، کارها، نهار و نظرسنجی‌ها)
-- ------------------------------------------------------------------------------
CREATE POLICY "Client_sync_students" ON public.students FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_teachers" ON public.teachers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_attendance" ON public.attendance FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_study_stats" ON public.study_stats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_oral_exams" ON public.oral_exams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_counseling" ON public.counseling_session_grades FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_todos" ON public.todos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_workflow" ON public.workflow_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_lunch_periods" ON public.lunch_periods FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Client_sync_lunch_reservations" ON public.lunch_reservations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- کامنت‌های توضیحی برای مستندسازی در کاتالوگ دیتابیس
COMMENT ON TABLE public.system_users IS 'فوق‌حساس: مسدود برای anon. منحصراً در دسترس service_role و بک‌اند سرور Express.';
COMMENT ON TABLE public.audit_logs IS 'حساس: لاگ‌های امنیتی. غیرقابل دسترسی توسط anon.';
COMMENT ON TABLE public.tuition_records IS 'حساس: سوابق شهریه و مالی. غیرقابل دسترسی توسط anon.';
COMMENT ON TABLE public.finance_expenses IS 'حساس: هزینه‌های مدرسه. غیرقابل دسترسی توسط anon.';
