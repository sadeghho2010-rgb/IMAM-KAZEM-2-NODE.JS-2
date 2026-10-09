-- ==============================================================================
-- اسکریپت جامع پایگاه داده MySQL 8+ و MariaDB 10.5+ برای سامانه مدیریت حوزه علمیه
-- طراحی شده جهت مهاجرت کامل از Supabase/PostgreSQL به هاست اختصاصی با دیتابیس MySQL
-- کدگذاری پیش‌فرض: utf8mb4 با تطبیق utf8mb4_unicode_ci (پشتیبانی کامل از فارسی و اعراب)
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ۱. جدول جامع کلیه کاربران سیستم (all_users)
CREATE TABLE IF NOT EXISTS `all_users` (
    `id` VARCHAR(100) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `name` VARCHAR(255) NOT NULL,
    `role` VARCHAR(50) NOT NULL,
    `role_title` VARCHAR(100) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `level` INT NOT NULL DEFAULT 3,
    `grade_label` VARCHAR(100) NULL,
    `mentor_id` VARCHAR(100) NULL,
    `student_id` VARCHAR(100) NULL,
    `linked_student_id` VARCHAR(100) NULL,
    `avatar_bg` VARCHAR(50) NULL,
    `allowed_tabs` JSON NULL,
    `editable_tabs` JSON NULL,
    `module_permissions` JSON NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
    `failed_login_attempts` INT NOT NULL DEFAULT 0,
    `account_locked_until` DATETIME NULL,
    `last_login` DATETIME NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_all_users_username` (`username`),
    INDEX `idx_all_users_role_level` (`role`, `level`),
    INDEX `idx_all_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۱-الف. نمای سازگاری all_user برای هماهنگی کامل
CREATE OR REPLACE VIEW `all_user` AS SELECT * FROM `all_users`;

-- ۱-ب. جدول کاربران سیستم (system_users) جهت سازگاری و Mirroring
CREATE TABLE IF NOT EXISTS `system_users` (
    `id` VARCHAR(100) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `name` VARCHAR(255) NOT NULL,
    `role` VARCHAR(50) NOT NULL,
    `role_title` VARCHAR(100) NULL,
    `level` INT NOT NULL DEFAULT 3,
    `grade_label` VARCHAR(100) NULL,
    `mentor_id` VARCHAR(100) NULL,
    `student_id` VARCHAR(100) NULL,
    `linked_student_id` VARCHAR(100) NULL,
    `avatar_bg` VARCHAR(50) NULL,
    `allowed_tabs` JSON NULL,
    `editable_tabs` JSON NULL,
    `module_permissions` JSON NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
    `failed_login_attempts` INT NOT NULL DEFAULT 0,
    `account_locked_until` DATETIME NULL,
    `last_login` DATETIME NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    INDEX `idx_users_role_level` (`role`, `level`),
    INDEX `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۲. جدول پرونده طلاب (Students)
CREATE TABLE IF NOT EXISTS `students` (
    `id` VARCHAR(100) NOT NULL,
    `student_code` VARCHAR(50) NULL,
    `national_id` VARCHAR(20) NULL,
    `name` VARCHAR(255) NOT NULL,
    `father_name` VARCHAR(150) NULL,
    `grade` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `entry_year` VARCHAR(10) NULL,
    `mentor_id` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_student_code` (`student_code`),
    INDEX `idx_student_national_id` (`national_id`),
    INDEX `idx_student_grade` (`grade`),
    INDEX `idx_student_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۳. جدول اساتید و مدرسین (Teachers)
CREATE TABLE IF NOT EXISTS `teachers` (
    `id` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `specialty` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(150) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_teacher_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۴. جدول کلاس‌ها و مدرس‌ها (Classrooms)
CREATE TABLE IF NOT EXISTS `classrooms` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `grade` VARCHAR(100) NULL,
    `capacity` INT NOT NULL DEFAULT 20,
    `location` VARCHAR(255) NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۵. جدول برنامه‌های آموزشی و سرفصل‌ها (Programs)
CREATE TABLE IF NOT EXISTS `programs` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `grade` VARCHAR(100) NOT NULL,
    `teacher_id` VARCHAR(100) NULL,
    `teacher_name` VARCHAR(255) NULL,
    `classroom_id` VARCHAR(100) NULL,
    `term` VARCHAR(50) NULL,
    `day_of_week` VARCHAR(50) NULL,
    `time_slot` VARCHAR(50) NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_program_grade` (`grade`),
    INDEX `idx_program_teacher` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۶. جدول ثبت‌نام در دوره‌ها (Enrollments)
CREATE TABLE IF NOT EXISTS `enrollments` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `program_id` VARCHAR(100) NOT NULL,
    `grade` VARCHAR(100) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'enrolled',
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_enrollment_student` (`student_id`),
    INDEX `idx_enrollment_program` (`program_id`),
    INDEX `idx_enrollment_student_program` (`student_id`, `program_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۷. جدول حضور و غیاب (Attendance)
CREATE TABLE IF NOT EXISTS `attendance` (
    `id` VARCHAR(100) NOT NULL,
    `date` VARCHAR(20) NOT NULL,
    `grade` VARCHAR(100) NOT NULL,
    `program_id` VARCHAR(100) NULL,
    `present_count` INT NOT NULL DEFAULT 0,
    `absent_count` INT NOT NULL DEFAULT 0,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_attendance_date_grade` (`date`, `grade`),
    INDEX `idx_attendance_program_date` (`program_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۸. جدول دوره‌ها و محاسبات شهریه طلاب (Tuition Periods & Records)
CREATE TABLE IF NOT EXISTS `tuition_periods` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `academic_year` VARCHAR(50) NULL,
    `month` VARCHAR(50) NULL,
    `is_closed` TINYINT(1) NOT NULL DEFAULT 0,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tuition_records` (
    `id` VARCHAR(100) NOT NULL,
    `period_id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(255) NULL,
    `grade` VARCHAR(100) NULL,
    `base_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `is_paid` TINYINT(1) NOT NULL DEFAULT 0,
    `paid_at` DATETIME NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_tuition_period_student` (`period_id`, `student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۹. جدول نمرات و ارزیابی مشاوره‌ها (Counseling Session Grades)
CREATE TABLE IF NOT EXISTS `counseling_session_grades` (
    `id` VARCHAR(100) NOT NULL,
    `program_id` VARCHAR(100) NULL,
    `course_title` VARCHAR(255) NULL,
    `teacher_id` VARCHAR(100) NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `session_date` VARCHAR(50) NOT NULL,
    `participation_score` VARCHAR(20) NULL,
    `research_score` VARCHAR(20) NULL,
    `grade` VARCHAR(20) NULL,
    `notes` TEXT NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_counseling_session` (`student_id`, `session_date`),
    INDEX `idx_counseling_teacher` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۱۰. جدول کمدها و واگذاری به طلاب (Student Lockers)
CREATE TABLE IF NOT EXISTS `student_lockers` (
    `id` VARCHAR(100) NOT NULL,
    `locker_number` INT NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'empty',
    `student_id` VARCHAR(100) NULL,
    `student_name` VARCHAR(255) NULL,
    `student_grade` VARCHAR(100) NULL,
    `assigned_at` VARCHAR(50) NULL,
    `inactive_reason` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `history` JSON NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_locker_number` (`locker_number`),
    INDEX `idx_locker_status` (`status`),
    INDEX `idx_locker_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۱۱. جدول آزمون‌های شفاهی طلاب (Oral Exams)
CREATE TABLE IF NOT EXISTS `oral_exams` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(255) NULL,
    `grade` VARCHAR(100) NULL,
    `subject` VARCHAR(255) NOT NULL,
    `score` DECIMAL(5, 2) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `examiner_name` VARCHAR(255) NULL,
    `exam_date` VARCHAR(50) NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_oral_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۱۲. جدول مقالات و ارزیابی پژوهش (Received Articles)
CREATE TABLE IF NOT EXISTS `received_articles` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(255) NULL,
    `grade` VARCHAR(100) NULL,
    `title` VARCHAR(255) NOT NULL,
    `field` VARCHAR(150) NULL,
    `word_count` INT NOT NULL DEFAULT 0,
    `status` VARCHAR(50) NOT NULL DEFAULT 'submitted',
    `score` DECIMAL(5, 2) NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_article_student` (`student_id`),
    INDEX `idx_article_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۱۳. جدول لاگ‌های امنیتی و رویدادها (Audit Logs)
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(100) NULL,
    `username` VARCHAR(100) NULL,
    `user_role` VARCHAR(50) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NULL,
    `entity_id` VARCHAR(100) NULL,
    `description` TEXT NOT NULL,
    `ip_address` VARCHAR(50) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_audit_user` (`user_id`, `username`),
    INDEX `idx_audit_user_created` (`user_id`, `created_at`),
    INDEX `idx_audit_action` (`action`),
    INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۱۴. جدول فایل‌های بکاپ دیتابیس (Cloud Backups)
CREATE TABLE IF NOT EXISTS `cloud_backups` (
    `id` VARCHAR(100) NOT NULL,
    `mentor_id` VARCHAR(100) NULL,
    `mentor_name` VARCHAR(255) NULL,
    `mentor_role` VARCHAR(100) NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size_bytes` BIGINT NOT NULL DEFAULT 0,
    `file_size_formatted` VARCHAR(50) NULL,
    `total_records` INT NOT NULL DEFAULT 0,
    `student_count` INT NOT NULL DEFAULT 0,
    `persian_date` VARCHAR(100) NULL,
    `backup_data` LONGTEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_backup_mentor` (`mentor_id`),
    INDEX `idx_backup_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۱۵. جدول آیینه‌ای کالکشن‌های عمومی (App Collections)
-- این جدول برای مهاجرت نرم و تضمین ۱۰۰٪ بدون خطای تمام اسناد و کالکشن‌های متفرقه است
CREATE TABLE IF NOT EXISTS `app_collections` (
    `collection_name` VARCHAR(100) NOT NULL,
    `id` VARCHAR(150) NOT NULL,
    `data` JSON NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`collection_name`, `id`),
    INDEX `idx_col_name` (`collection_name`),
    INDEX `idx_col_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
