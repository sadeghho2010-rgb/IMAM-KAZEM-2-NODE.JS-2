import React, { useState, useMemo } from 'react';
import { 
  Search, 
  CheckCircle2, 
  DoorOpen, 
  Clock, 
  Calendar, 
  Layers, 
  Users, 
  Plus, 
  CalendarDays,
  Sparkles,
  ArrowLeft,
  X
} from 'lucide-react';
import { MadrasRoom, Program } from '../../types';
import { 
  MADRAS_HOURLY_SLOTS_7_TO_17, 
  WEEK_DAYS_SEMINARY, 
  isProgramInRoom, 
  isDayMatch, 
  isProgramInTimeRange, 
  timeToMinutes,
  getCurrentPersianDayName
} from './madrasUtils';
import { cn } from '../../lib/utils';

interface MadrasEmptyFinderProps {
  rooms: MadrasRoom[];
  programs: Program[];
  isReadOnly?: boolean;
  onSelectRoom: (room: MadrasRoom) => void;
  onQuickAssign?: (roomName: string, day: string, timeStr: string) => void;
  onClose?: () => void;
}

export default function MadrasEmptyFinder({
  rooms,
  programs,
  isReadOnly,
  onSelectRoom,
  onQuickAssign,
  onClose,
}: MadrasEmptyFinderProps) {
  // Day selection: 'daily' (all active seminary days) or specific day name
  const [selectedDay, setSelectedDay] = useState<string>(() => getCurrentPersianDayName());
  
  // Time Slot selection (1-hour slots) or Custom (non-hour manual entry)
  const [selectedSlotId, setSelectedSlotId] = useState<string>('hour-1');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('07:30');
  const [customEndTime, setCustomEndTime] = useState('08:45');

  // Filters: Floor & Capacity
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [minCapacity, setMinCapacity] = useState<number>(0);

  // Extract unique floors
  const availableFloors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => {
      if (r.floor && r.floor.trim()) set.add(r.floor.trim());
    });
    return Array.from(set);
  }, [rooms]);

  // Selected time range minutes
  const timeRange = useMemo(() => {
    if (useCustomTime) {
      const sM = timeToMinutes(customStartTime) || 450; // 07:30 default
      const eM = timeToMinutes(customEndTime) || 525;   // 08:45 default
      return { 
        startMinutes: Math.max(7 * 60, Math.min(sM, 17 * 60)), 
        endMinutes: Math.min(17 * 60, Math.max(eM, 7 * 60 + 15)),
        display: `${customStartTime} الی ${customEndTime}`
      };
    }
    const slot = MADRAS_HOURLY_SLOTS_7_TO_17.find(s => s.id === selectedSlotId) || MADRAS_HOURLY_SLOTS_7_TO_17[0];
    return {
      startMinutes: timeToMinutes(slot.startTime) || 420,
      endMinutes: timeToMinutes(slot.endTime) || 480,
      display: `${slot.startTime} الی ${slot.endTime} (${slot.label})`
    };
  }, [useCustomTime, customStartTime, customEndTime, selectedSlotId]);

  // Quick preset helper for manual custom times
  const handleApplyPreset = (start: string, end: string) => {
    setCustomStartTime(start);
    setCustomEndTime(end);
    setUseCustomTime(true);
  };

  // Evaluate which rooms are free and which are occupied
  const { freeRooms, occupiedRooms } = useMemo(() => {
    const daysToCheck = selectedDay === 'daily' ? WEEK_DAYS_SEMINARY : [selectedDay];

    const free: { room: MadrasRoom }[] = [];
    const occupied: { room: MadrasRoom; conflictingPrograms: Program[] }[] = [];

    rooms.forEach(room => {
      // 1. Floor Filter
      if (selectedFloor !== 'all' && (room.floor || '').trim() !== selectedFloor) {
        return;
      }

      // 2. Capacity Filter
      if (minCapacity > 0 && (room.capacity || 0) < minCapacity) {
        return;
      }

      // 3. Check for conflicting programs during the day(s) and time range
      const conflicts = programs.filter(prog => {
        if (!isProgramInRoom(prog, room)) return false;

        // Day match
        const matchesAnyDay = daysToCheck.some(day => isDayMatch(prog, day));
        if (!matchesAnyDay) return false;

        // Time overlap match
        return isProgramInTimeRange(prog, timeRange.startMinutes, timeRange.endMinutes);
      });

      if (conflicts.length === 0) {
        free.push({ room });
      } else {
        occupied.push({ room, conflictingPrograms: conflicts });
      }
    });

    return { freeRooms: free, occupiedRooms: occupied };
  }, [rooms, programs, selectedDay, selectedFloor, minCapacity, timeRange]);

  const [showOccupiedToggle, setShowOccupiedToggle] = useState(false);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-indigo-200/90 shadow-md space-y-6 relative overflow-hidden" id="madras-empty-finder">
      <div className="absolute top-0 right-0 w-3 h-full bg-indigo-600 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
              <Search size={16} />
            </div>
            <h3 className="font-black text-slate-900 text-base">
              یافتن سریع مَدرَس خالی و آزاد
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            انتخاب روز (یا کل ایام هفته)، بازه زمانی (۷ تا ۱۷)، طبقه و ظرفیت برای پیدا کردن فوری کلاس‌های آماده
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl self-start sm:self-auto transition-colors"
            title="بستن ابزار جستجو"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
        
        {/* 1. Day / Daily */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Calendar size={13} className="text-indigo-600" />
            <span>روز مورد نظر:</span>
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-indigo-500"
          >
            <option value="daily">★ تمام روزهای هفته (برنامه روزانه ثابت)</option>
            {WEEK_DAYS_SEMINARY.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* 2. Time Slot / Hours (Bounded 7 to 17) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Clock size={13} className="text-indigo-600" />
              <span>ساعت آموزشی:</span>
            </label>
            <button
              onClick={() => setUseCustomTime(!useCustomTime)}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold transition-colors cursor-pointer"
            >
              {useCustomTime ? 'ساعت‌های رسمی (یک‌ساعته)' : 'ساعت دستی (غیر رأس ساعت)'}
            </button>
          </div>

          {useCustomTime ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  min="07:00"
                  max="17:00"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono text-center outline-none focus:border-indigo-500"
                  title="ساعت شروع"
                />
                <span className="text-xs text-slate-400 font-bold">تا</span>
                <input
                  type="time"
                  min="07:00"
                  max="17:00"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono text-center outline-none focus:border-indigo-500"
                  title="ساعت پایان"
                />
              </div>

              {/* Quick manual non-hour presets */}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] text-slate-400">پیش‌فرض:</span>
                {[
                  { label: '۰۷:۳۰-۰۸:۴۵', start: '07:30', end: '08:45' },
                  { label: '۰۸:۳۰-۰۹:۴۵', start: '08:30', end: '09:45' },
                  { label: '۱۰:۱۵-۱۱:۴۵', start: '10:15', end: '11:45' },
                  { label: '۱۳:۳۰-۱۵:۰۰', start: '13:30', end: '15:00' },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p.start, p.end)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer",
                      customStartTime === p.start && customEndTime === p.end
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <select
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-indigo-500"
            >
              {MADRAS_HOURLY_SLOTS_7_TO_17.map(slot => (
                <option key={slot.id} value={slot.id}>
                  {slot.label} ({slot.startTime} الی {slot.endTime})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 3. Floor Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Layers size={13} className="text-indigo-600" />
            <span>فیلتر طبقه:</span>
          </label>
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
          >
            <option value="all">همه طبقات</option>
            {availableFloors.map(floor => (
              <option key={floor} value={floor}>{floor}</option>
            ))}
          </select>
        </div>

        {/* 4. Capacity Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Users size={13} className="text-indigo-600" />
            <span>فیلتر حداقل ظرفیت:</span>
          </label>
          <select
            value={minCapacity}
            onChange={(e) => setMinCapacity(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
          >
            <option value={0}>تمام ظرفیت‌ها</option>
            <option value={20}>حداقل ۲۰ نفر</option>
            <option value={25}>حداقل ۲۵ نفر</option>
            <option value={30}>حداقل ۳۰ نفر</option>
            <option value={35}>حداقل ۳۵ نفر</option>
            <option value={40}>حداقل ۴۰ نفر</option>
            <option value={50}>حداقل ۵۰ نفر</option>
          </select>
        </div>
      </div>

      {/* Results Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-black border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>
              {freeRooms.length} مَدرَس خالی و آزاد یافت شد
            </span>
          </span>
          <span className="text-xs text-slate-500 font-medium">
            (در {selectedDay === 'daily' ? 'تمام روزهای هفته' : `روز ${selectedDay}`}، ساعت {timeRange.display})
          </span>
        </div>

        {occupiedRooms.length > 0 && (
          <button
            onClick={() => setShowOccupiedToggle(!showOccupiedToggle)}
            className="text-xs text-slate-500 hover:text-slate-800 underline self-start sm:self-auto cursor-pointer"
          >
            {showOccupiedToggle ? 'مخفی‌سازی مَدرَس‌های مشغول' : `مشاهده ${occupiedRooms.length} مَدرَس مشغول`}
          </button>
        )}
      </div>

      {/* Free Rooms List (Compact, no facilities, clean info) */}
      {freeRooms.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
          <DoorOpen size={32} className="mx-auto opacity-40 text-slate-400" />
          <p className="text-xs font-bold text-slate-600">
            هیچ مدرس خالی‌ای مطابق با شرایط و فیلترهای انتخابی شما در این بازه زمانی یافت نشد.
          </p>
          <p className="text-[11px] text-slate-400">
            می‌توانید فیلتر طبقه یا حداقل ظرفیت را تغییر داده یا ساعت دیگری را انتخاب فرمایید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {freeRooms.map(({ room }) => (
            <div
              key={room.id}
              className="bg-white rounded-2xl p-3.5 border border-emerald-200/90 shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all space-y-3 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-black text-slate-900 text-sm">{room.name}</h4>
                  {room.code && (
                    <span className="text-[10px] font-mono text-slate-400 font-bold block">
                      کد: {room.code}
                    </span>
                  )}
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                  آماده استفاده
                </span>
              </div>

              {/* Only Floor and Capacity */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2 text-xs text-slate-600 border border-slate-100">
                <div className="truncate">
                  <span className="text-[11px] text-slate-400 block">طبقه:</span>
                  <b className="font-bold text-slate-800 text-[11px] truncate">{room.floor || 'همکف'}</b>
                </div>
                <div className="truncate">
                  <span className="text-[11px] text-slate-400 block">ظرفیت:</span>
                  <b className="font-bold text-slate-800 text-[11px] truncate">{room.capacity ? `${room.capacity} نفر` : '—'}</b>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                <button
                  onClick={() => onSelectRoom(room)}
                  className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold transition-colors text-center cursor-pointer"
                >
                  برنامه هفتگی
                </button>

                {!isReadOnly && onQuickAssign && (
                  <button
                    onClick={() => {
                      const dayToUse = selectedDay === 'daily' ? 'شنبه' : selectedDay;
                      onQuickAssign(room.name, dayToUse, timeRange.display);
                    }}
                    className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="تخصیص کلاس به این مدرس در این ساعت"
                  >
                    <Plus size={12} />
                    <span>تخصیص</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Occupied Rooms (if toggled) */}
      {showOccupiedToggle && occupiedRooms.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h4 className="text-xs font-black text-rose-800 flex items-center gap-1">
            <DoorOpen size={13} className="text-rose-600" />
            <span>مَدرَس‌های مشغول در این بازه ({occupiedRooms.length} کلاس):</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {occupiedRooms.map(({ room, conflictingPrograms }) => (
              <div
                key={room.id}
                className="bg-slate-50/80 rounded-2xl p-3 border border-rose-200/80 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <span className="font-black text-slate-800 text-xs">{room.name}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold">
                    مشغول
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  {room.floor || 'همکف'} • ظرفیت: {room.capacity || '—'} نفر
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200/70 space-y-1">
                  {conflictingPrograms.map(p => (
                    <div key={p.id} className="text-[11px] flex items-center justify-between">
                      <span className="font-bold text-slate-800 truncate">{p.title}</span>
                      <span className="text-slate-500 font-mono">{p.teacher || '—'}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onSelectRoom(room)}
                  className="w-full py-1 text-center text-[11px] text-indigo-600 font-bold hover:underline"
                >
                  مشاهده جدول کامل هفتگی مدرس ←
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
