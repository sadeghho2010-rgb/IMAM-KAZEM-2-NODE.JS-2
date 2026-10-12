import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  BookOpen, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Sparkles, 
  UserCheck, 
  DoorOpen,
  MessageSquare
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { DiscussionGroup, Student, Program } from '../../../types';

interface StudentMobileDiscussionProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentMobileDiscussion: React.FC<StudentMobileDiscussionProps> = ({
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [groups, setGroups] = useState<DiscussionGroup[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allGroups, allSts, allProgs] = await Promise.all([
        localDb.getDocs<DiscussionGroup>('discussion_groups'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Program>('programs')
      ]);

      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uName = (currentUser?.username || '').trim().toLowerCase();
      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();

      const matched = allSts.find(s => 
        (sId && String(s.id) === String(sId)) ||
        (uName && (s.nationalId?.toLowerCase() === uName || s.studentCode?.toLowerCase() === uName)) ||
        (cName && s.name?.toLowerCase().includes(cName))
      );
      if (matched) {
        setStudentObj(matched);
      }

      setGroups(allGroups);
      setAllStudents(allSts);
      setPrograms(allProgs);
    } catch (e) {
      console.warn('Error loading discussion data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const studentGrade = studentObj?.grade || currentUser?.gradeLabel || 'پایه ۷';
  const sId = studentObj?.id || currentUser?.studentId || currentUser?.id;
  const sName = (studentObj?.name || currentUser?.name || '').trim().toLowerCase();

  // Find discussion groups this student belongs to
  const myGroups = useMemo(() => {
    return groups.filter(g => {
      const inIds = Array.isArray(g.memberStudentIds) && g.memberStudentIds.includes(String(sId));
      return inIds;
    });
  }, [groups, sId]);

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-xs" dir="rtl">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-700">در حال بارگذاری گروه‌های مباحثه...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right pb-10" dir="rtl">
      {/* 1. Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-500/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-purple-300 backdrop-blur-md flex items-center justify-center font-bold shadow-xs border border-white/20">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">گروه‌های مباحثه من</h2>
              <p className="text-[10px] text-indigo-200/80 font-medium">
                {studentObj?.name || currentUser?.name || 'طلبه گرامی'} • {studentGrade}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-400/30">
            {myGroups.length} گروه فعال
          </span>
        </div>
      </div>

      {/* 2. Groups Cards List */}
      {myGroups.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 text-center shadow-2xs space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <Users size={20} />
          </div>
          <h3 className="text-xs font-black text-slate-800">گروه مباحثه ثبت‌شده‌ای یافت نشد</h3>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
            گروه‌بندی مباحثات توسط مسئول آموزش و استاد پایه تعیین می‌گردد. در صورت نیاز می‌توانید با استاد پایه خود هماهنگ فرمایید.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {myGroups.map(g => {
            const partnerIds = (g.memberStudentIds || []).filter(id => id !== String(sId));
            const partners = allStudents.filter(s => partnerIds.includes(String(s.id)));

            return (
              <div 
                key={g.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-3"
              >
                {/* Group Title and Course */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-slate-900 truncate">
                      {g.title || 'گروه مباحثه'}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-purple-700 font-bold mt-0.5">
                      <BookOpen size={11} />
                      <span>{g.subject || g.programTitle || 'درس تخصصی دوره'}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9.5px] font-black shrink-0">
                    فعال
                  </span>
                </div>

                {/* Meeting time & Madras room */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">زمان: بعد از کلاس‌های درس</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 text-slate-700 font-medium">
                    <DoorOpen size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">مکان: {g.room || 'مَدرَس عمومی'}</span>
                  </div>
                </div>

                {/* Discussion Partners */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-black text-slate-800 block">
                    اعضا و هم‌بحثی‌ها ({partners.length + 1} نفر):
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {/* Current user */}
                    <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-200/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center">
                          ط
                        </div>
                        <span className="font-black text-indigo-950">
                          {studentObj?.name || currentUser?.name} (شما)
                        </span>
                      </div>
                      <span className="text-[9px] text-indigo-700 font-bold bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                        عضو گروه
                      </span>
                    </div>

                    {/* Partners */}
                    {partners.map(p => (
                      <div 
                        key={p.id}
                        className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-[10px] flex items-center justify-center">
                            {(p.name || 'ط')[0]}
                          </div>
                          <span className="font-bold text-slate-800">
                            {p.name}
                          </span>
                        </div>
                        <span className="text-[9.5px] font-mono text-slate-500 font-bold">
                          {p.phone || p.grade || 'هم‌کلاسی'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
