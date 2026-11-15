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
import { localDb } from '../../lib/localDb';
import { Teacher, TeacherCategory, TeacherBankAccount } from '../../types';
import { cn } from '../../lib/utils';

const ALL_TEACHER_CATEGORIES: TeacherCategory[] = [
  'فقه',
  'اصول',
  'فلسفه',
  'مشاوره اصول',
  'مشاوره فقه',
  'مشاوره فلسفه',
  'دروس پنجشنبه',
  'ویژه',
];

export type TeacherImportFieldKey =
  | ''
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'fatherName'
  | 'nationalId'
  | 'birthDate'
  | 'birthCertificateNumber'
  | 'phoneNumber'
  | 'homePhone'
  | 'homeAddress'
  | 'teacherCode'
  | 'centerTeacherCode'
  | 'servicesCenterCode'
  | 'managementCenterFileNumber'
  | 'isActive'
  | 'priority'
  | 'categories'
  | 'experienceHistory'
  | 'notes'
  | 'bankSheba'
  | 'tejaratBankAccount'
  | 'sibaBankAccount'
  | 'sandooqAccount'
  | 'bankName'
  | 'bankAccount';

interface TeacherFieldDefinition {
  key: Exclude<TeacherImportFieldKey, ''>;
  label: string;
  group: 'identity' | 'codes' | 'academic' | 'finance';
  hasPredefinedOptions?: boolean;
  isNumericCode?: boolean;
  headerAliases: string[];
}

