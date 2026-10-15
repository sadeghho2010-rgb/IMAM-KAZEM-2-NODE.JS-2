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
  MessageSquare,
  Plus,
  Send,
  X,
  Search,
  Filter,
  Layers,
  GraduationCap
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { DiscussionGroup, Student, Program, WorkflowItem } from '../../../types';

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
  const [pendingRequests, setPendingRequests] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Proposal Modal State
  const [showModal, setShowModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formProgramIds, setFormProgramIds] = useState<string[]>([]);
  const [formSubjects, setFormSubjects] = useState<string[]>(['فقه', 'اصول']);
  const [formMemberStudentIds, setFormMemberStudentIds] = useState<string[]>([]);
  const [formRoom, setFormRoom] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [memberScopeTab, setMemberScopeTab] = useState<'grade' | 'school'>('grade');
  const [studentSearch, setStudentSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allGroups, allSts, allProgs, allWf] = await Promise.all([
        localDb.getDocs<DiscussionGroup>('discussion_groups'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<WorkflowItem>('workflow_items')
      ]);

      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uName = (currentUser?.username || '').trim().toLowerCase();
      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();

      const matched = (allSts || []).find(s => 
        (sId && String(s.id) === String(sId)) ||
        (uName && (s.nationalId?.toLowerCase() === uName || s.studentCode?.toLowerCase() === uName)) ||
        (cName && s.name?.toLowerCase().includes(cName))
      );
      if (matched) {
        setStudentObj(matched);
      }

      setGroups(allGroups || []);
      setAllStudents((allSts || []).filter(s => s.status !== 'deleted'));
      setPrograms(allProgs || []);

      const myId = matched?.id || sId || currentUser?.id;
      const myPending = (allWf || []).filter(w => 
        w.category === 'discussion_group_change' && 
        (w.studentId === myId || w.details?.requestedByStudentId === myId) &&
        w.status === 'pending'
      );
      setPendingRequests(myPending);
    } catch (e) {
      console.warn('Error loading discussion data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const studentGrade = studentObj?.grade || currentUser?.gradeLabel || 'پایه ۷';
  const sId = studentObj?.id || currentUser?.studentId || currentUser?.id;

  // Find discussion groups this student belongs to
  const myGroups = useMemo(() => {
    return groups.filter(g => {
      const inIds = Array.isArray(g.memberStudentIds) && g.memberStudentIds.map(String).includes(String(sId));
      return inIds;
    });
  }, [groups, sId]);

  // Main classes available for student to pick
  const availablePrograms = useMemo(() => {
    return programs.filter(p => {
      if (p.type && p.type !== 'اصلی') return false;
      return true;
    });
  }, [programs]);

  // Students in same grade vs all school students
  const sameGradeStudents = useMemo(() => {
    return allStudents.filter(s => s.id !== sId && s.grade === studentGrade);
  }, [allStudents, sId, studentGrade]);

  const allSchoolOtherStudents = useMemo(() => {
    return allStudents.filter(s => s.id !== sId && s.grade !== studentGrade);
  }, [allStudents, sId, studentGrade]);

  const displayedPeers = useMemo(() => {
    const list = memberScopeTab === 'grade' ? sameGradeStudents : allSchoolOtherStudents;
    if (!studentSearch.trim()) return list;
    const q = studentSearch.trim().toLowerCase();
    return list.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.studentCode && s.studentCode.includes(q)) || 
      (s.nationalId && s.nationalId.includes(q))
    );
  }, [memberScopeTab, sameGradeStudents, allSchoolOtherStudents, studentSearch]);

  const handleOpenModal = () => {
    setFormTitle(`گروه مباحثه ${studentObj?.name || currentUser?.name || ''}`);
    // Auto-select logged-in student's ID
    if (sId) {
      setFormMemberStudentIds([String(sId)]);
    } else {
      setFormMemberStudentIds([]);
    }
    // Pre-select main courses in student's grade if available
    const gradeMainProgs = availablePrograms.filter(p => p.grade === studentGrade);
    if (gradeMainProgs.length > 0) {
      setFormProgramIds(gradeMainProgs.map(p => p.id));
    } else {
      setFormProgramIds([]);
    }
    setFormSubjects(['فقه', 'اصول']);
    setFormRoom('');
    setFormDescription('');
    setStudentSearch('');
    setMemberScopeTab('grade');
    setShowModal(true);
  };

  const handleToggleProgram = (progId: string) => {
    setFormProgramIds(prev => 
      prev.includes(progId) ? prev.filter(id => id !== progId) : [...prev, progId]
    );
  };

  const handleToggleSubject = (subj: string) => {
    setFormSubjects(prev => 
      prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]
    );
  };

  const handleToggleMember = (targetStudentId: string) => {
    setFormMemberStudentIds(prev => 
      prev.includes(targetStudentId) 
        ? prev.filter(id => id !== targetStudentId) 
        : [...prev, targetStudentId]
    );
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('لطفاً عنوان گروه مباحثه را وارد فرمایید.');
      return;
    }
    if (formProgramIds.length === 0 && formSubjects.length === 0) {
      alert('لطفاً حداقل یک درس یا موضوع مباحثه را انتخاب فرمایید.');
      return;
    }
    if (formMemberStudentIds.length <= 1) {
      alert('لطفاً حداقل یک نفر از طلاب را به عنوان هم‌مباحثه‌ای انتخاب فرمایید.');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const myStudentId = String(sId || studentObj?.id);
      const myStudentName = studentObj?.name || currentUser?.name || currentUser?.fullName || 'طلبه گرامی';

      const selectedPrograms = programs.filter(p => formProgramIds.includes(p.id));
      const programTitles = selectedPrograms.map(p => p.title);
      const effectiveTitle = programTitles.length > 0 ? programTitles.join(' و ') : formSubjects.join(' و ');

      const memberNames = allStudents
        .filter(s => formMemberStudentIds.includes(String(s.id)))
        .map(s => s.name);

      const workflowItem: WorkflowItem = {
        id: `disc_req_${Date.now()}_${myStudentId}`,
        type: 'approval',
        category: 'discussion_group_change',
        title: `درخواست معرفی گروه مباحثه: ${myStudentName} (${effectiveTitle})`,
        description: `طلبه گرامی ${myStudentName} (${studentGrade}) گروه مباحثه «${formTitle.trim()}» را برای دروس (${effectiveTitle}) با اعضای (${memberNames.join('، ')}) معرفی نموده است.`,
        status: 'pending',
        grade: studentGrade,
        studentId: myStudentId,
        studentName: myStudentName,
        nationalId: studentObj?.nationalId || currentUser?.username,
        requiresEducationApproval: true,
        details: {
          programIds: formProgramIds,
          programTitles,
          programTitle: effectiveTitle,
          subject: effectiveTitle,
          subjects: formSubjects,
          grade: studentGrade,
          room: formRoom.trim(),
          memberStudentIds: formMemberStudentIds,
          memberStudentNames: memberNames,
          description: formDescription.trim(),
          requestedByStudentId: myStudentId,
          requestedByStudentName: myStudentName
        },
        createdAt: now
      };

      await localDb.addDoc('workflow_items', workflowItem);

      setPendingRequests(prev => [workflowItem, ...prev]);
      setShowModal(false);
      setSuccessToast('درخواست معرفی گروه مباحثه شما با موفقیت به جریان کار ارسال گردید و پس از تایید مسئول اعمال می‌شود.');
      setTimeout(() => setSuccessToast(''), 5000);

      window.dispatchEvent(new CustomEvent('workflow_items_updated'));
      window.dispatchEvent(new CustomEvent('app_data_change'));
    } catch (err: any) {
      console.error('Error submitting discussion proposal:', err);
      alert('خطا در ثبت درخواست: ' + (err?.message || 'لطفاً مجدداً تلاش فرمایید'));
    } finally {
      setIsSubmitting(false);
    }
  };

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

          <button
            type="button"
            onClick={handleOpenModal}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-md transition-all active:scale-95"
          >
            <Plus size={14} />
            <span>معرفی گروه بحثی</span>
          </button>
        </div>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <Clock size={14} className="text-amber-600" />
            <span>شما {pendingRequests.length} درخواست در انتظار تایید مسئول دارید:</span>
          </div>
          {pendingRequests.map(r => (
            <p key={r.id} className="text-[11px] text-amber-700 font-mono">
              • {r.title}
            </p>
          ))}
        </div>
      )}

      {/* 2. Groups Cards List */}
      {myGroups.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <Users size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black text-slate-800">هنوز گروه مباحثه‌ای برای شما ثبت نشده است</h3>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
              می‌توانید با لمس دکمه «معرفی گروه بحثی»، هم‌مباحثه‌ای‌های خود را در دروس مختلف تعیین کرده و جهت تایید برای مسئول ارسال فرمایید.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>معرفی و ثبت گروه بحثی جدید</span>
          </button>
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
                    تایید شده
                  </span>
                </div>

                {/* Partners List */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold block">اعضای گروه مباحثه:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {/* Self */}
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10.5px] font-bold">
                      {studentObj?.name || currentUser?.name || 'شما'} (من)
                    </span>
                    {partners.map(p => (
                      <span key={p.id} className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-[10.5px] font-medium">
                        {p.name}
                      </span>
                    ))}
                    {(g.externalMembers || []).map((ext, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10.5px] font-medium">
                        {ext} (خارج از مدرسه)
                      </span>
                    ))}
                  </div>
                </div>

                {/* Meeting time & Madras room */}
                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-100">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">زمان: بعد از کلاس‌های درس</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 text-slate-700 font-medium">
                    <DoorOpen size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">مکان: {g.room || 'مَدرَس عمومی'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. PROPOSAL MODAL FOR MOBILE (امکان معرفی گروه بحثی با انتخاب چند درس، مشاهده هم‌پایه‌ای‌ها و کل طلاب) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-vazir text-right animate-in slide-in-from-bottom duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <Users size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    معرفی و ثبت گروه بحثی جدید
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    ارسال جهت تایید به مسئول پایه و آموزش
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitProposal} className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Group Title */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">عنوان گروه مباحثه *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: گروه مباحثه فقه و اصول"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Requirement 1: Multi-Course Selection (انتخاب چند کلاس/درس همزمان: فقه و اصول) */}
              <div className="space-y-1.5 p-3 bg-purple-50/60 rounded-2xl border border-purple-100">
                <label className="font-bold text-purple-950 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <BookOpen size={13} className="text-purple-600" />
                    <span>انتخاب کلاس‌ها و دروس مباحثه (چند انتخابی) *</span>
                  </span>
                  <span className="text-[10px] text-purple-700 font-normal">
                    {formProgramIds.length} کلاس انتخاب‌شده
                  </span>
                </label>
                <p className="text-[10px] text-slate-500">
                  اگر هم‌بحث‌های شما در چند درس (مثلاً فقه و اصول) یکسان هستند، همه آن دروس را علامت بزنید:
                </p>

                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 pt-1">
                  {availablePrograms.map(prog => {
                    const isSelected = formProgramIds.includes(prog.id);
                    return (
                      <button
                        key={prog.id}
                        type="button"
                        onClick={() => handleToggleProgram(prog.id)}
                        className={cn(
                          "w-full text-right p-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between cursor-pointer",
                          isSelected
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <span className="truncate">{prog.title} {prog.teacher ? `(استاد ${prog.teacher})` : ''}</span>
                        {isSelected && <CheckCircle2 size={14} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject Tag Selection */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">موضوعات پوشش‌داده‌شده:</label>
                <div className="flex flex-wrap gap-1.5">
                  {['فقه', 'اصول', 'فلسفه', 'ادبیات', 'سایر'].map(sub => {
                    const isChecked = formSubjects.includes(sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => handleToggleSubject(sub)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                          isChecked
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-600 border-slate-200"
                        )}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Requirement 2: Selection of Members with Tabs: Same-grade vs All School */}
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <UserCheck size={14} className="text-indigo-600" />
                    <span>انتخاب اعضا و هم‌بحثی‌ها *</span>
                  </label>
                  <span className="text-[10px] text-indigo-700 font-bold">
                    {formMemberStudentIds.length} نفر انتخاب‌شده
                  </span>
                </div>

                {/* Scope Switch: هم‌پایه‌ای‌ها vs کل طلاب مدرسه */}
                <div className="grid grid-cols-2 gap-1.5 bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMemberScopeTab('grade')}
                    className={cn(
                      "py-1.5 rounded-lg transition-all cursor-pointer text-center",
                      memberScopeTab === 'grade'
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    طلاب هم‌پایه ({studentGrade})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberScopeTab('school')}
                    className={cn(
                      "py-1.5 rounded-lg transition-all cursor-pointer text-center",
                      memberScopeTab === 'school'
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    سایر پایه‌های مدرسه
                  </button>
                </div>

                {/* Instant Search in Students */}
                <div className="relative">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="جستجوی نام یا کد طلبه..."
                    className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
                </div>

                {/* Selected Members Chips */}
                {formMemberStudentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {formMemberStudentIds.map(memId => {
                      const st = allStudents.find(s => String(s.id) === String(memId));
                      const isMe = String(memId) === String(sId);
                      return (
                        <span
                          key={memId}
                          className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10.5px] font-bold flex items-center gap-1"
                        >
                          <span>{st?.name || (isMe ? 'شما' : 'طلبه')}</span>
                          {!isMe && (
                            <button
                              type="button"
                              onClick={() => handleToggleMember(memId)}
                              className="text-rose-600 hover:text-rose-800"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Students Checklist */}
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1 pt-1">
                  {displayedPeers.map(st => {
                    const isSelected = formMemberStudentIds.includes(String(st.id));
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleToggleMember(String(st.id))}
                        className={cn(
                          "w-full text-right p-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between cursor-pointer",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span>{st.name}</span>
                          <span className="text-[10px] opacity-75 font-normal">({st.grade || 'طلبه'})</span>
                        </div>
                        {isSelected && <CheckCircle2 size={14} className="shrink-0" />}
                      </button>
                    );
                  })}
                  {displayedPeers.length === 0 && (
                    <div className="p-3 text-center text-slate-400 text-xs italic">
                      طلبه‌ای با این مشخصات یافت نشد.
                    </div>
                  )}
                </div>
              </div>

              {/* Madras Room & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">مَدرَس / محل مباحثه:</label>
                  <input
                    type="text"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    placeholder="مثال: مَدرَس ۲، حیاط، کتابخانه..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">توضیحات تکمیلی:</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="یادداشت برای مسئول آموزش..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-black text-xs shadow-md shadow-purple-600/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Send size={14} />
                  <span>{isSubmitting ? 'در حال ارسال...' : 'ارسال درخواست معرفی گروه'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
