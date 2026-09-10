import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  DoorOpen, 
  Clock, 
  Calendar, 
  CalendarDays, 
  User, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  Building2, 
  Layers, 
  LayoutGrid, 
  Table, 
  List, 
  Printer, 
  FileSpreadsheet, 
  RefreshCw, 
  ArrowRight, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Settings2, 
  GraduationCap,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { Program, MadrasRoom, Teacher, Student, Enrollment } from '../types';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { useMentor } from '../context/MentorContext';
import { cn, WEEK_DAYS, getProgramDays } from '../lib/utils';

// Standard Seminary / School Study Slots (زنگ‌های آموزشی)
export interface TimeSlotDef {
  id: string;
  label: string;
  periodName: string;
  startTime: string;
  endTime: string;
  displayTime: string;
}

export const STANDARD_TIME_SLOTS: TimeSlotDef[] = [
  { id: 'slot-1', label: 'زنگ ۱ (صبحگاه)', periodName: 'زنگ اول', startTime: '08:00', endTime: '09:30', displayTime: '۰۸:۰۰ الی ۰۹:۳۰' },
  { id: 'slot-2', label: 'زنگ ۲ (نیمروزی)', periodName: 'زنگ دوم', startTime: '10:00', endTime: '11:30', displayTime: '۱۰:۰۰ الی ۱۱:۳۰' },
  { id: 'slot-3', label: 'زنگ ۳ (پیش از ظهر)', periodName: 'زنگ سوم / اخلاق', startTime: '11:45', endTime: '12:45', displayTime: '۱۱:۴۵ الی ۱۲:۴۵' },
  { id: 'slot-4', label: 'زنگ ۴ (عصرگاه ۱)', periodName: 'زنگ چهارم', startTime: '14:00', endTime: '15:30', displayTime: '۱۴:۰۰ الی ۱۵:۳۰' },
  { id: 'slot-5', label: 'زنگ ۵ (عصرگاه ۲)', periodName: 'زنگ پنجم', startTime: '15:45', endTime: '17:15', displayTime: '۱۵:۴۵ الی ۱۷:۱۵' },
  { id: 'slot-6', label: 'زنگ ۶ (شبگاه)', periodName: 'زنگ ششم / کارگاه', startTime: '17:30', endTime: '19:00', displayTime: '۱۷:۳۰ الی ۱۹:۰۰' },
];

export const DEFAULT_MADRAS_ROOMS: MadrasRoom[] = [
  {
    id: 'room-1',
    name: 'مدرس ۱ (شیخ انصاری)',
    code: 'م-۱',
    capacity: 35,
    floor: 'طبقه اول',
    facilities: ['ویدئو پروژکتور', 'سیستم صوتی', 'تخته وایت‌برد', 'تهویه مطبوع'],
    color: 'border-indigo-400 bg-indigo-50/50',
    description: 'مدرس اصلی دروس فقه و اصول پایه‌های عالی',
    isActive: true,
  },
  {
    id: 'room-2',
    name: 'مدرس ۲ (علامه حلی)',
    code: 'م-۲',
    capacity: 30,
    floor: 'طبقه اول',
    facilities: ['ویدئو پروژکتور', 'تخته وایت‌برد', 'سیستم صوتی'],
    color: 'border-sky-400 bg-sky-50/50',
    description: 'مدرس دروس ادبیات و منطق',
    isActive: true,
  },
  {
    id: 'room-3',
    name: 'مدرس ۳ (شهید بهشتی)',
    code: 'م-۳',
    capacity: 25,
    floor: 'طبقه دوم',
    facilities: ['تخته وایت‌برد', 'تهویه مطبوع'],
    color: 'border-emerald-400 bg-emerald-50/50',
    description: 'مدرس کلاس‌های پایه ۷ و مشاوره',
    isActive: true,
  },
  {
    id: 'room-4',
    name: 'مدرس ۴ (ملاصدرا)',
    code: 'م-۴',
    capacity: 25,
    floor: 'طبقه دوم',
    facilities: ['تخته وایت‌برد'],
    color: 'border-amber-400 bg-amber-50/50',
    description: 'مدرس دروس فلسفه و کلام',
    isActive: true,
  },
  {
    id: 'room-5',
    name: 'مدرس ۵ (شیخ طوسی)',
    code: 'م-۵',
    capacity: 20,
    floor: 'طبقه دوم',
    facilities: ['تخته وایت‌برد'],
    color: 'border-purple-400 bg-purple-50/50',
    description: 'مدرس کلاس‌های پژوهشی و جلسات حلقه‌ای',
    isActive: true,
  },
  {
    id: 'room-6',
    name: 'مدرس ۶ (علامه طباطبایی)',
    code: 'م-۶',
    capacity: 40,
    floor: 'طبقه همکف',
    facilities: ['تخته هوشمند', 'ویدئو پروژکتور', 'سیستم صوتی'],
    color: 'border-rose-400 bg-rose-50/50',
    description: 'مدرس دروس عمومی و کارگاه‌های مشترک',
    isActive: true,
  },
  {
    id: 'room-7',
    name: 'سالن اجتماعات (شهید مطهری)',
    code: 'س-۱',
    capacity: 120,
    floor: 'طبقه زیرهمکف',
    facilities: ['پروژکتور سالنی', 'سیستم صوتی حرفه‌ای', 'امکان ضبط ویدئویی', 'تریبون'],
    color: 'border-teal-400 bg-teal-50/50',
    description: 'سالن همایش، سخنرانی اخلاق و اجتماعات مدرسه',
    isActive: true,
  },
];

// Helper to normalize day string for loose comparison
function normalizeDay(dayStr: string): string {
  return (dayStr || '').replace(/\s+/g, '').replace(/‌/g, '');
}

