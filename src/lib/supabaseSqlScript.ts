export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- اسکریپت جامع ساخت جداول و تنظیمات دیتابیس Supabase / PostgreSQL
-- نرم‌افزار مدیریت آموزشی، پژوهشی و مالی طلاب و اساتید
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
  data JSONB DEFAULT '{}'::jsonb,
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
  program_id TEXT,
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

-- ۸. جدول برنامه‌های آموزشی و کلاس‌ها (programs)
CREATE TABLE IF NOT EXISTS public.programs (
  id TEXT PRIMARY KEY,
  title TEXT,
  grade TEXT,
  teacher_name TEXT,
  type TEXT,
  madras_room TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۹. جدول ثبت‌نام طلاب در دروس (enrollments)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  program_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_program ON public.enrollments (program_id);

-- ۱۰. جدول مدرس‌ها و فضاهای آموزشی (classrooms)
CREATE TABLE IF NOT EXISTS public.classrooms (
  id TEXT PRIMARY KEY,
  title TEXT,
  capacity INT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۱. جدول بازه‌های زمانی انتخاب واحد (course_selection_periods)
CREATE TABLE IF NOT EXISTS public.course_selection_periods (
  id TEXT PRIMARY KEY,
  title TEXT,
  grade TEXT,
  start_date TEXT,
  end_date TEXT,
  is_active BOOLEAN DEFAULT true,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۲. جدول درخواست‌های ثبت کلاس و انتخاب واحد طلاب (course_selection_requests)
CREATE TABLE IF NOT EXISTS public.course_selection_requests (
  id TEXT PRIMARY KEY,
  period_id TEXT,
  student_id TEXT,
  student_name TEXT,
  grade TEXT,
  status TEXT DEFAULT 'pending',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_requests_period ON public.course_selection_requests (period_id);
CREATE INDEX IF NOT EXISTS idx_course_requests_student ON public.course_selection_requests (student_id);
CREATE INDEX IF NOT EXISTS idx_course_requests_status ON public.course_selection_requests (status);

-- ۱۳. جدول برنامه‌های درسی اختصاصی/خارج از موسسه طلاب (custom_student_schedules)
CREATE TABLE IF NOT EXISTS public.custom_student_schedules (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  title TEXT,
  day TEXT,
  time TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۴. جدول برنامه‌های دستی زمان‌بندی اساتید (teacher_schedules)
CREATE TABLE IF NOT EXISTS public.teacher_schedules (
  id TEXT PRIMARY KEY,
  teacher_id TEXT,
  teacher_name TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۵. جدول آزمون‌های شفاهی طلاب (oral_exams)
CREATE TABLE IF NOT EXISTS public.oral_exams (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  subject TEXT,
  score NUMERIC,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۶. جدول ارزیابی کلاس‌های مشاوره (counseling_session_grades)
CREATE TABLE IF NOT EXISTS public.counseling_session_grades (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  session_date TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۷. جدول پیگیری‌ها و وظایف (todos)
CREATE TABLE IF NOT EXISTS public.todos (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  mentor_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۱۸. جدول جریان کار و درخواست‌های تایید (workflow_items)
CREATE TABLE IF NOT EXISTS public.workflow_items (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  stage TEXT,
  category TEXT,
  grade TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON public.workflow_items (status);
CREATE INDEX IF NOT EXISTS idx_workflow_category ON public.workflow_items (category);

-- ۱۹. جدول تنظیمات جریان کار (workflow_settings)
CREATE TABLE IF NOT EXISTS public.workflow_settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲۰. جدول کارکرد و ساعت‌های حضور کادر (presence_hours_logs & presence_reports)
CREATE TABLE IF NOT EXISTS public.presence_hours_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  log_date TEXT,
  hours NUMERIC DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.presence_reports (
  id TEXT PRIMARY KEY,
  report_month TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲۱. جدول دوره‌های نهار و شام (lunch_periods) و رزروها (lunch_reservations)
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

-- ۲۲. جدول شهریه و مطالبات طلاب (tuition_records)
CREATE TABLE IF NOT EXISTS public.tuition_records (
  id TEXT PRIMARY KEY,
  period_id TEXT,
  student_id TEXT,
  amount NUMERIC DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲۳. جدول هزینه‌ها و مخارج مدرسه (finance_expenses)
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

-- ۲۴. جدول گروه مباحثات (discussion_groups)
CREATE TABLE IF NOT EXISTS public.discussion_groups (
  id TEXT PRIMARY KEY,
  title TEXT,
  program_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲۵. جدول گزارش فعالیت‌ها و رویدادهای سیستم (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  user_name TEXT,
  action TEXT,
  details TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲۶. جدول تقویم آموزشی و تعطیلات (academic_calendar_periods, academic_holidays, academic_holiday_types, academic_sub_periods, academic_weekly_programs)
CREATE TABLE IF NOT EXISTS public.academic_calendar_periods (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_holidays (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_holiday_types (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_sub_periods (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_weekly_programs (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲۷. جدول سوابق و مهارت‌های پژوهشی طلاب (research_records, research_skills_def, student_research_skills)
CREATE TABLE IF NOT EXISTS public.research_records (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.research_skills_def (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_research_skills (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲۸. جدول گزارش مطالعه دوره‌ای طلاب (periodic_study_logs & study_periods)
CREATE TABLE IF NOT EXISTS public.periodic_study_logs (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  period_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_periods (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲۹. جدول ملاحظات و پیام‌های طلاب (student_comments)
CREATE TABLE IF NOT EXISTS public.student_comments (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۳۰. جدول جامع همگام‌سازی تمامی بخش‌های دیتابیس (app_collections)
CREATE TABLE IF NOT EXISTS public.app_collections (
  collection_name TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_name, id)
);
CREATE INDEX IF NOT EXISTS idx_app_collections_name ON public.app_collections (collection_name);

-- ۳۱. جدول کاربران اختصاصی سیستم (system_users)
CREATE TABLE IF NOT EXISTS public.system_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT,
  level INT DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  allowed_tabs JSONB DEFAULT '[]'::jsonb,
  mentor_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_users_username ON public.system_users (username);

-- ۳۲. فعال‌سازی دسترسی و امنیت Row Level Security (RLS)
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
    'enrollments',
    'classrooms',
    'course_selection_periods',
    'course_selection_requests',
    'custom_student_schedules',
    'teacher_schedules',
    'oral_exams',
    'counseling_session_grades',
    'todos',
    'workflow_items',
    'workflow_settings',
    'presence_hours_logs',
    'presence_reports',
    'lunch_periods',
    'lunch_reservations',
    'tuition_records',
    'finance_expenses',
    'discussion_groups',
    'audit_logs',
    'academic_calendar_periods',
    'academic_holidays',
    'academic_holiday_types',
    'academic_sub_periods',
    'academic_weekly_programs',
    'research_records',
    'research_skills_def',
    'student_research_skills',
    'periodic_study_logs',
    'study_periods',
    'student_comments',
    'app_collections',
    'system_users'
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
