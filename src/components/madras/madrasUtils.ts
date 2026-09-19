import { Program, MadrasRoom } from '../../types';
import { getProgramDays } from '../../lib/utils';

export interface TimeSlotDef {
  id: string;
  hourNumber: number;
  label: string;
  periodName: string;
  startTime: string;
  endTime: string;
  displayTime: string;
}

// 1-Hour Regular Slots between 07:00 and 17:00 (ساعت‌های درسی یک‌ساعته از رأس ساعت)
export const MADRAS_HOURLY_SLOTS_7_TO_17: TimeSlotDef[] = [
  { id: 'hour-1', hourNumber: 1, label: 'ساعت ۱', periodName: 'ساعت اول (۰۷:۰۰ تا ۰۸:۰۰)', startTime: '07:00', endTime: '08:00', displayTime: '۰۷:۰۰ الی ۰۸:۰۰' },
  { id: 'hour-2', hourNumber: 2, label: 'ساعت ۲', periodName: 'ساعت دوم (۰۸:۰۰ تا ۰۹:۰۰)', startTime: '08:00', endTime: '09:00', displayTime: '۰۸:۰۰ الی ۰۹:۰۰' },
  { id: 'hour-3', hourNumber: 3, label: 'ساعت ۳', periodName: 'ساعت سوم (۰۹:۰۰ تا ۱۰:۰۰)', startTime: '09:00', endTime: '10:00', displayTime: '۰۹:۰۰ الی ۱۰:۰۰' },
  { id: 'hour-4', hourNumber: 4, label: 'ساعت ۴', periodName: 'ساعت چهارم (۱۰:۰۰ تا ۱۱:۰۰)', startTime: '10:00', endTime: '11:00', displayTime: '۱۰:۰۰ الی ۱۱:۰۰' },
  { id: 'hour-5', hourNumber: 5, label: 'ساعت ۵', periodName: 'ساعت پنجم (۱۱:۰۰ تا ۱۲:۰۰)', startTime: '11:00', endTime: '12:00', displayTime: '۱۱:۰۰ الی ۱۲:۰۰' },
  { id: 'hour-6', hourNumber: 6, label: 'ساعت ۶', periodName: 'ساعت ششم (۱۲:۰۰ تا ۱۳:۰۰)', startTime: '12:00', endTime: '13:00', displayTime: '۱۲:۰۰ الی ۱۳:۰۰' },
  { id: 'hour-7', hourNumber: 7, label: 'ساعت ۷', periodName: 'ساعت هفتم (۱۳:۰۰ تا ۱۴:۰۰)', startTime: '13:00', endTime: '14:00', displayTime: '۱۳:۰۰ الی ۱۴:۰۰' },
  { id: 'hour-8', hourNumber: 8, label: 'ساعت ۸', periodName: 'ساعت هشتم (۱۴:۰۰ تا ۱۵:۰۰)', startTime: '14:00', endTime: '15:00', displayTime: '۱۴:۰۰ الی ۱۵:۰۰' },
  { id: 'hour-9', hourNumber: 9, label: 'ساعت ۹', periodName: 'ساعت نهم (۱۵:۰۰ تا ۱۶:۰۰)', startTime: '15:00', endTime: '16:00', displayTime: '۱۵:۰۰ الی ۱۶:۰۰' },
  { id: 'hour-10', hourNumber: 10, label: 'ساعت ۱۰', periodName: 'ساعت دهم (۱۶:۰۰ تا ۱۷:۰۰)', startTime: '16:00', endTime: '17:00', displayTime: '۱۶:۰۰ الی ۱۷:۰۰' },
];

export const MADRAS_TIME_SLOTS_7_TO_17: TimeSlotDef[] = MADRAS_HOURLY_SLOTS_7_TO_17;

