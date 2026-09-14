export interface CustomStudentSchedule {
  id: string;
  studentId: string;
  studentName?: string;
  title: string;
  day: string;
  days?: string[];
  time?: string;
  startTime: string;
  endTime: string;
  locationOrNotes?: string;
  isExternal?: boolean;
  createdAt: string;
  createdByName?: string;
}

export type ProgramType = 'اصلی' | 'مشاوره' | 'پژوهش' | 'دروس 5 شنبه' | 'سایر';
export type ImportanceLevel = 'low' | 'medium' | 'high';
export type AttendanceStatus = 'present' | 'absent' | 'late';

export type StudentDeactivationReason = 
  | 'صرفا غیر فعال' 
  | 'فارغ التحصیل' 
  | 'انتقال اختیاری از مجموعه' 
  | 'قطع همکاری از مجموعه';

export interface Student {
  id: string;
  name: string;
  photoUrl?: string;
  nationalId?: string;
  isActive: boolean;
  phoneNumber?: string;
  grade?: string;

  // اطلاعات آموزشی
  managementCenterCode?: string; // کد مرکز مدیریت
  instituteCode?: string; // کد موسسه
  servicesCenterCode?: string; // کد مرکز خدمات

  // اطلاعات هویتی
  birthDate?: string; // تاریخ تولد
  birthPlace?: string; // اهل کجاست (محل تولد/صادره)
  fatherName?: string; // نام پدر
  fatherOccupation?: string; // شغل پدر
  fatherJob?: string; // شغل پدر (سازگار با فیلدهای قبلی)
  tammomStatus?: 'معمم' | 'غیر معمم'; // وضعیت تعمم

  // وضعیت تاهل و سکونت
  maritalStatus?: 'مجرد' | 'متاهل';
  childrenCount?: number;
  livingStatus?: 'پدری' | 'خوابگاه' | 'اجاره ای' | 'شخصی' | 'سایر';
  livingStatusOther?: string;

  // سوابق تحصیلی
  classicEducation?: string; // تحصیلات کلاسیک
  howzaEntryYear?: string; // سال ورود به حوزه
  instituteEntryYear?: string; // سال ورود به موسسه
  levelOneSchool?: string; // مدرسه سطح یک

  // وضعیت در سامانه و علت غیرفعال بودن
  deactivationReason?: StudentDeactivationReason;
  deactivationDate?: string;
  deactivationNotes?: string;

  // اطلاعات مالی
  tuitionCode?: string; // کد شهریه
  bankName1?: string; // نام بانک ۱
  bankAccount1?: string; // شماره حساب بانک ۱
  bankSheba1?: string; // شماره شبا حساب شماره ۱
  bankName2?: string; // نام بانک ۲
  bankAccount2?: string; // شماره حساب بانک ۲
  bankSheba2?: string; // شماره شبا حساب شماره ۲

  // سوابق پایه‌ها
  pastGrades?: string[]; // e.g. ['پایه 7', 'پایه 8']

  createdAt: string;
}

export interface Program {
  id: string;
  title: string;
  type: ProgramType;
  day?: string;
  days?: string[]; // List of specific days e.g. ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']
  time?: string;
  startTime?: string;
  endTime?: string;
  teacher?: string;
  madrasRoom?: string; // مَدرَس (کلاس درس)
  classroom?: string;  // مَدرَس (نام یا شناسه کلاس درس)
  grade?: string;      // پایه تحصیلی مربوطه
  capacity?: number;
  notes?: string;
  mentorId?: string;
  parentProgramId?: string; // ID of the main program if type === 'مشاوره'
  representativeStudentIds?: string[]; // شناسه‌های طلاب نماینده کلاس
  representativeNames?: string[]; // نام‌های نمایندگان کلاس
  customRepresentative?: string; // نماینده متفرقه خارج از طلاب
}

