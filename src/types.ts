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
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'unspecified';

export interface AttendanceJustification {
  isExcused: boolean;
  reason?: string;
  justifiedBy?: string;
  justifiedAt?: string;
}

export interface StudentAttendanceDetail {
  studentId: string;
  studentName: string;
  nationalId?: string;
  status: AttendanceStatus;
  note?: string;
  lateMinutes?: number;
  isExcused?: boolean;
  excuseReason?: string;
  hasEducationalWarning?: boolean;
  warningRegisteredBy?: string;
  warningRegisteredAt?: string;
}

export interface AttendanceSessionLog {
  id: string; // `${programId}_${date}`
  programId: string;
  programTitle: string;
  grade?: string;
  date: string; // Shamsi YYYY/MM/DD
  dayOfWeek: string;
  isCancelled: boolean;
  cancellationReason?: string;
  // حضور استاد جایگزین
  hasSubstituteTeacher?: boolean; // آیا استاد جایگزین حضور داشته است؟
  substituteTeacherId?: string; // شناسه استاد جایگزین از بانک اساتید
  substituteTeacherName?: string; // نام استاد جایگزین (انتخابی یا دستی)
  substituteTeacherNotes?: string; // توضیحات استاد جایگزین
  notes?: string;
  recordedByUserId?: string;
  recordedByName?: string;
  recordedAt: string;
  students: StudentAttendanceDetail[];
}

export interface AttendanceSettings {
  id: string;
  representativeEditWindowDays: number; // default: 7
  unspecifiedCountAs: 'unspecified' | 'absent' | 'present' | 'late'; // in reporting
  unexcusedWarningThreshold?: number; // حد نصاب اخطار آموزشی غیبت (پیش‌فرض: ۳ جلسه)
  allowGradeProfessorSettingsEdit?: boolean; // آیا اساتید پایه می‌توانند تنظیمات حضور غیاب را تغییر دهند؟
  allowGradeProfessorAttendanceEdit?: boolean; // تعیین توسط مسئول آموزش: آیا اساتید پایه می‌توانند حضور و غیاب را ویرایش کنند یا فقط ببینند؟
  updatedAt?: string;
  updatedBy?: string;
}

export interface StudyTier {
  id: string;
  stepNumber: number; // پله ۱ تا ۵
  minMinutes: number; // از چند دقیقه مازاد/کسری
  maxMinutes: number; // تا چند دقیقه مازاد/کسری
  amount: number; // مبلغ این پله (تومان)
}

export interface TuitionCalculationSettings {
  id: string;
  // شهریه پایه
  isBaseTuitionEqualForMarried?: boolean; // آیا شهریه پایه متاهلین و مجردین یکسان است؟
  singleBaseTuition?: number; // شهریه پایه مجردین (تومان)
  baseSingleTuition?: number; // سازگار با نگارش فارسی
  marriedBaseTuition?: number; // شهریه پایه متاهلین (تومان)
  baseMarriedTuition?: number; // سازگار با نگارش فارسی
  
  // تاهل و اولاد و معمم بودن و مسکن (با پرسش اولیه آیا افزایش دارد یا خیر)
  hasMarriageBonus?: boolean; // آیا تاهل سبب افزایش شهریه می‌شود؟
  marriageBonusType?: 'percentage' | 'fixed'; // نوع افزایش تاهل: درصدی یا تومانی
  marriageBonusAmount?: number; // مبلغ تومانی اضافه برای تاهل
  marriageBonusPercent?: number; // درصد اضافه برای تاهل

  hasChildAllowance?: boolean; // آیا حق اولاد داریم یا نه؟
  childAllowance?: number; // مبلغ به ازای هر فرزند (تومان)
  childAllowancePerChild?: number;

  hasTurbanAllowance?: boolean; // آیا پاداش تلبس و معمم بودن داریم یا نه؟
  turbanAllowance?: number; // پاداش معمم بودن (تومان)
  clericalHabitBonus?: number;

  hasHousingAllowance?: boolean; // آیا کمک هزینه مسکن داریم یا نه؟
  housingAllowanceRented?: number; // کمک هزینه مسکن اجاره‌ای (تومان)
  housingAllowanceDorm?: number; // کمک هزینه خوابگاه (تومان)
  housingSubsidy?: number;

  // مطالعه: پاداش افزایش شهریه
  studyBonusEnabled?: boolean; // آیا مطالعه بیشتر سبب افزایش شهریه شود؟
  studyBonusBase?: 'mandatory' | 'average'; // مبنای محاسبه: نسبت با میانگین یا موظفی به طور مستقل
  studyBonusTiered?: boolean; // آیا پله‌ای محاسبه شود؟
  studyBonusTiers?: StudyTier[]; // تا ۵ پله تعریف پاداش مطالعه
  studyBonusThresholdMinutes?: number; // چند دقیقه بالاتر از مبنا؟
  studyBonusCalculationType?: 'per_hour' | 'fixed'; // در صورت غیر پله‌ای بودن: به ازای هر ساعت یا عدد ثابت
  studyBonusPerHour?: number; // پاداش به ازای هر ساعت مطالعه مازاد
  studyBonusRatePerHour?: number;
  studyBonusFixedAmount?: number; // مبلغ پاداش ثابت ساعت مطالعه