// Permission helper: Only Super Admin and Education Officer (مسئول آموزش) have rights to edit & search
export function canManageAndSearchMadras(user: any): boolean {
  if (!user) return false;
  if (user.isReadOnly) return false;

  const role = user.role;
  const username = (user.username || '').toUpperCase();
  const roleTitle = user.roleTitle || '';

  // 1. سوپر ادمین
  if (role === 'super_admin' || username === 'ADMIN' || (user.level === 1 && role === 'super_admin')) {
    return true;
  }

  // 2. مسئول آموزش (Education Manager / Officer)
  if (
    role === 'education_manager' || 
    role === 'education_officer' || 
    username === 'SHAH' || 
    roleTitle.includes('مسئول آموزش')
  ) {
    return true;
  }

  return false;
}

export const WEEK_DAYS_SEMINARY = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];

export const DEFAULT_MADRAS_ROOMS: MadrasRoom[] = [
  {
    id: 'room-1',
    name: 'مَدرَس ۱ (شیخ انصاری)',
    code: 'م-۱',
    capacity: 35,
    floor: 'طبقه اول',
    facilities: ['ویدئو پروژکتور', 'وایت‌برد', 'سیستم صوتی'],
    description: 'کلاس اصلی پایه‌های سطوح عالی',
    isActive: true,
  },
  {
    id: 'room-2',
    name: 'مَدرَس ۲ (علامه طباطبایی)',
    code: 'م-۲',
    capacity: 30,
    floor: 'طبقه اول',
    facilities: ['وایت‌برد', 'تهویه مطبوع'],
    description: 'کلاس درس فلسفه و کلام',
    isActive: true,
  },
  {
    id: 'room-3',
    name: 'مَدرَس ۳ (شهید اول)',
    code: 'م-۳',
    capacity: 40,
    floor: 'طبقه اول',
    facilities: ['ویدئو پروژکتور', 'صندلی دسته‌دار'],
    description: 'کلاس درس لمعه و ادبیات',
    isActive: true,
  },
  {
    id: 'room-4',
    name: 'مَدرَس ۴ (ملاصدرا)',
    code: 'م-۴',
    capacity: 25,
    floor: 'طبقه دوم',
    facilities: ['وایت‌برد', 'سیستم صوتی'],
    description: 'کارگاه پژوهش و دروس جانبی',
    isActive: true,
  },
  {
    id: 'room-5',
    name: 'مَدرَس ۵ (شیخ طوسی)',
    code: 'م-۵',
    capacity: 50,
    floor: 'همکف',
    facilities: ['ویدئو پروژکتور', 'سیستم صوتی پیشرفته'],
    description: 'مدرس اجتماعات و دروس اخلاق عمومی',
    isActive: true,
  },
  {
    id: 'room-6',
    name: 'مَدرَس ۶ (شهید ثانی)',
    code: 'م-۶',
    capacity: 25,
    floor: 'طبقه دوم',
    facilities: ['وایت‌برد'],
    description: 'کلاس تخصصی حلقات و مباحثه',
    isActive: true,
  },
];

export function toEnglishDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

export function cleanPersianText(str: string): string {
  if (!str) return '';
  return toEnglishDigits(str)
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics / tashkeel (fatha, damma, kasra, etc.)
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\u200c/g, '') // remove half-space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeDay(dayStr: string): string {
  return cleanPersianText(dayStr).replace(/\s+/g, '');
}