export interface ClassSessionAttendance {
  id: string;
  programId: string;
  programTitle: string;
  date: string; // تاریخ شمسی e.g. 1403/07/15
  isCancelled: boolean; // عدم برگزاری کلاس
  cancellationReason?: string;
  notes?: string; // توضیحات و یادداشت‌های کلاس
  recordedByUserId?: string;
  recordedByName?: string;
  records: Record<string, AttendanceStatus>; // studentId -> 'present' | 'absent' | 'late'
  createdAt: string;
  updatedAt: string;
}

export interface MadrasRoom {
  id: string;
  name: string;             // e.g. "مدرس ۱ (شیخ انصاری)"
  code?: string;            // e.g. "M-1"
  capacity?: number;        // ظرفیت به نفر
  floor?: string;           // طبقه یا محل استقرار
  facilities?: string[];    // امکانات مانند ویدئو پروژکتور، وایت‌برد، سیستم صوتی
  description?: string;
  color?: string;           // رنگ شاخص
  isActive: boolean;
  createdAt?: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  programId: string;
}

export interface ResearchRecord {
  id: string;
  studentId: string;
  topic?: string;
  type?: 'individual' | 'group';
  teamMemberIds?: string[];
  stage: string;
  description?: string;
  professorNotes?: string;
  supervisorNotes?: string;
  criticNotes?: string;
  score?: string;
  usages?: string[];
  needsFollowUp?: boolean;
  followUpTodoId?: string;
  updatedAt: string;
}

export interface ResearchHistoryItem {
  id: string;
  studentId: string;
  topic: string;
  type?: 'individual' | 'group';
  stage?: string;
  academicYearOrPeriod?: string;
  description?: string;
  summary?: string;
  score?: string;
  professorNotes?: string;
  supervisorNotes?: string;
  criticNotes?: string;
  usages?: string[];
  archivedAt: string;
  originalRecordSnapshot?: Partial<ResearchRecord>;
}

export interface ResearchSkillDef {
  id: string;
  title: string;
  category?: 'روش و ابزار' | 'نگارش و ویرایش' | 'نرمافزار و دیجیتال' | 'زبان و ترجمه' | 'عمومی';
  description?: string;
  createdAt?: string;
}

export interface StudentResearchSkills {
  id: string;
  studentId: string;
  skillIds: string[];
  customSkills?: string[];
  notes?: string;
  updatedAt: string;
}

export interface ConversationArchive {
  id: string;
  studentId: string;
  summary: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  reason?: string;
}

export interface StudyStat {
  id: string;
  studentId: string;
  date: string;
  studyHours: number;
  discussionHours: number;
}

export interface Todo {
  id: string;
  studentId?: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  isResearchFollowUp?: boolean;
  isStudyFollowUp?: boolean;
  researchRecordId?: string;
  periodId?: string;
  mentorId?: string;
  createdAt?: string;
}

