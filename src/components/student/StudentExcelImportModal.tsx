import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  Check,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  RefreshCw,
  Eye,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { localDb, isStudentActive } from '../../lib/localDb';
import { Student } from '../../types';
import { cn } from '../../lib/utils';

export type StudentImportFieldKey =
  | ''
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'nationalId'
  | 'phoneNumber'
  | 'studentCode'
  | 'fatherName'
  | 'fatherOccupation'
  | 'birthDate'
  | 'birthPlace'
  | 'grade'
  | 'isActive'
  | 'deactivationReason'
  | 'deactivationDate'
  | 'deactivationNotes'
  | 'managementCenterCode'
  | 'instituteCode'
  | 'servicesCenterCode'
  | 'maritalStatus'
  | 'childrenCount'
  | 'livingStatus'
  | 'livingStatusOther'
  | 'tammomStatus'
  | 'classicEducation'
  | 'howzaEntryYear'
  | 'instituteEntryYear'
  | 'levelOneSchool'
  | 'tuitionCode'
  | 'fundBookAccountNumber'
  | 'tejaratBankAccount'
  | 'tejaratBankSheba'
  | 'bankName1'
  | 'bankAccount1'
  | 'bankSheba1'
  | 'bankName2'
  | 'bankAccount2'
  | 'bankSheba2';

interface StudentFieldDefinition {
  key: Exclude<StudentImportFieldKey, ''>;
  label: string;
  group: 'identity' | 'education' | 'family' | 'finance';
  hasPredefinedOptions?: boolean;
  isNumericCode?: boolean;
  headerAliases: string[];
}

const STUDENT_FIELDS: StudentFieldDefinition[] = [
  // هویتی و تماس
  {
    key: 'name',
    label: 'نام و نام خانوادگی (کامل)',
    group: 'identity',
    headerAliases: ['نام و نام خانوادگی', 'نام کامل', 'نام خانوادگی و نام', 'مشخصات', 'fullname', 'full name', 'name'],
  },
  {
    key: 'firstName',
    label: 'نام (جداگانه)',
    group: 'identity',
    headerAliases: ['نام', 'اسم', 'firstname', 'first name'],
  },
  {
    key: 'lastName',
    label: 'نام خانوادگی (جداگانه)',
    group: 'identity',
    headerAliases: ['نام خانوادگی', 'فامیل', 'فامیلی', 'شهرت', 'lastname', 'last name'],
  },
  {
    key: 'nationalId',
    label: 'کد ملی',
    group: 'identity',
    isNumericCode: true,
    headerAliases: ['کد ملی', 'کدملی', 'شماره ملی', 'nationalid', 'national id', 'nationalcode'],
  },
  {
    key: 'phoneNumber',
    label: 'شماره تماس / موبایل',
    group: 'identity',
    isNumericCode: true,
    headerAliases: ['شماره تماس', 'تلفن', 'موبایل', 'همراه', 'شماره همراه', 'تلفن همراه', 'phone', 'mobile'],
  },
  {
    key: 'studentCode',
    label: 'کد طلبگی / شماره پرونده',
    group: 'identity',
    isNumericCode: true,
    headerAliases: ['کد طلبگی', 'شماره پرونده', 'کد طلبه', 'کد دانشجویی', 'studentcode', 'student code'],
  },
  {
    key: 'fatherName',
    label: 'نام پدر',
    group: 'identity',
    headerAliases: ['نام پدر', 'پدر', 'fathername', 'father name'],
  },
  {
    key: 'fatherOccupation',
    label: 'شغل پدر',
    group: 'identity',
    headerAliases: ['شغل پدر', 'پیشه پدر', 'fatheroccupation', 'father job'],
  },
  {
    key: 'birthDate',
    label: 'تاریخ تولد',
    group: 'identity',
    isNumericCode: true,
    headerAliases: ['تاریخ تولد', 'تولد', 'متولد', 'birthdate', 'birth date'],
  },
  {
    key: 'birthPlace',
    label: 'اهل کجاست / محل تولد / صادره',
    group: 'identity',
    headerAliases: ['اهل کجاست', 'محل تولد', 'صادره', 'شهر', 'استان', 'شهرستان', 'ملیت', 'birthplace'],
  },

  // آموزشی و وضعیت
  {
    key: 'grade',
    label: 'پایه تحصیلی',
    group: 'education',
    hasPredefinedOptions: true,
    headerAliases: ['پایه تحصیلی', 'پایه', 'مقطع', 'سال تحصیلی', 'grade', 'level'],
  },
  {
    key: 'isActive',
    label: 'وضعیت در مدرسه (فعال / غیرفعال)',
    group: 'education',
    hasPredefinedOptions: true,
    headerAliases: ['وضعیت حضور', 'وضعیت تحصیلی', 'وضعیت فعلی', 'وضعیت', 'حالت', 'شاغل به تحصیل', 'isactive', 'status'],
  },
  {
    key: 'deactivationReason',
    label: 'علت غیرفعال بودن',
    group: 'education',
    hasPredefinedOptions: true,
    headerAliases: ['علت غیرفعال بودن', 'علت غیرفعالی', 'دلیل خروج', 'علت', 'deactivationreason'],
  },
  {
    key: 'deactivationDate',
    label: 'تاریخ غیرفعال‌سازی / خروج',
    group: 'education',
    isNumericCode: true,
    headerAliases: ['تاریخ غیرفعال‌سازی', 'تاریخ خروج', 'تاریخ فارغ التحصیلی', 'deactivationdate'],
  },
  {
    key: 'deactivationNotes',
    label: 'توضیحات غیرفعال‌سازی',
    group: 'education',
    headerAliases: ['توضیحات غیرفعال‌سازی', 'توضیحات خروج', 'یادداشت وضعیت', 'deactivationnotes'],
  },
  {
    key: 'managementCenterCode',
    label: 'کد مرکز مدیریت',
    group: 'education',
    isNumericCode: true,
    headerAliases: ['کد مرکز مدیریت', 'مرکز مدیریت', 'کد مرکز', 'کد حوزوی', 'managementcentercode'],
  },
  {
    key: 'instituteCode',
    label: 'کد موسسه',
    group: 'education',
    isNumericCode: true,
    headerAliases: ['کد موسسه', 'کد مؤسسه', 'institutecode'],
  },
  {
    key: 'servicesCenterCode',
    label: 'کد مرکز خدمات',
    group: 'education',
    isNumericCode: true,
    headerAliases: ['کد مرکز خدمات', 'مرکز خدمات', 'servicescentercode'],
  },

  // خانوادگی، سکونت و سوابق
  {
    key: 'maritalStatus',
    label: 'وضعیت تاهل',
    group: 'family',
    hasPredefinedOptions: true,
    headerAliases: ['وضعیت تاهل', 'تاهل', 'تأهل', 'ازدواج', 'maritalstatus'],
  },
  {
    key: 'childrenCount',
    label: 'تعداد فرزندان',
    group: 'family',
    isNumericCode: true,
    headerAliases: ['تعداد فرزندان', 'فرزندان', 'تعداد اولاد', 'اولاد', 'childrencount'],
  },
  {
    key: 'livingStatus',
    label: 'وضعیت سکونت',
    group: 'family',
    hasPredefinedOptions: true,
    headerAliases: ['سکونت', 'وضعیت سکونت', 'اسکان', 'محل سکونت', 'livingstatus'],
  },
  {
    key: 'livingStatusOther',
    label: 'توضیحات سکونت',
    group: 'family',
    headerAliases: ['توضیحات سکونت', 'نشانی', 'آدرس', 'livingstatusother'],
  },
  {
    key: 'tammomStatus',
    label: 'وضعیت تعمم',
    group: 'family',
    hasPredefinedOptions: true,
    headerAliases: ['وضعیت تعمم', 'تعمم', 'معمم', 'ملبس', 'tammomstatus'],
  },
  {
    key: 'classicEducation',
    label: 'تحصیلات کلاسیک',
    group: 'family',
    headerAliases: ['تحصیلات کلاسیک', 'مدرک کلاسیک', 'تحصیلات دانشگاهی', 'رشته کلاسیک', 'classiceducation'],
  },
  {
    key: 'howzaEntryYear',
    label: 'سال ورود به حوزه',
    group: 'family',
    isNumericCode: true,
    headerAliases: ['سال ورود به حوزه', 'ورود به حوزه', 'ورودی حوزه', 'howzaentryyear'],
  },
  {
    key: 'instituteEntryYear',
    label: 'سال ورود به موسسه',
    group: 'family',
    isNumericCode: true,
    headerAliases: ['سال ورود به موسسه', 'سال ورود به مؤسسه', 'ورود به موسسه', 'ورودی موسسه', 'instituteentryyear'],
  },
  {
    key: 'levelOneSchool',
    label: 'مدرسه سطح یک',
    group: 'family',
    headerAliases: ['مدرسه سطح یک', 'مدرسه قبلی', 'محل تحصیل سطح یک', 'leveloneschool'],
  },

  // مالی و بانکی
  {
    key: 'tuitionCode',
    label: 'کد شهریه',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['کد شهریه', 'شماره شهریه', 'tuitioncode'],
  },
  {
    key: 'bankName1',
    label: 'نام بانک ۱',
    group: 'finance',
    headerAliases: ['بانک ۱', 'نام بانک ۱', 'بانک 1', 'بانک', 'bankname1'],
  },
  {
    key: 'bankAccount1',
    label: 'شماره حساب ۱',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره حساب ۱', 'شماره حساب 1', 'حساب ۱', 'شماره حساب', 'bankaccount1'],
  },
  {
    key: 'bankSheba1',
    label: 'شماره شبا ۱',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره شبا ۱', 'شبا ۱', 'شماره شبا 1', 'شبا', 'banksheba1'],
  },
  {
    key: 'bankName2',
    label: 'نام بانک ۲',
    group: 'finance',
    headerAliases: ['بانک ۲', 'نام بانک ۲', 'بانک 2', 'bankname2'],
  },
  {
    key: 'bankAccount2',
    label: 'شماره حساب ۲',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره حساب ۲', 'شماره حساب 2', 'حساب ۲', 'bankaccount2'],
  },
  {
    key: 'bankSheba2',
    label: 'شماره شبا ۲',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره شبا ۲', 'شبا ۲', 'شماره شبا 2', 'banksheba2'],
  },
  {
    key: 'fundBookAccountNumber',
    label: 'شماره حساب دفتر صندوق',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره حساب دفتر صندوق', 'دفتر صندوق', 'حساب صندوق', 'شماره دفتر صندوق', 'fundbookaccountnumber'],
  },
  {
    key: 'tejaratBankAccount',
    label: 'شماره حساب بانک تجارت',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره حساب بانک تجارت', 'حساب بانک تجارت', 'حساب تجارت', 'بانک تجارت', 'tejaratbankaccount'],
  },
  {
    key: 'tejaratBankSheba',
    label: 'شماره شبا (بانک تجارت)',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره شبا بانک تجارت', 'شبا بانک تجارت', 'شبا تجارت', 'tejaratbanksheba'],
  },
];

