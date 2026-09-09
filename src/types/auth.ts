export type UserLevel = 1 | 2 | 3;

export type UserRole = 
  | 'super_admin'         // سوپر ادمین (سطح ۱)
  | 'school_manager'      // مدیر مدرسه / معاون (سطح ۱ - مشاهده بدون ویرایش)
  | 'education_manager'   // مسئول آموزش (سطح ۲)
  | 'grade_mentor'        // مسئول پایه (سطح ۲ - پایه‌های ۷، ۸، ۹، ۱۰)
  | 'research_manager'    // مسئول پژوهش (سطح ۲)
  | 'finance_manager'     // مسئول مالی (سطح ۲)
  | 'class_representative'// نماینده کلاس (سطح ۳)
  | 'student'             // طلبه (سطح ۳)
  | 'custom';             // نقش سفارشی

export type UserScope = 
  | 'all'                 // تمام طلاب و بخش‌ها
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
  mentorId?: 'hayati' | 'hosseini' | 'soleimani' | 'asadi' | 'shahpoori';
  studentId?: string;
  studentName?: string;
  isReadOnly?: boolean;
  canEdit?: boolean;
  canManageUsers?: boolean;
  canBackup?: boolean;
  allowedTabs: string[];
  avatarBg?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface MenuItemConfig {
  id: string;
  label: string;
  iconName: string;
  description?: string;
  minLevel?: UserLevel;
}
