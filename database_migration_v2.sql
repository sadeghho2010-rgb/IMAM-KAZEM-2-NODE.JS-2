-- ==============================================================================
-- اسکریپت مهاجرت پایگاه داده حوزه علمیه - نسخه ۲ (Stage 6 to 9 Tables Migration)
-- اضافه کننده ۱۸ جدول جدید ماژول‌های توسعه‌یافته:
-- ۱. دوره‌های مطالعه و ثبت ساعات مطالعه (study_periods, study_logs)
-- ۲. جلسات ارزیابی مقاله و آزمون‌های شفاهی (research_sessions, oral_exam_periods, oral_exam_records)
-- ۳. تقویم آموزشی، تعطیلات و برنامه‌ها (calendar_periods, holidays, weekly_programs)
-- ۴. تغذیه، رزرو وعده‌ها و تعطیلی آشپزخانه (meal_periods, meal_reservations, meal_cancelled_days)
-- ۵. ترابری و رانندگان اساتید (drivers, weekly_routines, trips)
-- ۶. انتخاب واحد طلاب (course_selection_periods, course_selection_requests)
-- ۷. ارزیابی جلسات مشاوره و طرح‌ها (counseling_grades, advisor_proposals)
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ۱. دوره‌های مطالعاتی (study_periods)
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

-- ۲. لاگ ساعات مطالعه و مباحثه طلاب (study_logs)
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

-- ۳. جلسات ارزیابی و کرسی‌های مقاله پژوهشی (research_sessions)
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

-- ۴. دوره‌های آزمون شفاهی (oral_exam_periods)
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

-- ۵. کارنامه و نمرات تفصیلی آزمون شفاهی فقه و اصول (oral_exam_records)
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

-- ۶. دوره‌های تقویم آموزشی (calendar_periods)
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

-- ۷. تعطیلات رسمی و مناسبتی تقویم (holidays)
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

-- ۸. برنامه‌های فوق‌برنامه هفتگی تقویم (weekly_programs)
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

-- ۹. دوره‌های رزرو غذا (meal_periods)
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

-- ۱۰. رزرو وعده‌های نهار و شام طلاب (meal_reservations)
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

-- ۱۱. تعطیلی‌های آشپزخانه و عدم طبخ غذا (meal_cancelled_days)
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

-- ۱۲. بانک اطلاعات رانندگان سرویس اساتید (drivers)
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

-- ۱۳. برنامه هفتگی ثابت سرویس رفت و برگشت اساتید (weekly_routines)
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

-- ۱۴. ثبت سفرهای موردی و روزانه ترابری اساتید (trips)
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

-- ۱۵. دوره‌های انتخاب واحد (course_selection_periods)
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

-- ۱۶. فرم‌ها و درخواست‌های انتخاب واحد طلاب (course_selection_requests)
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

-- ۱۷. ارزیابی و نمرات کیفی کلاس‌های مشاوره (counseling_grades)
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

-- ۱۸. طرح‌های پیشنهادی مشاورین تحصیلی (advisor_proposals)
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

SET FOREIGN_KEY_CHECKS = 1;