const FIELD_GROUP_LABELS: Record<StudentFieldDefinition['group'], string> = {
  identity: 'اطلاعات هویتی و تماس',
  education: 'اطلاعات آموزشی و وضعیت حضور',
  family: 'وضعیت خانوادگی، سکونت و سوابق',
  finance: 'اطلاعات شهریه و بانکی',
};

const PREDEFINED_OPTIONS_BY_FIELD: Record<string, { value: string; label: string }[]> = {
  grade: [
    { value: 'پایه 7', label: 'پایه 7' },
    { value: 'پایه 8', label: 'پایه 8' },
    { value: 'پایه 9', label: 'پایه 9' },
    { value: 'پایه 10', label: 'پایه 10' },
    { value: 'پایه 11', label: 'پایه 11' },
    { value: 'پایه 12', label: 'پایه 12' },
    { value: 'پایه 1', label: 'پایه 1' },
    { value: 'پایه 2', label: 'پایه 2' },
    { value: 'پایه 3', label: 'پایه 3' },
    { value: 'پایه 4', label: 'پایه 4' },
    { value: 'پایه 5', label: 'پایه 5' },
    { value: 'پایه 6', label: 'پایه 6' },
  ],
  isActive: [
    { value: 'active', label: 'فعال (در حال تحصیل / حضور در مدرسه)' },
    { value: 'inactive', label: 'غیرفعال (عدم حضور در مدرسه)' },
  ],
  deactivationReason: [
    { value: '', label: 'بدون علت (خالی)' },
    { value: 'صرفا غیر فعال', label: 'صرفا غیر فعال (مرخصی / انصراف موقت)' },
    { value: 'فارغ التحصیل', label: 'فارغ التحصیل' },
    { value: 'انتقال اختیاری از مجموعه', label: 'انتقال اختیاری از مجموعه' },
    { value: 'قطع همکاری از مجموعه', label: 'قطع همکاری از مجموعه' },
  ],
  maritalStatus: [
    { value: 'مجرد', label: 'مجرد' },
    { value: 'متاهل', label: 'متاهل' },
  ],
  livingStatus: [
    { value: 'پدری', label: 'پدری' },
    { value: 'خوابگاه', label: 'خوابگاه' },
    { value: 'اجاره ای', label: 'اجاره ای' },
    { value: 'شخصی', label: 'شخصی' },
    { value: 'سایر', label: 'سایر' },
  ],
  tammomStatus: [
    { value: 'غیر معمم', label: 'غیر معمم' },
    { value: 'معمم', label: 'معمم' },
    { value: 'در شرف تعمم', label: 'در شرف تعمم' },
  ],
};

const EMPTY_VALUE_TOKEN = '__EMPTY__';
const KEEP_ORIGINAL_TOKEN = '__KEEP_ORIGINAL__';
const IMPORT_PROFILE_STORAGE_KEY = 'madrasah_student_excel_import_profile_v1';

type DuplicateStrategy = 'update_existing' | 'skip_existing' | 'create_always';

interface SavedImportProfile {
  ignoredHeaders: string[];
  headerToField: Record<string, StudentImportFieldKey>;
  valueRules: Record<string, Record<string, string>>; // fieldKey -> { rawValueKey -> mappedValue }
  duplicateStrategy: DuplicateStrategy;
}

interface ParsedColumn {
  colIndex: number;
  header: string;
  normalizedHeader: string;
  nonEmptyCount: number;
  sampleValues: string[];
}

interface TransformedRowPreview {
  rowIndex: number;
  studentData: Partial<Student>;
  matchedExisting: Student | null;
  action: 'create' | 'update' | 'skip';
  warnings: string[];
}

interface StudentExcelImportModalProps {
  isOpen: boolean;
  initialFile: File | null;
  existingStudents: Student[];
  onClose: () => void;
  onImportCompleted: () => void;
}

