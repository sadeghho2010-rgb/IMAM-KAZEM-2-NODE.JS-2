import React, { useState, useMemo } from 'react';
import { 
  DoorOpen, 
  X, 
  Printer, 
  FileSpreadsheet, 
  Clock, 
  Calendar, 
  GraduationCap, 
  User, 
  Plus, 
  Edit3,
  Layers,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { MadrasRoom, Program } from '../../types';
import { 
  MADRAS_TIME_SLOTS_7_TO_17, 
  MADRAS_HOURLY_SLOTS_7_TO_17, 
  WEEK_DAYS_SEMINARY, 
  isProgramInRoom, 
  isDayMatch, 
  isProgramInTimeRange, 
  timeToMinutes 
} from './madrasUtils';
import { cn } from '../../lib/utils';

interface MadrasWeeklyScheduleModalProps {
  room: MadrasRoom | null;
  programs: Program[];
  isReadOnly?: boolean;
  onClose: () => void;
  onAddClass?: (roomName: string, day: string, time: string) => void;
  onEditClass?: (prog: Program) => void;
}

interface TimetableRowSlot {
  id: string;
  hourNumber: number;
  startTime: string;
  endTime: string;
  label: string;
  displayTime: string;
}

export default function MadrasWeeklyScheduleModal({
  room,
  programs,
  isReadOnly,
  onClose,
  onAddClass,
  onEditClass,
}: MadrasWeeklyScheduleModalProps) {
  if (!room) return null;

  // Filter programs only belonging to this room and within 07:00 - 17:00
  const roomPrograms = programs.filter(p => isProgramInRoom(p, room));

  // Compute 1-hour slots
  const timetableSlots: TimetableRowSlot[] = useMemo(() => {
    return MADRAS_HOURLY_SLOTS_7_TO_17.map(h => ({
      id: h.id,
      hourNumber: h.hourNumber,
      startTime: h.startTime,
      endTime: h.endTime,
      label: h.label,
      displayTime: `${h.startTime} الی ${h.endTime}`,
    }));
  }, []);

  // Find program for a specific day and time range
  const getProgramForCell = (day: string, startTime: string, endTime: string): Program | undefined => {
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);
    if (startM === null || endM === null) return undefined;

    return roomPrograms.find(p => {
      if (!isDayMatch(p, day)) return false;
      return isProgramInTimeRange(p, startM, endM);
    });
  };

  // Export Weekly Schedule to Excel
  const handleExportExcel = () => {
    const rows: any[] = [];
    rows.push([`برنامه هفتگی ${room.name} (ساعت ۰۷:۰۰ الی ۱۷:۰۰)`]);
    rows.push([`طبقه: ${room.floor || 'همکف'}`, `ظرفیت: ${room.capacity || '—'} نفر`]);
    rows.push([]);

    const header = ['ساعت درسی', ...WEEK_DAYS_SEMINARY];
    rows.push(header);

    timetableSlots.forEach(slot => {
      const rowData = [
        `${slot.label} (${slot.startTime} الی ${slot.endTime})`,
      ];

      WEEK_DAYS_SEMINARY.forEach(day => {
        const prog = getProgramForCell(day, slot.startTime, slot.endTime);
        if (prog) {
          rowData.push(`${prog.title} (${prog.teacher || 'بدون استاد'} - ${prog.grade || ''}${prog.time ? ` [${prog.time}]` : ''})`);
        } else {
          rowData.push('خالی');
        }
      });
      rows.push(rowData);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'برنامه هفتگی');
    XLSX.writeFile(workbook, `برنامه_هفتگی_${room.name.replace(/\s+/g, '_')}.xlsx`);
  };

  // Quick print handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
        onClick={onClose}
        id="madras-weekly-modal-backdrop"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
          id="madras-weekly-modal-content"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                  <DoorOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    برنامه هفتگی {room.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Layers size={13} className="text-slate-400" />
                      <span>{room.floor || 'طبقه همکف'}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users size={13} className="text-slate-400" />
                      <span>ظرفیت: <b>{room.capacity || '—'} نفر</b></span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      <Clock size={12} />
                      <span>ساعت‌های درسی یک‌ساعته (۰۷:۰۰ الی ۱۷:۰۰)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              {!isReadOnly && onAddClass && (
                <button
                  onClick={() => onAddClass(room.name, 'شنبه', '۰۷:۰۰ الی ۰۸:۰۰')}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="تعریف کلاس جدید برای این مَدرَس (امکان ورود ساعت دلخواه)"
                >
                  <Plus size={14} />
                  <span>ثبت کلاس جدید</span>
                </button>
              )}

              <button
                onClick={handleExportExcel}
                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                title="خروجی اکسل برنامه هفتگی این مدرس"
              >
                <FileSpreadsheet size={16} />
              </button>

              <button
                onClick={handlePrint}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                title="چاپ برنامه هفتگی"
              >
                <Printer size={16} />
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="بستن"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Timetable Body */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs min-w-[650px]">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs font-black border-b border-slate-200">
                    <th className="p-3 w-36 text-center border-l border-slate-200 bg-slate-100/90 sticky right-0 z-10">
                      ساعت درسی
                    </th>
                    {WEEK_DAYS_SEMINARY.map(day => (
                      <th key={day} className="p-3 text-center border-l last:border-l-0 border-slate-200">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {timetableSlots.map((slot, index) => {
                    const displayLabel = slot.label;
                    const slotTimeStr = slot.displayTime;
                    
                    return (
                      <tr 
                        key={slot.id}
                        className={cn(
                          "transition-colors",
                          index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                        )}
                      >
                        {/* Time Column */}
                        <td className="p-2.5 text-center font-bold border-l border-slate-200 bg-slate-50/80 sticky right-0 z-10">
                          <div className="font-black text-slate-900 text-xs">
                            {displayLabel}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {slot.startTime} الی {slot.endTime}
                          </div>
                        </td>

                        {/* Days Columns */}
                        {WEEK_DAYS_SEMINARY.map(day => {
                          const prog = getProgramForCell(day, slot.startTime, slot.endTime);

                          return (
                            <td 
                              key={day} 
                              className="p-1.5 border-l last:border-l-0 border-slate-200 align-middle text-center h-16"
                            >
                              {prog ? (
                                <div 
                                  onClick={() => !isReadOnly && onEditClass && onEditClass(prog)}
                                  className={cn(
                                    "p-2 rounded-xl text-right transition-all group relative",
                                    !isReadOnly && onEditClass ? "cursor-pointer hover:shadow-md" : "",
                                    "bg-indigo-600 text-white shadow-2xs"
                                  )}
                                  title={prog.notes || `${prog.title} - ${prog.teacher}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-black text-[11px] truncate">{prog.title}</span>
                                    {prog.grade && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black">
                                        {prog.grade}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between mt-1 text-[10px] text-indigo-100">
                                    <span className="truncate flex items-center gap-0.5">
                                      <User size={10} className="shrink-0" />
                                      <span>{prog.teacher || 'بدون استاد'}</span>
                                    </span>
                                    <span className="font-mono text-[9px] text-indigo-200 font-bold bg-indigo-700/60 px-1 rounded">
                                      {prog.time || ''}
                                    </span>
                                  </div>

                                  {!isReadOnly && onEditClass && (
                                    <span className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 p-0.5 rounded">
                                      <Edit3 size={10} />
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div 
                                  onClick={() => {
                                    if (!isReadOnly && onAddClass) {
                                      onAddClass(room.name, day, slotTimeStr);
                                    }
                                  }}
                                  className={cn(
                                    "w-full h-full min-h-[44px] rounded-xl flex items-center justify-center transition-all",
                                    !isReadOnly && onAddClass 
                                      ? "cursor-pointer hover:bg-emerald-50 hover:border hover:border-emerald-300 group" 
                                      : ""
                                  )}
                                  title={!isReadOnly ? 'مدرس در این ساعت خالی است. کلیک برای ثبت کلاس' : 'مدرس خالی است'}
                                >
                                  <span className="text-slate-300 text-xs font-bold group-hover:hidden">—</span>
                                  {!isReadOnly && onAddClass && (
                                    <span className="hidden group-hover:inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-700">
                                      <Plus size={12} />
                                      <span>تخصیص</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Note */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                <span>برنامه فقط در بازه استاندارد ساعت <b>۰۷:۰۰ الی ۱۷:۰۰</b> (ساعت‌های ۱ تا ۱۰) نمایش داده می‌شود.</span>
              </span>
              <span>
                تعداد کل کلاس‌های این مَدرَس: <b className="text-slate-700 font-bold">{roomPrograms.length} کلاس</b>
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
