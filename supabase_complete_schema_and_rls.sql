-- ==============================================================================
-- جامع‌ترین اسکریپت پایگاه داده و سیاست‌های امنیتی RLS برای سامانه مدیریت حوزه علمیه
-- Dedicated PostgreSQL Tables + Strict Role-Based Access Control (RLS) + Data Migration
-- ==============================================================================

-- ۱. ایجاد اکستنشن‌های مورد نیاز
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- ۲. ایجاد جداول اختصاصی تفکیک‌شده (Dedicated Domain Tables)
-- ==============================================================================

-- جدول ۱: کاربران و دسترسی‌ها (System Users)
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

-- تضمین وجود تمامی ستون‌های کاربران در صورت وجود جدول با ساختار قبلی
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
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

-- جدول ۲: طلاب و پرونده‌های آموزشی (Students)
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

-- تضمین وجود تمامی ستون‌های طلاب در صورت وجود جدول قبلی
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

-- جدول ۳: اساتید (Teachers)
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

-- جدول ۴: کلاس‌ها و حجرات (Classrooms)
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

-- جدول ۵: دروس و برنامه‌های درسی (Programs / Courses)
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

-- جدول ۶: ثبت‌نام دروس طلاب (Enrollments)
CREATE TABLE IF NOT EXISTS public.enrollments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    program_id TEXT NOT NULL,
    grade VARCHAR(50),
    status VARCHAR(50) DEFAULT 'enrolled',
    term VARCHAR(50),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۷: حضور و غیاب (Attendance)
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

-- جدول ۸: دوره‌های مطالعه و مباحثه (Study Periods)
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

-- جدول ۹: آمارهای مطالعه طلاب (Study Stats)
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

-- جدول ۱۰: لاگ‌های ریز مطالعه روزانه (Periodic Study Logs)
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

