-- ==============================================================================
-- پایگاه داده جامع سامانه مدیریت حوزه علمیه (Madrasah Management System)
-- نسخه: 2.6.0 (Relational Master Schema with Explicit Foreign Keys)
-- انکودینگ: utf8mb4_unicode_ci (پشتیبانی کامل از زبان فارسی و اعراب)
-- موتور ذخیره‌سازی: InnoDB (پشتیبانی کامل از ACID، تراکنش‌ها و کلیدهای خارجی)
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

-- ==============================================================================
-- ۱. جدول کاربران سیستم (system_users) - جدول پایه / Parent
-- ==============================================================================
DROP TABLE IF EXISTS `presence_hours`;
DROP TABLE IF EXISTS `system_users`;

CREATE TABLE `system_users` (
    `id` VARCHAR(100) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `name` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(255) NULL,
    `role` VARCHAR(50) NOT NULL DEFAULT 'student',
    `role_title` VARCHAR(100) NULL,
    `level` INT NOT NULL DEFAULT 3 COMMENT '1: مدیران ارشد, 2: کادر و اساتید پایه, 3: طلاب و اساتید',
    `scope` VARCHAR(50) NOT NULL DEFAULT 'self',
    `grade_label` VARCHAR(100) NULL,
    `mentor_id` VARCHAR(100) NULL,
    `student_id` VARCHAR(100) NULL,
    `linked_student_id` VARCHAR(100) NULL,
    `teacher_id` VARCHAR(100) NULL,
    `linked_teacher_id` VARCHAR(100) NULL,
    `avatar_bg` VARCHAR(50) NULL,
    `national_id` VARCHAR(20) NULL,
    `phone` VARCHAR(50) NULL,
    `allowed_tabs` JSON NULL,
    `editable_tabs` JSON NULL,
    `module_permissions` JSON NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
    `failed_login_attempts` INT NOT NULL DEFAULT 0,
    `account_locked_until` DATETIME NULL,
    `security_pin_enabled` TINYINT(1) NOT NULL DEFAULT 0,
    `pin_challenge_interval` INT NOT NULL DEFAULT 15,
    `special_security_pin_hash` VARCHAR(255) NULL,
    `security_config_signature` VARCHAR(255) NULL,
    `last_login` DATETIME NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    INDEX `idx_users_role_level` (`role`, `level`),
    INDEX `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲. جدول پرونده طلاب (students) - جدول پایه / Parent
-- ==============================================================================
DROP TABLE IF EXISTS `enrollments`;
DROP TABLE IF EXISTS `attendance`;
DROP TABLE IF EXISTS `oral_exams`;
DROP TABLE IF EXISTS `research_records`;
DROP TABLE IF EXISTS `tuition_records`;
DROP TABLE IF EXISTS `finance_loans`;
DROP TABLE IF EXISTS `student_requests`;
DROP TABLE IF EXISTS `student_lockers`;
DROP TABLE IF EXISTS `students`;

CREATE TABLE `students` (
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

-- ==============================================================================
-- ۳. جدول اساتید و مدرسین (teachers)
-- ==============================================================================
DROP TABLE IF EXISTS `teachers`;
CREATE TABLE `teachers` (
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

-- ==============================================================================
-- ۴. جدول کلاس‌ها و مدرس‌ها (classrooms)
-- ==============================================================================
DROP TABLE IF EXISTS `classrooms`;
CREATE TABLE `classrooms` (
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

-- ==============================================================================
-- ۵. جدول برنامه‌های آموزشی و سرفصل‌ها (programs)
-- ==============================================================================
DROP TABLE IF EXISTS `programs`;
CREATE TABLE `programs` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `grade` VARCHAR(100) NOT NULL,
    `teacher_id` VARCHAR(100) NULL,
    `teacher_name` VARCHAR(255) NULL,
    `classroom_id` VARCHAR(100) NULL,
    `day_of_week` VARCHAR(50) NULL,
    `start_time` VARCHAR(20) NULL,
    `end_time` VARCHAR(20) NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_programs_grade` (`grade`),
    INDEX `idx_programs_teacher` (`teacher_id`),
    CONSTRAINT `fk_programs_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_programs_classroom` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۶. جدول ثبت‌نام در برنامه‌های آموزشی (enrollments)
-- ==============================================================================
CREATE TABLE `enrollments` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `program_id` VARCHAR(100) NOT NULL,
    `grade` VARCHAR(100) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'enrolled',
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_student_program` (`student_id`, `program_id`),
    INDEX `idx_enrollment_program` (`program_id`),
    CONSTRAINT `fk_enrollments_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_enrollments_program` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۷. جدول حضور و غیاب روزانه (attendance)
-- ==============================================================================
CREATE TABLE `attendance` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `date` VARCHAR(30) NOT NULL COMMENT 'تاریخ شمسی مثلا 1403/07/15',
    `program_id` VARCHAR(100) NULL,
    `status` ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'present',
    `minutes_late` INT NOT NULL DEFAULT 0,
    `reason` TEXT NULL,
    `recorded_by` VARCHAR(100) NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_attendance_student_date` (`student_id`, `date`),
    CONSTRAINT `fk_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_attendance_program` FOREIGN KEY (`program_id`) REFERENCES `programs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۸. جدول آزمون‌های شفاهی طلاب (oral_exams)
-- ==============================================================================
CREATE TABLE `oral_exams` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `exam_title` VARCHAR(255) NOT NULL,
    `score` DECIMAL(4, 2) NULL,
    `exam_date` VARCHAR(30) NULL,
    `examiner_name` VARCHAR(150) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_oral_student` (`student_id`),
    CONSTRAINT `fk_oral_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۹. جدول پژوهش و مقالات طلاب (research_records)
-- ==============================================================================
CREATE TABLE `research_records` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(200) NULL,
    `grade` VARCHAR(100) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'submitted',
    `score` DECIMAL(4, 2) NULL,
    `evaluation_notes` TEXT NULL,
    `evaluator_id` VARCHAR(100) NULL,
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_research_student` (`student_id`),
    CONSTRAINT `fk_research_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۰. جدول ساعت حضور و کارکرد پرسنل و اساتید (presence_hours)
-- ==============================================================================
CREATE TABLE `presence_hours` (
    `id` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(100) NOT NULL,
    `user_name` VARCHAR(150) NOT NULL,
    `date` VARCHAR(30) NOT NULL,
    `entry_time` VARCHAR(10) NULL,
    `exit_time` VARCHAR(10) NULL,
    `total_minutes` INT NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'approved',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_presence_user_date` (`user_id`, `date`),
    CONSTRAINT `fk_presence_user` FOREIGN KEY (`user_id`) REFERENCES `system_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۱. جدول دوره‌ها و محاسبات شهریه طلاب (tuition_records)
-- ==============================================================================
CREATE TABLE `tuition_records` (
    `id` VARCHAR(100) NOT NULL,
    `period_id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(150) NOT NULL,
    `grade` VARCHAR(100) NULL,
    `base_amount` BIGINT NOT NULL DEFAULT 0,
    `bonus_amount` BIGINT NOT NULL DEFAULT 0,
    `deduction_amount` BIGINT NOT NULL DEFAULT 0,
    `net_amount` BIGINT NOT NULL DEFAULT 0,
    `status` VARCHAR(50) NOT NULL DEFAULT 'finalized',
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_tuition_period_student` (`period_id`, `student_id`),
    CONSTRAINT `fk_tuition_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۲. جدول وام‌های صندوق قرض‌الحسنه (finance_loans)
-- ==============================================================================
CREATE TABLE `finance_loans` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(150) NOT NULL,
    `loan_type` VARCHAR(100) NOT NULL,
    `total_amount` BIGINT NOT NULL,
    `installments_count` INT NOT NULL,
    `installment_amount` BIGINT NOT NULL,
    `paid_installments` INT NOT NULL DEFAULT 0,
    `start_date` VARCHAR(30) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    `data` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_loans_student` (`student_id`),
    CONSTRAINT `fk_loans_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۳. جدول ثبت هزینه‌ها و فاکتورها (finance_expenses)
-- ==============================================================================
DROP TABLE IF EXISTS `finance_expenses`;
CREATE TABLE `finance_expenses` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `amount` BIGINT NOT NULL,
    `date` VARCHAR(30) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `budget_row_id` VARCHAR(100) NULL,
    `payer` VARCHAR(150) NULL,
    `recipient` VARCHAR(150) NULL,
    `invoice_number` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'approved',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_expenses_date` (`date`),
    INDEX `idx_expenses_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۴. جدول مدیریت پیشرفته ۲۰۰ کمد طلاب (student_lockers)
-- ==============================================================================
CREATE TABLE `student_lockers` (
    `id` VARCHAR(50) NOT NULL,
    `locker_number` INT NOT NULL,
    `status` ENUM('vacant', 'occupied', 'defective') NOT NULL DEFAULT 'vacant',
    `student_id` VARCHAR(100) NULL,
    `student_name` VARCHAR(150) NULL,
    `student_code` VARCHAR(50) NULL,
    `grade` VARCHAR(50) NULL,
    `assigned_date` VARCHAR(30) NULL,
    `phone_number` VARCHAR(30) NULL,
    `defect_type` ENUM('lost_key', 'broken', 'other') NULL,
    `defect_description` TEXT NULL,
    `has_spare_key` TINYINT(1) NOT NULL DEFAULT 1,
    `updated_by` VARCHAR(100) NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_locker_number` (`locker_number`),
    INDEX `idx_locker_status` (`status`),
    CONSTRAINT `fk_lockers_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۵. جدول لاگ سوابق واگذاری کمدها (locker_history_logs)
-- ==============================================================================
DROP TABLE IF EXISTS `locker_history_logs`;
CREATE TABLE `locker_history_logs` (
    `id` VARCHAR(100) NOT NULL,
    `locker_number` INT NOT NULL,
    `action` ENUM('assign', 'vacate', 'swap', 'report_defect', 'resolve_defect', 'key_handover') NOT NULL,
    `student_id` VARCHAR(100) NULL,
    `student_name` VARCHAR(150) NULL,
    `previous_student_name` VARCHAR(150) NULL,
    `details` TEXT NULL,
    `actor_id` VARCHAR(100) NULL,
    `actor_name` VARCHAR(150) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_locker_hist_num` (`locker_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۶. جدول سامانه ثبت و گردش درخواست‌های طلاب (student_requests)
-- ==============================================================================
CREATE TABLE `student_requests` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(150) NOT NULL,
    `national_code` VARCHAR(20) NULL,
    `grade` VARCHAR(50) NULL,
    `unit` ENUM('education', 'finance', 'cultural_welfare') NOT NULL,
    `category` VARCHAR(150) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `status` ENUM('pending', 'in_progress', 'resolved', 'rejected') NOT NULL DEFAULT 'pending',
    `status_title` VARCHAR(100) NULL DEFAULT 'در انتظار بررسی',
    `official_reply` TEXT NULL,
    `replied_by` VARCHAR(100) NULL,
    `replied_by_name` VARCHAR(150) NULL,
    `replied_at` DATETIME NULL,
    `rejection_reason` TEXT NULL,
    `is_read_by_officer` TINYINT(1) NOT NULL DEFAULT 0,
    `is_read_by_student` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_req_unit` (`unit`),
    INDEX `idx_req_student` (`student_id`),
    INDEX `idx_req_status` (`status`),
    CONSTRAINT `fk_requests_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۷. جدول تنظیمات سراسری پنل درخواست‌ها (global_requests_config)
-- ==============================================================================
DROP TABLE IF EXISTS `global_requests_config`;
CREATE TABLE `global_requests_config` (
    `id` VARCHAR(50) NOT NULL DEFAULT 'global_requests_config',
    `is_global_visible_for_students` TINYINT(1) NOT NULL DEFAULT 1,
    `is_global_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `officers_status` JSON NOT NULL,
    `updated_by` VARCHAR(100) NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۸. جدول تنظیمات واحدهای پاسخگو (unit_request_settings)
-- ==============================================================================
DROP TABLE IF EXISTS `unit_request_settings`;
CREATE TABLE `unit_request_settings` (
    `id` VARCHAR(50) NOT NULL,
    `unit` ENUM('education', 'finance', 'cultural_welfare') NOT NULL,
    `unit_name` VARCHAR(150) NOT NULL,
    `is_accepting_requests` TINYINT(1) NOT NULL DEFAULT 1,
    `disabled_notice_message` TEXT NULL,
    `allowed_categories` JSON NOT NULL,
    `updated_by` VARCHAR(100) NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_unit` (`unit`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۱۹. جدول تشخیص ناهنجاری‌ها و رولبک (anomaly_logs)
-- ==============================================================================
DROP TABLE IF EXISTS `anomaly_logs`;
CREATE TABLE `anomaly_logs` (
    `id` VARCHAR(100) NOT NULL,
    `action_type` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(100) NOT NULL,
    `user_name` VARCHAR(150) NOT NULL,
    `severity` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    `description` TEXT NOT NULL,
    `detection_reason` VARCHAR(255) NOT NULL,
    `original_state` JSON NULL,
    `affected_records_count` INT NOT NULL DEFAULT 1,
    `is_resolved` TINYINT(1) NOT NULL DEFAULT 0,
    `resolved_by` VARCHAR(100) NULL,
    `resolved_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_anomaly_severity` (`severity`),
    INDEX `idx_anomaly_resolved` (`is_resolved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۰. جدول زنجیره امن لاگ‌های حسابرسی (audit_chain_logs)
-- ==============================================================================
DROP TABLE IF EXISTS `audit_chain_logs`;
CREATE TABLE `audit_chain_logs` (
    `id` VARCHAR(100) NOT NULL,
    `sequence_number` BIGINT NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(100) NOT NULL,
    `module` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(100) NOT NULL,
    `user_name` VARCHAR(150) NOT NULL,
    `user_role` VARCHAR(100) NULL,
    `ip_address` VARCHAR(60) NULL,
    `user_agent` VARCHAR(255) NULL,
    `target_id` VARCHAR(100) NULL,
    `details` JSON NULL,
    `previous_hash` VARCHAR(64) NOT NULL,
    `record_hash` VARCHAR(64) NOT NULL,
    `signature` VARCHAR(128) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_chain_sequence` (`sequence_number`),
    INDEX `idx_chain_user` (`user_id`),
    INDEX `idx_chain_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۱. جدول تاریخچه پشتیبان‌گیری‌ها (system_backups)
-- ==============================================================================
DROP TABLE IF EXISTS `system_backups`;
CREATE TABLE `system_backups` (
    `id` VARCHAR(100) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size_bytes` BIGINT NOT NULL DEFAULT 0,
    `checksum_sha256` VARCHAR(64) NOT NULL,
    `backup_type` ENUM('manual', 'scheduled', 'automated') NOT NULL DEFAULT 'manual',
    `tables_count` INT NOT NULL DEFAULT 0,
    `records_count` INT NOT NULL DEFAULT 0,
    `created_by_id` VARCHAR(100) NULL,
    `created_by_name` VARCHAR(150) NULL,
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_backup_type` (`backup_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۲. جدول گزارش باگ و مشکلات سیستم (bug_reports)
-- ==============================================================================
DROP TABLE IF EXISTS `bug_reports`;
CREATE TABLE `bug_reports` (
    `id` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(100) NULL,
    `user_name` VARCHAR(150) NULL,
    `page_url` VARCHAR(255) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `severity` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    `status` ENUM('open', 'in_review', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `browser_info` VARCHAR(255) NULL,
    `screenshot_url` TEXT NULL,
    `admin_note` TEXT NULL,
    `resolved_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_bug_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۳. جدول نظرات و بازخورد کاربران (user_feedback)
-- ==============================================================================
DROP TABLE IF EXISTS `user_feedback`;
CREATE TABLE `user_feedback` (
    `id` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(100) NULL,
    `user_name` VARCHAR(150) NULL,
    `category` VARCHAR(100) NOT NULL,
    `message` TEXT NOT NULL,
    `rating` INT NULL DEFAULT 5,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۴. جدول ثبت خطاهای بحرانی سرور (error_logs)
-- ==============================================================================
DROP TABLE IF EXISTS `error_logs`;
CREATE TABLE `error_logs` (
    `id` VARCHAR(100) NOT NULL,
    `endpoint` VARCHAR(255) NULL,
    `method` VARCHAR(20) NULL,
    `user_id` VARCHAR(100) NULL,
    `error_message` TEXT NOT NULL,
    `stack_trace` TEXT NULL,
    `ip_address` VARCHAR(60) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_error_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۵. جدول دوره‌های مطالعاتی (study_periods)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `study_periods` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `start_date` VARCHAR(50) NOT NULL,
    `end_date` VARCHAR(50) NOT NULL,
    `mandatory_hours` INT NOT NULL DEFAULT 40,
    `deadline_date` VARCHAR(50) NULL,
    `is_closed` TINYINT(1) NOT NULL DEFAULT 0,
    `closed_manually` TINYINT(1) NOT NULL DEFAULT 0,
    `warning_rule` VARCHAR(50) NOT NULL DEFAULT 'below_mandatory',
    `target_grades` JSON NULL,
    `exempt_grades` JSON NULL,
    `exempt_student_ids` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_sp_dates` (`start_date`, `end_date`),
    INDEX `idx_sp_closed` (`is_closed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۶. جدول لاگ ساعات مطالعه و مباحثه طلاب (study_logs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `study_logs` (
    `id` VARCHAR(100) NOT NULL,
    `period_id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `hours` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `study_hours` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `discussion_hours` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `is_exempt` TINYINT(1) NOT NULL DEFAULT 0,
    `exemption_reason` TEXT NULL,
    `submitted_by` VARCHAR(50) NOT NULL DEFAULT 'student',
    `last_modified_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_study_period_student` (`period_id`, `student_id`),
    CONSTRAINT `fk_study_logs_period` FOREIGN KEY (`period_id`) REFERENCES `study_periods` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_study_logs_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۷. جدول جلسات ارزیابی و کرسی‌های مقاله پژوهشی (research_sessions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `research_sessions` (
    `id` VARCHAR(100) NOT NULL,
    `article_id` VARCHAR(100) NULL,
    `title` VARCHAR(255) NOT NULL,
    `presenter_student_id` VARCHAR(100) NULL,
    `presenter_name` VARCHAR(255) NOT NULL,
    `student_grade` VARCHAR(100) NULL,
    `referee_count` INT NOT NULL DEFAULT 1,
    `critic_count` INT NOT NULL DEFAULT 1,
    `allowed_role_registration` VARCHAR(50) NOT NULL DEFAULT 'both',
    `has_abstract` TINYINT(1) NOT NULL DEFAULT 0,
    `abstract_text` TEXT NULL,
    `has_download_link` TINYINT(1) NOT NULL DEFAULT 0,
    `download_url` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    `approved_critic_student_ids` JSON NULL,
    `approved_referee_student_ids` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_session_presenter` (`presenter_student_id`),
    INDEX `idx_session_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۸. جدول دوره‌های آزمون شفاهی (oral_exam_periods)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `oral_exam_periods` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `academic_year` VARCHAR(50) NULL,
    `grade` VARCHAR(100) NOT NULL,
    `has_usul` TINYINT(1) NOT NULL DEFAULT 1,
    `usul_books` JSON NULL,
    `has_fiqh` TINYINT(1) NOT NULL DEFAULT 1,
    `fiqh_books` JSON NULL,
    `exam_dates` JSON NULL,
    `examiner_teacher_ids` JSON NULL,
    `examiner_teacher_names` JSON NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `notes` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_oep_grade` (`grade`),
    INDEX `idx_oep_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۲۹. جدول کارنامه و نمرات آزمون شفاهی (oral_exam_records)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `oral_exam_records` (
    `id` VARCHAR(100) NOT NULL,
    `period_id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(255) NOT NULL,
    `grade` VARCHAR(100) NULL,
    `exam_time` VARCHAR(100) NULL,
    `fiqh_examiner_teacher_name` VARCHAR(255) NULL,
    `fiqh_book_title` VARCHAR(255) NULL,
    `fiqh_score` DECIMAL(4,2) NULL,
    `fiqh_text_mastery` DECIMAL(4,2) NULL,
    `fiqh_explanation_mastery` DECIMAL(4,2) NULL,
    `fiqh_examiner_notes` TEXT NULL,
    `fiqh_is_retake` TINYINT(1) NOT NULL DEFAULT 0,
    `usul_examiner_teacher_name` VARCHAR(255) NULL,
    `usul_book_title` VARCHAR(255) NULL,
    `usul_score` DECIMAL(4,2) NULL,
    `usul_text_mastery` DECIMAL(4,2) NULL,
    `usul_explanation_mastery` DECIMAL(4,2) NULL,
    `usul_examiner_notes` TEXT NULL,
    `usul_is_retake` TINYINT(1) NOT NULL DEFAULT 0,
    `overall_status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_oral_period_student` (`period_id`, `student_id`),
    INDEX `idx_oral_status` (`overall_status`),
    CONSTRAINT `fk_oral_records_period` FOREIGN KEY (`period_id`) REFERENCES `oral_exam_periods` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_oral_records_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۰. جدول دوره‌های تقویم آموزشی (calendar_periods)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `calendar_periods` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `start_date` VARCHAR(50) NOT NULL,
    `end_date` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `default_thursday_mode` VARCHAR(50) NOT NULL DEFAULT 'off',
    `include_friday_as_study_day` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_cal_dates` (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۱. جدول تعطیلات تقویم آموزشی (holidays)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `holidays` (
    `id` VARCHAR(100) NOT NULL,
    `period_id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `type_id` VARCHAR(50) NOT NULL DEFAULT 'official',
    `type_name` VARCHAR(100) NOT NULL DEFAULT 'تعطیلی رسمی',
    `start_date` VARCHAR(50) NOT NULL,
    `end_date` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_holiday_dates` (`start_date`, `end_date`),
    CONSTRAINT `fk_holidays_period` FOREIGN KEY (`period_id`) REFERENCES `calendar_periods` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۲. جدول برنامه‌های هفتگی تقویم آموزشی (weekly_programs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `weekly_programs` (
    `id` VARCHAR(100) NOT NULL,
    `period_id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `day_of_week` VARCHAR(50) NULL,
    `start_date` VARCHAR(50) NULL,
    `end_date` VARCHAR(50) NULL,
    `time` VARCHAR(100) NULL,
    `location_or_teacher` VARCHAR(255) NULL,
    `grade` VARCHAR(100) NULL,
    `is_public` TINYINT(1) NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `color` VARCHAR(50) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_wp_period` (`period_id`),
    CONSTRAINT `fk_weekly_programs_period` FOREIGN KEY (`period_id`) REFERENCES `calendar_periods` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۳. جدول دوره‌های رزرو غذا (meal_periods)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `meal_periods` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `start_date` VARCHAR(50) NOT NULL,
    `end_date` VARCHAR(50) NOT NULL,
    `enable_lunch` TINYINT(1) NOT NULL DEFAULT 1,
    `enable_dinner` TINYINT(1) NOT NULL DEFAULT 1,
    `lunch_price` DECIMAL(12,2) NOT NULL DEFAULT 45000.00,
    `dinner_price` DECIMAL(12,2) NOT NULL DEFAULT 35000.00,
    `status` VARCHAR(50) NOT NULL DEFAULT 'open',
    `lunch_disabled_days` JSON NULL,
    `dinner_disabled_days` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_mp_dates` (`start_date`, `end_date`),
    INDEX `idx_mp_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۴. جدول رزرو غذای طلاب (meal_reservations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `meal_reservations` (
    `id` VARCHAR(100) NOT NULL,
    `period_id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(255) NOT NULL,
    `grade` VARCHAR(100) NULL,
    `selected_lunch_days` JSON NULL,
    `selected_dinner_days` JSON NULL,
    `dinner_location` VARCHAR(50) NOT NULL DEFAULT 'institute',
    `total_calculated_lunches` INT NOT NULL DEFAULT 0,
    `total_calculated_dinners` INT NOT NULL DEFAULT 0,
    `total_lunch_cost` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `total_dinner_cost` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `total_meal_cost` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `final_deduction_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_meal_res_student` (`period_id`, `student_id`),
    CONSTRAINT `fk_meal_res_period` FOREIGN KEY (`period_id`) REFERENCES `meal_periods` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_meal_res_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۵. جدول تعطیلی‌های آشپزخانه (meal_cancelled_days)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `meal_cancelled_days` (
    `id` VARCHAR(100) NOT NULL,
    `date` VARCHAR(50) NOT NULL,
    `meal_type` VARCHAR(50) NOT NULL DEFAULT 'both',
    `reason` VARCHAR(255) NOT NULL,
    `registered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `registered_by_name` VARCHAR(100) NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_meal_cancelled_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۶. جدول بانک رانندگان (drivers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `drivers` (
    `id` VARCHAR(100) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `car_model` VARCHAR(100) NULL,
    `plate_number` VARCHAR(50) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `notes` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_drivers_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۷. جدول برنامه هفتگی ترابری اساتید (weekly_routines)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `weekly_routines` (
    `id` VARCHAR(100) NOT NULL,
    `teacher_id` VARCHAR(100) NOT NULL,
    `teacher_name` VARCHAR(255) NOT NULL,
    `days_of_week` JSON NULL,
    `arrival_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `arrival_time` VARCHAR(50) NULL,
    `arrival_address_title` VARCHAR(255) NULL,
    `arrival_address_details` TEXT NULL,
    `departure_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `departure_time` VARCHAR(50) NULL,
    `departure_address_title` VARCHAR(255) NULL,
    `departure_address_details` TEXT NULL,
    `cost_per_trip` DECIMAL(12,2) NULL DEFAULT 0.00,
    `driver_id` VARCHAR(100) NULL,
    `driver_name` VARCHAR(255) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `notes` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_routine_teacher` (`teacher_id`),
    CONSTRAINT `fk_routines_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_routines_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۸. جدول سفرهای ترابری اساتید (trips)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `trips` (
    `id` VARCHAR(100) NOT NULL,
    `teacher_id` VARCHAR(100) NOT NULL,
    `teacher_name` VARCHAR(255) NOT NULL,
    `date` VARCHAR(50) NOT NULL,
    `trip_type` VARCHAR(50) NOT NULL DEFAULT 'both',
    `arrival_time` VARCHAR(50) NULL,
    `arrival_address_title` VARCHAR(255) NULL,
    `arrival_address_details` TEXT NULL,
    `departure_time` VARCHAR(50) NULL,
    `departure_address_title` VARCHAR(255) NULL,
    `departure_address_details` TEXT NULL,
    `driver_id` VARCHAR(100) NULL,
    `driver_name` VARCHAR(255) NULL,
    `trips_count` INT NOT NULL DEFAULT 1,
    `cost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(50) NOT NULL DEFAULT 'completed',
    `notes` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_trips_date_teacher` (`date`, `teacher_id`),
    CONSTRAINT `fk_trips_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_trips_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۳۹. جدول دوره‌های انتخاب واحد (course_selection_periods)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `course_selection_periods` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `academic_year` VARCHAR(50) NULL,
    `term` VARCHAR(50) NULL,
    `allowed_program_types` JSON NULL,
    `allowed_grades` JSON NULL,
    `start_date` VARCHAR(50) NOT NULL,
    `end_date` VARCHAR(50) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `allow_cross_grade_selection` TINYINT(1) NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by_user_name` VARCHAR(100) NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_csp_dates` (`start_date`, `end_date`),
    INDEX `idx_csp_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۴۰. جدول فرم‌های انتخاب واحد طلاب (course_selection_requests)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `course_selection_requests` (
    `id` VARCHAR(100) NOT NULL,
    `period_id` VARCHAR(100) NOT NULL,
    `period_title` VARCHAR(255) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(255) NOT NULL,
    `student_grade` VARCHAR(100) NOT NULL,
    `national_id` VARCHAR(50) NULL,
    `selected_courses` JSON NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `reviewed_at` DATETIME NULL,
    `reviewed_by` VARCHAR(100) NULL,
    `admin_notes` TEXT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_cs_period_student` (`period_id`, `student_id`),
    INDEX `idx_cs_status` (`status`),
    CONSTRAINT `fk_cs_req_period` FOREIGN KEY (`period_id`) REFERENCES `course_selection_periods` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cs_req_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۴۱. جدول ارزیابی جلسات مشاوره (counseling_grades)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `counseling_grades` (
    `id` VARCHAR(100) NOT NULL,
    `student_id` VARCHAR(100) NOT NULL,
    `student_name` VARCHAR(255) NOT NULL,
    `grade` VARCHAR(100) NULL,
    `counselor_teacher_name` VARCHAR(255) NOT NULL,
    `course_title` VARCHAR(255) NOT NULL,
    `session_date` VARCHAR(50) NOT NULL,
    `session_number` VARCHAR(50) NULL,
    `participation_score` VARCHAR(50) NOT NULL DEFAULT 'الف',
    `research_score` VARCHAR(50) NOT NULL DEFAULT 'الف',
    `counselor_feedback` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by_name` VARCHAR(100) NULL,
    `created_by_role` VARCHAR(100) NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_counseling_student_course` (`student_id`, `course_title`),
    INDEX `idx_counseling_teacher` (`counselor_teacher_name`),
    INDEX `idx_counseling_date` (`session_date`),
    INDEX `idx_counseling_grade` (`grade`),
    CONSTRAINT `fk_counseling_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- ۴۲. جدول طرح‌های پیشنهادی مشاورین (advisor_proposals)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `advisor_proposals` (
    `id` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `academic_year` VARCHAR(50) NULL,
    `target_grade` VARCHAR(100) NULL,
    `proposal_data` JSON NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `notes` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_by_user_name` VARCHAR(100) NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_adv_grade` (`target_grade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- داده‌های اولیه و پایه‌ای (Seed Data)
-- ==============================================================================

-- ۱. کاربران پیش‌فرض احراز هویت
-- رمز عبور admin برابر با: Admin@123456 (هش استاندارد Bcrypt)
-- رمز عبور finance برابر با: Finance@123456 (هش استاندارد Bcrypt)
-- رمز عبور مدیران تست: 8411924
INSERT INTO `system_users` 
(`id`, `username`, `password_hash`, `name`, `full_name`, `role`, `role_title`, `level`, `scope`, `grade_label`, `is_active`)
VALUES 
('usr_admin', 'admin', '$2b$10$gPXa3enKLAd7Aa9tjOtO0.q.LWw7Tg6wVSlfMXdQPOdkLhBNHzSKK', 'مدیر کل سیستم (Admin)', 'مدیریت کل حوزه علمیه', 'super_admin', 'سوپر ادمین', 1, 'all', 'کل سیستم', 1),
('usr_finance', 'finance', '$2b$10$mN7jAyMI45JuFX2fPjs/ROllvJSP2qJf1PYhvsr56c2HyXPnd2kUi', 'مسئول امور مالی', 'مسئول مالی و کارکرد', 'finance_manager', 'مسئول مالی', 2, 'all', 'امور مالی', 1),
('usr_sadegh', 'SADEGH', '$2b$10$gPXa3enKLAd7Aa9tjOtO0.q.LWw7Tg6wVSlfMXdQPOdkLhBNHzSKK', 'صادق (سوپر ادمین)', 'صادق (مدیر سیستم)', 'super_admin', 'سوپر ادمین', 1, 'all', 'کل سیستم', 1),
('usr_shah', 'SHAH', '$2b$10$gPXa3enKLAd7Aa9tjOtO0.q.LWw7Tg6wVSlfMXdQPOdkLhBNHzSKK', 'استاد شاهپوری (مسئول آموزش)', 'استاد شاهپوری', 'education_manager', 'مسئول آموزش', 2, 'all', 'کل پایه‌ها', 1),
('usr_mali', 'MALI', '$2b$10$mN7jAyMI45JuFX2fPjs/ROllvJSP2qJf1PYhvsr56c2HyXPnd2kUi', 'مسئول مالی و اداری', 'مسئول مالی و اداری', 'finance_manager', 'مسئول مالی', 2, 'all', 'امور مالی', 1),
('usr_yazdani', 'YAZDANI', '$2b$10$gPXa3enKLAd7Aa9tjOtO0.q.LWw7Tg6wVSlfMXdQPOdkLhBNHzSKK', 'استاد یزدانی (مسئول پژوهش)', 'استاد یزدانی', 'research_manager', 'مسئول پژوهش', 2, 'all', 'بخش پژوهش', 1)
ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`), `is_active` = 1;

-- ۲. ثبت یک طلبه اولیه برای حفظ پیوستگی کلیدهای خارجی
INSERT INTO `students` (`id`, `student_code`, `national_id`, `name`, `father_name`, `grade`, `status`, `is_active`)
VALUES ('stu_sample_1', 'STU1001', '0011223344', 'طلبه نمونه (جلیلی)', 'رضا', 'پایه ۷', 'active', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ۳. تنظیمات اولیه سراسری پنل درخواست‌ها
INSERT INTO `global_requests_config` (`id`, `is_global_visible_for_students`, `is_global_enabled`, `officers_status`)
VALUES (
    'global_requests_config',
    1,
    1,
    JSON_OBJECT(
        'education', JSON_OBJECT('isAccepting', true, 'officerTitle', 'مسئول آموزش و امتحانات', 'officerName', 'استاد شاهپوری', 'statusNote', 'پذیرش گواهی‌ها، مرخصی و انتخاب واحد'),
        'finance', JSON_OBJECT('isAccepting', true, 'officerTitle', 'مسئول مالی و کارکرد', 'officerName', 'مسئول مالی و اداری', 'statusNote', 'پذیرش وام قرض‌الحسنه و تسویه شهریه'),
        'cultural_welfare', JSON_OBJECT('isAccepting', true, 'officerTitle', 'مسئول امور فرهنگی و رفاهی', 'officerName', 'مسئول فرهنگی و رفاهی', 'statusNote', 'پذیرش درخواست‌های کمد، اردوها و خدمات رفاهی')
    )
)
ON DUPLICATE KEY UPDATE `is_global_enabled` = 1;

-- ۴. تنظیمات واحدهای سه‌گانه
INSERT INTO `unit_request_settings` (`id`, `unit`, `unit_name`, `is_accepting_requests`, `disabled_notice_message`, `allowed_categories`)
VALUES 
('setting_education', 'education', 'واحد آموزش و امتحانات', 1, 'پذیرش درخواست‌های آموزشی موقتاً به دلیل بازه امتحانات غیرفعال است.', JSON_ARRAY('درخواست تغییر کلاس', 'درخواست مرخصی', 'تجدید نظر در ازمون شفاهی')),
('setting_finance', 'finance', 'واحد مالی، شهریه و وام‌ها', 1, 'سامانه ثبت درخواست‌های مالی موقتاً در حال محاسبه شهریه ماهانه است.', JSON_ARRAY('گزارش کسریات شهریه')),
('setting_cultural_welfare', 'cultural_welfare', 'واحد فرهنگی، رفاهی و کمدها', 1, 'پذیرش درخواست‌های رفاهی موقتاً بسته شده است.', JSON_ARRAY('سایر'))
ON DUPLICATE KEY UPDATE `unit_name` = VALUES(`unit_name`), `allowed_categories` = VALUES(`allowed_categories`);

SET FOREIGN_KEY_CHECKS = 1;
