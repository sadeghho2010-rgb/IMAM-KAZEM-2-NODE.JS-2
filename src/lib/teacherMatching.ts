import { Teacher, Program, TeacherManualSchedule } from '../types';
import { AppUser } from '../types/auth';

/**
 * Normalizes Persian and Arabic text for reliable teacher and course name matching.
 * Handles:
 * - Arabic/Persian letter unification (ي -> ی, ك -> ک, ة -> ه, أ/إ/آ -> ا)
 * - Zero-width spaces, invisible unicode characters (\u200c, \u200f, \u200e, \ufeff)
 * - Arabic and Persian diacritics / Tanween (اعراب)
 * - Conversion of Persian & Arabic digits to standard Latin digits
 * - Removal of common honorific titles (استاد, حجت الاسلام, شیخ, دکتر, آیت الله, سید, جناب آقای)
 * - Removal of parenthetical suffixes (e.g., "(اصول)", "(فقه)", "(پایه ۸)")
 * - Duplicate space collapsing and trimming
 */
export function normalizeTeacherName(rawName: string | undefined | null): string {
  if (!rawName) return '';

  let name = String(rawName);

  // 1. Remove parenthesized notes (e.g. "(اصول)", "(مشاوره)", "(پایه ۷)")
  name = name.replace(/\([^)]*\)/g, ' ');

  // 2. Unify Arabic and Persian characters
  name = name
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ة]/g, 'ه')
    .replace(/[آأإ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ی');

  // 3. Remove zero-width characters and directional marks
  name = name.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00A0]/g, ' ');

  // 4. Remove Arabic/Persian diacritics (اعراب، تنوین، تشدید، حرکات)
  name = name.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

  // 5. Convert Persian/Arabic digits to English digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    name = name.split(persianDigits[i]).join(String(i));
    name = name.split(arabicDigits[i]).join(String(i));
  }

  // 6. Lowercase for safety
  name = name.toLowerCase().trim();

  // 7. Strip common Persian honorific prefixes in a multi-pass loop
  // Standard Regex without lookbehinds for full Cross-Browser & Edge/Safari compatibility
  const prefixRegex = /^(استاد|حجت\s*الاسلام\s*و\s*المسلمین|حجت\s*الاسلام|ایت\s*الله|شیخ|دکتر|مهندس|جناب\s*اقای|جناب\s*آقای|اقای|آقای|سید|میر)\s+/g;
  
  let previous = '';
  while (previous !== name) {
    previous = name;
    name = name.replace(prefixRegex, '').trim();
  }

  // 8. Collapse whitespace
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

/**
 * Normalizes National IDs or Phone Numbers for exact matching
 */
export function normalizeIdentifier(val: string | undefined | null): string {
  if (!val) return '';
  let clean = String(val).trim().toUpperCase();
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    clean = clean.split(persianDigits[i]).join(String(i));
    clean = clean.split(arabicDigits[i]).join(String(i));
  }
  // Strip non-alphanumeric
  return clean.replace(/[^A-Z0-9]/g, '');
}

/**
 * Robust multi-tier algorithm to find the corresponding Teacher profile
 * for the logged-in user.
 */
export function findMatchingTeacher(
  currentUser: AppUser | any | null | undefined,
  teachers: Teacher[]
): Teacher | undefined {
  if (!currentUser || !Array.isArray(teachers) || teachers.length === 0) {
    return undefined;
  }

  // Tier 1: Direct link by linkedTeacherId or teacherId
  const directId = currentUser.linkedTeacherId || currentUser.teacherId;
  if (directId) {
    const found = teachers.find(t => t.id === directId || t.teacherCode === directId);
    if (found) return found;
  }

  // Tier 2: Match by National ID (کد ملی)
  const userNat = normalizeIdentifier(currentUser.nationalId || currentUser.nationalCode);
  if (userNat && userNat.length >= 8) {
    const found = teachers.find(t => {
      const tNat = normalizeIdentifier(t.nationalId);
      return tNat && (tNat === userNat || tNat.endsWith(userNat) || userNat.endsWith(tNat));
    });
    if (found) return found;
  }

  // Tier 3: Match by Teacher Code (کد استادی)
  const userCode = normalizeIdentifier(currentUser.teacherCode || currentUser.username);
  if (userCode && userCode.length >= 3) {
    const found = teachers.find(t => {
      const tCode = normalizeIdentifier(t.teacherCode);
      return tCode && tCode === userCode;
    });
    if (found) return found;
  }

  // Tier 4: Match by Phone Number
  const userPhone = normalizeIdentifier(currentUser.phone || currentUser.phoneNumber || currentUser.username);
  const cleanUserPhone = userPhone.replace(/^0+/, '');
  if (cleanUserPhone && cleanUserPhone.length >= 7) {
    const found = teachers.find(t => {
      const tPhone = normalizeIdentifier(t.phoneNumber || t.phone).replace(/^0+/, '');
      return tPhone && (tPhone === cleanUserPhone || tPhone.endsWith(cleanUserPhone) || cleanUserPhone.endsWith(tPhone));
    });
    if (found) return found;
  }

  // Tier 5: Match by Normalized Name
  const userCleanName = normalizeTeacherName(currentUser.fullName || currentUser.name || '');
  if (userCleanName && userCleanName.length >= 2) {
    // Exact match on normalized name
    let found = teachers.find(t => {
      const tCleanName = normalizeTeacherName(t.fullName || t.name || '');
      return tCleanName === userCleanName;
    });
    if (found) return found;

    // Substring or token inclusion match
    found = teachers.find(t => {
      const tCleanName = normalizeTeacherName(t.fullName || t.name || '');
      if (!tCleanName) return false;
      return tCleanName.includes(userCleanName) || userCleanName.includes(tCleanName);
    });
    if (found) return found;
  }

  return undefined;
}