function toLatinDigits(input: string): string {
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizePersianText(input: string): string {
  return toLatinDigits(String(input || ''))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeaderKey(header: string): string {
  return normalizePersianText(header).toLowerCase();
}

function autoMatchFieldByHeader(header: string): StudentImportFieldKey {
  const norm = normalizeHeaderKey(header);
  if (!norm) return '';

  // Exact alias match first
  for (const field of STUDENT_FIELDS) {
    if (field.headerAliases.some((alias) => normalizeHeaderKey(alias) === norm)) {
      return field.key;
    }
  }
  // Partial inclusion match (avoid matching 'نام پدر' or 'نام بانک' to 'نام')
  for (const field of STUDENT_FIELDS) {
    if (field.key === 'name' || field.key === 'firstName') continue;
    if (field.headerAliases.some((alias) => norm.includes(normalizeHeaderKey(alias)))) {
      return field.key;
    }
  }
  if (norm === 'نام' || norm === 'اسم') return 'firstName';
  if (norm.includes('نام و نام')) return 'name';
  return '';
}

function suggestMappedValue(fieldKey: StudentImportFieldKey, rawValue: string): string {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) {
    if (fieldKey === 'isActive') return 'active';
    if (fieldKey === 'maritalStatus') return 'مجرد';
    if (fieldKey === 'livingStatus') return 'پدری';
    if (fieldKey === 'tammomStatus') return 'غیر معمم';
    return '';
  }

  const norm = normalizePersianText(trimmed).toLowerCase();

  if (fieldKey === 'grade') {
    const numMatch = norm.match(/^0*(\d{1,2})$/) || norm.match(/پایه\s*0*(\d{1,2})/) || norm.match(/grade\s*0*(\d{1,2})/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n >= 1 && n <= 12) return `پایه ${n}`;
    }
    const wordMap: Record<string, string> = {
      هفت: 'پایه 7',
      هفتم: 'پایه 7',
      هشت: 'پایه 8',
      هشتم: 'پایه 8',
      نه: 'پایه 9',
      نهم: 'پایه 9',
      ده: 'پایه 10',
      دهم: 'پایه 10',
      یازدهم: 'پایه 11',
      دوازدهم: 'پایه 12',
    };
    for (const [k, v] of Object.entries(wordMap)) {
      if (norm.includes(k)) return v;
    }
    return KEEP_ORIGINAL_TOKEN;
  }

  if (fieldKey === 'isActive') {
    if (
      norm === 'ه' ||
      norm === 'بله' ||
      norm === 'آری' ||
      norm === '1' ||
      norm === 'true' ||
      norm === 'active' ||
      norm.includes('در حال تحصیل') ||
      norm.includes('شاغل') ||
      norm.includes('حاضر') ||
      (norm.includes('فعال') && !norm.includes('غیر'))
    ) {
      return 'active';
    }
    if (
      norm === '0' ||
      norm === 'false' ||
      norm === 'خیر' ||
      norm === 'ن' ||
      norm === 'inactive' ||
      norm.includes('غیر') ||
      norm.includes('فارغ') ||
      norm.includes('انصراف') ||
      norm.includes('انتقال') ||
      norm.includes('مرخصی') ||
      norm.includes('اخراج') ||
      norm.includes('قطع') ||
      norm.includes('ترک')
    ) {
      return 'inactive';
    }
    return 'active';
  }

  if (fieldKey === 'deactivationReason') {
    if (norm.includes('فارغ')) return 'فارغ التحصیل';
    if (norm.includes('انتقال')) return 'انتقال اختیاری از مجموعه';
    if (norm.includes('قطع') || norm.includes('اخراج')) return 'قطع همکاری از مجموعه';
    if (norm.includes('مرخصی') || norm.includes('غیر') || norm.includes('انصراف')) return 'صرفا غیر فعال';
    return '';
  }

  if (fieldKey === 'maritalStatus') {
    if (norm.includes('متاهل') || norm === 'ت' || norm === 'married') return 'متاهل';
    return 'مجرد';
  }

  if (fieldKey === 'livingStatus') {
    if (norm.includes('خوابگاه')) return 'خوابگاه';
    if (norm.includes('اجاره') || norm.includes('مستاجر')) return 'اجاره ای';
    if (norm.includes('شخصی') || norm.includes('ملکی')) return 'شخصی';
    if (norm.includes('پدری') || norm.includes('والدین')) return 'پدری';
    return 'سایر';
  }

  if (fieldKey === 'tammomStatus') {
    if (norm.includes('شرف')) return 'در شرف تعمم';
    if (norm.includes('غیر') || norm === 'خیر' || norm === 'ن') return 'غیر معمم';
    if (norm.includes('معمم') || norm === 'بله' || norm === 'ه') return 'معمم';
    return 'غیر معمم';
  }

  return KEEP_ORIGINAL_TOKEN;
}

function loadSavedProfile(): SavedImportProfile | null {
  try {
    const raw = localStorage.getItem(IMPORT_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        ignoredHeaders: Array.isArray(parsed.ignoredHeaders) ? parsed.ignoredHeaders : [],
        headerToField: parsed.headerToField && typeof parsed.headerToField === 'object' ? parsed.headerToField : {},
        valueRules: parsed.valueRules && typeof parsed.valueRules === 'object' ? parsed.valueRules : {},
        duplicateStrategy:
          parsed.duplicateStrategy === 'skip_existing' ||
          parsed.duplicateStrategy === 'create_always' ||
          parsed.duplicateStrategy === 'update_existing'
            ? parsed.duplicateStrategy
            : 'update_existing',
      };
    }
  } catch (err) {
    console.warn('[ExcelImport] Failed to read saved import profile:', err);
  }
  return null;
}