export function timeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const eng = toEnglishDigits(timeStr);
  const match = eng.match(/(\d{1,2})[:：](\d{1,2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function isProgramInRoom(prog: Program, room: MadrasRoom): boolean {
  const pRoom = (prog.madrasRoom || prog.classroom || '').trim();
  if (!pRoom) return false;

  const cleanPRoom = cleanPersianText(pRoom);
  const cleanRoomName = cleanPersianText(room.name);
  const cleanRoomCode = cleanPersianText(room.code || '');

  if (cleanPRoom === cleanRoomName || (cleanRoomCode && cleanPRoom === cleanRoomCode)) return true;
  if (cleanPRoom.includes(cleanRoomName) || cleanRoomName.includes(cleanPRoom)) return true;
  if (cleanRoomCode && (cleanPRoom.includes(cleanRoomCode) || cleanRoomCode.includes(cleanPRoom))) return true;

  // Compare without parentheses e.g. "مدرس ۱"
  const roomNameNoParen = cleanPersianText(room.name.replace(/\(.*?\)/g, ''));
  if (roomNameNoParen && (cleanPRoom.includes(roomNameNoParen) || roomNameNoParen.includes(cleanPRoom))) return true;

  // Check matching room number e.g. "مدرس 1" vs "مدرس ۱"
  const numInPRoom = cleanPRoom.match(/\d+/);
  const numInRoom = cleanRoomName.match(/\d+/);
  if (numInPRoom && numInRoom && numInPRoom[0] === numInRoom[0]) {
    if (cleanPRoom.includes('مدرس') || cleanPRoom.includes('کلاس') || cleanPRoom.includes('م-')) {
      return true;
    }
  }

  return false;
}

export function isDayMatch(program: Program, day: string): boolean {
  const days = getProgramDays(program);
  if (days.length === 0) return true; // Daily class
  const normTarget = normalizeDay(day);
  return days.some(d => normalizeDay(d) === normTarget);
}

export function isProgramInTimeRange(prog: Program, startMinutes: number, endMinutes: number): boolean {
  const rawTimeStr = prog.time || `${prog.startTime || ''} - ${prog.endTime || ''}`;
  if (!rawTimeStr.trim()) return false;

  const engTime = toEnglishDigits(rawTimeStr);
  const times = engTime.match(/\d{1,2}[:：]\d{1,2}/g);
  if (!times || times.length === 0) {
    // If it has a slot name like "زنگ اول"
    for (const slot of MADRAS_TIME_SLOTS_7_TO_17) {
      if (rawTimeStr.includes(slot.label) || rawTimeStr.includes(slot.periodName)) {
        const sM = timeToMinutes(slot.startTime) || 0;
        const eM = timeToMinutes(slot.endTime) || 0;
        return sM < endMinutes && startMinutes < eM;
      }
    }
    return false;
  }

  const pStart = timeToMinutes(times[0]);
  if (pStart === null) return false;
  const pEnd = times.length > 1 ? timeToMinutes(times[1]) : pStart + 60;
  if (pEnd === null) return false;

  // Overlap condition: class start is before slot end, and class end is after slot start
  return pStart < endMinutes && startMinutes < pEnd;
}

export function getCurrentPersianDayName(): string {
  const dayIndex = new Date().getDay();
  const map: Record<number, string> = {
    6: 'شنبه',
    0: 'یکشنبه',
    1: 'دوشنبه',
    2: 'سه‌شنبه',
    3: 'چهارشنبه',
    4: 'پنج‌شنبه',
    5: 'جمعه',
  };
  return map[dayIndex] || 'شنبه';
}

export function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Find if room is currently occupied right now (between 07:00 and 17:00)
export function getRoomCurrentStatus(
  room: MadrasRoom, 
  programs: Program[]
): { isOccupied: boolean; activeProgram: Program | null } {
  const currentMinutes = getCurrentTimeMinutes();
  const currentDay = getCurrentPersianDayName();

  // If outside 7:00 to 17:00, or Friday, status is free/off
  if (currentMinutes < 7 * 60 || currentMinutes > 17 * 60 || currentDay === 'جمعه') {
    return { isOccupied: false, activeProgram: null };
  }

  const match = programs.find(prog => {
    if (!isProgramInRoom(prog, room)) return false;
    if (!isDayMatch(prog, currentDay)) return false;
    return isProgramInTimeRange(prog, currentMinutes, currentMinutes + 1);
  });

  return {
    isOccupied: Boolean(match),
    activeProgram: match || null,
  };
}
