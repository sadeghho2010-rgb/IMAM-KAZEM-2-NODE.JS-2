import React from 'react';
import { DoorOpen, Users, Layers, Calendar, Edit3, Trash2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { MadrasRoom, Program } from '../../types';
import { getRoomCurrentStatus } from './madrasUtils';
import { cn } from '../../lib/utils';

interface MadrasRoomCardProps {
  room: MadrasRoom;
  programs: Program[];
  isReadOnly?: boolean;
  onSelect: (room: MadrasRoom) => void;
  onEdit?: (room: MadrasRoom) => void;
  onDelete?: (roomId: string) => void;
}

export default function MadrasRoomCard({
  room,
  programs,
  isReadOnly,
  onSelect,
  onEdit,
  onDelete,
}: MadrasRoomCardProps) {
  const { isOccupied, activeProgram } = getRoomCurrentStatus(room, programs);

  return (
    <motion.div
      layout
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(room)}
      className={cn(
        "group relative bg-white rounded-2xl p-4 border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md",
        isOccupied 
          ? "border-rose-200/90 hover:border-rose-400" 
          : "border-slate-200/90 hover:border-indigo-400"
      )}
      id={`madras-card-${room.id}`}
    >
      {/* Top Row: Room Number/Name & Status Dot */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
            isOccupied 
              ? "bg-rose-50 text-rose-600 border border-rose-200 group-hover:bg-rose-600 group-hover:text-white"
              : "bg-indigo-50 text-indigo-700 border border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white"
          )}>
            <DoorOpen size={18} />
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-slate-900 text-sm truncate leading-tight group-hover:text-indigo-600 transition-colors">
              {room.name}
            </h4>
            {room.code && (
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                کد: {room.code}
              </span>
            )}
          </div>
        </div>

        {/* Real-time Status Badge */}
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
            isOccupied
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOccupied ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
            )} />
            <span>{isOccupied ? 'مشغول' : 'آزاد'}</span>
          </span>

          {/* Admin Edit/Delete */}
          {!isReadOnly && (
            <div 
              className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(room);
                  }}
                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                  title="ویرایش مشخصات مَدرَس"
                >
                  <Edit3 size={13} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(room.id);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  title="حذف مَدرَس"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Row: Only Floor & Capacity (No Facilities as requested) */}
      <div className="grid grid-cols-2 gap-2 bg-slate-50/80 rounded-xl p-2.5 text-xs text-slate-600 border border-slate-100">
        <div className="flex items-center gap-1.5 truncate">
          <Layers size={13} className="text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-500">طبقه:</span>
          <b className="text-[11px] text-slate-800 font-bold truncate">{room.floor || 'همکف'}</b>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Users size={13} className="text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-500">ظرفیت:</span>
          <b className="text-[11px] text-slate-800 font-bold truncate">{room.capacity ? `${room.capacity} نفر` : '—'}</b>
        </div>
      </div>

      {/* Footer: Click Hint for 7:00 to 17:00 Weekly Schedule */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-600 font-bold transition-colors">
          <Calendar size={12} />
          <span>برنامه هفتگی (۷ تا ۱۷)</span>
        </div>
        <div className="text-slate-300 group-hover:text-indigo-600 group-hover:-translate-x-0.5 transition-all">
          <ArrowLeft size={13} />
        </div>
      </div>
    </motion.div>
  );
}