/**
 * Checks whether a given Program is assigned to a teacher using ID, teacherCode, or normalized names.
 */
export function isProgramAssignedToTeacher(
  program: Program,
  teacher: Teacher | undefined,
  currentUser?: AppUser | any
): boolean {
  if (!program) return false;

  const progTeacherId = (program as any).teacherId;
  const progTeacherName = program.teacher || (program as any).teacherName || '';
  const progCleanTeacher = normalizeTeacherName(progTeacherName);

  // 1. Direct ID match if available on program
  if (teacher && progTeacherId) {
    if (progTeacherId === teacher.id || (teacher.teacherCode && progTeacherId === teacher.teacherCode)) {
      return true;
    }
  }

  // 2. Match with Teacher object names
  if (teacher) {
    const tCleanName = normalizeTeacherName(teacher.fullName || teacher.name || '');
    if (tCleanName && progCleanTeacher) {
      if (
        tCleanName === progCleanTeacher ||
        tCleanName.includes(progCleanTeacher) ||
        progCleanTeacher.includes(tCleanName)
      ) {
        return true;
      }
    }
  }

  // 3. Match with Logged-in User name as fallback
  if (currentUser) {
    const uCleanName = normalizeTeacherName(currentUser.fullName || currentUser.name || '');
    if (uCleanName && progCleanTeacher) {
      if (
        uCleanName === progCleanTeacher ||
        uCleanName.includes(progCleanTeacher) ||
        progCleanTeacher.includes(uCleanName)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a Manual Teacher Schedule item is assigned to a teacher.
 */
export function isManualScheduleAssignedToTeacher(
  schedule: TeacherManualSchedule,
  teacher: Teacher | undefined,
  currentUser?: AppUser | any
): boolean {
  if (!schedule) return false;

  const schTeacherId = schedule.teacherId;
  const schTeacherName = schedule.teacherName || '';
  const schCleanTeacher = normalizeTeacherName(schTeacherName);

  if (teacher && schTeacherId) {
    if (schTeacherId === teacher.id || (teacher.teacherCode && schTeacherId === teacher.teacherCode)) {
      return true;
    }
  }

  if (teacher) {
    const tCleanName = normalizeTeacherName(teacher.fullName || teacher.name || '');
    if (tCleanName && schCleanTeacher) {
      if (
        tCleanName === schCleanTeacher ||
        tCleanName.includes(schCleanTeacher) ||
        schCleanTeacher.includes(tCleanName)
      ) {
        return true;
      }
    }
  }

  if (currentUser) {
    const uCleanName = normalizeTeacherName(currentUser.fullName || currentUser.name || '');
    if (uCleanName && schCleanTeacher) {
      if (
        uCleanName === schCleanTeacher ||
        uCleanName.includes(schCleanTeacher) ||
        schCleanTeacher.includes(uCleanName)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalizes grade strings for reliable cross-digit and ordinal Persian matching.
 * Examples: "پایه 7", "پایه ۷", "پایه هفتم", "7", "۷" -> standardized representation
 */
export function normalizeGrade(rawGrade?: string | null): string {
  if (!rawGrade) return '';
  let g = String(rawGrade).trim();
  
  // Convert Persian/Arabic digits to English digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    g = g.split(persianDigits[i]).join(String(i));
    g = g.split(arabicDigits[i]).join(String(i));
  }

  // Normalize ordinals
  g = g
    .replace(/هفتم/g, '7')
    .replace(/هشتم/g, '8')
    .replace(/نهم/g, '9')
    .replace(/دهم/g, '10')
    .replace(/یازدهم/g, '11')
    .replace(/دوازدهم/g, '12')
    .replace(/اول/g, '1')
    .replace(/دوم/g, '2')
    .replace(/سوم/g, '3')
    .replace(/چهارم/g, '4')
    .replace(/پنجم/g, '5')
    .replace(/ششم/g, '6')
    .replace(/[\u200c\u200f\u200e\s]+/g, ' ')
    .trim();

  return g;
}

/**
 * Checks if two grade representations match.
 */
export function isGradeMatch(studentGrade?: string | null, targetGrade?: string | null): boolean {
  if (!studentGrade || !targetGrade) return false;
  if (targetGrade === 'all' || targetGrade === 'همه' || targetGrade === 'عمومی') return true;

  const normA = normalizeGrade(studentGrade);
  const normB = normalizeGrade(targetGrade);

  if (normA === normB || normA.includes(normB) || normB.includes(normA)) {
    return true;
  }

  // Extract pure digits
  const digitsA = normA.replace(/[^0-9]/g, '');
  const digitsB = normB.replace(/[^0-9]/g, '');

  if (digitsA && digitsB && digitsA === digitsB) {
    return true;
  }

  return false;
}