  // مطالعه: جریمه و کاهش شهریه
  studyPenaltyEnabled?: boolean; // آیا مطالعه کمتر سبب کاهش شهریه شود؟
  studyPenaltyBase?: 'mandatory' | 'average'; // مبنای محاسبه: نسبت با میانگین یا موظفی به طور مستقل
  studyPenaltyTiered?: boolean; // آیا پله‌ای محاسبه شود؟
  studyPenaltyTiers?: StudyTier[]; // تا ۵ پله تعریف جریمه مطالعه
  studyPenaltyThreshold?: 'below_mandatory' | 'below_average' | 'both';
  studyPenaltyCalculationType?: 'per_hour' | 'fixed'; // نوع کاهش غیرپله‌ای: متناسب با هر ساعت کسری یا عدد ثابت
  studyPenaltyPerHour?: number; // جریمه کسری ساعت مطالعه به ازای هر ساعت
  studyPenaltyRatePerHour?: number;
  studyPenaltyFixedAmount?: number; // مبلغ جریمه ثابت کسری مطالعه

  // حضور و غیاب
  absenceDeductionEnabled?: boolean; // آیا بخش غیبت‌ها موجب کسر از شهریه شود؟
  absenceDeductionMode?: 'unexcused_only' | 'both_different'; // فقط غیرموجه یا هر دو با نرخ متفاوت
  absencePenaltyUnexcusedType?: 'fixed' | 'percentage'; // کسر تومانی یا درصدی
  absencePenaltyPerSession?: number; // جریمه هر جلسه غیبت غیرموجه (تومان)
  absencePenaltyUnexcusedAmount?: number;
  absencePenaltyUnexcusedPercent?: number;
  absencePenaltyExcusedAmount?: number; // کسر به ازای غیبت موجه (تومان)

  // ارزیابی مشاوره‌ها
  counselingGradeABonus?: number; // پاداش هر نمره الف کلاس مشاوره (تومان) - مثلاً ۳۰,۰۰۰
  counselingGradeBBonus?: number; // پاداش هر نمره ب کلاس مشاوره (تومان)
  counselingGradeCBonus?: number; // پاداش هر نمره ج کلاس مشاوره (تومان)
  counselingBonusPerWorkshop?: number;

  // نهار و شام
  lunchCostPerDay?: number; // کسر هزینه هر روز استفاده از نهار (تومان)
  dailyLunchCost?: number;
  dinnerCostPerDay?: number; // کسر هزینه هر روز استفاده از شام (تومان)
  dailyDinnerCost?: number;

  // وام و صندوق قرض‌الحسنه
  deductActiveLoans?: boolean; // آیا وام‌های فعالی که قرار است از شهریه کسر شود اعمال شود یا نه؟
  defaultLoanInstallment?: number;
  deductFundContribution?: boolean; // آیا کمک مالی به صندوق اعمال شود یا خیر؟
  defaultFundContribution?: number;

  // مطالبات و بدهی‌ها (کسورات نوع دوم)
  deductClaims?: boolean; // آیا مطالبات و بدهی‌های طلاب به صورت خودکار از شهریه کسر شود؟
  enabledClaimCategoryIds?: string[]; // شناسه‌های عناوینی از بانک بدهی‌ها که برای کسر در این دوره تیک خورده‌اند

  // اعمال تشویقی عمومی ماهانه برای همه طلاب (مبلغ ثابت یا درصدی)
  enableGeneralIncentive?: boolean; // فعال‌سازی تشویقی ماهانه برای همه طلاب
  generalIncentiveType?: 'fixed' | 'percentage'; // مبلغ ثابت یا درصد از شهریه پایه
  generalIncentiveAmount?: number; // مبلغ تشویقی به تومان
  generalIncentivePercent?: number; // درصد تشویقی
  generalIncentiveTitle?: string; // عنوان تشویقی (مثلاً تشویقی مناسبتی یا پاداش پایان ترم)

  updatedAt: string;
  updatedBy?: string;
}

export interface StudentFinancialProfile {
  studentId: string;
  studentName: string;
  nationalId?: string;
  grade?: string;
  maritalStatus?: 'مجرد' | 'متاهل';
  isMarried?: boolean;
  childrenCount?: number;
  livingStatus?: 'پدری' | 'خوابگاه' | 'اجاره ای' | 'شخصی' | 'سایر';
  hasHousingSubsidy?: boolean;
  isTammam?: boolean; // معمم
  isRobed?: boolean;
  currentBalance?: number; // تراز مالی فعلی (تومان)
  lunchDaysCount?: number; // تعداد روزهای استفاده از نهار
  monthlyLunchDays?: number;
  dinnerDaysCount?: number; // تعداد روزهای استفاده از شام
  monthlyDinnerDays?: number;
  activeLoanTotal?: number; // کل مبلغ وام فعال
  monthlyLoanInstallment?: number; // قسط ماهانه کسر از شهریه
  activeLoanInstallment?: number;
  fundContributionMonthly?: number; // مبلغ ماهانه کمک به صندوق
  fundContribution?: number; // سازگار با نگارش سریع
  studyHoursLogged?: number;
  counselingWorkshopsAttended?: number; // تعداد کارگاه‌ها / جلسات مشاوره
  unexcusedAbsences?: number;
  counselingScoreA?: number;
  counselingScoreB?: number;
  isBlockedFromTuition?: boolean;
  bankAccount?: string;
  bankSheba?: string;
  manualAdjustmentAmount?: number; // مبلغ تعدیل دستی (افزایش مثبت، کاهش منفی)
  manualAdjustmentReason?: string; // علت ثبت تعدیل دستی
  notes?: string;
  updatedAt?: string;
}

