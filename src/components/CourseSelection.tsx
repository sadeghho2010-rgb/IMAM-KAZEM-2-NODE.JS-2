import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { 
  CourseSelectionPeriod, 
  CourseSelectionRequest, 
  StudentCourseSelectionChoice, 
  Program, 
  Student, 
  Enrollment,
  ProgramType
} from '../types';
import { 
  BookOpen, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Search, 
  Check, 
  X, 
  User, 
  Layers, 
  FileText, 
  Edit, 
  DoorOpen,
  Send,
  RefreshCw,
  UserPlus,
  SlidersHorizontal,
  CheckSquare,
  MinusCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function CourseSelection() {
  const { currentUser, isSuperAdmin } = useAuth();
  const isEducationManager = currentUser?.role === 'education_manager' || currentUser?.role === 'education_officer' || currentUser?.username?.toUpperCase() === 'SHAH';

  const isGradeSupervisor = currentUser?.role === 'grade_supervisor' || 
                            currentUser?.role === 'grade_mentor' || 
                            currentUser?.roleTitle?.includes('استاد پایه') || 
                            currentUser?.roleTitle?.includes('مسئول پایه') || 
                            ['SADEGH', 'RAHNAMA', 'ISJ', 'HO', 'SOL', 'ASADI'].includes(currentUser?.username?.toUpperCase() || '');

  // Guard for grade supervisor
  if (isGradeSupervisor) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center bg-white rounded-3xl border border-rose-200 shadow-xl my-12">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">عدم دسترسی به سامانه انتخاب واحد</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-bold">
          سامانه انتخاب واحد منحصراً مربوط به مسئول محترم آموزش می‌باشد و اساتید محترم پایه به این بخش دسترسی ندارند.
        </p>
      </div>
    );
  }

  const [periods, setPeriods] = useState<CourseSelectionPeriod[]>([]);
  const [requests, setRequests] = useState<CourseSelectionRequest[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Mode for Admins
  const [activeTab, setActiveTab] = useState<'requests' | 'periods'>('requests');

  // Period Modal State
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'info' | 'students' | 'courses'>('info');
  const [editingPeriod, setEditingPeriod] = useState<CourseSelectionPeriod | null>(null);

  // Period Form State
  const [periodTitle, setPeriodTitle] = useState('انتخاب واحد نیم‌سال اول ۱۴۰۴-۱۴۰۳');
  const [periodAcademicYear, setPeriodAcademicYear] = useState('۱۴۰۳-۱۴۰۴');
  const [periodTerm, setTerm] = useState('نیم‌سال اول');
  const [periodAllowedTypes, setPeriodAllowedTypes] = useState<ProgramType[]>(['اصلی', 'مشاوره', 'دروس 5 شنبه', 'پژوهش']);
  const [periodAllowedGrades, setPeriodAllowedGrades] = useState<string[]>(['همه پایه‌ها']);
  const [periodCustomStudentIds, setPeriodCustomStudentIds] = useState<string[]>([]);
  const [periodCustomIncludedProgramIds, setPeriodCustomIncludedProgramIds] = useState<string[]>([]);
  const [periodCustomExcludedProgramIds, setPeriodCustomExcludedProgramIds] = useState<string[]>([]);
  const [periodAllowCrossGrade, setPeriodAllowCrossGrade] = useState<boolean>(true);
  const [periodStartDate, setPeriodStartDate] = useState(() => new Date().toLocaleDateString('fa-IR'));
  const [periodEndDate, setPeriodEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('fa-IR');
  });
  const [periodIsActive, setPeriodIsActive] = useState(true);
  const [periodDescription, setPeriodDescription] = useState('لطفاً در زمان مقرر نسبت به انتخاب دروس اقدام فرمایید.');

  // Modal Search Terms
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');

  // Student Selection State
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterPeriodId, setFilterPeriodId] = useState<string>('all');

  // Review / Rejection Modal State
  const [rejectModalRequest, setRejectModalRequest] = useState<CourseSelectionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const isAdminOrManager = isSuperAdmin || isEducationManager || currentUser?.level === 1 || currentUser?.role === 'research_manager';
  const isStudentView = currentUser?.level === 3 || (!isAdminOrManager && !!currentUser?.studentName);

  // Identify student record for student view
  const currentStudentObj = useMemo(() => {
    if (!currentUser) return null;
    return students.find(s => 
      (currentUser.linkedStudentId && s.id === currentUser.linkedStudentId) ||
      (currentUser.studentName && s.name.trim() === currentUser.studentName.trim()) ||
      (currentUser.name && s.name.trim() === currentUser.name.trim()) ||
      (s.nationalId && s.nationalId === currentUser.username)
    ) || null;
  }, [students, currentUser]);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [pDocs, rDocs, progDocs, sDocs, eDocs] = await Promise.all([
        localDb.getDocs<CourseSelectionPeriod>('course_selection_periods'),
        localDb.getDocs<CourseSelectionRequest>('course_selection_requests'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Enrollment>('enrollments')
      ]);

      setPeriods(pDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setRequests(rDocs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
      setPrograms(progDocs || []);
      setStudents(sDocs || []);
      setEnrollments(eDocs || []);
    } catch (err) {
      console.error('Error fetching course selection data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => fetchData());
    return () => unsub();
  }, []);

  // Active period for student or current view
  const activePeriod = useMemo(() => {
    return periods.find(p => p.isActive && !p.isArchived) || null;
  }, [periods]);

  // Check if current student is permitted to access active selection period
  const isStudentAllowedInActivePeriod = useMemo(() => {
    if (!activePeriod || !currentStudentObj) return false;

    // 1. Check if manually added by student ID
    if (activePeriod.customStudentIds && activePeriod.customStudentIds.includes(currentStudentObj.id)) {
      return true;
    }

    // 2. Check if student's grade is in allowedGrades or if allowedGrades contains 'همه پایه‌ها'
    if (activePeriod.allowedGrades && activePeriod.allowedGrades.length > 0) {
      if (activePeriod.allowedGrades.includes('همه پایه‌ها') || activePeriod.allowedGrades.includes('all')) {
        return true;
      }
      if (currentStudentObj.grade && activePeriod.allowedGrades.includes(currentStudentObj.grade)) {
        return true;
      }
    }

    return false;
  }, [activePeriod, currentStudentObj]);

  // Existing request for current student in active period
  const existingStudentRequest = useMemo(() => {
    if (!currentStudentObj || !activePeriod) return null;
    return requests.find(r => r.studentId === currentStudentObj.id && r.periodId === activePeriod.id) || null;
  }, [requests, currentStudentObj, activePeriod]);

  // Pre-fill student selected course checkboxes if request exists
  useEffect(() => {
    if (existingStudentRequest) {
      const courseIds = existingStudentRequest.selectedCourses.map(c => c.programId);
      setSelectedCourseIds(courseIds);
    }
  }, [existingStudentRequest]);

  // Available programs for current student considering all configuration parameters
  const availableProgramsForStudent = useMemo(() => {
    if (!activePeriod || !currentStudentObj) return [];
    
    return programs.filter(p => {
      // 1. Check custom excluded program IDs
      if (activePeriod.customExcludedProgramIds && activePeriod.customExcludedProgramIds.includes(p.id)) {
        return false;
      }

      // 2. Check custom included program IDs (force included)
      if (activePeriod.customIncludedProgramIds && activePeriod.customIncludedProgramIds.includes(p.id)) {
        return true;
      }

      // 3. Check program type / category
      if (activePeriod.allowedProgramTypes && activePeriod.allowedProgramTypes.length > 0) {
        if (!activePeriod.allowedProgramTypes.includes(p.type)) return false;
      }

      // 4. Check cross-grade selection vs grade matching
      const allowCrossGrade = activePeriod.allowCrossGradeSelection !== false; // Default true
      if (!allowCrossGrade) {
        // Only allow courses belonging to student's own grade or 'همه پایه‌ها'
        const matchesGrade = !p.grade || p.grade === currentStudentObj.grade || p.grade === 'همه پایه‌ها';
        if (!matchesGrade) return false;
      }

      return true;
    });
  }, [programs, activePeriod, currentStudentObj]);

  // Handle Save Period (Create/Edit)
  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Partial<CourseSelectionPeriod> = {
      title: periodTitle.trim(),
      academicYear: periodAcademicYear.trim(),
      term: periodTerm.trim(),
      allowedProgramTypes: periodAllowedTypes,
      allowedGrades: periodAllowedGrades,
      customStudentIds: periodCustomStudentIds,
      customIncludedProgramIds: periodCustomIncludedProgramIds,
      customExcludedProgramIds: periodCustomExcludedProgramIds,
      allowCrossGradeSelection: periodAllowCrossGrade,
      startDate: periodStartDate.trim(),
      endDate: periodEndDate.trim(),
      isActive: periodIsActive,
      description: periodDescription.trim(),
      createdByUserName: currentUser?.name || currentUser?.username || 'مسئول آموزش',
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingPeriod) {
        await localDb.updateDoc('course_selection_periods', editingPeriod.id, payload);
      } else {
        await localDb.addDoc('course_selection_periods', {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }
      setIsPeriodModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving period:', err);
      alert('خطا در ذخیره دوره انتخاب واحد.');
    }
  };

  // Open Period Modal
  const handleOpenPeriodModal = (p?: CourseSelectionPeriod) => {
    if (p) {
      setEditingPeriod(p);
      setPeriodTitle(p.title);
      setPeriodAcademicYear(p.academicYear || '۱۴۰۳-۱۴۰۴');
      setTerm(p.term || 'نیم‌سال اول');
      setPeriodAllowedTypes(p.allowedProgramTypes || ['اصلی', 'مشاوره', 'دروس 5 شنبه', 'پژوهش']);
      setPeriodAllowedGrades(p.allowedGrades || ['همه پایه‌ها']);
      setPeriodCustomStudentIds(p.customStudentIds || []);
      setPeriodCustomIncludedProgramIds(p.customIncludedProgramIds || []);
      setPeriodCustomExcludedProgramIds(p.customExcludedProgramIds || []);
      setPeriodAllowCrossGrade(p.allowCrossGradeSelection !== false);
      setPeriodStartDate(p.startDate || new Date().toLocaleDateString('fa-IR'));
      setPeriodEndDate(p.endDate || new Date().toLocaleDateString('fa-IR'));
      setPeriodIsActive(p.isActive);
      setPeriodDescription(p.description || '');
    } else {
      setEditingPeriod(null);
      setPeriodTitle('انتخاب واحد نیم‌سال اول ۱۴۰۴-۱۴۰۳');
      setPeriodAcademicYear('۱۴۰۳-۱۴۰۴');
      setTerm('نیم‌سال اول');
      setPeriodAllowedTypes(['اصلی', 'مشاوره', 'دروس 5 شنبه', 'پژوهش']);
      setPeriodAllowedGrades(['همه پایه‌ها']);
      setPeriodCustomStudentIds([]);
      setPeriodCustomIncludedProgramIds([]);
      setPeriodCustomExcludedProgramIds([]);
      setPeriodAllowCrossGrade(true);
      setPeriodStartDate(new Date().toLocaleDateString('fa-IR'));
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setPeriodEndDate(d.toLocaleDateString('fa-IR'));
      setPeriodIsActive(true);
      setPeriodDescription('لطفاً در زمان مقرر نسبت به انتخاب دروس اقدام فرمایید.');
    }
    setModalTab('info');
    setStudentSearchTerm('');
    setCourseSearchTerm('');
    setIsPeriodModalOpen(true);
  };

  // Student toggle course selection
  const handleToggleCourse = (progId: string) => {
    if (existingStudentRequest && existingStudentRequest.status === 'approved') return; // Cannot edit approved
    setSelectedCourseIds(prev => 
      prev.includes(progId) ? prev.filter(id => id !== progId) : [...prev, progId]
    );
  };

  // Student submit selection request
  const handleSubmitStudentSelection = async () => {
    if (!activePeriod || !currentStudentObj) return;
    if (selectedCourseIds.length === 0) {
      alert('لطفاً حداقل یک درس را انتخاب نمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedProgs = programs.filter(p => selectedCourseIds.includes(p.id));
      const choices: StudentCourseSelectionChoice[] = selectedProgs.map(p => ({
        programId: p.id,
        programTitle: p.title,
        programType: p.type,
        teacherName: p.teacher || 'نامشخص',
        day: p.day,
        time: p.time,
        madrasRoom: p.madrasRoom || p.classroom,
        grade: p.grade
      }));

      const payload: Partial<CourseSelectionRequest> = {
        periodId: activePeriod.id,
        periodTitle: activePeriod.title,
        studentId: currentStudentObj.id,
        studentName: currentStudentObj.name,
        studentGrade: currentStudentObj.grade || 'پایه نامشخص',
        nationalId: currentStudentObj.nationalId || '',
        selectedCourses: choices,
        status: 'pending',
        submittedAt: new Date().toISOString()
      };

      if (existingStudentRequest) {
        await localDb.updateDoc('course_selection_requests', existingStudentRequest.id, payload);
      } else {
        await localDb.addDoc('course_selection_requests', payload);
      }

      alert('درخواست انتخاب واحد شما با موفقیت ثبت شد و در انتظار بررسی مسئول آموزش قرار گرفت.');
      fetchData();
    } catch (err) {
      console.error('Error submitting selection:', err);
      alert('خطا در ثبت درخواست انتخاب واحد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Approve Request & Auto-Enroll Student
  const handleApproveRequest = async (req: CourseSelectionRequest) => {
    try {
      // 1. Update Request Status
      await localDb.updateDoc('course_selection_requests', req.id, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser?.name || currentUser?.username || 'مسئول آموزش'
      });

      // 2. Auto-Enroll student into all selected courses
      for (const course of req.selectedCourses) {
        const alreadyEnrolled = enrollments.some(
          e => e.studentId === req.studentId && e.programId === course.programId
        );
        if (!alreadyEnrolled) {
          const newEnrollment: Enrollment = {
            id: `e-${req.studentId}-${course.programId}-${Date.now()}`,
            studentId: req.studentId,
            programId: course.programId,
            enrollmentDate: new Date().toLocaleDateString('fa-IR'),
            status: 'active',
            notes: `ثبت‌نام خودکار از طریق انتخاب واحد (${req.periodTitle})`
          };
          await localDb.setDoc('enrollments', newEnrollment);
        }
      }

      // 3. Log Audit
      await localDb.addDoc('audit_logs', {
        action: 'تایید انتخاب واحد',
        details: `تایید انتخاب واحد طلبه ${req.studentName} در دوره ${req.periodTitle} (تعداد ${req.selectedCourses.length} درس)`,
        userId: currentUser?.id || 'sys',
        userName: currentUser?.name || currentUser?.username || 'آموزش',
        createdAt: new Date().toISOString()
      });

      fetchData();
    } catch (err) {
      console.error('Error approving request:', err);
      alert('خطا در تایید انتخاب واحد.');
    }
  };

  // Admin Reject Request
  const handleConfirmReject = async () => {
    if (!rejectModalRequest) return;
    try {
      await localDb.updateDoc('course_selection_requests', rejectModalRequest.id, {
        status: 'rejected',
        adminNotes: rejectionReason.trim() || 'درخواست انتخاب واحد توسط مسئول آموزش تایید نشد.',
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser?.name || currentUser?.username || 'مسئول آموزش'
      });

      setRejectModalRequest(null);
      setRejectionReason('');
      fetchData();
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('خطا در رد درخواست.');
    }
  };

  // Filter requests list
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterGrade !== 'all' && r.studentGrade !== filterGrade) return false;
      if (filterPeriodId !== 'all' && r.periodId !== filterPeriodId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.studentName.toLowerCase().includes(q) || (r.nationalId && r.nationalId.includes(q));
      }
      return true;
    });
  }, [requests, filterStatus, filterGrade, filterPeriodId, searchQuery]);

  // List of available grades
  const ALL_GRADES_LIST = ['همه پایه‌ها', 'پایه ۷', 'پایه ۸', 'پایه ۹', 'پایه ۱۰', 'پایه ۱۱', 'پایه ۱۲'];

  // List of available program types
  const ALL_PROGRAM_TYPES_LIST: ProgramType[] = ['اصلی', 'مشاوره', 'دروس 5 شنبه', 'پژوهش'];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 font-bold gap-2">
        <RefreshCw size={20} className="animate-spin text-indigo-600" />
        <span>در حال دریافت اطلاعات انتخاب واحد...</span>
      </div>
    );
  }

  // =========================================================================
  // STUDENT VIEW
  // =========================================================================
  if (isStudentView) {
    return (
      <div className="space-y-6 pb-12">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-sm border border-indigo-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-700/80 rounded-2xl border border-indigo-500 flex items-center justify-center text-white font-black text-lg">
                <BookOpen size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">سامانه انتخاب واحد آنلاین</h2>
                <p className="text-xs text-indigo-200 font-medium mt-0.5">
                  پورتال رسمی انتخاب دروس و واحدهای آموزشی طلاب
                </p>
              </div>
            </div>

            {currentStudentObj && (
              <div className="text-left bg-indigo-950/60 p-3 rounded-2xl border border-indigo-700/60 text-xs">
                <p className="font-black text-white">{currentStudentObj.name}</p>
                <p className="text-[10px] text-indigo-300 font-bold">پایه تحصیلی: {currentStudentObj.grade || 'نامشخص'}</p>
              </div>
            )}
          </div>
        </div>

        {!activePeriod ? (
          /* NO ACTIVE PERIOD ALERT */
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-800">دوره فعال انتخاب واحد وجود ندارد</h3>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                در حال حاضر بازه زمانی انتخاب واحد فعال نمی‌باشد. لطفاً در مهلت‌های اعلام‌شده توسط مسئول آموزش مراجعه فرمایید.
              </p>
            </div>
          </div>
        ) : !isStudentAllowedInActivePeriod ? (
          /* STUDENT NOT IN TARGET GRADES OR LIST */
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-800">عدم مجوز دسترسی به این دوره انتخاب واحد</h3>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                دوره فعال انتخاب واحد («{activePeriod.title}») ویژه پایه‌های {activePeriod.allowedGrades?.join('، ')} می‌باشد و برای پایه تحصیلی شما ({currentStudentObj?.grade || 'نامشخص'}) فعال نیست. در صورت نیاز با مسئول آموزش تماس بگیرید.
              </p>
            </div>
          </div>
        ) : (
          /* ACTIVE PERIOD SELECTION FORM */
          <div className="space-y-6">
            {/* Period Specs Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-black px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                    {activePeriod.academicYear || '۱۴۰۳-۱۴۰۴'} - {activePeriod.term || 'نیم‌سال اول'}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-2">{activePeriod.title}</h3>
                  {activePeriod.description && (
                    <p className="text-xs text-slate-500 font-medium mt-1">{activePeriod.description}</p>
                  )}
                  {activePeriod.allowCrossGradeSelection !== false && (
                    <p className="text-[11px] text-amber-800 font-bold bg-amber-50 border border-amber-200 p-2 rounded-xl mt-2 inline-block">
                      💡 ملاحظه: امکان انتخاب درس از سایر پایه‌ها نیز برای شما فعال می‌باشد.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
                  <Clock size={16} className="text-indigo-600" />
                  <span>مهلت ثبت‌نام: {activePeriod.startDate} تا {activePeriod.endDate}</span>
                </div>
              </div>

              {/* Status Badge of Existing Request */}
              {existingStudentRequest && (
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold",
                  existingStudentRequest.status === 'approved' ? "bg-emerald-50 text-emerald-900 border-emerald-200" :
                  existingStudentRequest.status === 'rejected' ? "bg-rose-50 text-rose-900 border-rose-200" :
                  "bg-amber-50 text-amber-900 border-amber-200"
                )}>
                  <div className="flex items-center gap-2">
                    {existingStudentRequest.status === 'approved' && <CheckCircle2 size={18} className="text-emerald-600" />}
                    {existingStudentRequest.status === 'rejected' && <XCircle size={18} className="text-rose-600" />}
                    {existingStudentRequest.status === 'pending' && <Clock size={18} className="text-amber-600" />}
                    <div>
                      <p className="font-black">
                        وضعیت درخواست شما: {
                          existingStudentRequest.status === 'approved' ? 'تایید شده (ثبت نهایی در کلاس‌ها)' :
                          existingStudentRequest.status === 'rejected' ? 'رد شده توسط آموزش' :
                          'در انتظار بررسی مسئول آموزش'
                        }
                      </p>
                      {existingStudentRequest.adminNotes && (
                        <p className="text-[11px] opacity-80 mt-0.5">توضیحات آموزش: {existingStudentRequest.adminNotes}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] opacity-75 font-mono">{existingStudentRequest.submittedAt}</span>
                </div>
              )}

              {/* Available Courses Checklist */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Layers size={18} className="text-indigo-600" />
                    <span>دروس ارائه‌شده قابل انتخاب ({availableProgramsForStudent.length} درس)</span>
                  </h4>
                  <span className="text-xs text-indigo-700 font-bold">
                    دروس انتخاب‌شده: {selectedCourseIds.length} درس
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableProgramsForStudent.map(prog => {
                    const isSelected = selectedCourseIds.includes(prog.id);
                    const isApproved = existingStudentRequest?.status === 'approved';

                    return (
                      <div
                        key={prog.id}
                        onClick={() => !isApproved && handleToggleCourse(prog.id)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer select-none",
                          isSelected 
                            ? "bg-indigo-50/80 border-indigo-400 shadow-2xs" 
                            : "bg-white hover:bg-slate-50 border-slate-200",
                          isApproved && "cursor-default"
                        )}
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-[9px] font-black px-2 py-0.5 rounded border",
                              prog.type === 'اصلی' ? "bg-indigo-100 text-indigo-800 border-indigo-200" :
                              prog.type === 'مشاوره' ? "bg-amber-100 text-amber-800 border-amber-200" :
                              prog.type === 'دروس 5 شنبه' ? "bg-purple-100 text-purple-800 border-purple-200" :
                              "bg-emerald-100 text-emerald-800 border-emerald-200"
                            )}>
                              {prog.type}
                            </span>

                            {prog.grade && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded border bg-amber-50 text-amber-900 border-amber-200">
                                مربوط به {prog.grade}
                              </span>
                            )}

                            <h5 className="font-black text-xs text-slate-900">{prog.title}</h5>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 font-bold">
                            <span className="flex items-center gap-1">
                              <User size={12} className="text-slate-400" />
                              <span>استاد: {prog.teacher || 'نامشخص'}</span>
                            </span>
                            {(prog.madrasRoom || prog.classroom) && (
                              <span className="flex items-center gap-1">
                                <DoorOpen size={12} className="text-slate-400" />
                                <span>مَدرَس: {prog.madrasRoom || prog.classroom}</span>
                              </span>
                            )}
                            {(prog.day || prog.time) && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} className="text-slate-400" />
                                <span>{prog.day || ''} {prog.time || ''}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Custom Checkbox Indicator */}
                        <div className={cn(
                          "w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                          isSelected 
                            ? "bg-indigo-600 border-indigo-600 text-white" 
                            : "bg-slate-100 border-slate-300 text-transparent"
                        )}>
                          <Check size={14} strokeWidth={3} />
                        </div>
                      </div>
                    );
                  })}

                  {availableProgramsForStudent.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-xs text-slate-400 italic">
                      هیچ درسی برای پایه و مشخصات شما در این دوره یافت نشد.
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                {(!existingStudentRequest || existingStudentRequest.status !== 'approved') && (
                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={handleSubmitStudentSelection}
                      disabled={isSubmitting || selectedCourseIds.length === 0}
                      className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      <Send size={16} />
                      <span>{existingStudentRequest ? 'ویرایش و بازارسال درخواست' : 'ثبت نهایی درخواست انتخاب واحد'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // ADMIN / EDUCATION MANAGER VIEW
  // =========================================================================
  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-sm border border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-700/80 rounded-2xl border border-indigo-500 flex items-center justify-center text-white font-black text-lg">
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">مدیریت و بررسی انتخاب واحد طلاب</h2>
            <p className="text-xs text-indigo-200 font-medium mt-0.5">
              تعریف دوره‌های انتخاب واحد، تخصیص طلاب مجاز، فیلتر دروس و ثبت خودکار در کلاس‌ها
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenPeriodModal()}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-2"
          >
            <Plus size={16} />
            <span>تعریف دوره جدید انتخاب واحد</span>
          </button>
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-2",
            activeTab === 'requests' 
              ? "bg-indigo-600 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <FileText size={16} />
          <span>بررسی درخواست‌های انتخاب واحد طلاب ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('periods')}
          className={cn(
            "px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-2",
            activeTab === 'periods' 
              ? "bg-indigo-600 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <Calendar size={16} />
          <span>دوره‌های تعریف‌شده و تنظیمی ({periods.length})</span>
        </button>
      </div>

      {activeTab === 'requests' ? (
        /* REQUESTS LIST & FILTERS */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px]">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی نام یا کد ملی..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="p-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="pending">در انتظار بررسی</option>
                <option value="approved">تایید شده</option>
                <option value="rejected">رد شده</option>
              </select>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="p-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold"
              >
                <option value="all">همه پایه‌ها</option>
                <option value="پایه ۷">پایه ۷</option>
                <option value="پایه ۸">پایه ۸</option>
                <option value="پایه ۹">پایه ۹</option>
                <option value="پایه ۱۰">پایه ۱۰</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-bold">
              تعداد موارد: {filteredRequests.length} درخواست
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRequests.map(req => (
              <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-indigo-50 text-indigo-700 font-black rounded-xl flex items-center justify-center text-xs">
                        {req.studentName[0] || 'ط'}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900">{req.studentName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {req.studentGrade} {req.nationalId ? `| کد ملی: ${req.nationalId}` : ''}
                        </p>
                      </div>
                    </div>

                    <span className={cn(
                      "text-[10px] font-black px-2.5 py-1 rounded-full border",
                      req.status === 'approved' ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                      req.status === 'rejected' ? "bg-rose-50 text-rose-800 border-rose-200" :
                      "bg-amber-50 text-amber-800 border-amber-200"
                    )}>
                      {req.status === 'approved' ? 'تایید شده' : req.status === 'rejected' ? 'رد شده' : 'در انتظار بررسی'}
                    </span>
                  </div>

                  <p className="text-[11px] text-indigo-900 font-bold bg-indigo-50/60 p-2 rounded-xl">
                    دوره: {req.periodTitle}
                  </p>

                  {/* Selected Courses List */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-700">دروس درخواستی ({req.selectedCourses.length} درس):</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {req.selectedCourses.map((c, idx) => (
                        <div key={idx} className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] flex items-center justify-between">
                          <span className="font-bold text-slate-800">{c.programTitle}</span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            استاد: {c.teacherName || 'نامشخص'} {c.madrasRoom ? `[مدرس: ${c.madrasRoom}]` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {req.adminNotes && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-100">
                      علت رد/توضیحات: {req.adminNotes}
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ثبت: {req.submittedAt}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {req.status !== 'approved' && (
                      <button
                        onClick={() => handleApproveRequest(req)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Check size={14} />
                        <span>تایید و افزودن به کلاس‌ها</span>
                      </button>
                    )}

                    {req.status !== 'rejected' && (
                      <button
                        onClick={() => setRejectModalRequest(req)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1"
                      >
                        <X size={14} />
                        <span>رد درخواست</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredRequests.length === 0 && (
              <div className="col-span-2 bg-white rounded-3xl p-8 text-center text-xs text-slate-400 italic border border-slate-200">
                هیچ درخواستی با مشخصات انتخابی یافت نشد.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* PERIODS LIST */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {periods.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-full border",
                      p.isActive ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {p.isActive ? 'فعال' : 'غیرفعال / بایگانی'}
                    </span>
                    <h4 className="font-black text-sm text-slate-900 mt-1">{p.title}</h4>
                  </div>

                  <button
                    onClick={() => handleOpenPeriodModal(p)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="ویرایش دوره"
                  >
                    <Edit size={16} />
                  </button>
                </div>

                <div className="text-xs text-slate-600 space-y-1.5 font-bold">
                  <p>پایه‌های مجاز: <span className="text-indigo-900">{p.allowedGrades?.join('، ') || 'همه'}</span></p>
                  <p>نوع دروس مجاز: <span className="text-indigo-900">{p.allowedProgramTypes?.join('، ') || 'همه'}</span></p>
                  {p.customStudentIds && p.customStudentIds.length > 0 && (
                    <p className="text-emerald-700">طلاب اضافه شده دستی: {p.customStudentIds.length} نفر</p>
                  )}
                  {p.customIncludedProgramIds && p.customIncludedProgramIds.length > 0 && (
                    <p className="text-emerald-700">دروس مجاز شده دستی: {p.customIncludedProgramIds.length} درس</p>
                  )}
                  {p.customExcludedProgramIds && p.customExcludedProgramIds.length > 0 && (
                    <p className="text-rose-700">دروس مستثنی شده دستی: {p.customExcludedProgramIds.length} درس</p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    امکان انتخاب درس از سایر پایه‌ها: {p.allowCrossGradeSelection !== false ? '✅ فعال' : '❌ غیرفعال'}
                  </p>
                  <p>مهلت: {p.startDate} تا {p.endDate}</p>
                  {p.description && <p className="text-[11px] text-slate-500 font-normal">{p.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PERIOD CREATE/EDIT MODAL FOR EDUCATION MANAGER */}
      <AnimatePresence>
        {isPeriodModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" />
                  <span>{editingPeriod ? 'ویرایش دوره انتخاب واحد' : 'تعریف دوره جدید انتخاب واحد'}</span>
                </h3>
                <button
                  onClick={() => setIsPeriodModalOpen(false)}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Sub-Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setModalTab('info')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                    modalTab === 'info' ? "bg-indigo-600 text-white font-black" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <Calendar size={14} />
                  <span>۱. مشخصات پایه</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('students')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                    modalTab === 'students' ? "bg-indigo-600 text-white font-black" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <UserPlus size={14} />
                  <span>۲. پایه‌ها و طلاب مجاز ({periodAllowedGrades.length} پایه | {periodCustomStudentIds.length} نفر موردی)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('courses')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                    modalTab === 'courses' ? "bg-indigo-600 text-white font-black" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <SlidersHorizontal size={14} />
                  <span>۳. دروس و دسته‌بندی‌ها</span>
                </button>
              </div>

              <form onSubmit={handleSavePeriod} className="space-y-4 text-xs font-bold text-slate-800">
                {/* TAB 1: BASIC INFO */}
                {modalTab === 'info' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label>عنوان دوره انتخاب واحد:</label>
                      <input
                        type="text"
                        required
                        value={periodTitle}
                        onChange={(e) => setPeriodTitle(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label>سال تحصیلی:</label>
                        <input
                          type="text"
                          required
                          value={periodAcademicYear}
                          onChange={(e) => setPeriodAcademicYear(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label>نیم‌سال تحصیلی:</label>
                        <select
                          value={periodTerm}
                          onChange={(e) => setTerm(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="نیم‌سال اول">نیم‌سال اول</option>
                          <option value="نیم‌سال دوم">نیم‌سال دوم</option>
                          <option value="ترک تحصیلی / تابستان">ترک تحصیلی / تابستان</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label>تاریخ شروع (شمسی):</label>
                        <input
                          type="text"
                          required
                          value={periodStartDate}
                          onChange={(e) => setPeriodStartDate(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label>تاریخ پایان (شمسی):</label>
                        <input
                          type="text"
                          required
                          value={periodEndDate}
                          onChange={(e) => setPeriodEndDate(e.target.value)}
                          className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label>توضیحات و راهنمای ثبت‌نام برای طلاب:</label>
                      <textarea
                        rows={3}
                        value={periodDescription}
                        onChange={(e) => setPeriodDescription(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <input
                        type="checkbox"
                        id="periodActiveCheck"
                        checked={periodIsActive}
                        onChange={(e) => setPeriodIsActive(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="periodActiveCheck" className="cursor-pointer">دوره هم‌اکنون برای طلاب فعال و قابل مشاهده باشد</label>
                    </div>
                  </div>
                )}

                {/* TAB 2: TARGET GRADES & CUSTOM STUDENTS */}
                {modalTab === 'students' && (
                  <div className="space-y-5">
                    {/* Grade Target Checkboxes */}
                    <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="text-slate-900 font-black block">۱. تعیین پایه‌های تحصیلی مجاز:</label>
                      <p className="text-[11px] text-slate-500 font-normal">
                        انتخاب کنید این انتخاب واحد برای طلاب کدام پایه‌ها باز باشد:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {ALL_GRADES_LIST.map(g => {
                          const isChecked = periodAllowedGrades.includes(g);
                          return (
                            <button
                              type="button"
                              key={g}
                              onClick={() => {
                                if (g === 'همه پایه‌ها') {
                                  setPeriodAllowedGrades(isChecked ? [] : ['همه پایه‌ها']);
                                } else {
                                  let next = periodAllowedGrades.filter(x => x !== 'همه پایه‌ها');
                                  if (isChecked) {
                                    next = next.filter(x => x !== g);
                                  } else {
                                    next.push(g);
                                  }
                                  setPeriodAllowedGrades(next.length === 0 ? ['همه پایه‌ها'] : next);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                isChecked ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                              )}
                            >
                              <CheckSquare size={14} />
                              <span>{g}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Individual Student Picker */}
                    <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-indigo-950 font-black block">۲. افزودن دستی و موردی طلاب:</label>
                          <p className="text-[11px] text-indigo-700 font-normal">
                            می‌توانید علاوه بر گروهی، برخی طلاب خاص را بدون توجه به پایه‌شان به این انتخاب واحد اضافه کنید.
                          </p>
                        </div>
                        <span className="text-xs bg-indigo-200 text-indigo-900 px-2.5 py-1 rounded-xl font-black">
                          {periodCustomStudentIds.length} طلبه افزوده شده
                        </span>
                      </div>

                      {/* Selected Custom Students Badges */}
                      {periodCustomStudentIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-indigo-200 max-h-28 overflow-y-auto">
                          {periodCustomStudentIds.map(stId => {
                            const stObj = students.find(s => s.id === stId);
                            return (
                              <span key={stId} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-[11px] font-bold border border-indigo-200">
                                <span>{stObj?.name || stId} ({stObj?.grade || 'پایه نامشخص'})</span>
                                <button
                                  type="button"
                                  onClick={() => setPeriodCustomStudentIds(prev => prev.filter(id => id !== stId))}
                                  className="text-indigo-600 hover:text-rose-600 cursor-pointer"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Search Student Input */}
                      <div className="relative">
                        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="جستجوی نام طلبه یا کد ملی جهت افزودن موردی..."
                          value={studentSearchTerm}
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          className="w-full pr-9 pl-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Search Results List */}
                      {studentSearchTerm.trim().length > 0 && (
                        <div className="bg-white rounded-xl border border-indigo-200 max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs">
                          {students
                            .filter(s => s.name.includes(studentSearchTerm) || (s.nationalId && s.nationalId.includes(studentSearchTerm)))
                            .map(st => {
                              const isAdded = periodCustomStudentIds.includes(st.id);
                              return (
                                <div key={st.id} className="p-2 flex items-center justify-between hover:bg-slate-50">
                                  <span>{st.name} ({st.grade || 'پایه نامشخص'})</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isAdded) {
                                        setPeriodCustomStudentIds(prev => prev.filter(id => id !== st.id));
                                      } else {
                                        setPeriodCustomStudentIds(prev => [...prev, st.id]);
                                      }
                                    }}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer",
                                      isAdded ? "bg-rose-100 text-rose-700" : "bg-indigo-600 text-white"
                                    )}
                                  >
                                    {isAdded ? 'حذف از لیست' : 'افزودن موردی'}
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: COURSES & CATEGORIES */}
                {modalTab === 'courses' && (
                  <div className="space-y-5">
                    {/* Course Category Checkboxes */}
                    <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="text-slate-900 font-black block">۱. تعیین دسته‌بندی و گروه دروس قابل انتخاب:</label>
                      <p className="text-[11px] text-slate-500 font-normal">
                        مشخص کنید چه گروه‌های درسی در این دوره به طلاب نمایش داده شود:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {ALL_PROGRAM_TYPES_LIST.map(t => {
                          const isChecked = periodAllowedTypes.includes(t);
                          return (
                            <button
                              type="button"
                              key={t}
                              onClick={() => {
                                if (isChecked) {
                                  setPeriodAllowedTypes(prev => prev.filter(x => x !== t));
                                } else {
                                  setPeriodAllowedTypes(prev => [...prev, t]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                                isChecked ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                              )}
                            >
                              <CheckSquare size={14} />
                              <span>{t}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cross-Grade Toggle */}
                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="allowCrossGradeCheck"
                          checked={periodAllowCrossGrade}
                          onChange={(e) => setPeriodAllowCrossGrade(e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                        />
                        <label htmlFor="allowCrossGradeCheck" className="text-amber-950 font-black cursor-pointer">
                          اجازه انتخاب درس از سایر پایه‌ها (Cross-Grade Selection)
                        </label>
                      </div>
                      <p className="text-[11px] text-amber-800 pr-6 font-medium">
                        در صورت فعال بودن، طلبه هر پایه‌ای می‌تواند دروس ارائه‌شده از پایه‌های دیگر را نیز انتخاب کند.
                      </p>
                    </div>

                    {/* Manual Individual Course Inclusions / Exclusions */}
                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-900 font-black block">۲. مدیریت دستی دروس (افزودن یا حذف موردی):</label>
                        <span className="text-[11px] text-slate-500 font-bold">
                          {periodCustomIncludedProgramIds.length} مجاز شده | {periodCustomExcludedProgramIds.length} استثنا شده
                        </span>
                      </div>

                      {/* Course Search Input */}
                      <div className="relative">
                        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="جستجوی نام درس یا استاد برای تنظیم دستی..."
                          value={courseSearchTerm}
                          onChange={(e) => setCourseSearchTerm(e.target.value)}
                          className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Course List with Status Buttons */}
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-200 bg-white rounded-xl border border-slate-200">
                        {programs
                          .filter(p => !courseSearchTerm.trim() || p.title.includes(courseSearchTerm) || (p.teacher && p.teacher.includes(courseSearchTerm)))
                          .map(prog => {
                            const isForceIncluded = periodCustomIncludedProgramIds.includes(prog.id);
                            const isForceExcluded = periodCustomExcludedProgramIds.includes(prog.id);

                            return (
                              <div key={prog.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                                <div>
                                  <span className="font-bold text-slate-900">{prog.title}</span>
                                  <span className="text-[10px] text-slate-500 pr-2">({prog.type} | {prog.grade || 'پایه عمومی'} | استاد: {prog.teacher || 'نامشخص'})</span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isForceIncluded) {
                                        setPeriodCustomIncludedProgramIds(prev => prev.filter(id => id !== prog.id));
                                      } else {
                                        setPeriodCustomIncludedProgramIds(prev => [...prev, prog.id]);
                                        setPeriodCustomExcludedProgramIds(prev => prev.filter(id => id !== prog.id));
                                      }
                                    }}
                                    className={cn(
                                      "px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all",
                                      isForceIncluded ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-emerald-100"
                                    )}
                                  >
                                    🟢 مجاز دستی
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isForceExcluded) {
                                        setPeriodCustomExcludedProgramIds(prev => prev.filter(id => id !== prog.id));
                                      } else {
                                        setPeriodCustomExcludedProgramIds(prev => [...prev, prog.id]);
                                        setPeriodCustomIncludedProgramIds(prev => prev.filter(id => id !== prog.id));
                                      }
                                    }}
                                    className={cn(
                                      "px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all",
                                      isForceExcluded ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-rose-100"
                                    )}
                                  >
                                    🔴 غیرمجاز دستی
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Footer Controls */}
                <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {modalTab !== 'info' && (
                      <button
                        type="button"
                        onClick={() => setModalTab(modalTab === 'courses' ? 'students' : 'info')}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                      >
                        قبلی
                      </button>
                    )}
                    {modalTab !== 'courses' && (
                      <button
                        type="button"
                        onClick={() => setModalTab(modalTab === 'info' ? 'students' : 'courses')}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold cursor-pointer"
                      >
                        بعدی
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPeriodModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xs cursor-pointer"
                    >
                      ذخیره دوره انتخاب واحد
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REJECTION MODAL */}
      <AnimatePresence>
        {rejectModalRequest && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            >
              <h3 className="font-black text-sm text-rose-900 flex items-center gap-2">
                <XCircle size={18} />
                <span>رد درخواست انتخاب واحد {rejectModalRequest.studentName}</span>
              </h3>

              <div className="space-y-2 text-xs font-bold">
                <label>علت رد درخواست را بنویسید:</label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="علت رد انتخاب واحد..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setRejectModalRequest(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  onClick={handleConfirmReject}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black shadow-xs cursor-pointer"
                >
                  تایید و ثبت رد
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
