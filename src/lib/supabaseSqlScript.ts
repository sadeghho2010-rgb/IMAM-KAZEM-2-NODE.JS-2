export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- اسکریپت جامع ساخت جداول و تنظیمات دیتابیس Supabase
-- نرم‌افزار مدیریت آموزشی و مالی طلاب و اساتید
-- ==============================================================================

-- ۱. فعال‌سازی اکستنشن‌های ضروری
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ۲. ایجاد باکت ذخیره‌سازی پشتیبان‌ها در Supabase Storage (باکت backups)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backups',
  'backups',
  true,
  52428800, -- 50 MB
  ARRAY['application/json', 'application/zip', 'application/x-zip-compressed', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- دسترسی به باکت ذخیره‌سازی برای کلید عمومی و کاربران
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for backups bucket' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Public Access for backups bucket" ON storage.objects
      FOR ALL
      USING (bucket_id = 'backups')
      WITH CHECK (bucket_id = 'backups');
  END IF;
END $$;

-- ۳. جدول تاریخچه و فایل‌های پشتیبان ابری (cloud_backups)
CREATE TABLE IF NOT EXISTS public.cloud_backups (
  id TEXT PRIMARY KEY,
  mentor_id TEXT,
  mentor_name TEXT,
  mentor_role TEXT,
  file_name TEXT,
  folder_path TEXT,
  file_size_bytes BIGINT DEFAULT 0,
  file_size_formatted TEXT,
  total_records INT DEFAULT 0,
  student_count INT DEFAULT 0,
  persian_date TEXT,
  supabase_url TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۴. جدول طلاب و مشخصات دانش‌آموختگان (students)
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  national_id TEXT,
  name TEXT,
  grade TEXT,
  is_active BOOLEAN DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_students_national_id ON public.students (national_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students (grade);

-- ۵. جدول اساتید و مدرسین (teachers)
CREATE TABLE IF NOT EXISTS public.teachers (
  id TEXT PRIMARY KEY,
  name TEXT,
  national_id TEXT,
  phone TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۶. جدول حضور و غیاب طلاب (attendance)
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  date TEXT,
  grade TEXT,
  status TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance (student_id);

-- ۷. جدول آمار و ساعت‌های مطالعه طلاب (study_stats)
CREATE TABLE IF NOT EXISTS public.study_stats (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  date TEXT,
  study_minutes INT DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۸. جدول برنامه‌های آموزشی و کلاسی (programs)
CREATE TABLE IF NOT EXISTS public.programs (
  id TEXT PRIMARY KEY,
  title TEXT,
  grade TEXT,
  teacher_name TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۹. جدول آزمون‌های شفاهی طلاب (oral_exams)
CREATE TABLE IF NOT EXISTS public.oral_exams (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  subject TEXT,
  score NUMERIC,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۰. جدول ارزیابی کلاس‌های مشاوره (counseling_session_grades)
CREATE TABLE IF NOT EXISTS public.counseling_session_grades (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  session_date TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۱. جدول پیگیری‌ها و وظایف (todos)
CREATE TABLE IF NOT EXISTS public.todos (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  mentor_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۲. جدول جریان کار (workflow_items)
CREATE TABLE IF NOT EXISTS public.workflow_items (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  stage TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۳. جدول دوره‌های نهار و شام (lunch_periods) و رزروها (lunch_reservations)
CREATE TABLE IF NOT EXISTS public.lunch_periods (
  id TEXT PRIMARY KEY,
  title TEXT,
  start_date TEXT,
  end_date TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lunch_reservations (
  id TEXT PRIMARY KEY,
  period_id TEXT,
  student_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lunch_reservations_period ON public.lunch_reservations (period_id);

-- ۱۴. جدول شهریه و مطالبات طلاب (tuition_records)
CREATE TABLE IF NOT EXISTS public.tuition_records (
  id TEXT PRIMARY KEY,
  period_id TEXT,
  student_id TEXT,
  amount NUMERIC DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۵. جدول هزینه‌ها و مخارج مدرسه (finance_expenses)
CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id TEXT PRIMARY KEY,
  title TEXT,
  amount NUMERIC DEFAULT 0,
  category TEXT,
  expense_date TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۶. جدول گزارش فعالیت‌ها و رویدادهای سیستم (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  user_name TEXT,
  action TEXT,
  details TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۷. جدول جامع همگام‌سازی تمامی بخش‌های دیتابیس (app_collections)
CREATE TABLE IF NOT EXISTS public.app_collections (
  collection_name TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_name, id)
);
CREATE INDEX IF NOT EXISTS idx_app_collections_name ON public.app_collections (collection_name);

-- ۱۸. فعال‌سازی دسترسی و امنیت Row Level Security (RLS)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'cloud_backups',
    'students',
    'teachers',
    'attendance',
    'study_stats',
    'programs',
    'oral_exams',
    'counseling_session_grades',
    'todos',
    'workflow_items',
    'lunch_periods',
    'lunch_reservations',
    'tuition_records',
    'finance_expenses',
    'audit_logs',
    'app_collections'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Allow all for anon and auth', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      'Allow all for anon and auth',
      tbl
    );
  END LOOP;
END $$;
`;