export interface TuitionCalculationBreakdown {
  studentId: string;
  studentName: string;
  nationalId?: string;
  instituteCode?: string;
  phoneNumber?: string;
  grade?: string;
  periodTitle?: string;
  maritalStatus?: 'مجرد' | 'متاهل';
  childrenCount?: number;
  livingStatus?: string;
  isTammam?: boolean;
  bankAccount?: string;
  bankSheba?: string;
  tuitionCode?: string;
  baseTuition?: number;
  baseAmount?: number;
  maritalBonus?: number;
  childAllowanceTotal?: number;
  childAllowance?: number;
  turbanAllowance?: number;
  robedBonus?: number;
  housingAllowance?: number;
  studyMinutesTotal?: number;
  studyRequiredMinutes?: number;
  studyDiffMinutes?: number;
  isAboveStudyRequired?: boolean;
  isAboveStudyAverage?: boolean;
  studyWarningIssued?: boolean;
  studyBonusAmount?: number;
  studyBonus?: number;
  studyPenaltyAmount?: number;
  totalPresentSessions?: number;
  totalAbsentSessions?: number;
  totalExcusedAbsences?: number;
  unexcusedAbsenceCount?: number;
  excusedAbsenceCount?: number;
  totalLateSessions?: number;
  totalUnspecifiedSessions?: number;
  totalEducationalWarnings?: number;
  absencePenaltyAmount?: number;
  absenceDeduction?: number;
  counselingGradeACount?: number;
  counselingGradeBCount?: number;
  counselingGradeCCount?: number;
  counselingGradeDCount?: number;
  counselingBonusAmount?: number;
  lunchDaysCount?: number;
  lunchDeductionAmount?: number;
  lunchDeduction?: number;
  dinnerDaysCount?: number;
  dinnerDeductionAmount?: number;
  dinnerDeduction?: number;
  totalMealDeduction?: number;
  loanInstallmentDeduction?: number;
  loanDeduction?: number;
  fundContributionDeduction?: number;
  fundDeduction?: number;
  // مطالبات کسر شده (کسورات نوع دوم)
  claimsDeductions?: Array<{
    claimId: string;
    title: string;
    amount: number;
    destinationAccountId: string;
    destinationTitle: string;
    bankInfo?: string;
  }>;
  claimsTotalDeduction?: number;
  generalIncentiveAmount?: number; // پاداش تشویقی عمومی ماهانه
  generalIncentiveTitle?: string;
  lunchMealsFromModule?: boolean; // آیا آمار نهار مستقیماً از ماژول نهار استخراج شده
  lunchSubsidyDiscount?: number;
  // تعدیل دستی امور مالی
  manualAdjustmentAmount?: number; // مبلغ افزایش (+) یا کاهش (-) دستی
  manualAdjustmentReason?: string; // علت افزایش یا کاهش دستی
  // تعدیل ارسالی مسئول آموزش
  educationAdjustmentAmount?: number; // مبلغ تعدیل ارسالی از طرف مسئول آموزش
  educationAdjustmentReason?: string; // علت تعدیل ارسالی آموزش
  educationAdjustmentApplied?: boolean; // آیا تعدیل آموزش تایید و اعمال شده است
  totalAdditions?: number;
  totalEarnings?: number;
  totalDeductions?: number;
  // تفکیک ساختاری کسورات نوع اول و نوع دوم (مطابق فاکتور بالادستی)
  type1DeductionsTotal?: number; // کسورات نوع ۱ (غیبت، مطالعه و...) که از شهریه کسر و تمام می‌شود
  grossEarnedTuition?: number; // شهریه ناخالص / استحقاقی ارسالی به بالادستی (پایه + افزایش‌ها - کسورات نوع ۱)
  type2DeductionsTotal?: number; // کسورات نوع ۲ (نهار، وام، صندوق، عتبات، مطالبات) که به حساب‌های مقصد واریز می‌شوند
  kitchenTransferAmount?: number; // سهم واریز به حساب آشپزخانه (نهار و شام)
  culturalTransferAmount?: number; // سهم واریز به امور فرهنگی (عتبات، اردوها و...)
  qardFundTransferAmount?: number; // سهم واریز به صندوق قرض‌الحسنه (وام و پس‌انداز ماهانه)
  otherTransferAmount?: number; // سهم واریز به سایر حساب‌های مقصد
  netPayableTuition?: number; // مبلغ خالص قابل پرداخت به طلبه (grossEarnedTuition - type2DeductionsTotal)
  netPayable?: number;
}

// آیتم‌های گزارش مالی ارسالی مسئول آموزش برای هر طلبه
export interface EducationFinancialItem {
  studentId: string;
  studentName: string;
  nationalId?: string;
  grade?: string;
  type: 'increase' | 'decrease' | 'none'; // افزایش، کاهش یا بدون تغییر
  amount: number; // مبلغ به تومان (مثبت)
  reason: string; // علت افزایش یا کاهش
}

// گزارش مالی ارسالی آموزش به امور مالی
export interface EducationFinancialReport {
  id: string;
  title: string; // عنوان گزارش (مثلاً گزارش تشویقی و کسورات آموزشی مهرماه ۱۴۰۳)
  month: string; // ماه مربوطه (مثلاً مهر ۱۴۰۳)
  senderUserId?: string;
  senderUserName: string;
  senderRoleTitle: string;
  status: 'sent' | 'reviewed' | 'applied' | 'rejected'; // ارسال شده / بررسی شده / اعمال شده / رد شده
  items: EducationFinancialItem[];
  notes?: string;
  createdAt: string;
  appliedAt?: string;
  appliedByName?: string;
}

