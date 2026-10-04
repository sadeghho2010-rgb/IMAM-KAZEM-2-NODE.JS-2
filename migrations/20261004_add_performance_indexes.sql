-- ==============================================================================
-- اسکریپت مایگریشن افزایشی ایندکس‌های بهینه‌سازی MySQL / MariaDB
-- تاریخ: ۱۴۰۵/۰۷/۱۲ (2026-10-04)
-- توضیحات: ایجاد ایندکس‌های جدید بر اساس تحلیل کوئری‌های پرکاربرد سامانه
-- ==============================================================================

SET NAMES utf8mb4;

-- ۱. ایندکس ترکیبی مطالعه طلاب روی جدول study_logs
-- کمک به کوئری‌های محاسبه ساعات مطالعه هر طلبه در بازه زمانی مشخص:
-- WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC
CREATE INDEX `idx_study_student_date` ON `study_logs` (`student_id`, `date`);

-- ۲. ایندکس ترکیبی حضور و غیاب روی جدول attendance
-- کمک به کوئری‌های دریافت لیست و وضعیت حضور و غیاب یک کلاس مشخص در یک تاریخ یا بازه:
-- WHERE program_id = ? AND date = ?
CREATE INDEX `idx_attendance_program_date` ON `attendance` (`program_id`, `date`);

-- ۳. ایندکس ترکیبی ثبت‌نام روی جدول enrollments
-- کمک به کوئری‌های بررسی استعلام ثبت‌نام طلبه در یک درس یا JOIN بین طلاب و برنامه‌ها:
-- WHERE student_id = ? AND program_id = ?
CREATE INDEX `idx_enrollment_student_program` ON `enrollments` (`student_id`, `program_id`);

-- ۴. ایندکس کارنامه آزمون شفاهی روی جدول oral_exam_records
-- کمک به کوئری‌های بررسی وضعیت و سابقه آزمون‌های شفاهی یک طلبه:
-- WHERE student_id = ? AND overall_status = ?
CREATE INDEX `idx_oral_exam_student_status` ON `oral_exam_records` (`student_id`, `overall_status`);

-- ۵. ایندکس رزرو غذای طلبه روی جدول meal_reservations
-- کمک به کوئری‌های استخراج سابقه رزرو غذای یک طلبه در دوره‌های مختلف:
-- WHERE student_id = ?
CREATE INDEX `idx_meal_res_student_only` ON `meal_reservations` (`student_id`);

-- ۶. ایندکس درخواست‌های انتخاب واحد روی جدول course_selection_requests
-- کمک به کوئری‌های نمایش درخواست‌های انتخاب واحد یک طلبه بر اساس تاریخ ارسال:
-- WHERE student_id = ? ORDER BY submitted_at DESC
CREATE INDEX `idx_cs_student_submitted` ON `course_selection_requests` (`student_id`, `submitted_at`);

-- ۷. ایندکس لاگ‌های امنیتی کاربر روی جدول audit_logs
-- کمک به کوئری‌های بازرسی و مشاهده لاگ‌های امنیتی یک کاربر مشخص بر اساس زمان ثبت:
-- WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX `idx_audit_user_created` ON `audit_logs` (`user_id`, `created_at`);

-- ۸. ایندکس مقالات پژوهشی طلبه روی جدول received_articles
-- کمک به کوئری‌های استخراج لیست مقالات پژوهشی ارسال شده توسط یک طلبه بر اساس زمان:
-- WHERE student_id = ? ORDER BY created_at DESC
CREATE INDEX `idx_article_student_created` ON `received_articles` (`student_id`, `created_at`);