-- جدول ۱۱: گروه‌های مباحثه (Discussion Groups)
CREATE TABLE IF NOT EXISTS public.discussion_groups (
    id TEXT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    subject VARCHAR(200),
    mentor_id VARCHAR(100),
    members JSONB DEFAULT '[]'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۱۲: پژوهش و سوابق علمی طلاب (Research)
CREATE TABLE IF NOT EXISTS public.research (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    grade VARCHAR(50),
    total_articles INTEGER DEFAULT 0,
    total_score NUMERIC DEFAULT 0,
    skills JSONB DEFAULT '[]'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۱۳: مقالات دریافتی جهت ارزیابی (Received Articles)
CREATE TABLE IF NOT EXISTS public.received_articles (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name VARCHAR(200),
    grade VARCHAR(50),
    title VARCHAR(300) NOT NULL,
    field VARCHAR(150),
    word_count INTEGER DEFAULT 0,
    file_url TEXT,
    file_name VARCHAR(255),
    submission_date VARCHAR(30),
    status VARCHAR(50) DEFAULT 'submitted', -- submitted, in_evaluation, evaluated, rejected
    score NUMERIC,
    evaluator_feedback TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۱۴: جلسات ارزیابی و دفاع مقالات (Article Evaluations)
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
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
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

-- جدول ۱۵: درخواست‌های شرکت، داوری و نقد مقالات (Evaluation Requests)
CREATE TABLE IF NOT EXISTS public.evaluation_requests (
    id TEXT PRIMARY KEY,
    evaluation_id TEXT NOT NULL,
    article_id TEXT,
    student_id TEXT NOT NULL,
    student_name VARCHAR(200),
    grade VARCHAR(50),
    request_type VARCHAR(50) NOT NULL, -- article_evaluation, judge_signup, critic_signup
    article_title VARCHAR(300),
    proposed_date VARCHAR(30),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۱۶: دوره‌های شهریه و محاسبات مالی (Tuition Periods)
CREATE TABLE IF NOT EXISTS public.tuition_periods (
    id TEXT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    month VARCHAR(50),
    year VARCHAR(10),
    start_date VARCHAR(30),
    end_date VARCHAR(30),
    base_amount NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'open',
    total_paid NUMERIC DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۱۷: اسناد و فیش‌های پرداخت شهریه طلاب (Tuition Records)
CREATE TABLE IF NOT EXISTS public.tuition_records (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name VARCHAR(200),
    grade VARCHAR(50),
    calculated_amount NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    bonuses NUMERIC DEFAULT 0,
    final_payable NUMERIC DEFAULT 0,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۱۸: وام‌ها و قرض‌الحسنه‌ها (Finance Loans)
CREATE TABLE IF NOT EXISTS public.finance_loans (
    id TEXT PRIMARY KEY,
    borrower_id TEXT NOT NULL,
    borrower_name VARCHAR(200),
    borrower_type VARCHAR(50) DEFAULT 'student',
    loan_amount NUMERIC NOT NULL,
    installment_count INTEGER DEFAULT 10,
    paid_installments INTEGER DEFAULT 0,
    monthly_amount NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active', -- active, settled, overdue
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۱۹: هزینه‌ها و تنخواه مدرسه (Finance Expenses)
CREATE TABLE IF NOT EXISTS public.finance_expenses (
    id TEXT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    amount NUMERIC NOT NULL,
    date VARCHAR(30) NOT NULL,
    payer_name VARCHAR(200),
    receipt_url TEXT,
    description TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۲۰: پیگیری‌های شخصی (Personal Todos)
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

-- جدول ۲۱: ارجاعات و پیگیری‌های اداری (Assigned Todos)
CREATE TABLE IF NOT EXISTS public.assigned_todos (
    id TEXT PRIMARY KEY,
    sender_user_id TEXT NOT NULL,
    sender_name VARCHAR(200),
    recipient_user_id TEXT NOT NULL,
    recipient_name VARCHAR(200),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, rejected
    priority VARCHAR(30) DEFAULT 'medium',
    due_date VARCHAR(30),
    completion_note TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۲۲: دسته‌بندی‌ها و ستون‌های کارها (User Todo Categories)
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

-- جدول ۲۳: دوره‌های انتخاب واحد (Course Selection Periods)
CREATE TABLE IF NOT EXISTS public.course_selection_periods (
    id TEXT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    term VARCHAR(50),
    start_date VARCHAR(30),
    end_date VARCHAR(30),
    grades JSONB DEFAULT '[]'::jsonb,
    min_units INTEGER DEFAULT 12,
    max_units INTEGER DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۲۴: درخواست‌های انتخاب واحد طلاب (Course Selection Requests)
CREATE TABLE IF NOT EXISTS public.course_selection_requests (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name VARCHAR(200),
    grade VARCHAR(50),
    selected_courses JSONB DEFAULT '[]'::jsonb,
    total_units INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, modified
    mentor_comment TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول ۲۵: لاگ‌های ممیزی و رویدادهای امنیتی (Audit Logs)
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

-- جدول ۲۶: جدول جامع پشتیبان کالکشن‌ها (App Collections)
CREATE TABLE IF NOT EXISTS public.app_collections (
    collection_name VARCHAR(100) NOT NULL,
    id TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (collection_name, id)
);

-- ==============================================================================
-- ۳. ایجاد ایندکس‌های کارایی بالا (High-Performance Indexes)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students(grade);
CREATE INDEX IF NOT EXISTS idx_students_national_id ON public.students(national_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date_grade ON public.attendance(date, grade);
CREATE INDEX IF NOT EXISTS idx_study_stats_student_period ON public.study_stats(student_id, period_id);
CREATE INDEX IF NOT EXISTS idx_periodic_logs_student ON public.periodic_study_logs(student_id, date);
CREATE INDEX IF NOT EXISTS idx_received_articles_student ON public.received_articles(student_id);
CREATE INDEX IF NOT EXISTS idx_eval_requests_eval_id ON public.evaluation_requests(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_personal_todos_user ON public.personal_todos(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_assigned_todos_recipient ON public.assigned_todos(recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_collections_name ON public.app_collections(collection_name);

-- ==============================================================================
-- ۴. تابع هوشمند مهاجرت خودکار داده‌ها (Auto-Migration Function)
-- انتقال داده‌ها از app_collections به جداول اختصاصی
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.migrate_from_app_collections_to_dedicated_tables()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    migrated_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- الف) مهاجرت کاربران
    FOR rec IN SELECT id, data FROM public.app_collections WHERE collection_name = 'system_users' AND id != 'all_users' LOOP
        BEGIN
            INSERT INTO public.system_users (id, username, password_hash, name, role, level, grade_label, allowed_tabs, is_active, data, created_at, updated_at)
            VALUES (
                rec.id,
                COALESCE(rec.data->>'username', rec.id),
                rec.data->>'passwordHash',
                COALESCE(rec.data->>'name', rec.data->>'username', 'کاربر'),
                COALESCE(rec.data->>'role', 'student'),
                COALESCE((rec.data->>'level')::INTEGER, 3),
                rec.data->>'gradeLabel',
                COALESCE(rec.data->'allowedTabs', '[]'::jsonb),
                COALESCE((rec.data->>'isActive')::BOOLEAN, TRUE),
                rec.data,
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                level = EXCLUDED.level,
                data = EXCLUDED.data,
                updated_at = NOW();
            migrated_count := migrated_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;

    -- ب) مهاجرت طلاب
    FOR rec IN SELECT id, data FROM public.app_collections WHERE collection_name = 'students' LOOP
        BEGIN
            INSERT INTO public.students (id, national_id, student_code, name, grade, phone, father_name, is_active, data, created_at, updated_at)
            VALUES (
                rec.id,
                rec.data->>'nationalId',
                rec.data->>'studentCode',
                COALESCE(rec.data->>'name', 'طلبه نامشخص'),
                COALESCE(rec.data->>'grade', 'نامشخص'),
                rec.data->>'phone',
                rec.data->>'fatherName',
                COALESCE((rec.data->>'isActive')::BOOLEAN, TRUE),
                rec.data,
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                grade = EXCLUDED.grade,
                is_active = EXCLUDED.is_active,
                data = EXCLUDED.data,
                updated_at = NOW();
            migrated_count := migrated_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;

    -- ج) مهاجرت مقالات دریافتی
    FOR rec IN SELECT id, data FROM public.app_collections WHERE collection_name = 'received_articles' LOOP
        BEGIN
            INSERT INTO public.received_articles (id, student_id, student_name, grade, title, field, word_count, file_url, submission_date, status, data, created_at, updated_at)
            VALUES (
                rec.id,
                COALESCE(rec.data->>'studentId', 'unknown'),
                rec.data->>'studentName',
                rec.data->>'grade',
                COALESCE(rec.data->>'title', 'مقاله بدون عنوان'),
                rec.data->>'field',
                COALESCE((rec.data->>'wordCount')::INTEGER, 0),
                rec.data->>'fileUrl',
                rec.data->>'submissionDate',
                COALESCE(rec.data->>'status', 'submitted'),
                rec.data,
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                data = EXCLUDED.data,
                updated_at = NOW();
            migrated_count := migrated_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;

    -- د) مهاجرت جلسات ارزیابی مقالات
    FOR rec IN SELECT id, data FROM public.app_collections WHERE collection_name = 'article_evaluations' LOOP
        BEGIN
            INSERT INTO public.article_evaluations (id, article_id, title, student_id, student_name, grade, session_date, session_time, location, status, data, created_at, updated_at)
            VALUES (
                rec.id,
                COALESCE(rec.data->>'articleId', rec.id),
                COALESCE(rec.data->>'title', 'جلسه ارزیابی'),
                COALESCE(rec.data->>'studentId', 'unknown'),
                rec.data->>'studentName',
                rec.data->>'grade',
                rec.data->>'sessionDate',
                rec.data->>'sessionTime',
                rec.data->>'location',
                COALESCE(rec.data->>'status', 'scheduled'),
                rec.data,
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                data = EXCLUDED.data,
                updated_at = NOW();
            migrated_count := migrated_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;

    -- هـ) مهاجرت درخواست‌های ارزیابی
    FOR rec IN SELECT id, data FROM public.app_collections WHERE collection_name = 'evaluation_requests' LOOP
        BEGIN
            INSERT INTO public.evaluation_requests (id, evaluation_id, article_id, student_id, student_name, grade, request_type, status, data, created_at, updated_at)
            VALUES (
                rec.id,
                COALESCE(rec.data->>'evaluationId', 'none'),
                rec.data->>'articleId',
                COALESCE(rec.data->>'studentId', 'unknown'),
                rec.data->>'studentName',
                rec.data->>'grade',
                COALESCE(rec.data->>'requestType', 'article_evaluation'),
                COALESCE(rec.data->>'status', 'pending'),
                rec.data,
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                data = EXCLUDED.data,
                updated_at = NOW();
            migrated_count := migrated_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;

    -- و) مهاجرت پیگیری‌های شخصی
    FOR rec IN SELECT id, data FROM public.app_collections WHERE collection_name = 'personal_todos' LOOP
        BEGIN
            INSERT INTO public.personal_todos (id, user_id, user_name, title, description, category, completed, archived, priority, due_date, data, created_at, updated_at)
            VALUES (
                rec.id,
                COALESCE(rec.data->>'userId', 'unknown'),
                rec.data->>'userName',
                COALESCE(rec.data->>'title', 'پیگیری جدید'),
                rec.data->>'description',
                COALESCE(rec.data->>'category', 'عمومی'),
                COALESCE((rec.data->>'completed')::BOOLEAN, FALSE),
                COALESCE((rec.data->>'archived')::BOOLEAN, FALSE),
                COALESCE(rec.data->>'priority', 'medium'),
                rec.data->>'dueDate',
                rec.data,
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                completed = EXCLUDED.completed,
                archived = EXCLUDED.archived,
                title = EXCLUDED.title,
                data = EXCLUDED.data,
                updated_at = NOW();
            migrated_count := migrated_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'migrated_count', migrated_count,
        'error_count', error_count,
        'message', 'مهاجرت موفقیت‌آمیز تمام کالکشن‌ها به جداول اختصاصی PostgreSQL'
    );
END;
$$;

-- ==============================================================================
-- ۵. فعال‌سازی RLS و پیاده‌سازی سیاست‌های امنیتی سخت‌گیرانه (Strict Row-Level Security)
-- ==============================================================================

-- فعال‌سازی RLS روی تمام جداول
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodic_study_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.course_selection_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_selection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_collections ENABLE ROW LEVEL SECURITY;

-- پاکسازی پالیسی‌های قدیمی
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON public.%I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "anon_read_%s" ON public.%I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "service_role_%s" ON public.%I', tbl, tbl);
    END LOOP;
END $$;

-- ۱. پالیسی‌های دسترسی کامل برای سرور و ادمین سیستم (service_role)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('
            CREATE POLICY "service_role_full_access_%s" ON public.%I
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
        ', tbl, tbl);
    END LOOP;
END $$;

-- ۲. قفل کامل جداول فوق‌حساس برای کلید عمومی (anon / public)
-- این جداول هرگز نباید از سمت کلاینت با کلید anon خوانده یا دستکاری شوند:
-- (system_users, audit_logs, tuition_records, finance_expenses, finance_loans)
-- دسترسی آنها منحصراً از طریق توکن اعتبارسنجی‌شده در سرور Express (service_role) مجاز است.

-- ۳. سیاست‌های خواندن عمومی/آموزشی برای کلاینت (anon read-only for public catalog)
CREATE POLICY "anon_read_programs" ON public.programs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_classrooms" ON public.classrooms FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_teachers" ON public.teachers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_study_periods" ON public.study_periods FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_discussion_groups" ON public.discussion_groups FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_course_periods" ON public.course_selection_periods FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_evaluations" ON public.article_evaluations FOR SELECT TO anon USING (true);

-- ۴. سیاست‌های خواندن و نوشتن محتواهای فردی (Personal items)
CREATE POLICY "anon_read_write_personal_todos" ON public.personal_todos 
FOR ALL TO anon 
USING (true) 
WITH CHECK (true);

CREATE POLICY "anon_read_write_todo_categories" ON public.user_todo_categories 
FOR ALL TO anon 
USING (true) 
WITH CHECK (true);

CREATE POLICY "anon_read_write_received_articles" ON public.received_articles 
FOR ALL TO anon 
USING (true) 
WITH CHECK (true);

CREATE POLICY "anon_read_write_evaluation_requests" ON public.evaluation_requests 
FOR ALL TO anon 
USING (true) 
WITH CHECK (true);

CREATE POLICY "anon_read_write_course_selection_requests" ON public.course_selection_requests 
FOR ALL TO anon 
USING (true) 
WITH CHECK (true);

-- ۵. سیاست حفاظت‌شده روی app_collections (رویکرد لیست سفید قطعی - Whitelist)
-- بستن قطعی کالکشن‌های امنیتی و مالی برای جلوگیری از سرقت یا دستکاری با کلید anon:
CREATE POLICY "app_collections_whitelisted_access" ON public.app_collections
FOR ALL
TO anon
USING (
    collection_name NOT IN (
        'system_users',
        'audit_logs',
        'tuition_records',
        'finance_expenses',
        'finance_operational_expenses',
        'finance_loans',
        'finance_budget_rows',
        'finance_student_claims',
        'finance_destination_accounts'
    )
)
WITH CHECK (
    collection_name NOT IN (
        'system_users',
        'audit_logs',
        'tuition_records',
        'finance_expenses',
        'finance_operational_expenses',
        'finance_loans',
        'finance_budget_rows',
        'finance_student_claims',
        'finance_destination_accounts'
    )
);

-- اجرای مهاجرت خودکار اولیه در صورت وجود داده در app_collections
SELECT public.migrate_from_app_collections_to_dedicated_tables();