export interface TuitionPeriod {
  id: string;
  title: string; // e.g. "شهریه مهر ماه ۱۴۰۳"
  startDate: string; // Shamsi YYYY/MM/DD
  endDate: string; // Shamsi YYYY/MM/DD
  status: 'draft' | 'finalized' | 'paid';
  totalStudentsCalculated: number;
  totalPayoutAmount: number;
  calculations: TuitionCalculationBreakdown[];
  createdAt: string;
  createdByName?: string;
  finalizedAt?: string;
  finalizedByName?: string;
}

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
  activeDepositAccount?: 'account1' | 'account2' | 'both'; // حساب فعال جهت واریز شهریه (پیش‌فرض حساب اول)

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
  enrollmentDate?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
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

export interface ReceivedArticle {
  id: string;
  studentId: string;
  studentName: string;
  studentGrade?: string;
  title: string;
  summary?: string;
  type?: 'individual' | 'group';
  deliveryYear?: string;
  pageCount?: number | string;
  evaluationScores?: string;
  evaluatorComments?: string;
  isCompleted?: boolean;
  source?: 'auto_completed' | 'manual';
  createdAt?: string;
  updatedAt?: string;
}

export interface ArticleEvaluationSession {
  id: string;
  articleId?: string;
  title: string;
  presenterStudentId?: string;
  presenterName: string;
  studentGrade?: string;
  refereeCount: number; // تعداد داور
  criticCount: number;  // تعداد ناقد
  allowedRoleRegistration: 'critic' | 'referee' | 'both';
  hasAbstract: boolean;
  abstractText?: string;
  hasDownloadLink: boolean;
  downloadUrl?: string;
  status: 'active' | 'completed' | 'archived';
  approvedCriticStudentIds?: string[];
  approvedRefereeStudentIds?: string[];
  createdAt: string;
}