export interface StudyPeriod {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  mandatoryHours: number;
  deadlineDate?: string;
  isClosed?: boolean;
  closedManually?: boolean;
  exemptStudentIds?: string[];
  exemptGrades?: string[];
  targetGrades?: string[];
  warningRule?: 'none' | 'below_mandatory' | 'below_mandatory_and_avg';
  autoWarningGenerated?: boolean;
  mentorId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PeriodicStudyLog {
  id: string;
  periodId: string;
  studentId: string;
  hours: number;
  studyHours?: number;
  discussionHours?: number;
  isExempt?: boolean;
  exemptionReason?: string;
  warningsCount?: number;
  submittedBy?: 'student' | 'education_officer' | 'grade_supervisor' | 'officer';
  lastModifiedAt?: string;
}

export type CommentPriority = 'high' | 'medium' | 'low' | 'info';

export type OralExamSubjectType = 'فقه' | 'اصول' | 'امتحان ورودی' | 'سایر';

export interface OralExam {
  id: string;
  studentId: string;
  title: string;
  subjectType: OralExamSubjectType;
  score: number;
  examinerName: string;
  date: string;
  isRetake: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentComment {
  id: string;
  studentId: string;
  authorName: string;
  category?: 'علمی' | 'اخلاقی' | 'انضباطی' | 'مشاوره' | 'خانوادگی' | 'عمومی';
  content: string;
  priority: CommentPriority;
  date: string;
  needsFollowUp?: boolean;
  followUpTodoId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DiscussionGroup {
  id: string;
  title: string;
  subject?: string;
  grade?: string; // 'پایه ۷' | 'پایه ۸' | 'پایه ۹' | 'پایه ۱۰'
  mentorId?: string; // 'hayati' | 'hosseini' | 'soleimani' | 'asadi' | 'shahpoori'
  programId?: string; // شناسه درس اصلی یا برنامه آموزشی مرتبط
  programTitle?: string; // عنوان درس اصلی یا کلاس متفرقه
  memberStudentIds: string[]; // Active students in this discussion group
  externalMembers?: string[]; // External discussion partners ("سایر" / custom names)
  room?: string; // محل مباحثه (مدرسه، حجره یا کلاس)
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

// Presence & Hours Tracking Types
export interface PresenceHoursLog {
  id: string;
  mentorId?: string;
  date: string; // Shamsi date string, e.g. "1405/06/15"
  startTime?: string; // e.g. "08:00"
  endTime?: string; // e.g. "16:30"
  durationHours: number; // e.g. 8.5
  description?: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PresenceCycleSettings {
  id: string;
  mentorId?: string;
  startShamsiDate: string;
  endShamsiDate: string;
  title?: string;
}

// Academic Calendar Types
export type ThursdayMode = 'special_program' | 'main_class' | 'off';

export interface ThursdayRangeSetting {
  id: string;
  startDate: string; // Shamsi YYYY/MM/DD
  endDate: string; // Shamsi YYYY/MM/DD
  mode: ThursdayMode; // 'main_class' (کلاس درس اصلی) | 'special_program' (برنامه ویژه / حضور غیردرسی) | 'off' (تعطیل)
  title?: string;
}

export interface ThursdayOverride {
  dateStr: string; // Shamsi YYYY/MM/DD
  mode: ThursdayMode; // 'special_program' | 'main_class' | 'off'
  title?: string; // Optional custom name e.g. "برنامه ویژه اخلاق", "تدریس جبرانی اصول"
  description?: string;
}

export interface AcademicCalendarPeriod {
  id: string;
  title: string; // e.g., "سال تحصیلی ۱۴۰۵-۱۴۰۶"
  startDate: string; // Shamsi YYYY/MM/DD e.g. "1405/06/15"
  endDate: string; // Shamsi YYYY/MM/DD e.g. "1406/03/20"
  description?: string;
  defaultThursdayMode?: ThursdayMode; // Fallback mode if no range matches (default: 'off')
  thursdayRanges?: ThursdayRangeSetting[]; // Range-based rules for Thursday modes
  thursdayOverrides?: Record<string, ThursdayOverride>; // Single-day overrides (dateStr -> ThursdayOverride)
  includeThursdayAsStudyDay?: boolean; // legacy compatibility
  includeFridayAsStudyDay: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicHolidayType {
  id: string;
  name: string; // e.g. "تعطیلی رسمی", "تعطیلی مناسبتی", "تعطیلی تبلیغی"
  color: string; // Hex or Tailwind color token
  isSystemDefault?: boolean;
}

export interface AcademicHolidayItem {
  id: string;
  periodId: string;
  title: string;
  typeId: string;
  typeName: string;
  startDate: string; // Shamsi YYYY/MM/DD
  endDate: string; // Shamsi YYYY/MM/DD
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicSubPeriod {
  id: string;
  periodId: string;
  title: string; // e.g. "هفته پژوهش", "دوره مهارتی و کارگاه‌ها"
  startDate: string; // Shamsi YYYY/MM/DD
  endDate: string; // Shamsi YYYY/MM/DD
  isAcademicPresence: boolean; // آیا حضور تحصیلی محسوب می‌شود؟ (default: true)
  isStandardClassDay: boolean; // آیا کلاس درس اصلی سرفصل برگزار می‌شود؟ (default: false)
  targetGrades?: string[]; // شناسه‌های پایه‌های هدف مثلاً ['پایه ۷'] یا خالی برای عمومی
  grade?: string; // 'عمومی' | 'پایه ۷' | 'پایه ۸' | 'پایه ۹' | 'پایه ۱۰' | 'سایر'
  isPublic?: boolean; // آیا دوره به صورت عمومی برای تمام پایه‌هاست؟ (پیش‌فرض: true)
  description?: string;
  color?: string; // e.g. "violet", "purple", "indigo", "amber", "sky"
  createdAt: string;
  updatedAt?: string;
}

export type WeekDayName = 'شنبه' | 'یکشنبه' | 'دوشنبه' | 'سه‌شنبه' | 'چهارشنبه' | 'پنج‌شنبه' | 'جمعه';

export interface AcademicWeeklyProgram {
  id: string;
  periodId: string;
  title: string; // e.g., "برنامه کارگاه پژوهش", "جلسه اخلاق هفتگی", "همایش تخصصی"
  scheduleType?: 'recurring' | 'custom_dates'; // 'recurring' (weekly) or 'custom_dates' (irregular specific dates)
  dayOfWeek?: string; // e.g. "دوشنبه" or "شنبه، چهارشنبه" (kept for legacy/display compatibility)
  daysOfWeek?: WeekDayName[]; // Multi-day selection e.g. ['دوشنبه', 'چهارشنبه']
  specificDates?: string[]; // List of YYYY/MM/DD dates for irregular custom schedules
  startDate: string; // Shamsi YYYY/MM/DD (defaults to period startDate)
  endDate: string; // Shamsi YYYY/MM/DD (defaults to period endDate)
  time?: string; // e.g. "10:00 تا 11:30"
  locationOrTeacher?: string; // e.g. "سالن اجتماعات / استاد حسینی"
  targetGrades?: string[]; // شناسه‌های پایه‌های هدف مثلاً ['پایه ۷'] یا خالی برای عمومی
  grade?: string; // 'عمومی' | 'پایه ۷' | 'پایه ۸' | 'پایه ۹' | 'پایه ۱۰' | 'سایر'
  isPublic?: boolean; // آیا برنامه به صورت عمومی برای تمام پایه‌هاست؟ (پیش‌فرض: true)
  description?: string;
  customCancelledDates?: string[]; // List of YYYY/MM/DD specific dates manually cancelled for this program
  color?: string; // 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'sky' | 'violet'
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicCalendarExportPackage {
  _meta: {
    system: 'TOLAB_ACADEMIC_CALENDAR';
    version: string;
    exportDate: string;
    totalPeriods: number;
    totalHolidays: number;
    totalHolidayTypes: number;
    totalSubPeriods?: number;
    totalWeeklyPrograms?: number;
  };
  periods: AcademicCalendarPeriod[];
  holidays: AcademicHolidayItem[];
  holidayTypes: AcademicHolidayType[];
  subPeriods?: AcademicSubPeriod[];
  weeklyPrograms?: AcademicWeeklyProgram[];
}

export type TeacherCategory = 
  | 'فقه'
  | 'اصول'
  | 'فلسفه'
  | 'مشاوره اصول'
  | 'مشاوره فقه'
  | 'مشاوره فلسفه'
  | 'دروس پنجشنبه'
  | 'ویژه';

export interface TeacherDetailedSpecialties {
  usul?: ('رسائل' | 'کفایه' | 'حلقات')[];
  fiqh?: ('مکاسب')[];
  falsafa?: ('بدایه' | 'نهایه' | 'آموزش فلسفه')[];
  thursdayNote?: string;
}

export interface Teacher {
  id: string;
  fullName: string;
  phoneNumber?: string;
  photoUrl?: string;
  categories: TeacherCategory[];
  detailedSpecialties?: TeacherDetailedSpecialties;
  notes?: string;
  experienceHistory?: string;
  priority: 1 | 2 | 3 | '1' | '2' | '3';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

// -------------------------------------------------------------
// Authentication & 3-Tier RBAC Types (SRS 2.0 Compliant)
// -------------------------------------------------------------

export type UserLevel = 1 | 2 | 3;

export type UserRole = 
  // Level 1
  | 'super_admin'            // سوپر ادمین (دسترسی کامل + مدیریت کاربران و اختیارات)
  | 'school_manager'          // مدیر مدرسه / معاون
  | 'manager_principal'       // مدیر مدرسه (مشاهده کامل بدون ویرایش)
  | 'vice_principal'          // معاون مدرسه (مشاهده کامل بدون ویرایش)
  // Level 2
  | 'education_manager'       // مسئول آموزش
  | 'education_officer'       // مسئول آموزش
  | 'research_manager'        // مسئول پژوهش
  | 'research_officer'        // مسئول پژوهش
  | 'grade_supervisor_7'      // مسئول پایه ۷
  | 'grade_supervisor_8'      // مسئول پایه ۸
  | 'grade_supervisor_9'      // مسئول پایه ۹
  | 'grade_supervisor_10'     // مسئول پایه ۱۰
  | 'grade_mentor'            // مسئول پایه
  | 'grade_supervisor'        // مسئول پایه (۷، ۸، ۹، ۱۰)
  | 'finance_manager'         // مسئول مالی
  | 'financial_officer'       // مسئول مالی
  // Level 3
  | 'class_representative'    // نماینده کلاس (ثبت حضور و غیاب، مشاهده برنامه و مباحثات)
  | 'student'                 // طلبه / دانشجو (مشاهده پرونده، حضور، مطالعه و برنامه شخصی)
  | 'custom';                 // سفارشی

export type AppModuleId =
  | 'todos'
  | 'workflow'
  | 'academic-calendar'
  | 'presence-hours'
  | 'students'
  | 'active-students'
  | 'programs'
  | 'classrooms'
  | 'student-schedule'
  | 'teachers-schedule'
  | 'consultation-advisor'
  | 'stats'
  | 'discussion'
  | 'research'
  | 'attendance'
  | 'oral-exams'
  | 'comments'
  | 'summary'
  | 'teachers-bank'
  | 'manager-files'
  | 'backup'
  | 'user-management'
  | 'user-credentials'
  | 'student-portal';

export interface ProposedConsultationClass {
  id: string;
  name: string;
  day: string;
  days?: string[]; // دو روز تشکیل در هفته
  startTime: string;
  endTime: string;
  room?: string;
  advisorName?: string;
  assignedStudentIds: string[];
  discussionGroupNames: string[];
}

export interface ConsultationAdvisorProposal {
  id: string;
  mainProgramId: string;
  mainProgramTitle: string;
  grade: string;
  totalEnrolledCount: number;
  classesCount: number;
  minCapacity: number;
  maxCapacity: number;
  selectedDays?: string[];
  priority1Time?: { start: string; end: string };
  priority2Time?: { start: string; end: string };
  activePriorityUsed?: 1 | 2;
  classes: ProposedConsultationClass[];
  unassignedStudentIds: string[];
  unassignedReasons: Record<string, string>;
  createdAt: string;
  createdByUserName?: string;
}

// -------------------------------------------------------------
// Workflow & Task Approvals Types (جریان کار و کارتابل تاییدات)
// -------------------------------------------------------------

export type WorkflowItemType = 
  | 'notice'          // صرفاً اطلاع‌رسانی رخدادهای مهم
  | 'report_notice'   // اطلاع‌رسانی همراه با گزینه‌های گزارش‌گیری
  | 'approval';       // نیاز به بررسی و تایید نهایی مسئول مربوطه

export type WorkflowCategory = 
  | 'study_period'                // دوره مطالعاتی (باز شدن / بسته شدن)
  | 'unexcused_absence_warning'  // اخطار غیبت غیر موجه
  | 'study_deficit_warning'       // اخطار ساعت مطالعه و مباحثه
  | 'student_account_creation'    // ایجاد حساب کاربری برای طلبه جدید
  | 'discussion_group_change'     // درخواست ثبت یا ویرایش گروه مباحثه طلبه
  | 'general';                    // اطلاعیه یا اقدام عمومی

export type WorkflowStatus = 
  | 'pending'         // در انتظار اقدام / تایید
  | 'approved'        // تایید نهایی شده
  | 'rejected'        // رد شده / تایید نشده
  | 'acknowledged';   // مشاهده و بررسی شده (برای اطلاع‌رسانی‌ها)

export interface WorkflowReportAction {
  label: string;
  tabTarget: AppModuleId;
  description?: string;
  filterParams?: Record<string, any>;
}

export interface WorkflowItem {
  id: string;
  type: WorkflowItemType;
  category: WorkflowCategory;
  title: string;
  description: string;
  status: WorkflowStatus;
  grade?: string;                 // e.g. "پایه ۷", "پایه ۸", "همه پایه‌ها"
  studentId?: string;
  studentName?: string;
  nationalId?: string;
  periodId?: string;
  periodTitle?: string;
  dateRange?: string;             // e.g. "۱۴۰۳/۰۷/۰۱ تا ۱۴۰۳/۰۷/۱۵"
  details?: Record<string, any>;  // داده‌های جزئی مانند تعداد غیبت‌ها، میزان کسری ساعت و ...
  requiresEducationApproval: boolean;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  approvalNotes?: string;
  reportAction?: WorkflowReportAction;
  targetRoles?: UserRole[];
  targetLevels?: UserLevel[];
  targetGrades?: string[];
  readByUserIds?: string[];
  createdByUserId?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkflowSettings {
  id: string;
  requireEducationApprovalForAttendanceWarning: boolean; // آیا ثبت نهایی اخطار غیبت منوط به تایید مسئول آموزش باشد؟
  requireEducationApprovalForStudyWarning: boolean;      // آیا ثبت قطعی اخطار ساعت مطالعه منوط به تایید مسئول آموزش باشد؟
  requireAccountCreationPrompt: boolean;                  // یادآوری و تایید ایجاد نام کاربری برای طلاب جدید
  notifyGradeSupervisorOnWarning: boolean;               // اطلاع‌رسانی به مسئول پایه در زمان ثبت اخطار
  notifyOnStudyPeriodOpened: boolean;                    // اطلاع‌رسانی هنگام باز شدن دوره مطالعاتی جدید
  notifyOnStudyPeriodClosed: boolean;                    // اطلاع‌رسانی هنگام بسته شدن دوره مطالعه
  updatedAt?: string;
  updatedBy?: string;
}

export interface TeacherManualSchedule {
  id: string;
  teacherId?: string;
  teacherName: string;
  title: string;
  grade?: string;
  days: string[];
  day?: string;
  time: string;
  startTime?: string;
  endTime?: string;
  madrasRoom?: string;
  notes?: string;
  createdAt: string;
}

export type UserScope = 'global' | 'grade_7' | 'grade_8' | 'grade_9' | 'grade_10' | 'class' | 'self';

export interface AppUser {
  id: string;
  username: string; // e.g., 'SADEGH', 'RAHNAMA', 'SHAH', 'YAZDANI', 'HAYATI', 'HO', 'SOL', 'ASADI', 'JALILI', 'SARLAK'
  password: string; // Plain/hashed in local DB
  fullName: string;
  level: UserLevel; // 1 | 2 | 3
  role: UserRole;
  roleTitle: string; // e.g. "سوپر ادمین", "مدیر مدرسه", "مسئول آموزش", "مسئول پایه ۷", "نماینده کلاس", "طلبه"
  scope: UserScope;
  gradeLabel?: string; // e.g. "پایه ۷", "پایه ۸", "کل پایه‌ها"
  linkedStudentId?: string; // For Level 3 student or class rep
  isReadOnly?: boolean; // If true, can view all authorized tabs but cannot create/edit/delete
  isActive: boolean;
  avatarBg?: string;
  allowedModules?: AppModuleId[]; // If specified, overrides default role menu
  modulePermissions?: Partial<Record<AppModuleId, 'none' | 'view' | 'edit'>>;
  createdAt: string;
  updatedAt?: string;
}