const TEACHER_FIELDS: TeacherFieldDefinition[] = [
  // اطلاعات هویتی، پایه و تماس
  {
    key: 'fullName',
    label: 'نام و نام خانوادگی (کامل)',
    group: 'identity',
    headerAliases: ['نام و نام خانوادگی', 'نام کامل', 'نام خانوادگی و نام', 'نام استاد', 'مشخصات', 'fullname', 'full name', 'name'],
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
    key: 'fatherName',
    label: 'نام پدر',
    group: 'identity',
    headerAliases: ['نام پدر', 'پدر', 'fathername', 'father name'],
  },
  {
    key: 'nationalId',
    label: 'کد ملی',
    group: 'identity',
    isNumericCode: true,
    headerAliases: ['کد ملی', 'کدملی', 'شماره ملی', 'nationalid', 'national id', 'nationalcode'],
  },
  {
    key: 'birthDate',
    label: 'تاریخ تولد',
    group: 'identity',
    headerAliases: ['تاریخ تولد', 'تولد', 'birthdate', 'birth date', 'dob'],
  },
  {
    key: 'birthCertificateNumber',
    label: 'شماره شناسنامه',
    group: 'identity',
    isNumericCode: true,
    headerAliases: ['ش.شناسنامه', 'ش شناسنامه', 'شماره شناسنامه', 'شناسنامه', 'birthcertificatenumber', 'idnumber'],
  },
  {
    key: 'phoneNumber',
    label: 'شماره تماس / همراه',
    group: 'identity',
    isNumericCode: true,
    headerAliases: ['شماره تماس', 'شماره همراه', 'موبایل', 'همراه', 'تلفن همراه', 'تلفن', 'phone', 'phonenumber', 'mobile'],
  },
  {
    key: 'homePhone',
    label: 'شماره منزل',
    group: 'identity',
    isNumericCode: true,
    headerAliases: ['شماره منزل', 'تلفن منزل', 'تلفن ثابت', 'منزل', 'homephone', 'home phone'],
  },
  {
    key: 'homeAddress',
    label: 'آدرس منزل',
    group: 'identity',
    headerAliases: ['آدرس منزل', 'ادرس منزل', 'آدرس', 'ادرس', 'نشانی', 'محل سکونت', 'homeaddress', 'address'],
  },

  // کدها و شناسه‌های سازمانی
  {
    key: 'teacherCode',
    label: 'شناسه / کد استادی داخلی',
    group: 'codes',
    isNumericCode: true,
    headerAliases: ['کد استادی', 'شناسه استادی', 'کد استاد', 'شناسه', 'teachercode', 'teacher code'],
  },
  {
    key: 'centerTeacherCode',
    label: 'کد استاد مرکز',
    group: 'codes',
    isNumericCode: true,
    headerAliases: ['کد استاد مرکز', 'کد استادی مرکز', 'کد مرکز استاد', 'centerteachercode'],
  },
  {
    key: 'servicesCenterCode',
    label: 'کد مرکز خدمات',
    group: 'codes',
    isNumericCode: true,
    headerAliases: ['کد مرکز خدمات', 'مرکز خدمات', 'servicescentercode'],
  },
  {
    key: 'managementCenterFileNumber',
    label: 'شماره پرونده مرکز مدیریت',
    group: 'codes',
    isNumericCode: true,
    headerAliases: ['شماره پرونده مرکز مدیریت', 'پرونده مرکز مدیریت', 'شماره پرونده', 'کد مرکز مدیریت', 'managementcenterfilenumber'],
  },

  // وضعیت، اولویت، تخصص و سوابق
  {
    key: 'isActive',
    label: 'وضعیت استاد (فعال / غیرفعال)',
    group: 'academic',
    hasPredefinedOptions: true,
    headerAliases: ['وضعیت استاد', 'وضعیت', 'حالت', 'فعال', 'isactive', 'status'],
  },
  {
    key: 'priority',
    label: 'اولویت پیشنهادی (۱ تا ۳)',
    group: 'academic',
    hasPredefinedOptions: true,
    headerAliases: ['اولویت پیشنهادی', 'اولویت پیشنهاد', 'اولویت', 'priority'],
  },
  {
    key: 'categories',
    label: 'تخصص‌های کلی (فقه، اصول، فلسفه و...)',
    group: 'academic',
    headerAliases: ['تخصص‌های کلی', 'تخصص های کلی', 'تخصص', 'دسته', 'دسته‌بندی', 'گرایش', 'categories', 'category'],
  },
  {
    key: 'experienceHistory',
    label: 'سوابق تدریس دستی و بازخوردها',
    group: 'academic',
    headerAliases: ['سوابق تدریس در مجموعه', 'سوابق تدریس', 'سوابق', 'experiencehistory', 'experience'],
  },
  {
    key: 'notes',
    label: 'توضیحات و ملاحظات تکمیلی',
    group: 'academic',
    headerAliases: ['توضیحات', 'ملاحظات', 'یادداشت', 'notes', 'note'],
  },

  // مالی و بانکی
  {
    key: 'bankSheba',
    label: 'شماره شبا (IR...)',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره شبا', 'شبا', 'banksheba', 'sheba', 'iban'],
  },
  {
    key: 'tejaratBankAccount',
    label: 'حساب تجارت (شماره حساب بانک تجارت)',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['حساب تجارت', 'شماره حساب تجارت', 'شماره حساب بانک تجارت', 'حساب بانک تجارت', 'بانک تجارت', 'tejaratbankaccount'],
  },
  {
    key: 'sibaBankAccount',
    label: 'حساب سیبا (بانک ملی)',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['حساب سیبا', 'شماره حساب سیبا', 'سیبا', 'sibabankaccount', 'siba'],
  },
  {
    key: 'sandooqAccount',
    label: 'شماره حساب دفتر صندوق',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره حساب دفتر صندوق', 'حساب دفتر صندوق', 'دفتر صندوق', 'صندوق', 'sandooqaccount', 'sandooq'],
  },
  {
    key: 'bankName',
    label: 'نام بانک (عمومی)',
    group: 'finance',
    headerAliases: ['نام بانک', 'بانک', 'bankname'],
  },
  {
    key: 'bankAccount',
    label: 'شماره حساب (عمومی)',
    group: 'finance',
    isNumericCode: true,
    headerAliases: ['شماره حساب', 'حساب', 'bankaccount'],
  },
];

const FIELD_GROUP_LABELS: Record<TeacherFieldDefinition['group'], string> = {
  identity: 'اطلاعات پایه، هویتی و تماس',
  codes: 'کدها و شناسه‌های سازمانی',
  academic: 'وضعیت، اولویت، تخصص و سوابق',
  finance: 'اطلاعات مالی و حساب‌های بانکی',
};

const PREDEFINED_OPTIONS_BY_FIELD: Record<string, { value: string; label: string }[]> = {
  isActive: [
    { value: 'active', label: 'فعال جهت دعوت' },
    { value: 'inactive', label: 'غیرفعال (موقت)' },
  ],
  priority: [
    { value: '1', label: 'اولویت ۱ (عالی)' },
    { value: '2', label: 'اولویت ۲ (خوب)' },
    { value: '3', label: 'اولویت ۳ (معمولی)' },
  ],
};