export default function StudentExcelImportModal({
  isOpen,
  initialFile,
  existingStudents,
  onClose,
  onImportCompleted,
}: StudentExcelImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  // Workbook state
  const [workbookRef, setWorkbookRef] = useState<any>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawMatrix, setRawMatrix] = useState<string[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);

  // Step 1: selected column indices
  const [selectedColIndices, setSelectedColIndices] = useState<number[]>([]);

  // Step 2: colIndex -> StudentImportFieldKey
  const [colFieldMap, setColFieldMap] = useState<Record<number, StudentImportFieldKey>>({});

  // Step 3: fieldKey -> { rawValueKey -> targetValue }
  const [valueRules, setValueRules] = useState<Record<string, Record<string, string>>>({});
  const [customRuleInputs, setCustomRuleInputs] = useState<Record<string, boolean>>({});
  const [showTextTransformFields, setShowTextTransformFields] = useState<boolean>(false);
  const [newRuleInputs, setNewRuleInputs] = useState<Record<string, { raw: string; target: string }>>({});

  // Step 4: duplicate strategy, save profile, execution state
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('update_existing');
  const [saveProfileForNextTime, setSaveProfileForNextTime] = useState<boolean>(true);
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const [hasSavedProfile, setHasSavedProfile] = useState<boolean>(() => Boolean(loadSavedProfile()));

  // Load Excel file into workbook
  const parseExcelFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setImportResult(null);
    setPreviewSearch('');
    setCustomRuleInputs({});
    setNewRuleInputs({});
    setShowTextTransformFields(false);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        setParseError('هیچ برگه (Sheet) معتبری در فایل اکسل یافت نشد.');
        setIsParsing(false);
        return;
      }
      setWorkbookRef({ wb, XLSX });
      setSheetNames(wb.SheetNames);
      const firstSheet = wb.SheetNames[0];
      setSelectedSheet(firstSheet);
      loadSheetMatrix(wb, XLSX, firstSheet);
      setStep(1);
    } catch (err: any) {
      console.error('[ExcelImport] Parse error:', err);
      setParseError('خطا در خواندن فایل اکسل: ' + (err?.message || 'فرمت فایل نامعتبر است.'));
    } finally {
      setIsParsing(false);
    }
  };

  const loadSheetMatrix = (wb: any, XLSX: any, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      setRawMatrix([]);
      return;
    }
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as any[][];
    const stringMatrix: string[][] = (matrix || []).map((row) =>
      Array.isArray(row) ? row.map((cell) => (cell !== undefined && cell !== null ? String(cell).trim() : '')) : []
    );

    // Trim completely empty trailing rows
    let lastNonEmpty = stringMatrix.length - 1;
    while (lastNonEmpty >= 0 && stringMatrix[lastNonEmpty].every((c) => c === '')) {
      lastNonEmpty--;
    }
    const trimmedMatrix = stringMatrix.slice(0, lastNonEmpty + 1);
    setRawMatrix(trimmedMatrix);

    // Auto-detect likely header row among first 6 rows (densest non-empty unique strings)
    let bestRowIdx = 0;
    let bestScore = -1;
    const scanLimit = Math.min(6, trimmedMatrix.length);
    for (let r = 0; r < scanLimit; r++) {
      const cells = trimmedMatrix[r].filter((c) => c !== '');
      const uniqueCount = new Set(cells).size;
      const score = cells.length + uniqueCount;
      if (score > bestScore && cells.length >= 2) {
        bestScore = score;
        bestRowIdx = r;
      }
    }
    setHeaderRowIndex(bestRowIdx);
  };

  useEffect(() => {
    if (isOpen && initialFile) {
      parseExcelFile(initialFile);
    }
  }, [isOpen, initialFile]);

  // Build parsed columns & data rows whenever rawMatrix or headerRowIndex changes
  const { columns, dataRows } = useMemo(() => {
    if (!rawMatrix || rawMatrix.length === 0 || headerRowIndex >= rawMatrix.length) {
      return { columns: [] as ParsedColumn[], dataRows: [] as string[][] };
    }

    const headerRow = rawMatrix[headerRowIndex] || [];
    const maxCols = Math.max(
      headerRow.length,
      ...rawMatrix.slice(headerRowIndex + 1, headerRowIndex + 25).map((r) => r.length)
    );
    const rowsAfterHeader = rawMatrix
      .slice(headerRowIndex + 1)
      .filter((row) => row.some((cell) => cell !== ''));

    const parsedCols: ParsedColumn[] = [];
    for (let c = 0; c < maxCols; c++) {
      const rawH = (headerRow[c] || '').trim();
      const displayHeader = rawH || `ستون ${c + 1}`;
      const samples: string[] = [];
      let nonEmptyCount = 0;
      for (const row of rowsAfterHeader) {
        const val = (row[c] || '').trim();
        if (val !== '') {
          nonEmptyCount++;
          if (samples.length < 3 && !samples.includes(val)) {
            samples.push(val);
          }
        }
      }
      parsedCols.push({
        colIndex: c,
        header: displayHeader,
        normalizedHeader: normalizeHeaderKey(displayHeader),
        nonEmptyCount,
        sampleValues: samples,
      });
    }

    return { columns: parsedCols, dataRows: rowsAfterHeader };
  }, [rawMatrix, headerRowIndex]);

  // Initialize column selections & field mappings from saved profile or heuristics whenever columns change
  useEffect(() => {
    if (columns.length === 0) {
      setSelectedColIndices([]);
      setColFieldMap({});
      return;
    }

    const saved = loadSavedProfile();
    const ignoredSet = new Set((saved?.ignoredHeaders || []).map((h) => normalizeHeaderKey(h)));
    const nextSelected: number[] = [];
    const nextFieldMap: Record<number, StudentImportFieldKey> = {};
    const usedFields = new Set<StudentImportFieldKey>();

    for (const col of columns) {
      if (col.nonEmptyCount === 0) continue;

      const savedField = saved?.headerToField?.[col.normalizedHeader];
      const isSavedIgnored = ignoredSet.has(col.normalizedHeader);

      if (saved && isSavedIgnored) {
        // Respect previously ignored column
        continue;
      }

      nextSelected.push(col.colIndex);

      if (savedField && !usedFields.has(savedField)) {
        nextFieldMap[col.colIndex] = savedField;
        usedFields.add(savedField);
      } else {
        const guessed = autoMatchFieldByHeader(col.header);
        if (guessed && !usedFields.has(guessed)) {
          nextFieldMap[col.colIndex] = guessed;
          usedFields.add(guessed);
        } else {
          nextFieldMap[col.colIndex] = '';
        }
      }
    }

    if (saved) {
      setDuplicateStrategy(saved.duplicateStrategy);
      if (saved.valueRules && Object.keys(saved.valueRules).length > 0) {
        setValueRules((prev) => ({ ...saved.valueRules, ...prev }));
      }
    }

    setSelectedColIndices(nextSelected);
    setColFieldMap(nextFieldMap);
  }, [columns]);

  // Distinct values per mapped field (calculated from Excel dataRows)
  const mappedFieldsWithValues = useMemo(() => {
    const result: {
      field: StudentFieldDefinition;
      col: ParsedColumn;
      distinctValues: { rawKey: string; displayLabel: string; count: number }[];
    }[] = [];

    for (const colIndex of selectedColIndices) {
      const fieldKey = colFieldMap[colIndex];
      if (!fieldKey) continue;
      const col = columns.find((c) => c.colIndex === colIndex);
      const field = STUDENT_FIELDS.find((f) => f.key === fieldKey);
      if (!col || !field) continue;

      const counts = new Map<string, number>();
      for (const row of dataRows) {
        const raw = (row[colIndex] || '').trim();
        const key = raw === '' ? EMPTY_VALUE_TOKEN : raw;
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      const distinctValues = Array.from(counts.entries())
        .map(([rawKey, count]) => ({
          rawKey,
          displayLabel: rawKey === EMPTY_VALUE_TOKEN ? '(مقدار خالی)' : rawKey,
          count,
        }))
        .sort((a, b) => {
          if (a.rawKey === EMPTY_VALUE_TOKEN) return 1;
          if (b.rawKey === EMPTY_VALUE_TOKEN) return -1;
          return b.count - a.count;
        });

      result.push({ field, col, distinctValues });
    }

    return result;
  }, [selectedColIndices, colFieldMap, columns, dataRows]);

  // Auto-populate valueRules with smart guesses when entering Step 3 (without overwriting user/saved rules)
  useEffect(() => {
    if (step !== 3 && step !== 4) return;
    setValueRules((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const { field, distinctValues } of mappedFieldsWithValues) {
        if (!field.hasPredefinedOptions) continue;
        const existingFieldRules = { ...(next[field.key] || {}) };
        let fieldChanged = false;

        for (const item of distinctValues) {
          if (existingFieldRules[item.rawKey] === undefined) {
            const rawForGuess = item.rawKey === EMPTY_VALUE_TOKEN ? '' : item.rawKey;
            existingFieldRules[item.rawKey] = suggestMappedValue(field.key, rawForGuess);
            fieldChanged = true;
          }
        }

        if (fieldChanged || !next[field.key]) {
          next[field.key] = existingFieldRules;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [step, mappedFieldsWithValues]);

  // Duplicate field assignment warnings in Step 2
  const duplicateFieldTargets = useMemo(() => {
    const counts = new Map<StudentImportFieldKey, number>();
    for (const colIdx of selectedColIndices) {
      const fk = colFieldMap[colIdx];
      if (!fk) continue;
      counts.set(fk, (counts.get(fk) || 0) + 1);
    }
    const dups = new Set<StudentImportFieldKey>();
    counts.forEach((cnt, key) => {
      if (cnt > 1) dups.add(key);
    });
    return dups;
  }, [selectedColIndices, colFieldMap]);

  const hasNameMapping = useMemo(() => {
    return selectedColIndices.some((idx) => {
      const fk = colFieldMap[idx];
      return fk === 'name' || fk === 'firstName' || fk === 'lastName';
    });
  }, [selectedColIndices, colFieldMap]);

  // Index existing students for fast duplicate detection
  const existingByNationalId = useMemo(() => {
    const map = new Map<string, Student>();
    for (const st of existingStudents) {
      const nid = toLatinDigits(String(st.nationalId || (st as any).national_id || (st as any).nationalCode || '')).trim();
      if (nid && nid !== '---') {
        map.set(nid, st);
      }
    }
    return map;
  }, [existingStudents]);

  const existingByStudentCode = useMemo(() => {
    const map = new Map<string, Student>();
    for (const st of existingStudents) {
      const code = toLatinDigits(String(st.studentCode || '')).trim();
      if (code) {
        map.set(code, st);
      }
    }
    return map;
  }, [existingStudents]);

  // Apply value rules & build transformed Student rows for Step 4 preview & final execution
  const transformedRows: TransformedRowPreview[] = useMemo(() => {
    if (dataRows.length === 0) return [];

    return dataRows.map((row, idx) => {
      const warnings: string[] = [];
      const payload: Record<string, any> = {};

      for (const colIdx of selectedColIndices) {
        const fieldKey = colFieldMap[colIdx];
        if (!fieldKey) continue;
        const fieldDef = STUDENT_FIELDS.find((f) => f.key === fieldKey);
        if (!fieldDef) continue;

        const rawCell = (row[colIdx] || '').trim();
        const rawKey = rawCell === '' ? EMPTY_VALUE_TOKEN : rawCell;
        const fieldRuleMap = valueRules[fieldKey] || {};

        let resolvedValue: string = rawCell;
        if (Object.prototype.hasOwnProperty.call(fieldRuleMap, rawKey)) {
          const ruleTarget = fieldRuleMap[rawKey];
          resolvedValue = ruleTarget === KEEP_ORIGINAL_TOKEN ? rawCell : ruleTarget;
        } else if (fieldDef.hasPredefinedOptions) {
          const suggested = suggestMappedValue(fieldKey, rawCell);
          resolvedValue = suggested === KEEP_ORIGINAL_TOKEN ? rawCell : suggested;
        }

        if (fieldKey === 'isActive') {
          payload.isActive = resolvedValue === 'active';
        } else if (fieldKey === 'childrenCount') {
          const num = parseInt(toLatinDigits(resolvedValue), 10);
          payload.childrenCount = !isNaN(num) && num >= 0 ? num : 0;
        } else if (fieldDef.isNumericCode) {
          payload[fieldKey] = toLatinDigits(resolvedValue).trim();
        } else {
          payload[fieldKey] = resolvedValue.trim();
        }
      }

      // Resolve full name cleanly from name / firstName / lastName
      const fn = String(payload.firstName || '').trim();
      const ln = String(payload.lastName || '').trim();
      const directName = String(payload.name || '').trim();

      if (!directName && (fn || ln)) {
        payload.name = `${fn} ${ln}`.trim();
      } else if (directName && (!fn && !ln)) {
        const parts = directName.split(/\s+/);
        payload.firstName = parts[0] || '';
        payload.lastName = parts.slice(1).join(' ');
      }

      if (!payload.name) {
        payload.name = 'نامشخص';
        warnings.push('نام طلبه خالی است');
      }

      // Normalize status defaults if mapped or creating new
      if (payload.isActive === false && !payload.deactivationReason) {
        payload.deactivationReason = 'صرفا غیر فعال';
      } else if (payload.isActive === true) {
        payload.deactivationReason = undefined;
      }

      // Duplicate lookup
      const normNatId = payload.nationalId ? toLatinDigits(String(payload.nationalId)).trim() : '';
      const normStudentCode = payload.studentCode ? toLatinDigits(String(payload.studentCode)).trim() : '';

      let matchedExisting: Student | null = null;
      if (normNatId && existingByNationalId.has(normNatId)) {
        matchedExisting = existingByNationalId.get(normNatId) || null;
      } else if (!normNatId && normStudentCode && existingByStudentCode.has(normStudentCode)) {
        matchedExisting = existingByStudentCode.get(normStudentCode) || null;
      }

      let action: 'create' | 'update' | 'skip' = 'create';
      if (matchedExisting) {
        if (duplicateStrategy === 'update_existing') action = 'update';
        else if (duplicateStrategy === 'skip_existing') action = 'skip';
        else action = 'create';
      }

      return {
        rowIndex: idx + 1,
        studentData: payload as Partial<Student>,
        matchedExisting,
        action,
        warnings,
      };
    });
  }, [dataRows, selectedColIndices, colFieldMap, valueRules, existingByNationalId, existingByStudentCode, duplicateStrategy]);

  const summaryStats = useMemo(() => {
    let createCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    for (const r of transformedRows) {
      if (r.action === 'create') createCount++;
      else if (r.action === 'update') updateCount++;
      else skipCount++;
    }
    return { total: transformedRows.length, createCount, updateCount, skipCount };
  }, [transformedRows]);

  const filteredPreviewRows = useMemo(() => {
    const q = normalizePersianText(previewSearch).toLowerCase();
    if (!q) return transformedRows;
    return transformedRows.filter((r) => {
      const hay = normalizePersianText(
        `${r.studentData.name || ''} ${r.studentData.nationalId || ''} ${r.studentData.grade || ''} ${r.studentData.studentCode || ''}`
      ).toLowerCase();
      return hay.includes(q);
    });
  }, [transformedRows, previewSearch]);

  const toggleColumnSelection = (colIndex: number) => {
    setSelectedColIndices((prev) =>
      prev.includes(colIndex) ? prev.filter((i) => i !== colIndex) : [...prev, colIndex].sort((a, b) => a - b)
    );
  };

  const handleFieldAssignment = (colIndex: number, targetField: StudentImportFieldKey) => {
    setColFieldMap((prev) => ({
      ...prev,
      [colIndex]: targetField,
    }));
  };

  const handleValueRuleChange = (fieldKey: string, rawKey: string, newTarget: string) => {
    setValueRules((prev) => ({
      ...prev,
      [fieldKey]: {
        ...(prev[fieldKey] || {}),
        [rawKey]: newTarget,
      },
    }));
  };

  const handleAddManualRule = (fieldKey: string) => {
    const draft = newRuleInputs[fieldKey];
    if (!draft || !draft.raw.trim()) return;
    const rawKey = draft.raw.trim();
    const defaultTarget = PREDEFINED_OPTIONS_BY_FIELD[fieldKey]?.[0]?.value ?? '';
    handleValueRuleChange(fieldKey, rawKey, draft.target || defaultTarget);
    setNewRuleInputs((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const handleResetSavedProfile = () => {
    try {
      localStorage.removeItem(IMPORT_PROFILE_STORAGE_KEY);
      setHasSavedProfile(false);
    } catch (err) {
      console.warn('[ExcelImport] Failed to clear saved profile:', err);
    }
    // Re-apply heuristic defaults
    const nextSelected = columns.filter((c) => c.nonEmptyCount > 0).map((c) => c.colIndex);
    const nextMap: Record<number, StudentImportFieldKey> = {};
    const used = new Set<StudentImportFieldKey>();
    for (const col of columns) {
      if (col.nonEmptyCount === 0) continue;
      const g = autoMatchFieldByHeader(col.header);
      if (g && !used.has(g)) {
        nextMap[col.colIndex] = g;
        used.add(g);
      } else {
        nextMap[col.colIndex] = '';
      }
    }
    setSelectedColIndices(nextSelected);
    setColFieldMap(nextMap);
    setValueRules({});
    setCustomRuleInputs({});
  };

  const handleExecuteImport = async () => {
    if (isImporting || transformedRows.length === 0) return;
    setIsImporting(true);
    setImportProgress({ current: 0, total: transformedRows.length });

    // Persist profile if user opted in
    if (saveProfileForNextTime) {
      try {
        const selectedSet = new Set(selectedColIndices);
        const ignoredHeaders = columns
          .filter((c) => !selectedSet.has(c.colIndex) && c.nonEmptyCount > 0)
          .map((c) => c.normalizedHeader);

        const headerToField: Record<string, StudentImportFieldKey> = {};
        for (const col of columns) {
          if (selectedSet.has(col.colIndex) && colFieldMap[col.colIndex]) {
            headerToField[col.normalizedHeader] = colFieldMap[col.colIndex];
          }
        }

        const profileToSave: SavedImportProfile = {
          ignoredHeaders,
          headerToField,
          valueRules,
          duplicateStrategy,
        };
        localStorage.setItem(IMPORT_PROFILE_STORAGE_KEY, JSON.stringify(profileToSave));
        setHasSavedProfile(true);
      } catch (err) {
        console.warn('[ExcelImport] Could not save import profile to localStorage:', err);
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < transformedRows.length; i++) {
      const row = transformedRows[i];
      setImportProgress({ current: i + 1, total: transformedRows.length });

      if (row.action === 'skip') {
        skipped++;
        continue;
      }

      try {
        const nowIso = new Date().toISOString();
        if (row.action === 'update' && row.matchedExisting) {
          const existing = row.matchedExisting;
          const nextVersion = ((existing as any).version || 0) + 1;
          await localDb.updateDoc('students', existing.id, {
            ...row.studentData,
            version: nextVersion,
            updated_at: nowIso,
            updatedAt: nowIso,
          });
          updated++;
        } else {
          const defaults: Partial<Student> = {
            isActive: true,
            maritalStatus: 'مجرد',
            childrenCount: 0,
            livingStatus: 'پدری',
            tammomStatus: 'غیر معمم',
          };
          const newRecord = {
            ...defaults,
            ...row.studentData,
            version: 1,
            updated_at: nowIso,
            createdAt: nowIso,
          };
          if (newRecord.isActive === false && !newRecord.deactivationReason) {
            newRecord.deactivationReason = 'صرفا غیر فعال';
          }
          await localDb.addDoc('students', newRecord);
          created++;
        }
      } catch (err: any) {
        failed++;
        const msg = `ردیف ${row.rowIndex} (${row.studentData.name || 'نامشخص'}): ${err?.message || 'خطا در ذخیره‌سازی'}`;
        errors.push(msg);
        console.error('[EXCEL_IMPORT_ROW_FAILURE]', msg, err);
      }
    }

    setIsImporting(false);
    setImportResult({ created, updated, skipped, failed, errors });
    onImportCompleted();
  };

  if (!isOpen) return null;

  const stepsMeta = [
    { num: 1 as const, title: '۱. انتخاب ستون‌های مهم' },
    { num: 2 as const, title: '۲. اتصال به فیلدهای طلبه' },
    { num: 3 as const, title: '۳. قوانین تبدیل مقادیر' },
    { num: 4 as const, title: '۴. پیش‌نمایش و ثبت نهایی' },
  ];

  const mappedTargetList = mappedFieldsWithValues.filter((item) => item.field.hasPredefinedOptions);
  const mappedOtherTextList = mappedFieldsWithValues.filter(
    (item) => !item.field.hasPredefinedOptions && item.field.key !== 'name' && item.field.key !== 'firstName' && item.field.key !== 'lastName' && item.field.key !== 'nationalId'
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-vazir" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-900 truncate">
                ورود هوشمند و سفارشی مشخصات طلاب از اکسل
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 truncate">
                <span className="truncate">{fileName || 'فایل انتخاب‌نشده'}</span>
                {dataRows.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{dataRows.length.toLocaleString('fa-IR')} ردیف داده</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{columns.length.toLocaleString('fa-IR')} ستون</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <Upload size={14} />
              <span>تغییر فایل اکسل</span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) parseExcelFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            {hasSavedProfile && (
              <button
                type="button"
                onClick={handleResetSavedProfile}
                className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="حذف الگوی ذخیره‌شده و تشخیص مجدد"
              >
                <RotateCcw size={13} />
                <span>بازنشانی الگو</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              aria-label="بستن"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Step Navigation Bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-2 overflow-x-auto">
          {stepsMeta.map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                disabled={isImporting || Boolean(importResult) || (s.num > 1 && selectedColIndices.length === 0) || (s.num > 2 && !hasNameMapping)}
                onClick={() => setStep(s.num)}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 border cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                )}
              >
                {isDone && <Check size={14} />}
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
          {isParsing ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-600">
              <RefreshCw size={28} className="animate-spin text-indigo-600" />
              <p className="text-sm font-bold">در حال خواندن ساختار فایل اکسل...</p>
            </div>
          ) : parseError ? (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800">
              <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <p className="text-sm font-bold">امکان پردازش فایل وجود ندارد</p>
                <p className="text-xs">{parseError}</p>
              </div>
            </div>
          ) : importResult ? (
            /* Final Result View */
            <div className="max-w-2xl mx-auto py-6 space-y-5">
              <div
                className={cn(
                  'p-6 rounded-xl border text-center space-y-3',
                  importResult.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                )}
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center mx-auto',
                    importResult.failed > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  )}
                >
                  {importResult.failed > 0 ? <AlertCircle size={26} /> : <CheckCircle size={26} />}
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {importResult.failed > 0 ? 'عملیات ورود اکسل با برخی هشدارها پایان یافت' : 'اطلاعات اکسل با موفقیت در سامانه ثبت شد'}
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-700 pt-1 tabular-nums">
                  <span>ایجاد شده: {importResult.created.toLocaleString('fa-IR')} نفر</span>
                  <span aria-hidden="true">·</span>
                  <span>به‌روزرسانی شده: {importResult.updated.toLocaleString('fa-IR')} نفر</span>
                  <span aria-hidden="true">·</span>
                  <span>رد شده (تکراری): {importResult.skipped.toLocaleString('fa-IR')} ردیف</span>
                  {importResult.failed > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-rose-700">خطا: {importResult.failed.toLocaleString('fa-IR')} ردیف</span>
                    </>
                  )}
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="border border-rose-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-xs font-bold text-rose-800">
                    جزئیات ردیف‌های دارای خطا
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-rose-100 text-xs text-rose-700 p-3 space-y-1.5">
                    {importResult.errors.map((errMsg, i) => (
                      <div key={i}>{errMsg}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : step === 1 ? (
            /* STEP 1: PREVIEW & COLUMN SELECTION */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-slate-800">
                    ستون‌های مهم اکسل را تیک بزنید
                  </h3>
                  <p className="text-xs text-slate-500">
                    ستون‌هایی که به کار شما نمی‌آیند را بدون تیک بگذارید تا در مراحل بعد نادیده گرفته شوند.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {sheetNames.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-bold text-slate-600">برگه (Sheet):</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => {
                          const sName = e.target.value;
                          setSelectedSheet(sName);
                          if (workbookRef) {
                            loadSheetMatrix(workbookRef.wb, workbookRef.XLSX, sName);
                          }
                        }}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {sheetNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {rawMatrix.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-bold text-slate-600">ردیف سرستون:</span>
                      <select
                        value={headerRowIndex}
                        onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                      >
                        {rawMatrix.slice(0, Math.min(8, rawMatrix.length)).map((row, rIdx) => {
                          const previewText = row.filter(Boolean).slice(0, 3).join(' / ');
                          return (
                            <option key={rIdx} value={rIdx}>
                              ردیف {(rIdx + 1).toLocaleString('fa-IR')} {previewText ? `(${previewText.slice(0, 35)})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedColIndices(columns.filter((c) => c.nonEmptyCount > 0).map((c) => c.colIndex))}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    انتخاب همه ستون‌ها
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedColIndices([])}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    لغو همه
                  </button>
                </div>
              </div>

              {/* Selection counter */}
              <div className="text-xs font-bold text-slate-600 flex items-center justify-between px-1 tabular-nums">
                <span>
                  پیش‌نمایش ۸ ردیف اول فایل · {selectedColIndices.length.toLocaleString('fa-IR')} ستون از {columns.length.toLocaleString('fa-IR')} ستون انتخاب شده
                </span>
                {selectedColIndices.length === 0 && (
                  <span className="text-rose-600">حداقل یک ستون باید انتخاب شود</span>
                )}
              </div>

              {/* Excel Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-3 text-slate-400 font-bold border-l border-slate-200 w-10 text-center tabular-nums">
                        #
                      </th>
                      {columns.map((col) => {
                        const isChecked = selectedColIndices.includes(col.colIndex);
                        return (
                          <th
                            key={col.colIndex}
                            onClick={() => toggleColumnSelection(col.colIndex)}
                            className={cn(
                              'px-3 py-2.5 border-l border-slate-200 last:border-l-0 cursor-pointer select-none transition-colors min-w-[140px] align-top',
                              isChecked ? 'bg-indigo-50/70 text-slate-900' : 'bg-slate-100/60 text-slate-400 opacity-65 hover:opacity-90'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="mt-0.5 w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-black text-xs break-words leading-snug">
                                  {col.header}
                                </div>
                                <div className="text-[11px] font-normal text-slate-500 mt-0.5 tabular-nums">
                                  {col.nonEmptyCount.toLocaleString('fa-IR')} مقدار غیرخالی
                                </div>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataRows.slice(0, 8).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 text-slate-400 font-mono text-center border-l border-slate-200 tabular-nums">
                          {rIdx + 1}
                        </td>
                        {columns.map((col) => {
                          const isChecked = selectedColIndices.includes(col.colIndex);
                          const cellVal = row[col.colIndex] || '';
                          return (
                            <td
                              key={col.colIndex}
                              className={cn(
                                'px-3 py-2.5 border-l border-slate-100 last:border-l-0 max-w-[200px] truncate',
                                isChecked ? 'text-slate-800 bg-white' : 'text-slate-400 bg-slate-50/60 opacity-50'
                              )}
                              title={cellVal}
                            >
                              {cellVal || <span className="text-slate-300">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : step === 2 ? (
            /* STEP 2: COLUMN TO STUDENT FIELD MAPPING */
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-slate-800">
                    مشخص کنید هر ستون اکسل مربوط به کدام فیلد پرونده طلبه است
                  </h3>
                  <p className="text-xs text-slate-500">
                    اگر نام و نام خانوادگی در اکسل دو ستون مجزا هستند، هر کدام را جداگانه به «نام» و «نام خانوادگی» وصل کنید تا خودکار ترکیب شوند.
                  </p>
                </div>
                <div className="text-xs font-bold text-slate-600 tabular-nums">
                  {selectedColIndices.filter((i) => Boolean(colFieldMap[i])).length.toLocaleString('fa-IR')} ستون متصل‌شده
                </div>
              </div>

              {!hasNameMapping && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs font-bold text-rose-800">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>برای ادامه، حداقل یکی از ستون‌ها باید به «نام و نام خانوادگی» یا «نام / نام خانوادگی» متصل شود.</span>
                </div>
              )}

              {duplicateFieldTargets.size > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs font-bold text-amber-800">
                  <AlertCircle size={16} className="shrink-0 text-amber-600" />
                  <span>توجه: بیش از یک ستون اکسل به یک فیلد مشابه متصل شده است. بهتر است هر فیلد فقط یک ستون مبدأ داشته باشد.</span>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 text-xs font-bold text-slate-600">
                  <div className="md:col-span-5">ستون در فایل اکسل و نمونه داده‌ها</div>
                  <div className="md:col-span-5">فیلد متناظر در پرونده طلبه</div>
                  <div className="md:col-span-2 text-left">وضعیت</div>
                </div>

                {selectedColIndices.map((colIndex) => {
                  const col = columns.find((c) => c.colIndex === colIndex);
                  if (!col) return null;
                  const mappedField = colFieldMap[colIndex] || '';
                  const isDup = mappedField !== '' && duplicateFieldTargets.has(mappedField);

                  return (
                    <div
                      key={colIndex}
                      className={cn(
                        'grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-3 items-center transition-colors',
                        mappedField ? 'bg-white' : 'bg-slate-50/40'
                      )}
                    >
                      <div className="md:col-span-5 min-w-0 space-y-1">
                        <div className="font-black text-xs text-slate-900">{col.header}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          نمونه‌ها:{' '}
                          {col.sampleValues.length > 0
                            ? col.sampleValues.join(' · ')
                            : 'بدون نمونه غیرخالی'}
                        </div>
                      </div>

                      <div className="md:col-span-5">
                        <select
                          value={mappedField}
                          onChange={(e) => handleFieldAssignment(colIndex, e.target.value as StudentImportFieldKey)}
                          className={cn(
                            'w-full px-3 py-2 text-xs font-bold rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 bg-white',
                            isDup
                              ? 'border-amber-400 text-amber-900'
                              : mappedField
                              ? 'border-indigo-300 text-slate-900'
                              : 'border-slate-200 text-slate-500'
                          )}
                        >
                          <option value="">— نادیده گرفته شود —</option>
                          {(Object.keys(FIELD_GROUP_LABELS) as StudentFieldDefinition['group'][]).map((grp) => (
                            <optgroup key={grp} label={FIELD_GROUP_LABELS[grp]}>
                              {STUDENT_FIELDS.filter((f) => f.group === grp).map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2 flex items-center justify-end text-xs font-bold">
                        {isDup ? (
                          <span className="text-amber-700">تداخل فیلد</span>
                        ) : mappedField ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <Check size={14} />
                            متصل
                          </span>
                        ) : (
                          <span className="text-slate-400">نادیده</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : step === 3 ? (
            /* STEP 3: VALUE MAPPING RULES ("اگر فلان نوشته بود -> فلان را انتخاب کن") */
            <div className="space-y-5">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <h3 className="text-sm font-black text-slate-800">
                  تنظیم قوانین تبدیل مقادیر («اگر در اکسل فلان نوشته بود ← در سامانه فلان ثبت شود»)
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  در این مرحله تمام مقادیر یکتایی که داخل فایل اکسل شما وجود دارد نمایش داده می‌شوند. برای مثال اگر در اکسل «07» نوشته شده، مشخص کنید به «پایه 7» تبدیل شود یا اگر «ه» / «در حال تحصیل» نوشته شده، به «فعال» تبدیل شود.
                </p>
              </div>

              {mappedTargetList.length === 0 && mappedOtherTextList.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 rounded-xl text-xs text-slate-500 font-bold">
                  هیچ ستون دارای مقادیر قابل نگاشت انتخاب نشده است. می‌توانید مستقیم به مرحله پیش‌نمایش نهایی بروید.
                </div>
              ) : (
                <div className="space-y-5">
                  {mappedTargetList.map(({ field, col, distinctValues }) => {
                    const options = PREDEFINED_OPTIONS_BY_FIELD[field.key] || [];
                    const currentFieldRules = valueRules[field.key] || {};
                    const newDraft = newRuleInputs[field.key] || { raw: '', target: options[0]?.value ?? '' };
                    const extraCustomKeys = Object.keys(currentFieldRules).filter(
                      (k) => !distinctValues.some((d) => d.rawKey === k)
                    );

                    return (
                      <div key={field.key} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-slate-900">
                              {field.label}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              ستون اکسل: {col.header} · {distinctValues.length.toLocaleString('fa-IR')} مقدار یکتا در فایل
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const nextRules: Record<string, string> = {};
                              for (const dv of distinctValues) {
                                const rawForGuess = dv.rawKey === EMPTY_VALUE_TOKEN ? '' : dv.rawKey;
                                nextRules[dv.rawKey] = suggestMappedValue(field.key, rawForGuess);
                              }
                              setValueRules((prev) => ({ ...prev, [field.key]: nextRules }));
                            }}
                            className="px-3 py-1.5 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          >
                            پیشنهاد هوشمند خودکار
                          </button>
                        </div>

                        <div className="divide-y divide-slate-100">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-2 bg-white text-[11px] font-bold text-slate-500">
                            <div className="md:col-span-5">مقدار موجود در اکسل</div>
                            <div className="md:col-span-2 text-center">تعداد ردیف</div>
                            <div className="md:col-span-5">مقدار معادل در سامانه</div>
                          </div>

                          {[...distinctValues, ...extraCustomKeys.map((k) => ({ rawKey: k, displayLabel: k, count: 0 }))].map((item) => {
                            const currentTarget =
                              currentFieldRules[item.rawKey] !== undefined
                                ? currentFieldRules[item.rawKey]
                                : suggestMappedValue(field.key, item.rawKey === EMPTY_VALUE_TOKEN ? '' : item.rawKey);

                            const customFlagKey = `${field.key}::${item.rawKey}`;
                            const isKnownOption =
                              options.some((o) => o.value === currentTarget) || currentTarget === KEEP_ORIGINAL_TOKEN;
                            const isCustomMode = customRuleInputs[customFlagKey] || (field.key === 'grade' && !isKnownOption && currentTarget !== '');

                            return (
                              <div key={item.rawKey} className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-2.5 items-center bg-white hover:bg-slate-50/50">
                                <div className="md:col-span-5 text-xs font-bold text-slate-800 break-words">
                                  {item.rawKey === EMPTY_VALUE_TOKEN ? (
                                    <span className="text-slate-400 italic">(سلول خالی)</span>
                                  ) : (
                                    <span>«{item.displayLabel}»</span>
                                  )}
                                </div>

                                <div className="md:col-span-2 text-center text-xs text-slate-500 tabular-nums">
                                  {item.count > 0 ? `${item.count.toLocaleString('fa-IR')} ردیف` : 'قانون دستی'}
                                </div>

                                <div className="md:col-span-5 flex items-center gap-2">
                                  <select
                                    value={isCustomMode ? '__CUSTOM__' : currentTarget}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '__CUSTOM__') {
                                        setCustomRuleInputs((prev) => ({ ...prev, [customFlagKey]: true }));
                                        handleValueRuleChange(field.key, item.rawKey, item.rawKey === EMPTY_VALUE_TOKEN ? '' : item.rawKey);
                                      } else {
                                        setCustomRuleInputs((prev) => ({ ...prev, [customFlagKey]: false }));
                                        handleValueRuleChange(field.key, item.rawKey, val);
                                      }
                                    }}
                                    className="flex-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    {options.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                    {field.key === 'grade' && (
                                      <>
                                        <option value={KEEP_ORIGINAL_TOKEN}>نگهداری دقیق متن اکسل</option>
                                        <option value="__CUSTOM__">مقدار دلخواه...</option>
                                      </>
                                    )}
                                  </select>

                                  {isCustomMode && field.key === 'grade' && (
                                    <input
                                      type="text"
                                      value={currentTarget === KEEP_ORIGINAL_TOKEN ? '' : currentTarget}
                                      onChange={(e) => handleValueRuleChange(field.key, item.rawKey, e.target.value)}
                                      placeholder="مقدار دلخواه..."
                                      className="w-32 px-2.5 py-1.5 text-xs border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  )}

                                  {item.count === 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setValueRules((prev) => {
                                          const copy = { ...(prev[field.key] || {}) };
                                          delete copy[item.rawKey];
                                          return { ...prev, [field.key]: copy };
                                        });
                                      }}
                                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                      title="حذف قانون دستی"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add extra custom rule for future values */}
                        <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600">افزودن قانون اضافی (اختیاری):</span>
                          <input
                            type="text"
                            value={newDraft.raw}
                            onChange={(e) =>
                              setNewRuleInputs((prev) => ({
                                ...prev,
                                [field.key]: { ...newDraft, raw: e.target.value },
                              }))
                            }
                            placeholder="اگر در اکسل نوشته بود..."
                            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 w-44"
                          />
                          <span className="text-xs text-slate-400">←</span>
                          <select
                            value={newDraft.target}
                            onChange={(e) =>
                              setNewRuleInputs((prev) => ({
                                ...prev,
                                [field.key]: { ...newDraft, target: e.target.value },
                              }))
                            }
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddManualRule(field.key)}
                            disabled={!newDraft.raw.trim()}
                            className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg disabled:opacity-40 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                          >
                            <Plus size={13} />
                            <span>افزودن قانون</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Optional value transformation for other text fields */}
                  {mappedOtherTextList.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowTextTransformFields((prev) => !prev)}
                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                      >
                        <span>تبدیل مقادیر سایر ستون‌های متنی (اختیاری — مانند تحصیلات، محل تولد و...)</span>
                        {showTextTransformFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      {showTextTransformFields && (
                        <div className="divide-y divide-slate-200">
                          {mappedOtherTextList.map(({ field, col, distinctValues }) => {
                            const currentFieldRules = valueRules[field.key] || {};
                            return (
                              <div key={field.key} className="p-4 space-y-2.5 bg-white">
                                <div className="text-xs font-black text-slate-800">
                                  {field.label} <span className="font-normal text-slate-500">({col.header})</span>
                                </div>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {distinctValues.slice(0, 40).map((item) => {
                                    const ruleVal = currentFieldRules[item.rawKey];
                                    const hasCustom = ruleVal !== undefined && ruleVal !== KEEP_ORIGINAL_TOKEN;
                                    return (
                                      <div key={item.rawKey} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-xs">
                                        <div className="md:col-span-5 text-slate-700 truncate">
                                          {item.rawKey === EMPTY_VALUE_TOKEN ? '(خالی)' : `«${item.displayLabel}»`}
                                          <span className="text-slate-400 mr-1.5 tabular-nums">({item.count.toLocaleString('fa-IR')})</span>
                                        </div>
                                        <div className="md:col-span-7">
                                          <input
                                            type="text"
                                            value={hasCustom ? ruleVal : ''}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              handleValueRuleChange(field.key, item.rawKey, v === '' ? KEEP_ORIGINAL_TOKEN : v);
                                            }}
                                            placeholder="بدون تغییر (یا متن جایگزین را بنویسید)"
                                            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* STEP 4: TRANSFORMED PREVIEW & FINAL IMPORT */
            <div className="space-y-4">
              {/* Strategy & Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <label className="block text-xs font-black text-slate-800">
                    نحوه برخورد با طلاب تکراری (تطابق بر اساس کد ملی یا کد طلبگی):
                  </label>
                  <select
                    value={duplicateStrategy}
                    onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="update_existing">
                      به‌روزرسانی پرونده طلبه موجود و افزودن طلاب جدید (پیشنهادی)
                    </option>
                    <option value="skip_existing">
                      نادیده گرفتن طلاب تکراری و فقط افزودن طلاب جدید
                    </option>
                    <option value="create_always">
                      افزودن همه ردیف‌ها به‌عنوان پرونده جدید
                    </option>
                  </select>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveProfileForNextTime}
                      onChange={(e) => setSaveProfileForNextTime(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                    <span>ذخیره این انتخاب ستون‌ها و قوانین تبدیل برای وارد کردن‌های بعدی</span>
                  </label>
                </div>

                <div className="lg:col-span-5 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between gap-2">
                  <div className="text-xs font-black text-slate-800">خلاصه عملیات پیش‌رو</div>
                  <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="text-base font-black text-emerald-700">{summaryStats.createCount.toLocaleString('fa-IR')}</div>
                      <div className="text-[11px] font-bold text-slate-500 mt-0.5">طلبه جدید</div>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="text-base font-black text-indigo-700">{summaryStats.updateCount.toLocaleString('fa-IR')}</div>
                      <div className="text-[11px] font-bold text-slate-500 mt-0.5">به‌روزرسانی</div>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="text-base font-black text-slate-500">{summaryStats.skipCount.toLocaleString('fa-IR')}</div>
                      <div className="text-[11px] font-bold text-slate-500 mt-0.5">رد شده</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search in Final Preview */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <Eye size={15} className="text-indigo-600" />
                  <span>پیش‌نمایش داده‌های نهایی پس از اعمال قوانین تبدیل</span>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="جستجو در پیش‌نمایش..."
                    className="w-full pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Final Transformed Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[340px] overflow-y-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center tabular-nums">#</th>
                      <th className="px-3 py-2.5">عملیات</th>
                      <th className="px-3 py-2.5">نام و نام خانوادگی</th>
                      <th className="px-3 py-2.5">کد ملی</th>
                      <th className="px-3 py-2.5">پایه تحصیلی</th>
                      <th className="px-3 py-2.5">وضعیت حضور</th>
                      <th className="px-3 py-2.5">تاهل / سکونت</th>
                      <th className="px-3 py-2.5">شماره تماس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreviewRows.slice(0, 60).map((r) => {
                      const d = r.studentData;
                      const activeBool = d.isActive !== undefined ? isStudentActive(d.isActive) : true;
                      return (
                        <tr key={r.rowIndex} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-center text-slate-400 font-mono tabular-nums">{r.rowIndex}</td>
                          <td className="px-3 py-2 font-bold whitespace-nowrap">
                            {r.action === 'create' ? (
                              <span className="text-emerald-700">ایجاد جدید</span>
                            ) : r.action === 'update' ? (
                              <span className="text-indigo-700">به‌روزرسانی</span>
                            ) : (
                              <span className="text-slate-400">رد می‌شود</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">{d.name || 'نامشخص'}</td>
                          <td className="px-3 py-2 font-mono text-slate-700 tabular-nums">{d.nationalId || '—'}</td>
                          <td className="px-3 py-2 text-slate-800 font-bold">{d.grade || '—'}</td>
                          <td className="px-3 py-2 font-bold whitespace-nowrap">
                            {d.isActive === undefined ? (
                              <span className="text-slate-400">فعال (پیش‌فرض)</span>
                            ) : activeBool ? (
                              <span className="text-emerald-700">فعال</span>
                            ) : (
                              <span className="text-rose-700">
                                غیرفعال {d.deactivationReason ? `(${d.deactivationReason})` : ''}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {[d.maritalStatus, d.livingStatus].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 tabular-nums">{d.phoneNumber || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredPreviewRows.length > 60 && (
                <p className="text-[11px] text-slate-500 text-center tabular-nums">
                  نمایش ۶۰ ردیف اول از {filteredPreviewRows.length.toLocaleString('fa-IR')} ردیف (تمامی ردیف‌ها ثبت خواهند شد)
                </p>
              )}

              {isImporting && (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900 tabular-nums">
                    <span>در حال ثبت اطلاعات در سامانه و سرور...</span>
                    <span>
                      {importProgress.current.toLocaleString('fa-IR')} از {importProgress.total.toLocaleString('fa-IR')}
                    </span>
                  </div>
                  <progress
                    value={importProgress.current}
                    max={Math.max(1, importProgress.total)}
                    className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-indigo-100 [&::-webkit-progress-value]:bg-indigo-600 [&::-moz-progress-bar]:bg-indigo-600"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          {importResult ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                بستن و مشاهده لیست طلاب
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={isImporting}
                onClick={() => {
                  if (step === 1) onClose();
                  else setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-40"
              >
                {step > 1 && <ArrowRight size={14} />}
                <span>{step === 1 ? 'انصراف' : 'مرحله قبل'}</span>
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  disabled={
                    isParsing ||
                    Boolean(parseError) ||
                    (step === 1 && selectedColIndices.length === 0) ||
                    (step === 2 && !hasNameMapping)
                  }
                  onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed"
                >
                  <span>مرحله بعد</span>
                  <ArrowLeft size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isImporting || transformedRows.length === 0}
                  onClick={handleExecuteImport}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>در حال ثبت...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>تایید و ثبت نهایی ({(summaryStats.createCount + summaryStats.updateCount).toLocaleString('fa-IR')} نفر)</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
