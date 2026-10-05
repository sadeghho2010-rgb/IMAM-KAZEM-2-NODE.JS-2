import { localDb } from './localDb';

export type TargetRoleGroup = 
  | 'student'               // طلاب عادی (سطح ۳)
  | 'class_representative'  // نمایندگان کلاس (سطح ۳)
  | 'counseling_teacher'    // اساتید مشاوره
  | 'grade_supervisor'      // مسئولین پایه (سطح ۲)
  | 'education_officer';     // مسئولین آموزش (سطح ۲)

export type AccessLevel = 'none' | 'view' | 'full';

export interface SubFeatureDef {
  id: string;
  title: string;
  description: string;
}

export interface SectionModuleDef {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: 'education' | 'monitoring' | 'research' | 'management';
  subFeatures: SubFeatureDef[];
}

export const SECTION_MODULES: SectionModuleDef[] = [
  {
    id: 'programs',
    title: 'برنامه درسی و مدرسه',
    description: 'مدیریت دروس، ساعات برگزاری، مَدرَس‌ها و برنامه‌ریزی هفتگی',
    iconName: 'BookOpen',
    category: 'education',
    subFeatures: [
      { id: 'view_schedule', title: 'مشاهده برنامه هفتگی', description: 'دیدن جدول زمانی کلاس‌ها و ساعات دروس' },
      { id: 'edit_programs', title: 'افزودن و ویرایش برنامه', description: 'تعریف کلاس جدید، تغییر روز، ساعت و استاد' },
      { id: 'assign_representative', title: 'تعیین نماینده کلاس', description: 'انتساب طلبه به عنوان نماینده رسمی کلاس' }
    ]
  },
  {
    id: 'attendance',
    title: 'حضور و غیاب و پایش',
    description: 'ثبت جلسات روزانه، آمار غیبت‌ها و کارنامه کلاسی',
    iconName: 'CheckSquare',
    category: 'monitoring',
    subFeatures: [
      { id: 'view_own_report', title: 'مشاهده آمار و کارنامه شخصی', description: 'گزارش تفکیکی غیبت‌ها و تاخیرهای فرد' },
      { id: 'view_all_cards', title: 'مشاهده کارت‌های تمامی کلاس‌ها', description: 'دیدن وضعیت تشکیل و غیبت سایر کلاس‌ها' },
      { id: 'record_attendance', title: 'ثبت و ویرایش حضور و غیاب', description: 'تعیین حاضر/غایب و ثبت نهایی جلسه' },
      { id: 'manage_settings', title: 'تنظیمات و قفل تاریخی', description: 'مهلت ویرایش و کنترل دسترسی اساتید' }
    ]
  },
  {
    id: 'research',
    title: 'بخش پژوهش و مقالات',
    description: 'پرونده‌های مقاله‌نویسی، سوابق علمی و مهارت‌های پژوهشی',
    iconName: 'Award',
    category: 'research',
    subFeatures: [
      { id: 'view_own_research', title: 'مشاهده سوابق پژوهشی خود', description: 'دیدن لیست مقالات و وضعیت پیشرفت شخصی' },
      { id: 'view_skills', title: 'مشاهده بخش مهارت‌ها و استعدادها', description: 'نمایش استعدادسنجی و سطوح مهارتی طلبه' },
      { id: 'submit_article', title: 'ارسال و ویرایش مقاله جدید', description: 'بارگذاری فایل و ثبت اطلاعات مقاله' },
      { id: 'evaluate_articles', title: 'ارزیابی و داوری مقالات', description: 'ثبت امتیاز، نمره و بازخورد علمی' }
    ]
  },
  {
    id: 'discussion',
    title: 'گروه‌های مباحثه و مطالعه',
    description: 'سازماندهی حلقه‌های بحث، ساعات مطالعه و کارکرد علمی',
    iconName: 'Users',
    category: 'monitoring',
    subFeatures: [
      { id: 'view_own_group', title: 'مشاهده گروه مباحثه خود', description: 'دیدن هم‌بحثی‌ها و موضوعات مباحثه' },
      { id: 'view_comparison_table', title: 'مشاهده جدول مقایسه‌ای پایه‌ها', description: 'مقایسه آماری ساعات مطالعه و عملکرد گروه‌ها' },
      { id: 'edit_groups', title: 'مدیریت و تشکیل گروه‌ها', description: 'افزودن عضو، تغییر سرگروه و ویرایش مشخصات' },
      { id: 'log_study_hours', title: 'ثبت ساعات مطالعه روزانه', description: 'ورود ساعات مطالعه انفرادی و مباحثه' }
    ]
  },
  {
    id: 'counseling_classes',
    title: 'کلاس‌های مشاوره و هدایت علمی',
    description: 'حلقه‌های تخصصی مشاوره، نظارت تحصیلی و ارزیابی مشاوره‌ای',
    iconName: 'GraduationCap',
    category: 'education',
    subFeatures: [
      { id: 'view_counseling', title: 'مشاهده کلاس‌های مشاوره', description: 'دیدن لیست جلسات و اعضای حلقه مشاوره' },
      { id: 'evaluate_counseling', title: 'ثبت ارزیابی و نمرات مشاوره', description: 'نمره‌دهی و ثبت توصیه‌های تخصصی مشاور' }
    ]
  },
  {
    id: 'comments',
    title: 'نظرات و ارزیابی‌های تربیتی',
    description: 'پرونده‌های مشاوره‌ای، یادداشت‌های رفتاری و ارزیابی تربیتی',
    iconName: 'MessageSquare',
    category: 'monitoring',
    subFeatures: [
      { id: 'view_comments', title: 'مشاهده نظرات تربیتی', description: 'دیدن بازخوردها و نکات ثبت شده توسط اساتید' },
      { id: 'add_comments', title: 'ثبت و ویرایش نظر تربیتی', description: 'افزودن یادداشت تربیتی برای طلاب' }
    ]
  },
  {
    id: 'finance',
    title: 'امور مالی و شهریه طلاب',
    description: 'محاسبه شهریه، کسورات و تسهیلات رفاهی',
    iconName: 'Coins',
    category: 'management',
    subFeatures: [
      { id: 'view_tuition', title: 'مشاهده وضعیت شهریه', description: 'دیدن فیش و جزئیات مبالغ شهریه' },
      { id: 'manage_tuition', title: 'مدیریت و پرداخت شهریه', description: 'تایید نهایی، ثبت وام و پرداخت‌ها' }
    ]
  },
  {
    id: 'course_selection',
    title: 'سامانه انتخاب واحد',
    description: 'اخذ دروس، ظرفیت‌بندی و تایید دوره‌ها',
    iconName: 'BookCheck',
    category: 'education',
    subFeatures: [
      { id: 'select_courses', title: 'اخذ و ثبت دروس', description: 'انتخاب واحدهای تحصیلی در بازه مجاز' },
      { id: 'approve_courses', title: 'تایید نهایی انتخاب واحد', description: 'بررسی ضوابط آموزشی و تایید مدیر' }
    ]
  }
];