const EMPTY_VALUE_TOKEN = '__EMPTY__';
const KEEP_ORIGINAL_TOKEN = '__KEEP_ORIGINAL__';
const IMPORT_PROFILE_STORAGE_KEY = 'madrasah_teacher_excel_import_profile_v1';

type DuplicateStrategy = 'update_existing' | 'skip_existing' | 'create_always';

interface SavedImportProfile {
  ignoredHeaders: string[];
  headerToField: Record<string, TeacherImportFieldKey>;
  valueRules: Record<string, Record<string, string>>;
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
  teacherData: Partial<Teacher>;
  matchedExisting: Teacher | null;
  action: 'create' | 'update' | 'skip';
  warnings: string[];
}

interface TeacherExcelImportModalProps {
  isOpen: boolean;
  initialFile: File | null;
  existingTeachers: Teacher[];
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

function autoMatchFieldByHeader(header: string): TeacherImportFieldKey {
  const norm = normalizeHeaderKey(header);
  if (!norm) return '';

  // Exact alias match first
  for (const field of TEACHER_FIELDS) {
    if (field.headerAliases.some((alias) => normalizeHeaderKey(alias) === norm)) {
      return field.key;
    }
  }
  // Partial inclusion match (skip short/ambiguous aliases like 'نام' so 'نام پدر' or 'نام بانک' doesn't collide)
  for (const field of TEACHER_FIELDS) {
    if (field.key === 'fullName' || field.key === 'firstName') continue;
    if (field.headerAliases.some((alias) => norm.includes(normalizeHeaderKey(alias)))) {
      return field.key;
    }
  }
  if (norm === 'نام' || norm === 'اسم') return 'firstName';
  if (norm.includes('نام و نام')) return 'fullName';
  return '';
}

function suggestMappedValue(fieldKey: TeacherImportFieldKey, rawValue: string): string {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) {
    if (fieldKey === 'isActive') return 'active';
    if (fieldKey === 'priority') return '1';
    return '';
  }

  const norm = normalizePersianText(trimmed).toLowerCase();

  if (fieldKey === 'isActive') {
    if (
      norm === 'ه' ||
      norm === 'بله' ||
      norm === 'اری' ||
      norm === '1' ||
      norm === 'true' ||
      norm === 'active' ||
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
      norm.includes('موقت') ||
      norm.includes('قطع')
    ) {
      return 'inactive';
    }
    return 'active';
  }

  if (fieldKey === 'priority') {
    if (norm.includes('3') || norm.includes('معمولی') || norm.includes('سوم')) return '3';
    if (norm.includes('2') || norm.includes('خوب') || norm.includes('دوم')) return '2';
    return '1';
  }

  return KEEP_ORIGINAL_TOKEN;
}

function parseCategoriesText(raw: string): TeacherCategory[] {
  if (!raw.trim()) return [];
  const parts = raw.split(/[|،,/؛;]/).map((s) => normalizePersianText(s));
  const matched: TeacherCategory[] = [];
  for (const p of parts) {
    if (!p) continue;
    for (const cat of ALL_TEACHER_CATEGORIES) {
      if (normalizePersianText(cat) === p || p.includes(normalizePersianText(cat))) {
        if (!matched.includes(cat)) matched.push(cat);
      }
    }
  }
  return matched;
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
    console.warn('[TeacherExcelImport] Failed to read saved import profile:', err);
  }
  return null;
}

