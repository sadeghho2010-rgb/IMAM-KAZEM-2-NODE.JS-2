export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- اسکریپت جامع ساخت جداول اختصاصی، تفکیک داده‌ها و امنیت Row-Level Security (RLS)
-- Dedicated PostgreSQL Architecture + Auto-Migration + Hardened RLS
-- ==============================================================================

-- ۱. فعال‌سازی اکستنشن‌های ضروری
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ۲. ایجاد باکت ذخیره‌سازی فایل‌های پشتیبان (Backups Bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backups',
  'backups',
  true,
  52428800,
  ARRAY['application/json', 'application/zip', 'application/x-zip-compressed', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- ۳. جدول کاربران و سطوح دسترسی (System Users)
CREATE TABLE IF NOT EXISTS public.system_users (
  id TEXT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT,
  name VARCHAR(200) NOT NULL,
  role VARCHAR(50) NOT NULL,
  role_title VARCHAR(100),
  level INTEGER NOT NULL DEFAULT 3,
  grade_label VARCHAR(100),
  mentor_id VARCHAR(100),
  student_id VARCHAR(100),
  linked_student_id VARCHAR(100),
  avatar_bg VARCHAR(50),
  allowed_tabs JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  must_change_password BOOLEAN DEFAULT FALSE,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- تضمین وجود تمامی ستون‌ها در صورت وجود جدول قبلی
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.system_users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS role_title VARCHAR(100);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 3;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS grade_label VARCHAR(100);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS mentor_id VARCHAR(100);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS student_id VARCHAR(100);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS linked_student_id VARCHAR(100);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS avatar_bg VARCHAR(50);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS allowed_tabs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ۴. جدول طلاب (Students)
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  national_id VARCHAR(20),
  student_code VARCHAR(50),
  name VARCHAR(200) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  phone VARCHAR(30),
  father_name VARCHAR(100),
  birth_date VARCHAR(30),
  is_active BOOLEAN DEFAULT TRUE,
  city VARCHAR(100),
  address TEXT,
  avatar_url TEXT,
  mentor_id VARCHAR(100),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS national_id VARCHAR(20);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_code VARCHAR(50);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS grade VARCHAR(50);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS father_name VARCHAR(100);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_date VARCHAR(30);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mentor_id VARCHAR(100);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_students_national_id ON public.students (national_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students (grade);

-- ۵. جدول اساتید (Teachers)
CREATE TABLE IF NOT EXISTS public.teachers (
  id TEXT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  national_id VARCHAR(20),
  specialty VARCHAR(150),
  is_active BOOLEAN DEFAULT TRUE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۶. جدول کلاس‌ها و حجرات (Classrooms)
CREATE TABLE IF NOT EXISTS public.classrooms (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  grade VARCHAR(50),
  capacity INTEGER DEFAULT 20,
  location VARCHAR(200),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۷. جدول دروس و برنامه‌ها (Programs)
CREATE TABLE IF NOT EXISTS public.programs (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  teacher_id TEXT,
  teacher_name VARCHAR(200),
  units INTEGER DEFAULT 2,
  term VARCHAR(50),
  schedule JSONB DEFAULT '[]'::jsonb,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۸. جدول حضور و غیاب (Attendance)
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  date VARCHAR(30) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  program_id TEXT,
  session_number INTEGER,
  present_count INTEGER DEFAULT 0,
  absent_count INTEGER DEFAULT 0,
  excused_count INTEGER DEFAULT 0,
  recorded_by VARCHAR(100),
  records JSONB DEFAULT '[]'::jsonb,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);
CREATE INDEX IF NOT EXISTS idx_attendance_grade ON public.attendance (grade);

-- ۹. جدول دوره‌ها و آمارهای مطالعه (Study Periods & Stats)
CREATE TABLE IF NOT EXISTS public.study_periods (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  start_date VARCHAR(30) NOT NULL,
  end_date VARCHAR(30) NOT NULL,
  grade VARCHAR(50) DEFAULT 'همه پایه‌ها',
  is_open BOOLEAN DEFAULT TRUE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_stats (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  period_id TEXT,
  grade VARCHAR(50),
  total_study_hours NUMERIC DEFAULT 0,
  total_discussion_hours NUMERIC DEFAULT 0,
  total_hours NUMERIC DEFAULT 0,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.periodic_study_logs (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  period_id TEXT,
  date VARCHAR(30) NOT NULL,
  study_duration_minutes INTEGER DEFAULT 0,
  discussion_duration_minutes INTEGER DEFAULT 0,
  subject VARCHAR(200),
  partner_name VARCHAR(200),
  notes TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۰. جدول مقالات و جلسات ارزیابی پژوهش (Research & Article Evaluations)
CREATE TABLE IF NOT EXISTS public.received_articles (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name VARCHAR(200),
  grade VARCHAR(50),
  title VARCHAR(300) NOT NULL,
  field VARCHAR(150),
  word_count INTEGER DEFAULT 0,
  file_url TEXT,
  submission_date VARCHAR(30),
  status VARCHAR(50) DEFAULT 'submitted',
  score NUMERIC,
  evaluator_feedback TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.article_evaluations (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  title VARCHAR(300) NOT NULL,
  student_id TEXT NOT NULL,
  student_name VARCHAR(200),
  grade VARCHAR(50),
  session_date VARCHAR(30),
  session_time VARCHAR(30),
  location VARCHAR(200),
  status VARCHAR(50) DEFAULT 'scheduled',
  lead_judge_name VARCHAR(200),
  critics JSONB DEFAULT '[]'::jsonb,
  requests_count INTEGER DEFAULT 0,
  approved_signups JSONB DEFAULT '[]'::jsonb,
  final_score NUMERIC,
  final_result TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evaluation_requests (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  article_id TEXT,
  student_id TEXT NOT NULL,
  student_name VARCHAR(200),
  grade VARCHAR(50),
  request_type VARCHAR(50) NOT NULL,
  article_title VARCHAR(300),
  status VARCHAR(50) DEFAULT 'pending',
  admin_note TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۱. جدول امور مالی، شهریه و وام‌ها (Finance & Tuition)
CREATE TABLE IF NOT EXISTS public.tuition_periods (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  month VARCHAR(50),
  year VARCHAR(10),
  base_amount NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'open',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tuition_records (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name VARCHAR(200),
  grade VARCHAR(50),
  final_payable NUMERIC DEFAULT 0,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_loans (
  id TEXT PRIMARY KEY,
  borrower_id TEXT NOT NULL,
  borrower_name VARCHAR(200),
  loan_amount NUMERIC NOT NULL,
  installment_count INTEGER DEFAULT 10,
  paid_installments INTEGER DEFAULT 0,
  monthly_amount NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id TEXT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  amount NUMERIC NOT NULL,
  date VARCHAR(30) NOT NULL,
  payer_name VARCHAR(200),
  description TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۲. جدول پیگیری‌های شخصی و ارجاعات (Todos & Tasks)
CREATE TABLE IF NOT EXISTS public.personal_todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name VARCHAR(200),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'عمومی',
  completed BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  priority VARCHAR(30) DEFAULT 'medium',
  due_date VARCHAR(30),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assigned_todos (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL,
  sender_name VARCHAR(200),
  recipient_user_id TEXT NOT NULL,
  recipient_name VARCHAR(200),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(30) DEFAULT 'medium',
  due_date VARCHAR(30),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_todo_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۳. جدول دوره‌ها و آزمون‌های شفاهی طلاب (Oral Exam Periods & Records)
CREATE TABLE IF NOT EXISTS public.oral_exam_periods (
  id TEXT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  grade VARCHAR(50),
  has_usul BOOLEAN DEFAULT TRUE,
  usul_books JSONB DEFAULT '[]'::jsonb,
  custom_usul_book VARCHAR(150),
  has_fiqh BOOLEAN DEFAULT TRUE,
  fiqh_books JSONB DEFAULT '[]'::jsonb,
  custom_fiqh_book VARCHAR(150),
  exam_dates JSONB DEFAULT '[]'::jsonb,
  exam_dates_str TEXT,
  examiner_teacher_ids JSONB DEFAULT '[]'::jsonb,
  examiner_teacher_names JSONB DEFAULT '[]'::jsonb,
  has_custom_scopes BOOLEAN DEFAULT FALSE,
  scopes JSONB DEFAULT '[]'::jsonb,
  participating_student_ids JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  created_by_name VARCHAR(100),
  finalized_at TIMESTAMPTZ,
  finalized_by_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.oral_exam_records (
  id TEXT PRIMARY KEY, -- period_id_student_id
  period_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name VARCHAR(200),
  national_id VARCHAR(20),
  grade VARCHAR(50),
  fiqh_examiner_teacher_id TEXT,
  fiqh_examiner_teacher_name VARCHAR(200),
  fiqh_scope_id TEXT,
  fiqh_scope_title TEXT,
  fiqh_score NUMERIC(5, 2),
  fiqh_is_retake BOOLEAN DEFAULT FALSE,
  fiqh_examiner_notes TEXT,
  usul_examiner_teacher_id TEXT,
  usul_examiner_teacher_name VARCHAR(200),
  usul_scope_id TEXT,
  usul_scope_title TEXT,
  usul_score NUMERIC(5, 2),
  usul_is_retake BOOLEAN DEFAULT FALSE,
  usul_examiner_notes TEXT,
  examiner1_notes TEXT,
  examiner2_notes TEXT,
  general_notes TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oral_exam_records_period ON public.oral_exam_records (period_id);
CREATE INDEX IF NOT EXISTS idx_oral_exam_records_student ON public.oral_exam_records (student_id);

-- ۱۴. جدول لاگ‌های ممیزی امنیتی (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username VARCHAR(100),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id TEXT,
  description TEXT,
  ip_address VARCHAR(50),
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۵. جدول کالکشن‌ها (App Collections)
CREATE TABLE IF NOT EXISTS public.app_collections (
  collection_name VARCHAR(100) NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_name, id)
);

-- ۱۶. فعال‌سازی سیاست‌های امنیتی RLS
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodic_study_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_todo_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oral_exam_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oral_exam_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_collections ENABLE ROW LEVEL SECURITY;

-- پاکسازی و تعریف مجدد پالیسی‌های امنیتی
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access_%s" ON public.%I', tbl, tbl);
    EXECUTE format('
      CREATE POLICY "service_role_full_access_%s" ON public.%I
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
    ', tbl, tbl);
  END LOOP;
END $$;

-- سیاست‌های دسترسی به جداول آزمون شفاهی
CREATE POLICY "anon_oral_exam_periods" ON public.oral_exam_periods FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_oral_exam_records" ON public.oral_exam_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- سیاست‌های خواندن عمومی جداول اطلاعاتی برای کلاینت
CREATE POLICY "anon_read_programs" ON public.programs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_classrooms" ON public.classrooms FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_teachers" ON public.teachers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_study_periods" ON public.study_periods FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_evaluations" ON public.article_evaluations FOR SELECT TO anon USING (true);

-- سیاست‌های دسترسی شخصی کاربران
CREATE POLICY "anon_personal_todos" ON public.personal_todos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_todo_categories" ON public.user_todo_categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_received_articles" ON public.received_articles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_evaluation_requests" ON public.evaluation_requests FOR ALL TO anon USING (true) WITH CHECK (true);

-- سیاست‌های دسترسی به جداول شهریه و مالی
CREATE POLICY "anon_tuition_periods" ON public.tuition_periods FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_tuition_records" ON public.tuition_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_finance_loans" ON public.finance_loans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_finance_expenses" ON public.finance_expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- دسترسی کامل به کالکشن‌های نرم‌افزار در app_collections برای تمام ماژول‌ها
DROP POLICY IF EXISTS "app_collections_whitelisted_access" ON public.app_collections;
DROP POLICY IF EXISTS "app_collections_full_access" ON public.app_collections;
CREATE POLICY "app_collections_full_access" ON public.app_collections
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);
`;