export const ROLE_GROUP_LABELS: Record<TargetRoleGroup, { title: string; subtitle: string; badgeColor: string }> = {
  student: {
    title: 'طلاب عادی (سطح ۳)',
    subtitle: 'کاربران عمومی دانش‌پژوه',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  },
  class_representative: {
    title: 'نمایندگان کلاس (سطح ۳)',
    subtitle: 'طلاب با مسئولیت حضور و غیاب کلاس',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200'
  },
  counseling_teacher: {
    title: 'اساتید مشاوره',
    subtitle: 'اساتید مشاور علمی و تربیتی',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  grade_supervisor: {
    title: 'مسئولین پایه (سطح ۲)',
    subtitle: 'اساتید ناظر و مدیران پایه‌ها',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200'
  },
  education_officer: {
    title: 'مسئولین آموزش (سطح ۲)',
    subtitle: 'مدیران آموزش و برنامه‌ریزی درسی',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200'
  }
};

// SectionPermissionsMap: [sectionId]: { [role in TargetRoleGroup]: AccessLevel, subFeatures: { [subFeatureId]: { [role]: AccessLevel } } }
export type SectionPermissionsMap = Record<
  string, 
  {
    overall: Record<TargetRoleGroup, AccessLevel>;
    subFeatures: Record<string, Record<TargetRoleGroup, AccessLevel>>;
  }
>;

export const DEFAULT_SECTION_PERMISSIONS: SectionPermissionsMap = {
  programs: {
    overall: {
      student: 'view',
      class_representative: 'view',
      counseling_teacher: 'view',
      grade_supervisor: 'full',
      education_officer: 'full'
    },
    subFeatures: {
      view_schedule: { student: 'view', class_representative: 'view', counseling_teacher: 'view', grade_supervisor: 'full', education_officer: 'full' },
      edit_programs: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' },
      assign_representative: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' }
    }
  },
  attendance: {
    overall: {
      student: 'view',
      class_representative: 'full',
      counseling_teacher: 'none',
      grade_supervisor: 'full',
      education_officer: 'full'
    },
    subFeatures: {
      view_own_report: { student: 'view', class_representative: 'view', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' },
      view_all_cards: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' },
      record_attendance: { student: 'none', class_representative: 'full', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' },
      manage_settings: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'view', education_officer: 'full' }
    }
  },
  research: {
    overall: {
      student: 'view',
      class_representative: 'view',
      counseling_teacher: 'full',
      grade_supervisor: 'full',
      education_officer: 'full'
    },
    subFeatures: {
      view_own_research: { student: 'view', class_representative: 'view', counseling_teacher: 'view', grade_supervisor: 'full', education_officer: 'full' },
      view_skills: { student: 'none', class_representative: 'none', counseling_teacher: 'view', grade_supervisor: 'full', education_officer: 'full' },
      submit_article: { student: 'none', class_representative: 'none', counseling_teacher: 'full', grade_supervisor: 'full', education_officer: 'full' },
      evaluate_articles: { student: 'none', class_representative: 'none', counseling_teacher: 'full', grade_supervisor: 'full', education_officer: 'full' }
    }
  },
  discussion: {
    overall: {
      student: 'view',
      class_representative: 'view',
      counseling_teacher: 'view',
      grade_supervisor: 'full',
      education_officer: 'full'
    },
    subFeatures: {
      view_own_group: { student: 'view', class_representative: 'view', counseling_teacher: 'view', grade_supervisor: 'full', education_officer: 'full' },
      view_comparison_table: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' },
      edit_groups: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' },
      log_study_hours: { student: 'full', class_representative: 'full', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' }
    }
  },
  counseling_classes: {
    overall: {
      student: 'none',
      class_representative: 'none',
      counseling_teacher: 'full',
      grade_supervisor: 'full',
      education_officer: 'full'
    },
    subFeatures: {
      view_counseling: { student: 'none', class_representative: 'none', counseling_teacher: 'view', grade_supervisor: 'full', education_officer: 'full' },
      evaluate_counseling: { student: 'none', class_representative: 'none', counseling_teacher: 'full', grade_supervisor: 'full', education_officer: 'full' }
    }
  },
  comments: {
    overall: {
      student: 'none',
      class_representative: 'none',
      counseling_teacher: 'view',
      grade_supervisor: 'full',
      education_officer: 'full'
    },
    subFeatures: {
      view_comments: { student: 'none', class_representative: 'none', counseling_teacher: 'view', grade_supervisor: 'full', education_officer: 'full' },
      add_comments: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' }
    }
  },
  finance: {
    overall: {
      student: 'none',
      class_representative: 'none',
      counseling_teacher: 'none',
      grade_supervisor: 'view',
      education_officer: 'full'
    },
    subFeatures: {
      view_tuition: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'view', education_officer: 'full' },
      manage_tuition: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'none', education_officer: 'full' }
    }
  },
  course_selection: {
    overall: {
      student: 'view',
      class_representative: 'view',
      counseling_teacher: 'none',
      grade_supervisor: 'full',
      education_officer: 'full'
    },
    subFeatures: {
      select_courses: { student: 'view', class_representative: 'view', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' },
      approve_courses: { student: 'none', class_representative: 'none', counseling_teacher: 'none', grade_supervisor: 'full', education_officer: 'full' }
    }
  }
};

const PERMISSIONS_DOC_ID = 'matrix_v1';

export async function getStoredSectionPermissions(): Promise<SectionPermissionsMap> {
  try {
    const doc = await localDb.getDoc<any>('system_section_permissions', PERMISSIONS_DOC_ID);
    if (doc && doc.matrix) {
      return { ...DEFAULT_SECTION_PERMISSIONS, ...doc.matrix };
    }
  } catch (e) {
    console.warn('Error loading section permissions:', e);
  }
  return DEFAULT_SECTION_PERMISSIONS;
}

export async function saveSectionPermissions(matrix: SectionPermissionsMap): Promise<boolean> {
  try {
    await localDb.setDoc('system_section_permissions', {
      id: PERMISSIONS_DOC_ID,
      matrix,
      updatedAt: new Date().toISOString()
    });
    // Trigger custom event for reactive in-app listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('section_permissions_changed', { detail: matrix }));
    }
    return true;
  } catch (e) {
    console.error('Error saving section permissions:', e);
    return false;
  }
}

export function resolveUserRoleGroup(user: { role?: string; level?: number; isCounselingAdvisor?: boolean } | null): TargetRoleGroup {
  if (!user) return 'student';
  if (user.role === 'class_representative') return 'class_representative';
  if (user.role === 'teacher' || user.isCounselingAdvisor || user.role === 'advisor') return 'counseling_teacher';
  if (user.role === 'grade_supervisor' || user.role === 'grade_mentor' || (user.role && user.role.startsWith('grade_supervisor_'))) return 'grade_supervisor';
  if (user.role === 'education_manager' || user.role === 'education_officer') return 'education_officer';
  if (user.level === 3) return 'student';
  return 'student';
}