export interface EvaluationRequest {
  id: string;
  type: 'evaluation_request' | 'role_registration';
  studentId: string;
  studentName: string;
  studentGrade?: string;
  articleId?: string;
  articleTitle: string;
  requestedRole?: 'critic' | 'referee';
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
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

export interface TodoCategory {
  id: string;
  userId: string;
  name: string;
  color?: string;
  createdAt: string;
}

export interface PersonalTodo {
  id: string;
  userId: string;
  userName?: string;
  title: string;
  description?: string;
  category: string;
  completed: boolean;
  completedAt?: string;
  archived?: boolean;
  archivedAt?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AssignedTodo {
  id: string;
  senderUserId: string;
  senderUserName: string;
  senderRoleTitle: string;
  recipientUserId: string;
  recipientUserName: string;
  recipientRoleTitle: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  status: 'pending' | 'completed';
  completedAt?: string;
  completionNote?: string;
  archivedBySender?: boolean;
  archivedByRecipient?: boolean;
  createdAt: string;
  updatedAt?: string;
}

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

export interface PresenceReport {
  id: string;
  senderUserId: string;
  senderUserName: string;
  senderRoleTitle: string;
  mentorId: string;
  cycleTitle: string;
  cycleStart: string;
  cycleEnd: string;
  totalHours: number;
  logsCount: number;
  status: 'submitted' | 'received' | 'approved';
  submittedAt: string;
  receivedAt?: string;
  receivedByUserId?: string;
  receivedByUserName?: string;
  isApprovedByFinance?: boolean;
  approvedAt?: string;
  approvedByName?: string;
  isUsedAsBasis?: boolean;
  usedInPeriodTitle?: string;
  teacherName?: string;
  grade?: string;
  dateRange?: string;
  notes?: string;
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
  name?: string; // alias for display
  nationalId?: string; // کد ملی
  teacherCode?: string; // کد استادی
  phoneNumber?: string;
  phone?: string; // alias
  subjectSpecialty?: string; // تخصص اصلی
  courses?: string[]; // عناوین دروس تدریسی
  managedGrades?: string[]; // پایه‌های تحت اشراف
  photoUrl?: string;
  categories: TeacherCategory[];
  detailedSpecialties?: TeacherDetailedSpecialties;
  notes?: string;
  experienceHistory?: string;
  bankName?: string; // نام بانک
  bankAccount?: string; // شماره حساب
  bankSheba?: string; // شماره شبا
  priority: 1 | 2 | 3 | '1' | '2' | '3';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

// -------------------------------------------------------------
// Driver & Teacher Transport Types (سرویس اساتید)
// -------------------------------------------------------------

export interface DriverInfo {
  id: string;
  fullName: string;
  name?: string;
  phoneNumber?: string;
  phone?: string;
  carModel?: string;
  plateNumber?: string;
  carPlate?: string;
  isActive?: boolean;
  notes?: string;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  fullName: string;
  staffCode?: string; // کد پرسنلی / شناسه
  nationalId?: string; // کد ملی
  roleTitle: string; // سمت / عنوان شغلی (مثلاً مسئول آشپزخانه، خادم، انباردار، راننده، مسئول دفتر)
  phoneNumber?: string; // شماره تماس
  bankName?: string;
  bankAccount?: string;
  bankSheba?: string;
  monthlySalary?: number; // حقوق پرداختی (تومان)
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TeacherTransportSchedule {
  id: string;
  teacherId: string;
  teacherName: string;
  date?: string;
  dayOfWeek?: string;
  days?: string[];
  pickupTime?: string;
  returnTime?: string;
  timeSchedule?: string;
  routeDescription?: string;
  serviceNeedType?: 'arrival_departure' | 'arrival_only' | 'departure_only' | 'custom';
  driverId?: string;
  driverName?: string;
  cost?: number;
  notes?: string;
  isEducationApproved?: boolean;
  isApprovedByEducation?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  approvedByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LegacyTeacherCompensationSettings {
  id: string;
  // آیا نرخ یکسان است یا تفکیکی؟
  rateMode: 'uniform' | 'separate'; // uniform: یکسان | separate: تفکیکی
  uniformHourlyRate: number; // نرخ ساعتی یکسان (تومان)
  mainClassRate: number; // نرخ درس اصلی (تومان)
  counselingResearchRate: number; // نرخ مشاوره و پژوهش (تومان)
  thursdayClassRate: number; // نرخ درس پنج‌شنبه (تومان)

  // تعرفه نهار استاد
  teacherMealCostPerMeal: number; // هزینه نهار استاد به ازای هر وعده (تومان)

  // هزینه سرویس اساتید
  enableTransportFee: boolean; // آیا هزینه سرویس اعمال شود؟
  transportCalculationMode: 'single_trip' | 'double_trip'; // ۱ هزینه یا ۲ هزینه
  transportRatePerTrip: number; // مبلغ هزینه هر بار سرویس (تومان)

  // کسورات (وام و صندوق)
  enableDeductions: boolean; // اعمال کسورات و وام‌ها
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
  | 'finance'
  | 'finance-tuition'
  | 'finance-grade-mentors'
  | 'finance-teachers'
  | 'finance-lunch'
  | 'finance-claims'
  | 'finance-loans-fund'
  | 'finance-expenses-reports'
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
  | 'backup'
  | 'user-management'
  | 'user-credentials'
  | 'student-portal'
  | 'student-meals'
  | 'audit-logs'
  | 'education-financial-report'
  | 'counseling-classes'
  | 'course-selection'
  | 'article-evaluations'
  | 'teacher-transport'
  | 'staff-bank';

export type CounselingScore = 'الف' | 'ب' | 'ج' | 'د' | 'غیبت';

export interface CourseSelectionPeriod {
  id: string;
  title: string;
  academicYear?: string;
  term?: string;
  allowedProgramTypes: ProgramType[];
  allowedGrades: string[]; // e.g. ['پایه ۷', 'پایه ۸'] or ['همه پایه‌ها']
  customStudentIds?: string[]; // لیست آی‌دی طلاب اضافه شده به صورت دستی
  customIncludedProgramIds?: string[]; // لیست آی‌دی دروس اضافه شده به صورت دستی
  customExcludedProgramIds?: string[]; // لیست آی‌دی دروس حذف شده به صورت دستی
  allowCrossGradeSelection?: boolean; // اجازه انتخاب درس از سایر پایه‌ها (پیش‌فرض: true)
  startDate: string; // Shamsi YYYY/MM/DD
  endDate: string; // Shamsi YYYY/MM/DD
  isActive: boolean; // فعال بودن دوره
  isArchived?: boolean; // بایگانی دوره
  description?: string;
  createdAt: string;
  createdByUserName?: string;
  updatedAt?: string;
}

export interface StudentCourseSelectionChoice {
  programId: string;
  programTitle: string;
  programType: ProgramType;
  teacherName?: string;
  teacherPhone?: string;
  day?: string;
  time?: string;
  madrasRoom?: string;
  grade?: string;
}

export interface CourseSelectionRequest {
  id: string;
  periodId: string;
  periodTitle: string;
  studentId: string;
  studentName: string;
  studentGrade: string;
  nationalId?: string;
  selectedCourses: StudentCourseSelectionChoice[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
  isArchived?: boolean;
}

export interface CounselingSessionGrade {
  id: string;
  studentId: string;
  studentName: string;
  grade?: string; // پایه تحصیلی مثلاً 'پایه ۷'
  counselorTeacherName: string; // نام استاد مشاور
  courseTitle: string; // عنوان درس / کلاس مشاوره
  sessionDate: string; // تاریخ جلسه (شمسی)
  sessionNumber?: number | string; // شماره یا عنوان جلسه
  participationScore: CounselingScore; // نمره مشارکت
  researchScore: CounselingScore; // نمره پژوهش و تقریر
  counselorFeedback?: string; // نظرات و ملاحظات استاد مشاور
  createdAt: string;
  createdByName?: string;
  createdByRole?: string;
  updatedAt?: string;
}

export type AuditActionType = 'create' | 'update' | 'delete' | 'revert' | 'status_change';

export interface AuditLog {
  id: string;
  timestamp: string;
  shamsiDate: string;
  shamsiTime: string;
  userId?: string;
  userName: string;
  username: string;
  userRole: UserRole;
  userRoleTitle: string;
  userLevel: UserLevel;
  actionType: AuditActionType;
  module: AppModuleId | string;
  moduleTitle: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  description: string;
  previousState?: any;
  newState?: any;
  isReverted?: boolean;
  revertedAt?: string;
  revertedByUserName?: string;
}

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
  | 'presence_finance_report'     // گزارش کارکرد و ساعت حضور جهت اطلاع مسئول مالی
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
  managedGrades?: string[]; // e.g. ['پایه ۷', 'پایه ۸']
  linkedStudentId?: string; // For Level 3 student or class rep
  isReadOnly?: boolean; // If true, can view all authorized tabs but cannot create/edit/delete
  isActive: boolean;
  avatarBg?: string;
  allowedModules?: AppModuleId[]; // If specified, overrides default role menu
  modulePermissions?: Partial<Record<AppModuleId, 'none' | 'view' | 'edit'>>;
  canEditCounseling?: boolean;
  canViewCounseling?: boolean;
  permissions?: string[];
  createdAt: string;
  updatedAt?: string;
}

// -------------------------------------------------------------
// Meal Reservation & Kitchen Management Types (نهار و شام)
// -------------------------------------------------------------

export interface MealPersonCategory {
  id: string;
  title: string; // e.g. "طلبه", "استاد", "کارمند / کادر", "خادم", "مهمان", "سایر"
  defaultLunchPrice?: number;
  defaultDinnerPrice?: number;
  isDefault?: boolean;
  createdAt?: string;
}

export interface MealCancelledDay {
  id: string;
  date: string; // تاریخ شمسی e.g. '۱۴۰۳/۰۷/۱۵'
  mealType: 'lunch' | 'dinner' | 'both'; // نهار، شام یا هر دو تعطیل
  reason?: string; // علت لغو (مثلاً تعطیلی آشپزخانه، اردوی عمومی، تعطیلی رسمی)
  registeredAt: string;
  registeredByName?: string;
}

export interface MealReservationPeriod {
  id: string;
  title: string; // e.g. "رزرو نهار و شام مهر ۱۴۰۳"
  startDate: string; // YYYY/MM/DD
  endDate: string; // YYYY/MM/DD
  deadlineDate?: string; // مهلت ثبت‌نام (مثلاً تا ۱۴۰۳/۰۷/۰۵)
  enableLunch: boolean; // امکان رزرو نهار
  enableDinner: boolean; // امکان رزرو شام
  lunchPrice: number; // نرخ مصوب هر وعده نهار به تومان (مثلاً ۴۵,۰۰۰)
  dinnerPrice: number; // نرخ مصوب هر وعده شام به تومان (مثلاً ۳۵,۰۰۰)
  allowDinnerLocationSelect?: boolean; // امکان انتخاب محل دریافت شام (موسسه/خوابگاه) - پیش‌فرض فعال
  status: 'open' | 'closed' | 'finalized';
  isManuallyClosed?: boolean; // بسته شدن دستی توسط مسئول مالی
  lunchDisabledDays: string[]; // روزهای مسدود شده نهار در هفته (مثلاً ['جمعه'] یا ['پنج‌شنبه', 'جمعه'])
  dinnerDisabledDays: string[]; // روزهای مسدود شده شام در هفته
  cancelledDates?: MealCancelledDay[]; // روزهای تعطیلی موردی آشپزخانه
  createdAt: string;
  createdByName?: string;
  updatedAt?: string;
}

export interface StudentMealReservation {
  id: string;
  periodId: string;
  studentId: string;
  studentName: string;
  nationalId?: string;
  grade?: string;
  personRoleTitle?: string; // عنوان فرد: "طلبه"، "استاد"، "کارمند / کادر"، "خادم"، "مهمان"
  isDormitory?: boolean;
  selectedLunchDays: string[]; // روزهای انتخابی هفتگی نهار: ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه']
  selectedDinnerDays: string[]; // روزهای انتخابی هفتگی شام
  dinnerLocation: 'institute' | 'dormitory'; // محل دریافت شام: 'موسسه' | 'خوابگاه'
  dinnerDayLocations?: Record<string, 'institute' | 'dormitory'>;
  // روزهای استثنایی خاص (در صورت ویرایش موردی)
  customLunchDates?: string[];
  customDinnerDates?: string[];
  // آمار محاسباتی نهایی در این دوره
  totalCalculatedLunches: number; // تعداد کل روزهای نهار با کسر روزهای تعطیلی آشپزخانه
  totalCalculatedDinners: number; // تعداد کل روزهای شام با کسر روزهای تعطیلی آشپزخانه
  totalDinnersInstitute?: number; // تعداد شام در موسسه
  totalDinnersDormitory?: number; // تعداد شام در خوابگاه
  totalLunchCost: number; // مجموع هزینه نهار
  totalDinnerCost: number; // مجموع هزینه شام
  totalMealCost: number; // مجموع کل هزینه نهار و شام
  subsidyDiscount?: number; // تخفیف یا سهم حمایتی
  finalDeductionAmount: number; // مبلغ نهایی کسر از شهریه
  notes?: string;
  updatedAt: string;
}

export type LunchReservation = StudentMealReservation;

// -------------------------------------------------------------
// Claims & Destination Deposit Accounts Types (مطالبات و حساب‌های واریز)
// -------------------------------------------------------------

export interface FinanceDestinationAccount {
  id: string;
  title: string; // e.g. "حساب آشپزخانه و پذیرایی", "حساب مسئول فرهنگی (عتبات و اردو)", "حساب صندوق قرض‌الحسنه", "حساب کتابخانه"
  bankName: string; // e.g. "بانک ملی", "بانک ملت", "بانک رسالت"
  accountNumber: string; // شماره حساب
  shebaNumber: string; // شماره شبا (بدون IR یا همراه با IR)
  accountHolder: string; // نام صاحب حساب / متصدی
  category?: 'kitchen' | 'cultural' | 'qard_fund' | 'other';
  isDefault?: boolean;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FinanceClaimCategory {
  id: string;
  title: string; // e.g. "وام اردو عتبات", "بدهی کتب درسی", "مساعده اساتید", "بیمه تکمیلی پرسنل"
  defaultDestinationAccountId: string; // شناسه حساب پیش‌فرض جهت واریز
  targetType?: 'student' | 'teacher' | 'staff' | 'all'; // بخش مربوطه: مطالبات از طلاب / اساتید / کارکنان و سایر یا عمومی
  description?: string;
  createdAt: string;
}

export interface StudentClaimRecord {
  id: string;
  claimCategoryId: string;
  claimTitle: string;
  targetType?: 'student' | 'teacher' | 'staff';
  targetId?: string; // شناسه فرد (طلبه، استاد یا کارمند)
  targetName?: string; // نام فرد
  destinationAccountId: string; // شناسه حسابی که مبلغ کسر شده باید به آن واریز شود
  destinationAccountTitle?: string;
  destinationBankInfo?: string;
  studentId: string;
  studentName: string;
  nationalId?: string;
  grade?: string;
  roleOrTitle?: string;
  totalDebtAmount: number; // مبلغ کل بدهی (تومان)
  monthlyDeductionAmount: number; // مبلغی که ماهانه کسر می‌شود (تومان)
  paidAmount: number; // کل مبالغ کسر / پرداخت شده تاکنون
  remainingAmount: number; // مانده بدهی
  status: 'active' | 'completed' | 'paused'; // فعال / تسویه کامل / متوقف شده
  startDate?: string; // تاریخ شروع کسر
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ClaimRecord = StudentClaimRecord;

export interface GradeMentorCalculationItem {
  id: string;
  userId: string;
  name: string;
  gradesStr: string; // پایه‌های تحت مسئولیت
  teacherCode?: string;
  nationalId?: string;
  phone?: string;
  totalHours: number; // ساعت حضور و کارکرد
  hourlyRate: number; // نرخ ساعتی
  baseCompensation: number; // مبلغ پایه کارکرد
  lunchCount: number; // تعداد وعده نهار
  lunchDeduction: number; // کسر نهار
  bonusAmount: number; // اضافات / پاداش
  manualAdjustmentAmount?: number; // افزایش (+) یا کاهش (-) دستی مسئول مالی
  manualAdjustmentReason?: string; // علت افزایش / کاهش دستی
  debtDeduction?: number; // کسر بدهی‌ها و مطالبات فعال
  debtNotes?: string; // شرح بدهی
  loanInstallment?: number; // اقساط وام
  fundContribution?: number; // صندوق قرض‌الحسنه
  otherDeductions: number; // سایر کسورات
  netPayable: number; // خالص پرداختی
  bankName?: string;
  bankAccount: string;
  bankSheba?: string;
  status?: 'pending' | 'approved' | 'paid';
  notes?: string;
  // فیلدهای اتصال به گزارش‌های کارکرد تاییدشده در جریان کار:
  reportedPresenceHours?: number; // ساعت کارکرد ارسال شده توسط استاد پایه در بازه زمانی
  reportedPresenceCycle?: string; // عنوان یا شرح بازه زمانی گزارش کارکرد (مثلاً مهر ۱۴۰۳)
  reportedPresenceCycleStart?: string; // تاریخ شروع بازه کارکرد
  reportedPresenceCycleEnd?: string; // تاریخ پایان بازه کارکرد
  presenceReportId?: string; // شناسه گزارش کارکرد در presence_reports
  isPresenceApprovedInWorkflow?: boolean; // آیا در جریان کار توسط مسئول مالی تایید شده است؟
  isPresenceBasisConfirmed?: boolean; // آیا مسئول مالی تایید کرده که این ساعت ارسالی مبنای محاسبه حق‌الزحمه قرار گیرد؟
  presenceBasisConfirmedAt?: string; // تاریخ و ساعت تایید مبنا توسط مسئول مالی
  presenceBasisConfirmedByName?: string; // نام کاربری مسئول مالی تاییدکننده مبنا
}

export interface GradeMentorPeriod {
  id: string;
  title: string; // e.g. "حق‌الزحمه اساتید پایه مهر ماه ۱۴۰۳"
  startDate: string;
  endDate: string;
  status: 'draft' | 'finalized' | 'paid';
  totalProfessors: number;
  totalPayoutAmount: number;
  lunchCostPerMeal: number; // مبلغ هر وعده نهار در تنظیمات
  baseHourlyRate: number; // نرخ مصوب هر ساعت
  items: GradeMentorCalculationItem[];
  createdAt: string;
  createdByName?: string;
  finalizedAt?: string;
  finalizedByName?: string;
}

// -------------------------------------------------------------
// Budget Rows & Expense Records Types (ردیف‌های بودجه و هزینه‌ها)
// -------------------------------------------------------------

export interface BudgetRow {
  id: string;
  code: string; // e.g. "013", "014", "102"
  title: string; // e.g. "ردیف پذیرایی و تغذیه طلاب", "ردیف تاسیسات و تعمیرات", "ردیف فرهنگی و اردوها"
  allocatedAmount: number; // سقف مصوب بودجه (تومان)
  period: string; // e.g. "سال تحصیلی ۱۴۰۳-۱۴۰۴", "پاییز ۱۴۰۳"
  startDate?: string;
  endDate?: string;
  spentAmount?: number; // مصرف شده
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TeacherWeeklyTransportRoutine {
  id: string;
  teacherId: string;
  teacherName: string;
  daysOfWeek: string[]; // e.g. ['شنبه', 'چهارشنبه']
  // رفت به موسسه
  arrivalEnabled?: boolean;
  arrivalTime: string; // e.g. "15:00"
  arrivalAddressTitle: string; // e.g. "منزل", "دانشگاه"
  arrivalAddressDetails: string; // e.g. "الغدیر ۴۱، پلاک ۱۲"
  // برگشت از موسسه
  departureEnabled?: boolean;
  departureTime: string; // e.g. "16:00"
  departureAddressTitle: string; // e.g. "منزل", "پژوهشگاه"
  departureAddressDetails: string; // e.g. "الغدیر ۴۱"
  costPerTrip?: number; // هزینه هر رفت یا برگشت
  driverId?: string;
  driverName?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TeacherTransportSingleTrip {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string; // Shamsi date e.g. "1403/07/10"
  tripType: 'arrival' | 'departure' | 'both' | 'round_trip'; // آمدن، رفتن، هر دو
  arrivalTime?: string;
  arrivalAddressTitle?: string;
  arrivalAddressDetails?: string;
  departureTime?: string;
  departureAddressTitle?: string;
  departureAddressDetails?: string;
  driverId?: string;
  driverName?: string;
  tripsCount: number; // مثلاً ۱ نوبت یا ۲ نوبت
  cost: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface TeacherCompensationSettings {
  hourlyTeachingRate: number; // نرخ هر ساعت / جلسه تدریس
  lunchCostPerDay: number; // هزینه هر وعده نهار
  enableTransportCalculation: boolean; // آیا هزینه سرویس محاسبه شود؟
  transportCalculationMode: 'per_trip' | 'per_day'; // هر رفت و آمد جداگانه (۲ نوبت) یا کل روز ۱ نوبت
  transportCostPerTrip: number; // نرخ مصوب هر نوبت سرویس
}

export interface TeacherCompensationCalculationItem {
  id: string;
  teacherId: string;
  teacherName: string; // نام و نام خانوادگی کامل استاد
  nationalId?: string;
  phone?: string;
  coursesStr?: string; // عناوین دروس تدریسی
  gradesStr?: string; // پایه‌ها
  
  // آمار حضور و غیاب
  totalCalendarDays: number; // کل روزهای تقویم درسی در بازه
  cancelledDaysCount: number; // جلسات تعطیل شده توسط نماینده
  regularTeachingSessions: number; // جلسات حضور عادی استاد اصلی
  regularTeachingHours: number; // مجموع ساعات تدریس عادی
  substituteTeachingSessions: number; // جلسات حضور به عنوان استاد جایگزین
  substituteTeachingHours: number; // ساعت تدریس جایگزین
  totalTeachingHours: number; // کل ساعات تدریس مؤثر (عادی + جایگزین)
  
  hourlyRate: number; // نرخ ساعتی/جلسه‌ای مصوب
  baseGrossAmount: number; // حق‌الزحمه ناخالص پایه
  
  // نهار
  lunchCount: number; // تعداد وعده نهار در بازه
  lunchDeduction: number; // مبلغ کسر نهار
  
  // سرویس ایاب و ذهاب
  transportTripsCount: number; // تعداد نوبت‌های سرویس (موردی یا هفتگی)
  transportDeduction: number; // مبلغ کسر سرویس
  
  // کسورات نوع ۱
  type1Deductions: number; // کسورات آموزشی و غیبت
  
  // کسورات نوع ۲ (واریز به حساب‌های مقصد)
  type2DeductionsTotal: number;
  claimsDeductions?: Array<{
    claimId: string;
    title: string;
    amount: number;
    destinationAccountId: string;
    destinationTitle: string;
    bankInfo?: string;
  }>;
  loanInstallment?: number; // قسط وام
  fundContribution?: number; // صندوق قرض‌الحسنه
  culturalDebt?: number; // عتبات و امور فرهنگی
  otherType2Deductions?: number;
  
  // پاداش و تعدیلات
  bonusAmount: number; // پاداش / تشویقی
  manualAdjustmentAmount: number; // افزایش (+) یا کاهش (-) دستی
  manualAdjustmentReason: string; // علت تعدیل دستی
  
  // نهایی
  netPayable: number; // خالص پرداختی نهایی
  bankName?: string;
  bankAccount?: string;
  bankSheba?: string;
  status: 'draft' | 'approved' | 'paid';
  notes?: string;
}

export interface TeacherCompensationPeriod {
  id: string;
  title: string; // e.g. "حق‌الزحمه اساتید مهر ماه ۱۴۰۳"
  startDate: string;
  endDate: string;
  status: 'draft' | 'finalized' | 'paid';
  settings: TeacherCompensationSettings;
  totalTeachers: number;
  totalPayoutAmount: number;
  totalType2Deductions: number;
  items: TeacherCompensationCalculationItem[];
  createdAt: string;
  createdByName?: string;
  finalizedAt?: string;
  finalizedByName?: string;
}

export interface DestinationAccountSummaryReport {
  destinationAccountId: string;
  destinationAccountTitle: string;
  category: string;
  bankName: string;
  accountNumber: string;
  shebaNumber: string;
  accountHolder: string;
  totalDeductionAmount: number;
  beneficiaryCount: number;
  description?: string;
}

export interface ExpenseRecord {

  id: string;
  title: string; // عنوان هزینه
  date: string; // تاریخ هزینه (شمسی)
  amount: number; // مبلغ (تومان)
  budgetRowId?: string; // شناسه ردیف بودجه (یا دستی)
  budgetRowTitle?: string; // عنوان ردیف بودجه (انتخابی یا دستی)
  budgetCode?: string; // کد ردیف مثلاً 013
  payer: string; // پرداخت کننده / تنخواه‌دار / شخص
  category: string; // موضوع/دسته‌بندی (تاسیسات، پذیرایی، فرهنگی، اداری، حق‌الزحمه، متفرقه)
  description?: string; // توضیحات
  attachmentUrl?: string; // لینک یا نام فایل پیوست/فاکتور
  recipient?: string; // طرف حساب / فروشگاه / شخص
  invoiceNumber?: string; // شماره فاکتور یا سند
  status?: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  createdByName?: string;
}



