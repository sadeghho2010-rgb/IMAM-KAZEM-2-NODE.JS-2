import React, { useState, useEffect, useMemo } from 'react';
import { 
  DoorOpen, 
  Search, 
  Plus, 
  Layers, 
  Users, 
  FileSpreadsheet, 
  Printer, 
  Building2, 
  Sparkles, 
  Filter, 
  Calendar,
  XCircle,
  Clock,
  User,
  GraduationCap,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { Program, MadrasRoom, Teacher, Student, Enrollment } from '../types';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { useMentor } from '../context/MentorContext';
import { cn, WEEK_DAYS, getProgramDays } from '../lib/utils';
import MadrasRoomCard from './madras/MadrasRoomCard';
import MadrasWeeklyScheduleModal from './madras/MadrasWeeklyScheduleModal';
import MadrasEmptyFinder from './madras/MadrasEmptyFinder';
import { 
  DEFAULT_MADRAS_ROOMS, 
  MADRAS_TIME_SLOTS_7_TO_17, 
  MADRAS_HOURLY_SLOTS_7_TO_17,
  canManageAndSearchMadras,
  timeToMinutes, 
  isProgramInRoom,
  getRoomCurrentStatus 
} from './madras/madrasUtils';

// Re-export for any external consumers if needed
export { DEFAULT_MADRAS_ROOMS } from './madras/madrasUtils';

export default function MadrasRooms() {
  const { currentUser } = useAuth();
  const { currentMentorId } = useMentor();

  // Role permissions: Only Super Admin and Education Officer can search and edit
  const canEditAndSearch = canManageAndSearchMadras(currentUser);

  // Data state
  const [rooms, setRooms] = useState<MadrasRoom[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State for Main Madras List
  const [searchFilter, setSearchFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [capacityFilter, setCapacityFilter] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'free' | 'occupied'>('all');

  // Quick Finder Toggle
  const [showEmptyFinder, setShowEmptyFinder] = useState(false);

  // Selected Room for Weekly Timetable (7:00 to 17:00)
  const [selectedRoomForSchedule, setSelectedRoomForSchedule] = useState<MadrasRoom | null>(null);

  // Modals state: Class & Room
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<MadrasRoom | null>(null);

  // Class Form State
  const [classFormTitle, setClassFormTitle] = useState('');
  const [classFormMadras, setClassFormMadras] = useState('');
  const [classFormTeacher, setClassFormTeacher] = useState('');
  const [classFormDays, setClassFormDays] = useState<string[]>(['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
  const [classFormTime, setClassFormTime] = useState(MADRAS_HOURLY_SLOTS_7_TO_17[0].displayTime);
  const [timeInputMode, setTimeInputMode] = useState<'standard' | 'manual'>('standard');
  const [customStartTime, setCustomStartTime] = useState('07:30');
  const [customEndTime, setCustomEndTime] = useState('08:45');
  const [classFormGrade, setClassFormGrade] = useState('پایه ۷');
  const [classFormType, setClassFormType] = useState<'اصلی' | 'مشاوره' | 'پژوهش' | 'دروس 5 شنبه' | 'سایر'>('اصلی');
  const [classFormNotes, setClassFormNotes] = useState('');

  // Room Form State
  const [roomFormName, setRoomFormName] = useState('');
  const [roomFormCode, setRoomFormCode] = useState('');
  const [roomFormCapacity, setRoomFormCapacity] = useState<number>(30);
  const [roomFormFloor, setRoomFormFloor] = useState('طبقه اول');
  const [roomFormDescription, setRoomFormDescription] = useState('');

  const isReadOnly = !canEditAndSearch;

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

  // Extract unique floors for filter dropdown
  const uniqueFloors = useMemo(() => {
    const s = new Set<string>();
    rooms.forEach(r => {
      if (r.floor && r.floor.trim()) s.add(r.floor.trim());
    });
    return Array.from(s);
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // 1. Search name or code
      if (searchFilter.trim()) {
        const term = searchFilter.toLowerCase().trim();
        const matchName = (room.name || '').toLowerCase().includes(term);
        const matchCode = (room.code || '').toLowerCase().includes(term);
        if (!matchName && !matchCode) return false;
      }

      // 2. Floor filter
      if (floorFilter !== 'all' && (room.floor || '').trim() !== floorFilter) {
        return false;
      }

      // 3. Capacity filter
      if (capacityFilter > 0 && (room.capacity || 0) < capacityFilter) {
        return false;
      }

      // 4. Real-time Status filter
      if (statusFilter !== 'all') {
        const { isOccupied } = getRoomCurrentStatus(room, programs);
        if (statusFilter === 'free' && isOccupied) return false;
        if (statusFilter === 'occupied' && !isOccupied) return false;
      }

      return true;
    });
  }, [rooms, programs, searchFilter, floorFilter, capacityFilter, statusFilter]);

  // Open modal for new class with prefilled room and time
  const handleOpenAddClass = (prefillRoomName?: string, prefillDay?: string, prefillTime?: string) => {
    setEditingProgram(null);
    setClassFormTitle('');
    setClassFormMadras(prefillRoomName || (rooms[0]?.name || ''));
    setClassFormTeacher('');
    setClassFormDays(prefillDay ? [prefillDay] : ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);

    const targetTime = prefillTime || MADRAS_HOURLY_SLOTS_7_TO_17[0].displayTime;
    setClassFormTime(targetTime);

    // If prefilled with a custom time format like 07:30 الی 08:45
    const matchedTimes = targetTime.match(/\d{1,2}[:：]\d{1,2}/g);
    if (matchedTimes && matchedTimes.length >= 2) {
      setCustomStartTime(matchedTimes[0]);
      setCustomEndTime(matchedTimes[1]);
    }
    const isStandard = MADRAS_HOURLY_SLOTS_7_TO_17.some(s => s.displayTime === targetTime);
    setTimeInputMode(isStandard ? 'standard' : 'manual');

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

    const progTime = prog.time || MADRAS_HOURLY_SLOTS_7_TO_17[0].displayTime;
    setClassFormTime(progTime);

    const matchedTimes = progTime.match(/\d{1,2}[:：]\d{1,2}/g);
    if (matchedTimes && matchedTimes.length >= 2) {
      setCustomStartTime(matchedTimes[0]);
      setCustomEndTime(matchedTimes[1]);
    }
    const isStandard = MADRAS_HOURLY_SLOTS_7_TO_17.some(s => s.displayTime === progTime);
    setTimeInputMode(isStandard ? 'standard' : 'manual');

    setClassFormGrade(prog.grade || 'پایه ۷');
    setClassFormType(prog.type || 'اصلی');
    setClassFormNotes(prog.notes || '');
    setShowClassModal(true);
  };

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

  // Save Room (Add / Edit)
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomFormName.trim()) return;

    try {
      const payload: Partial<MadrasRoom> = {
        name: roomFormName.trim(),
        code: roomFormCode.trim(),
        capacity: Number(roomFormCapacity) || 30,
        floor: roomFormFloor.trim(),
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

  // Export Rooms List to Excel
  const handleExportExcel = () => {
    const rows: any[] = [];
    rows.push(['گزارش مَدرَس‌ها و کلاس‌های درس']);
    rows.push(['شماره / نام مَدرَس', 'کد', 'طبقه', 'ظرفیت (نفر)', 'وضعیت فعلی']);

    rooms.forEach(room => {
      const { isOccupied } = getRoomCurrentStatus(room, programs);
      rows.push([
        room.name,
        room.code || '',
        room.floor || 'همکف',
        room.capacity || '—',
        isOccupied ? 'مشغول' : 'آزاد'
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'لیست مدرس‌ها');
    XLSX.writeFile(workbook, `لیست_مدرس_ها.xlsx`);
  };

  return (
    <div className="space-y-6 text-slate-800" dir="rtl" id="madras-rooms-main">
      
      {/* 1. Header Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <DoorOpen size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                مَدرَس‌ها (کلاس‌های درس)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                مشاهده لیست مَدرَس‌ها، برنامه هفتگی از ساعت ۰۷:۰۰ الی ۱۷:۰۰ و ابزار جستجوی سریع کلاس خالی
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canEditAndSearch ? (
            <>
              <button
                onClick={() => setShowEmptyFinder(!showEmptyFinder)}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs",
                  showEmptyFinder 
                    ? "bg-slate-900 text-white hover:bg-black" 
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                )}
                title="ابزار جستجو و یافتن سریع مَدرَس خالی"
              >
                <Search size={15} />
                <span>یافتن مَدرَس خالی</span>
              </button>

              <button
                onClick={() => handleOpenAddClass()}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
              >
                <Plus size={15} />
                <span>تعریف کلاس جدید</span>
              </button>

              <button
                onClick={() => {
                  setEditingRoom(null);
                  setRoomFormName(`مدرس ${rooms.length + 1}`);
                  setRoomFormCode(`م-${rooms.length + 1}`);
                  setRoomFormCapacity(30);
                  setRoomFormFloor('طبقه اول');
                  setRoomFormDescription('');
                  setShowRoomModal(true);
                }}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
              >
                <Building2 size={15} />
                <span>افزودن مَدرَس</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
              <DoorOpen size={15} className="text-indigo-600" />
              <span>مشاهده برنامه مَدرَس‌ها (جهت مشاهده جدول هفتگی روی هر کارت کلیک کنید)</span>
            </div>
          )}

          <button
            onClick={handleExportExcel}
            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="خروجی فایل اکسل از مَدرَس‌ها"
          >
            <FileSpreadsheet size={16} />
          </button>

          <button
            onClick={() => window.print()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="چاپ"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* 2. Quick Empty Room Finder Section (Collapsible / Interactive - Super Admin & Education Officer Only) */}
      <AnimatePresence>
        {showEmptyFinder && canEditAndSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <MadrasEmptyFinder
              rooms={rooms}
              programs={programs}
              isReadOnly={isReadOnly}
              onSelectRoom={(room) => setSelectedRoomForSchedule(room)}
              onQuickAssign={(roomName, day, timeStr) => handleOpenAddClass(roomName, day, timeStr)}
              onClose={() => setShowEmptyFinder(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Filter Bar (Floor & Capacity & Search & Status) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute right-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="شماره یا نام مَدرَس..."
            className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        {/* Filters Group: Floor, Capacity, Status */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          
          {/* Floor Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
            <Layers size={13} className="text-slate-400" />
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">همه طبقات</option>
              {uniqueFloors.map(fl => (
                <option key={fl} value={fl}>{fl}</option>
              ))}
            </select>
          </div>

          {/* Capacity Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
            <Users size={13} className="text-slate-400" />
            <select
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value={0}>تمام ظرفیت‌ها</option>
              <option value={20}>حداقل ۲۰ نفر</option>
              <option value={25}>حداقل ۲۵ نفر</option>
              <option value={30}>حداقل ۳۰ نفر</option>
              <option value={35}>حداقل ۳۵ نفر</option>
              <option value={40}>حداقل ۴۰ نفر</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                statusFilter === 'all' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-900"
              )}
            >
              همه
            </button>
            <button
              onClick={() => setStatusFilter('free')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                statusFilter === 'free' ? "bg-white text-emerald-700 shadow-2xs font-black" : "text-slate-500 hover:text-slate-900"
              )}
            >
              آزاد
            </button>
            <button
              onClick={() => setStatusFilter('occupied')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                statusFilter === 'occupied' ? "bg-white text-rose-700 shadow-2xs font-black" : "text-slate-500 hover:text-slate-900"
              )}
            >
              مشغول
            </button>
          </div>

          {(searchFilter || floorFilter !== 'all' || capacityFilter > 0 || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchFilter('');
                setFloorFilter('all');
                setCapacityFilter(0);
                setStatusFilter('all');
              }}
              className="text-xs text-rose-600 hover:underline px-2 py-1"
            >
              پاکسازی فیلترها
            </button>
          )}
        </div>
      </div>

      {/* 4. Compact Madras Rooms Grid (Clean, Decluttered, No Facilities) */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-bold">
          در حال بارگذاری اطلاعات مَدرَس‌ها...
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 space-y-2">
          <DoorOpen size={36} className="mx-auto opacity-30" />
          <p className="text-sm font-bold text-slate-600">مَدرَسی با این مشخصات یافت نشد.</p>
          <p className="text-xs text-slate-400">می‌توانید فیلترهای جستجو را پاک کنید یا مَدرَس جدیدی اضافه نمایید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredRooms.map(room => (
            <MadrasRoomCard
              key={room.id}
              room={room}
              programs={programs}
              isReadOnly={isReadOnly}
              onSelect={(r) => setSelectedRoomForSchedule(r)}
              onEdit={(r) => {
                setEditingRoom(r);
                setRoomFormName(r.name);
                setRoomFormCode(r.code || '');
                setRoomFormCapacity(r.capacity || 30);
                setRoomFormFloor(r.floor || 'طبقه اول');
                setRoomFormDescription(r.description || '');
                setShowRoomModal(true);
              }}
              onDelete={(roomId) => handleDeleteRoom(roomId)}
            />
          ))}
        </div>
      )}

      {/* 5. Weekly Schedule Modal (Strictly 07:00 to 17:00) */}
      <MadrasWeeklyScheduleModal
        room={selectedRoomForSchedule}
        programs={programs}
        isReadOnly={isReadOnly}
        onClose={() => setSelectedRoomForSchedule(null)}
        onAddClass={(roomName, day, time) => handleOpenAddClass(roomName, day, time)}
        onEditClass={(prog) => handleOpenEditClass(prog)}
      />

      {/* 6. Define / Edit Class Modal */}
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
                    {editingProgram ? 'ویرایش کلاس درس' : 'تعریف کلاس درس جدید'}
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
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان درس / کلاس *</label>
                  <input
                    type="text"
                    required
                    value={classFormTitle}
                    onChange={(e) => setClassFormTitle(e.target.value)}
                    placeholder="مثلاً: فقه (مکاسب)، اصول، نحو..."
                    className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                {/* Madras Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مَدرَس (کلاس درس) *</label>
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

                {/* Teacher */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">استاد / مدرس کلاس *</label>
                  <input
                    type="text"
                    list="teachers-datalist-madras"
                    required
                    value={classFormTeacher}
                    onChange={(e) => setClassFormTeacher(e.target.value)}
                    placeholder="نام استاد محترم..."
                    className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                  <datalist id="teachers-datalist-madras">
                    {teachers.map(t => (
                      <option key={t.id} value={t.fullName} />
                    ))}
                  </datalist>
                </div>

                {/* Time Selection: Standard 1-Hour vs Manual Custom Time (7:00 to 17:00) */}
                <div className="space-y-2.5 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Clock size={14} className="text-indigo-600" />
                      <span>ساعت برگزاری کلاس *</span>
                    </label>

                    {/* Mode Toggle */}
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-[11px] font-bold self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setTimeInputMode('standard');
                          setClassFormTime(MADRAS_HOURLY_SLOTS_7_TO_17[0].displayTime);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                          timeInputMode === 'standard'
                            ? "bg-white text-indigo-700 shadow-2xs font-black"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        ساعت‌های رسمی (رأس ساعت)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTimeInputMode('manual');
                          setClassFormTime(`${customStartTime} الی ${customEndTime}`);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                          timeInputMode === 'manual'
                            ? "bg-white text-indigo-700 shadow-2xs font-black"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        دستی (غیر رأس ساعت)
                      </button>
                    </div>
                  </div>

                  {timeInputMode === 'standard' ? (
                    <div className="space-y-1.5">
                      <select
                        value={classFormTime}
                        onChange={(e) => setClassFormTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-black text-slate-800"
                      >
                        {MADRAS_HOURLY_SLOTS_7_TO_17.map(s => (
                          <option key={s.id} value={s.displayTime}>
                            {s.label} ({s.displayTime})
                          </option>
                        ))}
                      </select>
                      <div className="text-[11px] text-slate-400 font-medium">
                        ساعت‌های رسمی یک‌ساعته هستند و دقیقاً از رأس هر ساعت شروع می‌شوند (۰۷:۰۰ الی ۱۷:۰۰).
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 block mb-1">ساعت شروع (دلخواه):</span>
                          <input
                            type="time"
                            min="07:00"
                            max="17:00"
                            value={customStartTime}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setCustomStartTime(newStart);
                              setClassFormTime(`${newStart} الی ${customEndTime}`);
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 block mb-1">ساعت پایان:</span>
                          <input
                            type="time"
                            min="07:00"
                            max="17:00"
                            value={customEndTime}
                            onChange={(e) => {
                              const newEnd = e.target.value;
                              setCustomEndTime(newEnd);
                              setClassFormTime(`${customStartTime} الی ${newEnd}`);
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Manual editable text field */}
                      <div>
                        <input
                          type="text"
                          required
                          value={classFormTime}
                          onChange={(e) => setClassFormTime(e.target.value)}
                          placeholder="مثلاً: ۰۷:۳۰ الی ۰۸:۴۵"
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-center bg-white text-indigo-700 font-mono"
                        />
                      </div>

                      {/* Quick non-hour presets */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <span className="text-[10px] text-slate-400 font-medium">ساعت‌های متداول:</span>
                        {[
                          { label: '۰۷:۳۰-۰۸:۴۵', s: '07:30', e: '08:45' },
                          { label: '۰۸:۳۰-۰۹:۴۵', s: '08:30', e: '09:45' },
                          { label: '۱۰:۱۵-۱۱:۴۵', s: '10:15', e: '11:45' },
                          { label: '۱۳:۳۰-۱۵:۰۰', s: '13:30', e: '15:00' },
                        ].map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCustomStartTime(p.s);
                              setCustomEndTime(p.e);
                              setClassFormTime(`${p.s} الی ${p.e}`);
                            }}
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer",
                              classFormTime === `${p.s} الی ${p.e}`
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Days */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">روزهای برگزاری:</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {WEEK_DAYS.filter(d => d !== 'جمعه').map(day => {
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

                {/* Grade */}
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">نوع کلاس</label>
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

                {/* Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    {editingProgram ? 'ذخیره تغییرات' : 'ثبت و اختصاص کلاس'}
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

      {/* 7. Define / Edit Madras Room Modal */}
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
                    {editingRoom ? 'ویرایش مشخصات مَدرَس' : 'تعریف مَدرَس جدید'}
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">شماره / نام مَدرَس *</label>
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">کد مَدرَس</label>
                    <input
                      type="text"
                      value={roomFormCode}
                      onChange={(e) => setRoomFormCode(e.target.value)}
                      placeholder="م-۱"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ظرفیت (نفر) *</label>
                    <input
                      type="number"
                      required
                      value={roomFormCapacity}
                      onChange={(e) => setRoomFormCapacity(Number(e.target.value))}
                      placeholder="۳۰"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طبقه مَدرَس *</label>
                  <input
                    type="text"
                    required
                    value={roomFormFloor}
                    onChange={(e) => setRoomFormFloor(e.target.value)}
                    placeholder="مثلاً: طبقه همکف، طبقه اول، طبقه دوم..."
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات اختیاری</label>
                  <textarea
                    rows={2}
                    value={roomFormDescription}
                    onChange={(e) => setRoomFormDescription(e.target.value)}
                    placeholder="توضیحات کوتاه..."
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-colors shadow-md cursor-pointer"
                  >
                    {editingRoom ? 'ذخیره تغییرات' : 'ثبت مَدرَس'}
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
