-- ==============================================================================
-- اسکریپت ساخت و راه‌اندازی پایگاه داده: اختصاص کمد و امانت کلید طلاب
-- Database Schema & Initial Data for Student Lockers Assignment
-- Compatible with PostgreSQL, Supabase, and Cloud SQL
-- ==============================================================================

-- ۱. ساخت جدول کمدهای طلاب (student_lockers)
CREATE TABLE IF NOT EXISTS public.student_lockers (
  id TEXT PRIMARY KEY,
  locker_number INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'empty', -- 'empty' (خالی), 'occupied' (پر/واگذار شده), 'inactive' (غیرفعال/خرابی یا گم شدن کلید)
  student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT,
  student_grade TEXT,
  assigned_at TEXT, -- تاریخ شمسی تحویل کلید به طلبه (e.g. '1403/07/10')
  inactive_reason TEXT, -- علت غیرفعال بودن (مثلاً خرابی قفل، گم شدن کلید، شکستگی لولا، نیاز به تعمیرات)
  notes TEXT,
  history JSONB DEFAULT '[]'::jsonb, -- سوابق ۳ نفر قبلی و تاریخچه کامل امانت کلید
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲. ایجاد ایندکس‌ها جهت سرعت جستجو و فیلتر بر اساس شماره و وضعیت
CREATE INDEX IF NOT EXISTS idx_student_lockers_number ON public.student_lockers(locker_number);
CREATE INDEX IF NOT EXISTS idx_student_lockers_status ON public.student_lockers(status);
CREATE INDEX IF NOT EXISTS idx_student_lockers_student_id ON public.student_lockers(student_id);

-- ۳. فعال‌سازی امنیت در سطح ردیف (Row Level Security - RLS)
ALTER TABLE public.student_lockers ENABLE ROW LEVEL SECURITY;

-- سیاست مشاهده (SELECT): تمامی کاربران مجاز سیستم می‌توانند وضعیت کمدها را مشاهده کنند
DROP POLICY IF EXISTS "Allow read student_lockers" ON public.student_lockers;
CREATE POLICY "Allow read student_lockers" ON public.student_lockers
  FOR SELECT TO authenticated, anon USING (true);

-- سیاست تغییر و ویرایش (INSERT / UPDATE / DELETE): کادر آموزش و مدیران
DROP POLICY IF EXISTS "Allow manage student_lockers" ON public.student_lockers;
CREATE POLICY "Allow manage student_lockers" ON public.student_lockers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ۴. ساخت تریگر برای به‌روزرسانی خودکار فیلد updated_at
CREATE OR REPLACE FUNCTION update_student_lockers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_student_lockers_updated_at ON public.student_lockers;
CREATE TRIGGER trg_student_lockers_updated_at
BEFORE UPDATE ON public.student_lockers
FOR EACH ROW EXECUTE FUNCTION update_student_lockers_timestamp();

-- ۵. مقداردهی اولیه خودکار: تولید کمدهای شماره ۱ تا ۲۰۰ در وضعیت خالی (empty)
INSERT INTO public.student_lockers (id, locker_number, status, history, data, created_at, updated_at)
SELECT 
  'locker_' || i,
  i,
  'empty',
  '[]'::jsonb,
  '{}'::jsonb,
  NOW(),
  NOW()
FROM generate_series(1, 200) AS i
ON CONFLICT (locker_number) DO NOTHING;

-- پایان اسکریپت