// Convert "08:30" or "8:30" to minutes from midnight
function timeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2})[:：](\d{1,2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Check if two time ranges overlap or match
function isTimeMatch(progTime: string | undefined, slot: TimeSlotDef): boolean {
  if (!progTime) return false;
  const pt = progTime.trim();
  
  // Exact slot display string match
  if (pt.includes(slot.displayTime) || pt.includes(slot.startTime) || pt.includes(slot.endTime)) {
    return true;
  }
  
  // Try extracting start and end from program time
  const times = pt.match(/\d{1,2}[:：]\d{1,2}/g);
  if (times && times.length > 0) {
    const pStart = timeToMinutes(times[0]);
    const pEnd = times.length > 1 ? timeToMinutes(times[1]) : (pStart !== null ? pStart + 90 : null);
    
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    
    if (pStart !== null && slotStart !== null && slotEnd !== null) {
      const actualPEnd = pEnd !== null ? pEnd : pStart + 80;
      // Overlap condition: startA < endB && startB < endA
      if (pStart < slotEnd && slotStart < actualPEnd) {
        return true;
      }
    }
  }

  // Fallback: check if period name or numbers match
  if (pt.includes(slot.periodName)) return true;
  return false;
}

// Check if program matches day
function isDayMatch(program: Program, day: string): boolean {
  const days = getProgramDays(program);
  if (days.length === 0) return true; // generic daily
  const normTarget = normalizeDay(day);
  return days.some(d => normalizeDay(d) === normTarget);
}

// Helper to get today's Persian day name
function getCurrentPersianDayName(): string {
  const dayIndex = new Date().getDay(); // 0 is Sunday, 6 is Saturday
  // JS getDay(): 0: یکشنبه, 1: دوشنبه, 2: سه‌شنبه, 3: چهارشنبه, 4: پنج‌شنبه, 5: جمعه, 6: شنبه
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

// Find closest current time slot
function getCurrentTimeSlot(): TimeSlotDef {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  for (const slot of STANDARD_TIME_SLOTS) {
    const startM = timeToMinutes(slot.startTime) || 0;
    const endM = timeToMinutes(slot.endTime) || 0;
    if (currentMinutes >= startM - 15 && currentMinutes <= endM + 15) {
      return slot;
    }
  }
  return STANDARD_TIME_SLOTS[0];
}

export default function MadrasRooms() {
  const { currentUser } = useAuth();
  const { currentMentorId } = useMentor();

  // Data state
  const [rooms, setRooms] = useState<MadrasRoom[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab: 'cards' | 'matrix' | 'classes' | 'rooms-config'
  const [activeView, setActiveView] = useState<'cards' | 'matrix' | 'classes' | 'rooms-config'>('cards');

  // Filter & Day-Time Navigator State
  const [selectedDay, setSelectedDay] = useState<string>(() => getCurrentPersianDayName());
  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => getCurrentTimeSlot().id);
  const [searchFilter, setSearchFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');
  const [onlyShowOccupied, setOnlyShowOccupied] = useState(false);
  const [onlyShowAvailable, setOnlyShowAvailable] = useState(false);

  // Modals state
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<MadrasRoom | null>(null);

  // Class Form State
  const [classFormTitle, setClassFormTitle] = useState('');
  const [classFormMadras, setClassFormMadras] = useState('');
  const [classFormTeacher, setClassFormTeacher] = useState('');
  const [classFormDays, setClassFormDays] = useState<string[]>(['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
  const [classFormTime, setClassFormTime] = useState(STANDARD_TIME_SLOTS[0].displayTime);
  const [classFormGrade, setClassFormGrade] = useState('پایه ۷');
  const [classFormType, setClassFormType] = useState<'اصلی' | 'مشاوره' | 'پژوهش' | 'دروس 5 شنبه' | 'سایر'>('اصلی');
  const [classFormNotes, setClassFormNotes] = useState('');

  // Room Form State
  const [roomFormName, setRoomFormName] = useState('');
  const [roomFormCode, setRoomFormCode] = useState('');
  const [roomFormCapacity, setRoomFormCapacity] = useState<number>(30);
  const [roomFormFloor, setRoomFormFloor] = useState('طبقه اول');
  const [roomFormFacilities, setRoomFormFacilities] = useState<string>('ویدئو پروژکتور، وایت‌برد');
  const [roomFormDescription, setRoomFormDescription] = useState('');

  const isReadOnly = currentUser?.isReadOnly || false;

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [rawRooms, rawPrograms, rawTeachers, rawEnrollments, rawStudents] = await Promise.all([
        localDb.getDocs<MadrasRoom>('classrooms'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<Student>('students'),
      ]);

      // Seed default rooms if none exist yet
      if (!rawRooms || rawRooms.length === 0) {
        for (const defaultRoom of DEFAULT_MADRAS_ROOMS) {
          await localDb.addDoc('classrooms', defaultRoom);
        }
        setRooms(DEFAULT_MADRAS_ROOMS);
      } else {
        setRooms(rawRooms);
      }

      setPrograms(rawPrograms || []);
      setTeachers(rawTeachers || []);
      setEnrollments(rawEnrollments || []);
      setStudents(rawStudents || []);
    } catch (err) {
      console.error('Error fetching madras rooms data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedSlot = useMemo(() => {
    return STANDARD_TIME_SLOTS.find(s => s.id === selectedSlotId) || STANDARD_TIME_SLOTS[0];
  }, [selectedSlotId]);

  // Map each room to its occupancy at current selected day & slot
  const roomsOccupancy = useMemo(() => {
    return rooms.map(room => {
      // Find programs assigned to this room at selectedDay and selectedSlot
      const matchingPrograms = programs.filter(prog => {
        const progRoom = (prog.madrasRoom || prog.classroom || '').trim();
        if (!progRoom) return false;
        
        // Exact or fuzzy room name match
        const isThisRoom = progRoom === room.name || 
                           progRoom === room.code || 
                           (room.name && progRoom.includes(room.name)) || 
                           (room.code && progRoom.includes(room.code));
        if (!isThisRoom) return false;

        // Day match
        if (!isDayMatch(prog, selectedDay)) return false;

        // Time slot match
        return isTimeMatch(prog.time, selectedSlot);
      });

      const isOccupied = matchingPrograms.length > 0;
      const primaryProgram = matchingPrograms[0] || null;
      
      // Calculate students count if program has enrollments
      let enrolledCount = 0;
      if (primaryProgram) {
        enrolledCount = enrollments.filter(e => e.programId === primaryProgram.id).length;
      }

      return {
        room,
        isOccupied,
        programs: matchingPrograms,
        primaryProgram,
        enrolledCount,
      };
    });
  }, [rooms, programs, selectedDay, selectedSlot, enrollments]);

  // Filtered rooms based on user view toggles & search
  const filteredOccupancy = useMemo(() => {
    return roomsOccupancy.filter(item => {
      if (onlyShowOccupied && !item.isOccupied) return false;
      if (onlyShowAvailable && item.isOccupied) return false;
      if (roomFilter !== 'all' && item.room.id !== roomFilter) return false;
      
      if (searchFilter.trim()) {
        const term = searchFilter.toLowerCase().trim();
        const roomNameMatch = item.room.name.toLowerCase().includes(term);
        const progMatch = item.programs.some(p => 
          (p.title || '').toLowerCase().includes(term) || 
          (p.teacher || '').toLowerCase().includes(term) ||
          (p.grade || '').toLowerCase().includes(term)
        );
        return roomNameMatch || progMatch;
      }
      return true;
    });
  }, [roomsOccupancy, onlyShowOccupied, onlyShowAvailable, roomFilter, searchFilter]);

  // Metrics
  const totalRoomsCount = rooms.length;
  const occupiedCount = roomsOccupancy.filter(r => r.isOccupied).length;
  const availableCount = totalRoomsCount - occupiedCount;
  const occupancyPercent = totalRoomsCount > 0 ? Math.round((occupiedCount / totalRoomsCount) * 100) : 0;

  // Open modal for new class with prefilled room and slot
  const handleOpenAddClass = (prefillRoomName?: string) => {
    setEditingProgram(null);
    setClassFormTitle('');
    setClassFormMadras(prefillRoomName || (rooms[0]?.name || ''));
    setClassFormTeacher('');
    setClassFormDays(selectedDay !== 'جمعه' ? [selectedDay] : ['شنبه']);
    setClassFormTime(selectedSlot.displayTime);
    setClassFormGrade('پایه ۷');
    setClassFormType('اصلی');
    setClassFormNotes('');
    setShowClassModal(true);
  };

  // Open modal for editing existing class
  const handleOpenEditClass = (prog: Program) => {
    setEditingProgram(prog);
    setClassFormTitle(prog.title || '');
    setClassFormMadras(prog.madrasRoom || prog.classroom || rooms[0]?.name || '');
    setClassFormTeacher(prog.teacher || '');
    setClassFormDays(getProgramDays(prog));
    setClassFormTime(prog.time || selectedSlot.displayTime);
    setClassFormGrade(prog.grade || 'پایه ۷');
    setClassFormType(prog.type || 'اصلی');
    setClassFormNotes(prog.notes || '');
    setShowClassModal(true);
  };

  // Check for potential room conflict when editing/creating class
  const conflictWarning = useMemo(() => {
    if (!classFormMadras || !classFormTime) return null;
    
    // Find if another program already uses this room on any of the selected days at this time
    const conflicting = programs.find(p => {
      if (editingProgram && p.id === editingProgram.id) return false;
      const pRoom = (p.madrasRoom || p.classroom || '').trim();
      if (pRoom !== classFormMadras.trim()) return false;

      // Check if time matches
      const timeMatches = p.time === classFormTime || 
        (selectedSlot && isTimeMatch(p.time, selectedSlot) && isTimeMatch(classFormTime, selectedSlot));
      if (!timeMatches) return false;

      // Check if any day overlaps
      const pDays = getProgramDays(p);
      const hasDayOverlap = classFormDays.some(d => pDays.includes(d));
      return hasDayOverlap;
    });

    if (conflicting) {
      return {
        title: conflicting.title,
        teacher: conflicting.teacher,
        day: conflicting.day || getProgramDays(conflicting).join('، '),
        time: conflicting.time,
      };
    }
    return null;
  }, [classFormMadras, classFormTime, classFormDays, programs, editingProgram, selectedSlot]);

  // Save class (Add / Update)
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classFormTitle.trim()) return;

    try {
      const dayStr = classFormDays.join(' ، ');
      const payload: Partial<Program> = {
        title: classFormTitle.trim(),
        madrasRoom: classFormMadras.trim(),
        classroom: classFormMadras.trim(),
        teacher: classFormTeacher.trim(),
        time: classFormTime.trim(),
        days: classFormDays,
        day: dayStr,
        grade: classFormGrade,
        type: classFormType,
        notes: classFormNotes.trim(),
        mentorId: currentMentorId,
      };

      if (editingProgram) {
        await localDb.updateDoc('programs', editingProgram.id, payload);
      } else {
        await localDb.addDoc('programs', payload);
      }

      setShowClassModal(false);
      fetchData();
    } catch (err) {
      console.error('Error saving class:', err);
      alert('خطا در ذخیره‌سازی اطلاعات کلاس');
    }
  };

  // Delete class
  const handleDeleteClass = async (progId: string) => {
    if (!confirm('آیا از حذف این کلاس اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('programs', progId);
      fetchData();
    } catch (err) {
      console.error('Error deleting program:', err);
    }
  };

  // Save Room (Add / Edit)
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomFormName.trim()) return;

    try {
      const facilitiesArray = roomFormFacilities
        .split(/[،,]/)
        .map(s => s.trim())
        .filter(Boolean);

      const payload: Partial<MadrasRoom> = {
        name: roomFormName.trim(),
        code: roomFormCode.trim(),
        capacity: Number(roomFormCapacity) || 30,
        floor: roomFormFloor.trim(),
        facilities: facilitiesArray,
        description: roomFormDescription.trim(),
        isActive: true,
      };

      if (editingRoom) {
        await localDb.updateDoc('classrooms', editingRoom.id, payload);
      } else {
        await localDb.addDoc('classrooms', payload);
      }

      setShowRoomModal(false);
      fetchData();
    } catch (err) {
      console.error('Error saving madras room:', err);
      alert('خطا در ثبت مشخصات مَدرَس');
    }
  };

  // Delete Room
  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('آیا از حذف این مَدرَس اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('classrooms', roomId);
      fetchData();
    } catch (err) {
      console.error('Error deleting room:', err);
    }
  };

  // Quick helper to jump to real-time now
  const handleJumpToNow = () => {
    const today = getCurrentPersianDayName();
    const currentSlot = getCurrentTimeSlot();
    setSelectedDay(today);
    setSelectedSlotId(currentSlot.id);
  };

  // Export Matrix to Excel
  const handleExportExcel = () => {
    const rows: any[] = [];
    rows.push(['گزارش جامع وضعیت مَدرَس‌ها و کلاس‌های درس']);
    rows.push(['روز بررسی', selectedDay]);
    rows.push(['زنگ و ساعت', selectedSlot.displayTime]);
    rows.push(['تعداد کل مدرس‌ها', totalRoomsCount]);
    rows.push(['مدرس‌های مشغول', occupiedCount]);
    rows.push(['مدرس‌های آزاد', availableCount]);
    rows.push([]);
    rows.push(['نام مَدرَس (کلاس درس)', 'کد', 'طبقه', 'ظرفیت', 'وضعیت', 'عنوان کلاس', 'استاد مربوطه', 'پایه', 'ساعت برگزاری']);

    rooms.forEach(room => {
      const occ = roomsOccupancy.find(o => o.room.id === room.id);
      if (occ?.isOccupied && occ.primaryProgram) {
        rows.push([
          room.name,
          room.code || '',
          room.floor || '',
          room.capacity || '',
          'مشغول (پر)',
          occ.primaryProgram.title,
          occ.primaryProgram.teacher || '---',
          occ.primaryProgram.grade || '---',
          occ.primaryProgram.time || ''
        ]);
      } else {
        rows.push([
          room.name,
          room.code || '',
          room.floor || '',
          room.capacity || '',
          'خالی و آزاد',
          '---',
          '---',
          '---',
          '---'
        ]);
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'وضعیت مدرس‌ها');
    XLSX.writeFile(workbook, `وضعیت_مدرس_ها_${selectedDay}.xlsx`);
  };

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      
      {/* 1. Header & Quick Actions Bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-50/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-emerald-50/60 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                <DoorOpen size={26} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  مَدرَس‌ها (کلاس‌های درس و رصد اشغال فضاها)
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  بررسی وضعیت پر یا خالی بودن کلاس‌ها در ساعات و روزهای مختلف، و مدیریت برگزاری دروس
                </p>
              </div>
            </div>

            {/* Live Persian Clock & Day Badge */}
            <div className="flex items-center gap-2 pt-1 text-xs font-bold text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 rounded-xl border border-indigo-200">
                <Calendar size={13} className="text-indigo-600" />
                <span>روز جاری سیستم: <b className="text-slate-900">{getCurrentPersianDayName()}</b></span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
                <Clock size={13} className="text-slate-500" />
                <span>زنگ متناظر اکنون: <b className="text-slate-900">{getCurrentTimeSlot().label}</b></span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleJumpToNow}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="انتقال سریع به وضعیت روز و ساعت کنونی"
            >
              <Sparkles size={15} className="text-emerald-600" />
              <span>هم‌اکنون</span>
            </button>

            {!isReadOnly && (
              <button
                onClick={() => handleOpenAddClass()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
              >
                <Plus size={16} />
                <span>تعریف کلاس درس جدید</span>
              </button>
            )}

            {!isReadOnly && (
              <button
                onClick={() => {
                  setEditingRoom(null);
                  setRoomFormName('');
                  setRoomFormCode(`م-${rooms.length + 1}`);
                  setRoomFormCapacity(30);
                  setRoomFormFloor('طبقه اول');
                  setRoomFormFacilities('ویدئو پروژکتور، وایت‌برد');
                  setRoomFormDescription('');
                  setShowRoomModal(true);
                }}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
              >
                <Building2 size={15} />
                <span>افزودن مَدرَس</span>
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="خروجی فایل اکسل از وضعیت کلاس‌ها"
            >
              <FileSpreadsheet size={15} />
              <span className="hidden sm:inline">اکسل</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
              title="چاپ برنامه"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>

        {/* 2. Top Metric Chips Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">کل مَدرَس‌ها</span>
              <span className="text-xl font-black text-slate-900">{totalRoomsCount} کلاس</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
              <Building2 size={18} />
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 block">کلاس‌های خالی و آزاد</span>
              <span className="text-xl font-black text-emerald-900">{availableCount} مدرس</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="p-3.5 bg-rose-50/80 rounded-2xl border border-rose-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-800 block">کلاس‌های پر و مشغول</span>
              <span className="text-xl font-black text-rose-900">{occupiedCount} مدرس</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <DoorOpen size={18} />
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-indigo-800 block">نرخ اشغال فضاها</span>
              <span className="text-xl font-black text-indigo-900">{occupancyPercent}٪</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs font-black text-xs">
              {occupancyPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Time & Day Slot Navigator */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        
        {/* Days Bar */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <CalendarDays size={14} className="text-indigo-600" />
            <span>انتخاب روز هفته جهت بررسی وضعیت مَدرَس‌ها:</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {WEEK_DAYS.map(day => {
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "py-2.5 px-3 rounded-2xl text-xs font-black transition-all border text-center cursor-pointer",
                    isSelected 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots Bar */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Clock size={14} className="text-indigo-600" />
            <span>انتخاب ساعت / زنگ برگزاری کلاس:</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {STANDARD_TIME_SLOTS.map(slot => {
              const isSelected = selectedSlotId === slot.id;
              return (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={cn(
                    "py-2 px-3 rounded-2xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 cursor-pointer text-center",
                    isSelected 
                      ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200" 
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  <span className="font-black text-[11px]">{slot.label}</span>
                  <span className={cn("text-[10px]", isSelected ? "text-slate-300" : "text-slate-400 font-mono")}>
                    {slot.startTime} - {slot.endTime}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* View Switcher & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Sub Tab View Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveView('cards')}
              className={cn(
                "flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeView === 'cards' 
                  ? "bg-white text-slate-900 shadow-xs font-black" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <LayoutGrid size={14} />
              <span>تفکیک پر و خالی</span>
            </button>

            <button
              onClick={() => setActiveView('matrix')}
              className={cn(
                "flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeView === 'matrix' 
                  ? "bg-white text-slate-900 shadow-xs font-black" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Table size={14} />
              <span>جدول ماتریس زنگ‌ها</span>
            </button>

            <button
              onClick={() => setActiveView('classes')}
              className={cn(
                "flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeView === 'classes' 
                  ? "bg-white text-slate-900 shadow-xs font-black" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <List size={14} />
              <span>لیست کل کلاس‌ها</span>
            </button>

            <button
              onClick={() => setActiveView('rooms-config')}
              className={cn(
                "flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeView === 'rooms-config' 
                  ? "bg-white text-slate-900 shadow-xs font-black" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Settings2 size={14} />
              <span>مدیریت مَدرَس‌ها</span>
            </button>
          </div>

          {/* Search and Status Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="جستجوی درس، استاد یا مدرس..."
                className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            {activeView === 'cards' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setOnlyShowOccupied(!onlyShowOccupied);
                    if (onlyShowAvailable) setOnlyShowAvailable(false);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer",
                    onlyShowOccupied 
                      ? "bg-rose-600 text-white border-rose-600 shadow-2xs" 
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  فقط پر
                </button>
                <button
                  onClick={() => {
                    setOnlyShowAvailable(!onlyShowAvailable);
                    if (onlyShowOccupied) setOnlyShowOccupied(false);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer",
                    onlyShowAvailable 
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs" 
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  فقط خالی
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. VIEW 1: LIVE CARDS DECK (تفکیک پر و خالی) */}
      {/* ========================================================================= */}
      {activeView === 'cards' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* COLUMN 1: FREE / AVAILABLE CLASSROOMS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-950">مَدرَس‌های خالی و آزاد (آماده استفاده)</h3>
                  <span className="text-[11px] font-medium text-emerald-800">
                    در روز {selectedDay}، {selectedSlot.label} ({selectedSlot.startTime} تا {selectedSlot.endTime})
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-white text-emerald-900 border border-emerald-300 rounded-full font-black text-xs shadow-2xs">
                {roomsOccupancy.filter(r => !r.isOccupied).length} کلاس
              </span>
            </div>

            <div className="space-y-3">
              {filteredOccupancy.filter(r => !r.isOccupied).length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                  <DoorOpen size={32} className="mx-auto opacity-30" />
                  <p className="text-xs font-bold">هیچ مدرس خالی‌ای در این ساعت یافت نشد (تمام فضاها پر یا فیلتر شده‌اند).</p>
                </div>
              ) : (
                filteredOccupancy.filter(r => !r.isOccupied).map(({ room }) => (
                  <motion.div
                    key={room.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-5 border border-emerald-200/90 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />

                    <div className="flex items-start justify-between pr-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-sm sm:text-base">{room.name}</h4>
                          {room.code && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono text-[10px] font-bold">
                              {room.code}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                          {room.floor && <span>موقعیت: {room.floor}</span>}
                          {room.capacity && <span>ظرفیت: <b>{room.capacity} نفر</b></span>}
                        </div>
                      </div>

                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black rounded-xl flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        خالی و آماده
                      </span>
                    </div>

                    {/* Facilities Chips */}
                    {room.facilities && room.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pr-2">
                        {room.facilities.map((fac, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200">
                            {fac}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between pr-2">
                      <span className="text-[10px] text-slate-400 font-medium">
                        آماده برگزاری کلاس، جلسه یا کارگاه
                      </span>

                      {!isReadOnly && (
                        <button
                          onClick={() => handleOpenAddClass(room.name)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>تخصیص کلاس در این ساعت</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: OCCUPIED CLASSROOMS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-rose-50/80 p-4 rounded-2xl border border-rose-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <DoorOpen size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-950">مَدرَس‌های پر و در حال برگزاری (مشغول)</h3>
                  <span className="text-[11px] font-medium text-rose-800">
                    در روز {selectedDay}، {selectedSlot.label} ({selectedSlot.startTime} تا {selectedSlot.endTime})
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-white text-rose-900 border border-rose-300 rounded-full font-black text-xs shadow-2xs">
                {roomsOccupancy.filter(r => r.isOccupied).length} کلاس
              </span>
            </div>

            <div className="space-y-3">
              {filteredOccupancy.filter(r => r.isOccupied).length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
                  <p className="text-xs font-bold text-slate-600">در این زنگ و روز، هیچ کلاسی در حال برگزاری نیست و تمام مدرس‌ها آزاد هستند.</p>
                </div>
              ) : (
                filteredOccupancy.filter(r => r.isOccupied).map(({ room, primaryProgram, enrolledCount }) => (
                  <motion.div
                    key={room.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-5 border border-rose-200/90 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />

                    <div className="flex items-start justify-between pr-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-sm sm:text-base">{room.name}</h4>
                          {room.code && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono text-[10px] font-bold">
                              {room.code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                          {room.floor && <span>{room.floor}</span>}
                          {room.capacity && <span>ظرفیت: {room.capacity} نفر</span>}
                        </div>
                      </div>

                      <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-black rounded-xl flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        مشغول (پر)
                      </span>
                    </div>

                    {/* Occupying Class Details Card */}
                    {primaryProgram && (
                      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 mr-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <GraduationCap size={15} className="text-indigo-600" />
                            <span className="font-black text-xs text-slate-900">{primaryProgram.title}</span>
                          </div>
                          {primaryProgram.grade && (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-black border border-indigo-200">
                              {primaryProgram.grade}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                          <div className="flex items-center gap-1">
                            <User size={13} className="text-slate-400" />
                            <span>استاد: <b className="text-slate-800">{primaryProgram.teacher || 'مشخص‌نشده'}</b></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={13} className="text-slate-400" />
                            <span>ساعت: <b>{primaryProgram.time || selectedSlot.displayTime}</b></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users size={13} className="text-slate-400" />
                            <span>تعداد طلاب: <b className="text-indigo-700">{enrolledCount} نفر</b></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400 font-medium">نوع: {primaryProgram.type || 'اصلی'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between pr-2">
                      <span className="text-[10px] text-slate-400 font-medium">
                        کلاس در حال استفاده در این زنگ
                      </span>

                      {!isReadOnly && primaryProgram && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditClass(primaryProgram)}
                            className="px-2.5 py-1 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-all border border-slate-200"
                          >
                            <Edit3 size={13} className="inline ml-1" />
                            ویرایش کلاس
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VIEW 2: WEEKLY TIMETABLE MATRIX (جدول ماتریس زنگ‌ها) */}
      {/* ========================================================================= */}
      {activeView === 'matrix' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-900 text-base">جدول ماتریس مَدرَس‌ها و زنگ‌های آموزشی</h3>
              <p className="text-xs text-slate-500 font-medium">
                نمای کلی وضعیت کلیه مدرس‌ها در زنگ‌های مختلف برای روز <b>{selectedDay}</b>
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-300 inline-block" />
                <span>خالی</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500 mr-2">
                <span className="w-3 h-3 rounded-md bg-indigo-600 inline-block" />
                <span>پر (برگزاری کلاس)</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-black">
                  <th className="p-3.5 w-48">مَدرَس (کلاس درس)</th>
                  {STANDARD_TIME_SLOTS.map(slot => (
                    <th key={slot.id} className="p-3.5 text-center font-black">
                      <div className="text-[11px] text-slate-800">{slot.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-normal">{slot.startTime} - {slot.endTime}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {rooms.map(room => (
                  <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <div>
                          <div className="font-black text-slate-900">{room.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {room.floor || 'طبقه همکف'} • {room.capacity} نفر
                          </div>
                        </div>
                      </div>
                    </td>

                    {STANDARD_TIME_SLOTS.map(slot => {
                      // Find program in this room, day, slot
                      const prog = programs.find(p => {
                        const pRoom = (p.madrasRoom || p.classroom || '').trim();
                        if (!pRoom) return false;
                        const isThisRoom = pRoom === room.name || pRoom === room.code || pRoom.includes(room.name);
                        if (!isThisRoom) return false;
                        if (!isDayMatch(p, selectedDay)) return false;
                        return isTimeMatch(p.time, slot);
                      });

                      return (
                        <td key={slot.id} className="p-2 text-center align-middle">
                          {prog ? (
                            <div 
                              onClick={() => !isReadOnly && handleOpenEditClass(prog)}
                              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all cursor-pointer text-right space-y-0.5"
                              title="مشاهده و ویرایش کلاس"
                            >
                              <div className="font-black text-[11px] leading-tight truncate">{prog.title}</div>
                              <div className="text-[9px] text-indigo-200 truncate">{prog.teacher || 'بدون استاد'}</div>
                              {prog.grade && (
                                <div className="text-[9px] text-amber-300 font-black">{prog.grade}</div>
                              )}
                            </div>
                          ) : (
                            <div 
                              onClick={() => {
                                if (!isReadOnly) {
                                  setSelectedSlotId(slot.id);
                                  handleOpenAddClass(room.name);
                                }
                              }}
                              className="p-2 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 rounded-xl border border-emerald-200/80 transition-all text-center cursor-pointer group"
                              title="مدرس در این ساعت خالی است. کلیک برای رزرو و تخصیص کلاس"
                            >
                              <span className="text-[10px] font-bold text-emerald-700 group-hover:hidden">خالی</span>
                              <span className="text-[10px] font-black text-emerald-800 hidden group-hover:inline">+ تخصیص</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. VIEW 3: ALL SCHEDULED CLASSES TABLE (لیست کل کلاس‌ها) */}
      {/* ========================================================================= */}
      {activeView === 'classes' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-900 text-base">لیست کلیه کلاس‌های تعریف‌شده</h3>
              <p className="text-xs text-slate-500 font-medium">
                فهرست کامل کلاس‌ها با مشخصات مَدرَس اختصاص‌یافته، استاد، ساعت و روزهای برگزاری
              </p>
            </div>

            {!isReadOnly && (
              <button
                onClick={() => handleOpenAddClass()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Plus size={15} />
                <span>تعریف کلاس جدید</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                  <th className="p-3">عنوان درس / کلاس</th>
                  <th className="p-3">مَدرَس (کلاس درس)</th>
                  <th className="p-3">استاد / مدرس</th>
                  <th className="p-3">روزهای برگزاری</th>
                  <th className="p-3">ساعت برگزاری</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3">تعداد طلاب</th>
                  {!isReadOnly && <th className="p-3 text-center">عملیات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                      هیچ کلاسی در سامانه ثبت نشده است. از دکمه «تعریف کلاس جدید» استفاده نمایید.
                    </td>
                  </tr>
                ) : (
                  programs
                    .filter(p => {
                      if (!searchFilter.trim()) return true;
                      const t = searchFilter.toLowerCase();
                      return (p.title || '').toLowerCase().includes(t) ||
                             (p.madrasRoom || p.classroom || '').toLowerCase().includes(t) ||
                             (p.teacher || '').toLowerCase().includes(t);
                    })
                    .map(prog => {
                      const studentCount = enrollments.filter(e => e.programId === prog.id).length;
                      const roomName = prog.madrasRoom || prog.classroom || 'تعیین‌نشده';

                      return (
                        <tr key={prog.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-black text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <GraduationCap size={15} className="text-indigo-600" />
                              <span>{prog.title}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={cn(
                              "px-2.5 py-1 rounded-xl font-bold text-[11px] inline-flex items-center gap-1",
                              roomName !== 'تعیین‌نشده' 
                                ? "bg-indigo-50 text-indigo-800 border border-indigo-200" 
                                : "bg-slate-100 text-slate-500"
                            )}>
                              <DoorOpen size={12} />
                              {roomName}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-700">
                            {prog.teacher || '---'}
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {prog.day || getProgramDays(prog).join(' ، ') || '---'}
                          </td>
                          <td className="p-3 font-bold text-slate-800">
                            <span className="flex items-center gap-1">
                              <Clock size={12} className="text-slate-400" />
                              {prog.time || '---'}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-indigo-700">
                            {prog.grade || '---'}
                          </td>
                          <td className="p-3 font-bold text-slate-700">
                            {studentCount} نفر
                          </td>
                          {!isReadOnly && (
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEditClass(prog)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="ویرایش مشخصات کلاس"
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClass(prog.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                                  title="حذف کلاس"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. VIEW 4: ROOMS CATALOG & CONFIG (مدیریت مَدرَس‌ها) */}
      {/* ========================================================================= */}
      {activeView === 'rooms-config' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-900 text-base">مدیریت مَدرَس‌ها (کلاس‌های فیزیکی درس)</h3>
              <p className="text-xs text-slate-500 font-medium">
                تعریف اتاق‌های کلاس درس، مشخصات ظرفیت، طبقه و امکانات رفاهی و تجهیزات
              </p>
            </div>

            {!isReadOnly && (
              <button
                onClick={() => {
                  setEditingRoom(null);
                  setRoomFormName('');
                  setRoomFormCode(`م-${rooms.length + 1}`);
                  setRoomFormCapacity(30);
                  setRoomFormFloor('طبقه اول');
                  setRoomFormFacilities('ویدئو پروژکتور، وایت‌برد');
                  setRoomFormDescription('');
                  setShowRoomModal(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
              >
                <Plus size={15} />
                <span>افزودن مَدرَس جدید</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <div
                key={room.id}
                className="bg-slate-50 rounded-2xl p-4 border border-slate-200 hover:border-indigo-300 transition-all space-y-3 relative"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white text-indigo-700 border border-slate-200 flex items-center justify-center font-bold">
                        <DoorOpen size={17} />
                      </div>
                      <h4 className="font-black text-slate-900 text-sm">{room.name}</h4>
                    </div>
                    {room.code && (
                      <span className="text-[10px] text-slate-400 font-mono font-bold block pr-10">
                        کد: {room.code}
                      </span>
                    )}
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingRoom(room);
                          setRoomFormName(room.name);
                          setRoomFormCode(room.code || '');
                          setRoomFormCapacity(room.capacity || 30);
                          setRoomFormFloor(room.floor || 'طبقه اول');
                          setRoomFormFacilities(room.facilities?.join('، ') || '');
                          setRoomFormDescription(room.description || '');
                          setShowRoomModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-700 hover:bg-white rounded-lg transition-all"
                        title="ویرایش مَدرَس"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-white rounded-lg transition-all"
                        title="حذف مَدرَس"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                  <div>موقعیت: <b>{room.floor || 'همکف'}</b></div>
                  <div>ظرفیت: <b>{room.capacity} نفر</b></div>
                </div>

                {room.facilities && room.facilities.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">امکانات و تجهیزات:</span>
                    <div className="flex flex-wrap gap-1">
                      {room.facilities.map((fac, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-white text-slate-700 rounded-md text-[10px] font-medium border border-slate-200">
                          {fac}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {room.description && (
                  <p className="text-[11px] text-slate-500 italic">
                    {room.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: DEFINE / EDIT CLASS (همراه با مشخص کردن ساعت، روز، مَدرَس و استاد) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showClassModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                    <GraduationCap size={18} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingProgram ? 'ویرایش اطلاعات کلاس درس' : 'تعریف کلاس درس جدید (با مَدرَس و ساعت)'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowClassModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveClass} className="space-y-4">
                
                {/* Class Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان کلاس / درس *</label>
                  <input
                    type="text"
                    required
                    value={classFormTitle}
                    onChange={(e) => setClassFormTitle(e.target.value)}
                    placeholder="مثلاً: فقه (مکاسب)، اصول (کفایه)، نحو، منطق..."
                    className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                {/* Madras Room Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <DoorOpen size={14} className="text-indigo-600" />
                      <span>مَدرَس (کلاس درس) *</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">محل فیزیکی برگزاری درس</span>
                  </label>
                  <select
                    required
                    value={classFormMadras}
                    onChange={(e) => setClassFormMadras(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-black bg-white text-slate-900"
                  >
                    <option value="">-- انتخاب مَدرَس --</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.name}>
                        {r.name} ({r.floor || 'همکف'} - ظرفیت {r.capacity} نفر)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Teacher / Instructor */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <User size={14} className="text-indigo-600" />
                      <span>استاد / مدرّس کلاس *</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">از لیست یا تایپ دستی</span>
                  </label>
                  <input
                    type="text"
                    list="teachers-datalist"
                    required
                    value={classFormTeacher}
                    onChange={(e) => setClassFormTeacher(e.target.value)}
                    placeholder="نام استاد محترم..."
                    className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                  <datalist id="teachers-datalist">
                    {teachers.map(t => (
                      <option key={t.id} value={t.fullName} />
                    ))}
                  </datalist>
                </div>

                {/* Time & Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Clock size={13} className="text-indigo-600" />
                      <span>ساعت برگزاری *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={classFormTime}
                      onChange={(e) => setClassFormTime(e.target.value)}
                      placeholder="مثلاً: ۰۸:۰۰ الی ۰۹:۳۰"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">انتخاب سریع زنگ</label>
                    <select
                      onChange={(e) => {
                        const slot = STANDARD_TIME_SLOTS.find(s => s.id === e.target.value);
                        if (slot) setClassFormTime(slot.displayTime);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium"
                    >
                      <option value="">-- انتخاب از زنگ‌های استاندارد --</option>
                      {STANDARD_TIME_SLOTS.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({s.startTime} تا {s.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Days of week */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    روزهای برگزاری کلاس در هفته:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {WEEK_DAYS.map(day => {
                      const isChecked = classFormDays.includes(day);
                      return (
                        <label
                          key={day}
                          className={cn(
                            "flex items-center gap-1.5 p-2 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all",
                            isChecked
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setClassFormDays([...classFormDays, day]);
                              } else {
                                setClassFormDays(classFormDays.filter(d => d !== day));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 focus:ring-indigo-500 accent-indigo-600"
                          />
                          <span className="text-[11px]">{day}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Grade & Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">پایه تحصیلی</label>
                    <select
                      value={classFormGrade}
                      onChange={(e) => setClassFormGrade(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold"
                    >
                      <option value="پایه ۷">پایه ۷</option>
                      <option value="پایه ۸">پایه ۸</option>
                      <option value="پایه ۹">پایه ۹</option>
                      <option value="پایه ۱۰">پایه ۱۰</option>
                      <option value="عموم پایه‌ها">عموم پایه‌ها</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نوع برنامه</label>
                    <select
                      value={classFormType}
                      onChange={(e) => setClassFormType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                    >
                      <option value="اصلی">درس اصلی</option>
                      <option value="مشاوره">مشاوره</option>
                      <option value="پژوهش">کارگاه پژوهش</option>
                      <option value="دروس 5 شنبه">برنامه ۵ شنبه</option>
                      <option value="سایر">سایر</option>
                    </select>
                  </div>
                </div>

                {/* Conflict Alert (Smart Warning) */}
                {conflictWarning && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold block">توجه: احتمال تداخل کلاسی در این مَدرَس!</span>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        مدرس <b>{classFormMadras}</b> در روزهای <b>{conflictWarning.day}</b> ساعت <b>{conflictWarning.time}</b> برای کلاس <b>«{conflictWarning.title}»</b> استاد <b>{conflictWarning.teacher}</b> رزرو شده است.
                      </p>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    {editingProgram ? 'ذخیره تغییرات کلاس' : 'ثبت و اختصاص کلاس به مَدرَس'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClassModal(false)}
                    className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 9. MODAL: DEFINE / EDIT MADRAS ROOM (تعریف و ویرایش کلاس درس فیزیکی) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showRoomModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                    <Building2 size={18} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingRoom ? 'ویرایش مشخصات مَدرَس' : 'تعریف مَدرَس (کلاس درس فیزیکی)'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowRoomModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام مَدرَس *</label>
                  <input
                    type="text"
                    required
                    value={roomFormName}
                    onChange={(e) => setRoomFormName(e.target.value)}
                    placeholder="مثلاً: مدرس ۱ (شیخ انصاری)..."
                    className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">کد / شماره</label>
                    <input
                      type="text"
                      value={roomFormCode}
                      onChange={(e) => setRoomFormCode(e.target.value)}
                      placeholder="مثلاً: م-۱"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ظرفیت (نفر)</label>
                    <input
                      type="number"
                      value={roomFormCapacity}
                      onChange={(e) => setRoomFormCapacity(Number(e.target.value))}
                      placeholder="۳۰"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">موقعیت / طبقه</label>
                  <input
                    type="text"
                    value={roomFormFloor}
                    onChange={(e) => setRoomFormFloor(e.target.value)}
                    placeholder="مثلاً: طبقه اول، همکف، زیرهمکف..."
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    امکانات و تجهیزات (با کاما یا ویرگول جدا کنید)
                  </label>
                  <input
                    type="text"
                    value={roomFormFacilities}
                    onChange={(e) => setRoomFormFacilities(e.target.value)}
                    placeholder="ویدئو پروژکتور، وایت‌برد، سیستم صوتی، تهویه..."
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات</label>
                  <textarea
                    rows={2}
                    value={roomFormDescription}
                    onChange={(e) => setRoomFormDescription(e.target.value)}
                    placeholder="توضیحات اختیاری درباره کاربری یا اساتید مدرس..."
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-colors shadow-md cursor-pointer"
                  >
                    {editingRoom ? 'ذخیره مشخصات' : 'ثبت مَدرَس'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRoomModal(false)}
                    className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
