export type UserLevel = 1 | 2 | 3;

export type UserRole = 
  | 'super_admin'         // سوپر ادمین (سطح ۱)
  | 'school_manager'      // مدیر مدرسه / معاون (سطح ۱ - مشاهده بدون ویرایش)
  | 'manager_principal'   // مدیر مدرسه
  | 'vice_principal'      // معاون مدرسه
  | 'education_manager'   // مسئول آموزش (سطح ۲)
  | 'education_officer'   // مسئول آموزش
  | 'grade_supervisor_7'  // مسئول پایه ۷ (سطح ۲)
  | 'grade_supervisor_8'  // مسئول پایه ۸ (سطح ۲)
  | 'grade_supervisor_9'  // مسئول پایه ۹ (سطح ۲)
  | 'grade_supervisor_10' // مسئول پایه ۱۰ (سطح ۲)
  | 'grade_mentor'        // مسئول پایه (سطح ۲ - پایه‌های ۷، ۸، ۹، ۱۰)
  | 'grade_supervisor'    // مسئول پایه
  | 'research_manager'    // مسئول پژوهش (سطح ۲)
  | 'research_officer'    // مسئول پژوهش
  | 'finance_manager'     // مسئول مالی (سطح ۲)
  | 'financial_officer'   // مسئول مالی
  | 'class_representative'// نماینده کلاس (سطح ۳)
  | 'student'             // طلبه (سطح ۳)
  | 'custom';             // نقش سفارشی

export type UserScope = 
  | 'all'                 // تمام طلاب و بخش‌ها
  | 'global'              // سراسری
  | 'grade_7'             // فقط پایه ۷
  | 'grade_8'             // فقط پایه ۸
  | 'grade_9'             // فقط پایه ۹
  | 'grade_10'            // فقط پایه ۱۰
  | 'class'               // کلاس مربوطه
  | 'self';               // فقط اطلاعات شخصی خود

export interface AppUser {
  id: string;
  username: string;
  password?: string;
  name: string;
  fullName?: string;
  level: UserLevel;
  role: UserRole;
  roleTitle: string;
  scope: UserScope;
  gradeLabel?: string;
  managedGrades?: string[]; // پایه‌های تحت مسئولیت استاد (مثلا ['پایه ۷', 'پایه ۸'])
  mentorId?: 'hayati' | 'hosseini' | 'soleimani' | 'asadi' | 'shahpoori';
  studentId?: string;
  studentName?: string;
  linkedStudentId?: string;
  isReadOnly?: boolean;
  canEdit?: boolean;
  canManageUsers?: boolean;
  canBackup?: boolean;
  isActive?: boolean;
  allowedTabs: string[];
  allowedModules?: string[];
  editableTabs?: string[];
  modulePermissions?: Record<string, 'none' | 'view' | 'edit'>;
  avatarBg?: string;
  phone?: string;
  nationalId?: string;
  personnelCode?: string;
  bankName?: string;
  bankAccount?: string;
  bankSheba?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  accountLockedUntil?: string;
}

export interface MenuItemConfig {
  id: string;
  label: string;
  iconName: string;
  description?: string;
  minLevel?: UserLevel;
}