export default function TeacherExcelImportModal({
  isOpen,
  initialFile,
  existingTeachers,
  onClose,
  onImportCompleted,
}: TeacherExcelImportModalProps) {
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

  // Step 2: colIndex -> TeacherImportFieldKey
  const [colFieldMap, setColFieldMap] = useState<Record<number, TeacherImportFieldKey>>({});

  // Step 3: fieldKey -> { rawValueKey -> targetValue }
  const [valueRules, setValueRules] = useState<Record<string, Record<string, string>>>({});
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

  const parseExcelFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setImportResult(null);
    setPreviewSearch('');
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
      console.error('[TeacherExcelImport] Parse error:', err);
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

    let lastNonEmpty = stringMatrix.length - 1;
    while (lastNonEmpty >= 0 && stringMatrix[lastNonEmpty].every((c) => c === '')) {
      lastNonEmpty--;
    }
    const trimmedMatrix = stringMatrix.slice(0, lastNonEmpty + 1);
    setRawMatrix(trimmedMatrix);

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

  useEffect(() => {
    if (columns.length === 0) {
      setSelectedColIndices([]);
      setColFieldMap({});
      return;
    }

    const saved = loadSavedProfile();
    const ignoredSet = new Set((saved?.ignoredHeaders || []).map((h) => normalizeHeaderKey(h)));
    const nextSelected: number[] = [];
    const nextFieldMap: Record<number, TeacherImportFieldKey> = {};
    const usedFields = new Set<TeacherImportFieldKey>();

    for (const col of columns) {
      if (col.nonEmptyCount === 0) continue;

      const savedField = saved?.headerToField?.[col.normalizedHeader];
      const isSavedIgnored = ignoredSet.has(col.normalizedHeader);

      if (saved && isSavedIgnored) {
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

  const mappedFieldsWithValues = useMemo(() => {
    const result: {
      field: TeacherFieldDefinition;
      col: ParsedColumn;
      distinctValues: { rawKey: string; displayLabel: string; count: number }[];
    }[] = [];

    for (const colIndex of selectedColIndices) {
      const fieldKey = colFieldMap[colIndex];
      if (!fieldKey) continue;
      const col = columns.find((c) => c.colIndex === colIndex);
      const field = TEACHER_FIELDS.find((f) => f.key === fieldKey);
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

  const duplicateFieldTargets = useMemo(() => {
    const counts = new Map<TeacherImportFieldKey, number>();
    for (const colIdx of selectedColIndices) {
      const fk = colFieldMap[colIdx];
      if (!fk) continue;
      counts.set(fk, (counts.get(fk) || 0) + 1);
    }
    const dups = new Set<TeacherImportFieldKey>();
    counts.forEach((cnt, key) => {
      if (cnt > 1) dups.add(key);
    });
    return dups;
  }, [selectedColIndices, colFieldMap]);

  const hasNameMapping = useMemo(() => {
    return selectedColIndices.some((idx) => {
      const fk = colFieldMap[idx];
      return fk === 'fullName' || fk === 'firstName' || fk === 'lastName';
    });
  }, [selectedColIndices, colFieldMap]);

  // Index existing teachers for duplicate lookup
  const existingIndexes = useMemo(() => {
    const byNationalId = new Map<string, Teacher>();
    const byCenterTeacherCode = new Map<string, Teacher>();
    const byTeacherCode = new Map<string, Teacher>();
    const byFullName = new Map<string, Teacher>();

    for (const t of existingTeachers) {
      const nid = toLatinDigits(String(t.nationalId || '')).trim();
      if (nid && nid !== '---') byNationalId.set(nid, t);

      const cCode = toLatinDigits(String(t.centerTeacherCode || '')).trim();
      if (cCode) byCenterTeacherCode.set(cCode, t);

      const tCode = toLatinDigits(String(t.teacherCode || '')).trim().toLowerCase();
      if (tCode) byTeacherCode.set(tCode, t);

      const cleanFull = normalizePersianText(t.fullName || t.name || '').toLowerCase();
      if (cleanFull) byFullName.set(cleanFull, t);
    }

    return { byNationalId, byCenterTeacherCode, byTeacherCode, byFullName };
  }, [existingTeachers]);

  const transformedRows: TransformedRowPreview[] = useMemo(() => {
    if (dataRows.length === 0) return [];

    return dataRows.map((row, idx) => {
      const warnings: string[] = [];
      const payload: Record<string, any> = {};

      for (const colIdx of selectedColIndices) {
        const fieldKey = colFieldMap[colIdx];
        if (!fieldKey) continue;
        const fieldDef = TEACHER_FIELDS.find((f) => f.key === fieldKey);
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
        } else if (fieldKey === 'priority') {
          const p = parseInt(toLatinDigits(resolvedValue), 10);
          payload.priority = p === 2 ? 2 : p === 3 ? 3 : 1;
        } else if (fieldKey === 'categories') {
          const cats = parseCategoriesText(resolvedValue);
          payload.categories = cats.length > 0 ? cats : ['اصول'];
        } else if (fieldDef.isNumericCode) {
          payload[fieldKey] = toLatinDigits(resolvedValue).trim();
        } else {
          payload[fieldKey] = resolvedValue.trim();
        }
      }

      // Resolve fullName / firstName / lastName cleanly
      const fn = String(payload.firstName || '').trim();
      const ln = String(payload.lastName || '').trim();
      const directFull = String(payload.fullName || '').trim();

      if (!directFull && (fn || ln)) {
        payload.fullName = `${fn} ${ln}`.trim();
      } else if (directFull && (!fn && !ln)) {
        const parts = directFull.split(/\s+/);
        payload.firstName = parts[0] || '';
        payload.lastName = parts.slice(1).join(' ');
      }

      if (!payload.fullName) {
        payload.fullName = 'استاد نامشخص';
        warnings.push('نام استاد خالی است');
      }

      // Duplicate lookup
      const normNatId = payload.nationalId ? toLatinDigits(String(payload.nationalId)).trim() : '';
      const normCenterCode = payload.centerTeacherCode ? toLatinDigits(String(payload.centerTeacherCode)).trim() : '';
      const normTeacherCode = payload.teacherCode ? toLatinDigits(String(payload.teacherCode)).trim().toLowerCase() : '';
      const normFullName = normalizePersianText(String(payload.fullName || '')).toLowerCase();

      let matchedExisting: Teacher | null = null;
      if (normNatId && existingIndexes.byNationalId.has(normNatId)) {
        matchedExisting = existingIndexes.byNationalId.get(normNatId) || null;
      } else if (normCenterCode && existingIndexes.byCenterTeacherCode.has(normCenterCode)) {
        matchedExisting = existingIndexes.byCenterTeacherCode.get(normCenterCode) || null;
      } else if (normTeacherCode && existingIndexes.byTeacherCode.has(normTeacherCode)) {
        matchedExisting = existingIndexes.byTeacherCode.get(normTeacherCode) || null;
      } else if (normFullName && existingIndexes.byFullName.has(normFullName)) {
        matchedExisting = existingIndexes.byFullName.get(normFullName) || null;
      }

      let action: 'create' | 'update' | 'skip' = 'create';
      if (matchedExisting) {
        if (duplicateStrategy === 'update_existing') action = 'update';
        else if (duplicateStrategy === 'skip_existing') action = 'skip';
        else action = 'create';
      }

      return {
        rowIndex: idx + 1,
        teacherData: payload as Partial<Teacher>,
        matchedExisting,
        action,
        warnings,
      };
    });
  }, [dataRows, selectedColIndices, colFieldMap, valueRules, existingIndexes, duplicateStrategy]);

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
        `${r.teacherData.fullName || ''} ${r.teacherData.nationalId || ''} ${r.teacherData.centerTeacherCode || ''} ${r.teacherData.teacherCode || ''} ${r.teacherData.phoneNumber || ''}`
      ).toLowerCase();
      return hay.includes(q);
    });
  }, [transformedRows, previewSearch]);

  const toggleColumnSelection = (colIndex: number) => {
    setSelectedColIndices((prev) =>
      prev.includes(colIndex) ? prev.filter((i) => i !== colIndex) : [...prev, colIndex].sort((a, b) => a - b)
    );
  };

  const handleFieldAssignment = (colIndex: number, targetField: TeacherImportFieldKey) => {
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
      console.warn('[TeacherExcelImport] Failed to clear saved profile:', err);
    }
    const nextSelected = columns.filter((c) => c.nonEmptyCount > 0).map((c) => c.colIndex);
    const nextMap: Record<number, TeacherImportFieldKey> = {};
    const used = new Set<TeacherImportFieldKey>();
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
  };

  const buildSyncedBankFields = (incoming: Partial<Teacher>, existing?: Teacher | null) => {
    const sheba = (incoming.bankSheba ?? existing?.bankSheba ?? '').trim();
    const tejarat = (incoming.tejaratBankAccount ?? existing?.tejaratBankAccount ?? '').trim();
    const siba = (incoming.sibaBankAccount ?? existing?.sibaBankAccount ?? '').trim();
    const fallbackAcc = (incoming.bankAccount ?? existing?.bankAccount ?? '').trim();
    const primaryBankName = (incoming.bankName ?? existing?.bankName ?? (tejarat ? 'بانک تجارت' : siba ? 'بانک ملی (سیبا)' : 'بانک ملی')).trim();
    const primaryAccNum = fallbackAcc || tejarat || siba || '';

    const bankAccounts: TeacherBankAccount[] = existing?.bankAccounts && existing.bankAccounts.length > 0
      ? [...existing.bankAccounts]
      : [
          {
            id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            bankName: primaryBankName,
            accountNumber: primaryAccNum,
            cardNumber: '',
            shebaNumber: sheba,
            isPrimary: true,
            note: 'حساب اصلی',
          },
        ];

    if (bankAccounts[0]) {
      bankAccounts[0] = {
        ...bankAccounts[0],
        bankName: primaryBankName || bankAccounts[0].bankName,
        accountNumber: primaryAccNum || bankAccounts[0].accountNumber,
        shebaNumber: sheba || bankAccounts[0].shebaNumber,
      };
    }

    return {
      bankSheba: sheba,
      tejaratBankAccount: tejarat,
      sibaBankAccount: siba,
      bankName: primaryBankName,
      bankAccount: primaryAccNum,
      bankAccounts,
    };
  };

  const handleExecuteImport = async () => {
    if (isImporting || transformedRows.length === 0) return;
    setIsImporting(true);
    setImportProgress({ current: 0, total: transformedRows.length });

    if (saveProfileForNextTime) {
      try {
        const selectedSet = new Set(selectedColIndices);
        const ignoredHeaders = columns
          .filter((c) => !selectedSet.has(c.colIndex) && c.nonEmptyCount > 0)
          .map((c) => c.normalizedHeader);

        const headerToField: Record<string, TeacherImportFieldKey> = {};
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
        console.warn('[TeacherExcelImport] Could not save import profile to localStorage:', err);
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
          const bankFields = buildSyncedBankFields(row.teacherData, existing);
          await localDb.updateDoc('teachers', existing.id, {
            ...row.teacherData,
            ...bankFields,
            isExternal: false,
            version: nextVersion,
            updated_at: nowIso,
            updatedAt: nowIso,
          });
          updated++;
        } else {
          const randomCode = `T-${Math.floor(1000 + Math.random() * 9000)}`;
          const bankFields = buildSyncedBankFields(row.teacherData, null);
          const defaults: Partial<Teacher> = {
            isActive: true,
            priority: 1,
            categories: ['اصول'],
            teacherCode: randomCode,
            isExternal: false,
          };
          const newRecord = {
            ...defaults,
            ...row.teacherData,
            ...bankFields,
            teacherCode: row.teacherData.teacherCode || randomCode,
            id: `t_${Date.now()}_${i}`,
            version: 1,
            updated_at: nowIso,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          await localDb.addDoc('teachers', newRecord);
          created++;
        }
      } catch (err: any) {
        failed++;
        const msg = `ردیف ${row.rowIndex} (${row.teacherData.fullName || 'نامشخص'}): ${err?.message || 'خطا در ذخیره‌سازی'}`;
        errors.push(msg);
        console.error('[TEACHER_EXCEL_IMPORT_ROW_FAILURE]', msg, err);
      }
    }

    setIsImporting(false);
    setImportResult({ created, updated, skipped, failed, errors });
    onImportCompleted();
  };

  if (!isOpen) return null;

  const stepsMeta = [
    { num: 1 as const, title: '۱. انتخاب ستون‌های مهم' },
    { num: 2 as const, title: '۲. اتصال به فیلدهای استاد' },
    { num: 3 as const, title: '۳. قوانین تبدیل مقادیر' },
    { num: 4 as const, title: '۴. پیش‌نمایش و ثبت نهایی' },
  ];

  const mappedTargetList = mappedFieldsWithValues.filter((item) => item.field.hasPredefinedOptions);
  const mappedOtherTextList = mappedFieldsWithValues.filter(
    (item) =>
      !item.field.hasPredefinedOptions &&
      item.field.key !== 'fullName' &&
      item.field.key !== 'firstName' &&
      item.field.key !== 'lastName' &&
      item.field.key !== 'nationalId'
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
                ورود هوشمند و سفارشی مشخصات اساتید از اکسل
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
                  {importResult.failed > 0 ? 'عملیات ورود اکسل با برخی هشدارها پایان یافت' : 'اطلاعات اساتید از اکسل با موفقیت در سامانه ثبت شد'}
                </h3>
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-700 pt-1 tabular-nums">
                  <span>ایجاد شده: {importResult.created.toLocaleString('fa-IR')} استاد</span>
                  <span aria-hidden="true">·</span>
                  <span>به‌روزرسانی شده: {importResult.updated.toLocaleString('fa-IR')} استاد</span>
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

              <div className="text-xs font-bold text-slate-600 flex items-center justify-between px-1 tabular-nums">
                <span>
                  پیش‌نمایش ۸ ردیف اول فایل · {selectedColIndices.length.toLocaleString('fa-IR')} ستون از {columns.length.toLocaleString('fa-IR')} ستون انتخاب شده
                </span>
                {selectedColIndices.length === 0 && (
                  <span className="text-rose-600">حداقل یک ستون باید انتخاب شود</span>
                )}
              </div>

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
            /* STEP 2: COLUMN TO TEACHER FIELD MAPPING */
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-slate-800">
                    مشخص کنید هر ستون اکسل مربوط به کدام فیلد پرونده استاد است
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
                  <div className="md:col-span-5">فیلد متناظر در پرونده استاد</div>
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
                          onChange={(e) => handleFieldAssignment(colIndex, e.target.value as TeacherImportFieldKey)}
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
                          {(Object.keys(FIELD_GROUP_LABELS) as TeacherFieldDefinition['group'][]).map((grp) => (
                            <optgroup key={grp} label={FIELD_GROUP_LABELS[grp]}>
                              {TEACHER_FIELDS.filter((f) => f.group === grp).map((f) => (
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
            /* STEP 3: VALUE MAPPING RULES */
            <div className="space-y-5">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <h3 className="text-sm font-black text-slate-800">
                  تنظیم قوانین تبدیل مقادیر («اگر در اکسل فلان نوشته بود ← در سامانه فلان ثبت شود»)
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  در این مرحله تمام مقادیر یکتای ستون‌های وضعیت و اولویت یا سایر ستون‌های متنی نمایش داده می‌شوند تا با مقادیر استاندارد بانک اساتید تطبیق داده شوند.
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
                                    value={currentTarget}
                                    onChange={(e) => handleValueRuleChange(field.key, item.rawKey, e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    {options.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>

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

                  {mappedOtherTextList.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowTextTransformFields((prev) => !prev)}
                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                      >
                        <span>تبدیل مقادیر سایر ستون‌های متنی (اختیاری — مانند تخصص‌ها، آدرس و...)</span>
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <label className="block text-xs font-black text-slate-800">
                    نحوه برخورد با اساتید تکراری (تطابق بر اساس کد ملی، کد استاد مرکز، کد استادی یا نام کامل):
                  </label>
                  <select
                    value={duplicateStrategy}
                    onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="update_existing">
                      به‌روزرسانی پرونده استاد موجود و افزودن اساتید جدید (پیشنهادی)
                    </option>
                    <option value="skip_existing">
                      نادیده گرفتن اساتید تکراری و فقط افزودن اساتید جدید
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
                      <div className="text-[11px] font-bold text-slate-500 mt-0.5">استاد جدید</div>
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

              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[340px] overflow-y-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center tabular-nums">#</th>
                      <th className="px-3 py-2.5">عملیات</th>
                      <th className="px-3 py-2.5">نام و نام خانوادگی</th>
                      <th className="px-3 py-2.5">کد ملی</th>
                      <th className="px-3 py-2.5">کد استاد مرکز</th>
                      <th className="px-3 py-2.5">همراه / منزل</th>
                      <th className="px-3 py-2.5">شبا / حساب بانکی</th>
                      <th className="px-3 py-2.5">وضعیت / اولویت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreviewRows.slice(0, 60).map((r) => {
                      const d = r.teacherData;
                      const activeBool = d.isActive !== undefined ? d.isActive : true;
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
                          <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">{d.fullName || 'نامشخص'}</td>
                          <td className="px-3 py-2 font-mono text-slate-700 tabular-nums">{d.nationalId || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-700 tabular-nums">{d.centerTeacherCode || d.teacherCode || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-600 tabular-nums">
                            {[d.phoneNumber, d.homePhone].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 tabular-nums max-w-[180px] truncate">
                            {d.bankSheba || d.tejaratBankAccount || d.sibaBankAccount || d.bankAccount || '—'}
                          </td>
                          <td className="px-3 py-2 font-bold whitespace-nowrap">
                            <span className={activeBool ? 'text-emerald-700' : 'text-rose-700'}>
                              {activeBool ? 'فعال' : 'غیرفعال'}
                            </span>
                            {d.priority && <span className="text-slate-500 mr-1.5">· اولویت {d.priority}</span>}
                          </td>
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
                    <span>در حال ثبت اطلاعات اساتید در سامانه و سرور...</span>
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
                بستن و مشاهده بانک اساتید
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
                      <span>تایید و ثبت نهایی ({(summaryStats.createCount + summaryStats.updateCount).toLocaleString('fa-IR')} استاد)</span>
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
