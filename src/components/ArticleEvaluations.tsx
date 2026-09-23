import React, { useState, useEffect } from 'react';
import { 
  Award, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  BookOpen, 
  Download, 
  FileText, 
  UserCheck, 
  MessageSquare, 
  Sparkles,
  Link as LinkIcon,
  Eye,
  Check,
  X,
  User,
  Users,
  Layers,
  AlertCircle
} from 'lucide-react';
import { localDb } from '../lib/localDb';
import { 
  Student, 
  ResearchRecord, 
  ReceivedArticle, 
  ArticleEvaluationSession, 
  EvaluationRequest 
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useMentor } from '../context/MentorContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function ArticleEvaluations() {
  const { currentUser } = useAuth();
  const { filterStudents } = useMentor();

  const isEducationStaff = currentUser?.role === 'education_manager' || 
                           currentUser?.role === 'education_officer' || 
                           currentUser?.roleTitle?.includes('آموزش') || 
                           currentUser?.username?.toUpperCase() === 'SHAH';
  const isGradeSupervisor = currentUser?.role === 'grade_supervisor' || 
                            currentUser?.role === 'grade_mentor' || 
                            currentUser?.role?.startsWith('grade_supervisor_') ||
                            currentUser?.roleTitle?.includes('استاد پایه') || 
                            currentUser?.roleTitle?.includes('مسئول پایه') || 
                            ['SADEGH', 'RAHNAMA', 'ISJ', 'HO', 'SOL', 'ASADI'].includes(currentUser?.username?.toUpperCase() || '');

  const isResearchManager = 
    currentUser?.role === 'research_manager' || 
    currentUser?.role === 'research_officer' || 
    currentUser?.roleTitle?.includes('پژوهش') || 
    currentUser?.username?.toUpperCase() === 'YAZDANI' ||
    currentUser?.role === 'super_admin';

  // Active Sub-tab for Research Manager: 'requests' | 'activate' | 'reports'
  const [managerTab, setManagerTab] = useState<'requests' | 'activate' | 'reports'>('requests');

  // Request Section Toggle for Manager: 'evaluations' | 'roles'
  const [requestSubTab, setRequestSubTab] = useState<'evaluations' | 'roles'>('evaluations');

  // Main Collections
  const [students, setStudents] = useState<Student[]>([]);
  const [receivedArticles, setReceivedArticles] = useState<ReceivedArticle[]>([]);
  const [evaluationSessions, setEvaluationSessions] = useState<ArticleEvaluationSession[]>([]);
  const [requests, setRequests] = useState<EvaluationRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // If user is education officer or grade supervisor, block access
  if (isEducationStaff || isGradeSupervisor) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center bg-white rounded-3xl border border-rose-200 shadow-xl my-12">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">عدم دسترسی به سامانه ارزیابی مقالات</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-bold">
          ارزیابی مقالات منحصراً در اختیار مسئول محترم پژوهش می‌باشد و مسئول آموزش و اساتید محترم پایه به این بخش دسترسی ندارند.
        </p>
      </div>
    );
  }

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');

  // State for Selection in "Activation" tab
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  
  // Activation Config Form State
  const [criticCount, setCriticCount] = useState<number>(1);
  const [refereeCount, setRefereeCount] = useState<number>(2);
  const [allowedRoleRegistration, setAllowedRoleRegistration] = useState<'critic' | 'referee' | 'both'>('both');
  const [hasAbstract, setHasAbstract] = useState<boolean>(false);
  const [abstractText, setAbstractText] = useState<string>('');
  const [hasDownloadLink, setHasDownloadLink] = useState<boolean>(false);
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  // Manual New Article Modal for Evaluation
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualPresenter, setManualPresenter] = useState('');
  const [manualGrade, setManualGrade] = useState('پایه ۷');
  const [manualCriticCount, setManualCriticCount] = useState(1);
  const [manualRefereeCount, setManualRefereeCount] = useState(2);
  const [manualAllowedRole, setManualAllowedRole] = useState<'critic' | 'referee' | 'both'>('both');
  const [manualHasAbstract, setManualHasAbstract] = useState(false);
  const [manualAbstractText, setManualAbstractText] = useState('');
  const [manualHasDownload, setManualHasDownload] = useState(false);
  const [manualDownloadUrl, setManualDownloadUrl] = useState('');

  // View Abstract Modal
  const [selectedAbstractText, setSelectedAbstractText] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();

    const unsub = localDb.subscribe(() => {
      loadAllData();
    });
    return () => unsub();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [allStudents, allReceived, allSessions, allRequests, allResearch] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<ReceivedArticle>('received_articles'),
        localDb.getDocs<ArticleEvaluationSession>('article_evaluations'),
        localDb.getDocs<EvaluationRequest>('evaluation_requests'),
        localDb.getDocs<ResearchRecord>('research_records')
      ]);

      const activeStudents = filterStudents(allStudents.filter(s => s.isActive), true);
      setStudents(activeStudents);

      // Auto-combine completed research records into received articles list
      const completedResearchArticles: ReceivedArticle[] = allResearch
        .filter(r => r.stage === 'تکمیل شده' || r.stage === 'تکمیل شده و تحویل شده')
        .map(r => {
          const st = activeStudents.find(s => s.id === r.studentId);
          return {
            id: `auto_${r.id}`,
            studentId: r.studentId,
            studentName: st?.name || 'طلبه',
            studentGrade: st?.grade || '---',
            title: r.topic || 'بدون عنوان',
            summary: r.description || '',
            type: r.type || 'individual',
            isCompleted: true,
            source: 'auto_completed',
            createdAt: r.updatedAt || new Date().toISOString()
          };
        });

      // Merge auto completed with manual received articles
      const combinedReceived = [...allReceived];
      completedResearchArticles.forEach(cra => {
        if (!combinedReceived.some(ra => ra.id === cra.id || (ra.studentId === cra.studentId && ra.title === cra.title))) {
          combinedReceived.push(cra);
        }
      });

      setReceivedArticles(combinedReceived);
      setEvaluationSessions(allSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setRequests(allRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error("Error loading evaluation data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Student details resolution helper
  const currentStudentObj = students.find(s => s.name === currentUser?.studentName || s.id === currentUser?.id) || {
    id: currentUser?.id || 'std_demo',
    name: currentUser?.studentName || currentUser?.name || 'طلبه آزماینده',
    grade: currentUser?.gradeLabel || 'پایه ۷'
  };

  // Manager: Activate Evaluation Sessions for Checked Received Articles
  const handleActivateSelectedArticles = async () => {
    if (selectedArticleIds.length === 0) {
      alert("لطفاً حداقل یک مقاله را برای فعال‌سازی ارزیابی انتخاب کنید.");
      return;
    }

    try {
      for (const articleId of selectedArticleIds) {
        const article = receivedArticles.find(a => a.id === articleId);
        if (article) {
          await localDb.addDoc('article_evaluations', {
            articleId: article.id,
            title: article.title,
            presenterStudentId: article.studentId,
            presenterName: article.studentName,
            studentGrade: article.studentGrade || '---',
            refereeCount: refereeCount,
            criticCount: criticCount,
            allowedRoleRegistration: allowedRoleRegistration,
            hasAbstract: hasAbstract,
            abstractText: hasAbstract ? (abstractText || article.summary || '') : '',
            hasDownloadLink: hasDownloadLink,
            downloadUrl: hasDownloadLink ? downloadUrl : '',
            status: 'active',
            approvedCriticStudentIds: [],
            approvedRefereeStudentIds: [],
            createdAt: new Date().toISOString()
          });
        }
      }

      alert("مقالات انتخاب شده با موفقیت به بخش ارزیابی مقالات اضافه شدند.");
      setSelectedArticleIds([]);
      setHasAbstract(false);
      setAbstractText('');
      setHasDownloadLink(false);
      setDownloadUrl('');
      setManagerTab('reports');
    } catch (err) {
      console.error("Error activating articles:", err);
      alert("خطا در فعال‌سازی ارزیابی مقالات.");
    }
  };

  // Manager: Create Manual Article for Evaluation
  const handleCreateManualArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualPresenter.trim()) {
      alert("لطفاً عنوان مقاله و نام ارائه دهنده را وارد کنید.");
      return;
    }

    try {
      await localDb.addDoc('article_evaluations', {
        title: manualTitle.trim(),
        presenterName: manualPresenter.trim(),
        studentGrade: manualGrade,
        refereeCount: manualRefereeCount,
        criticCount: manualCriticCount,
        allowedRoleRegistration: manualAllowedRole,
        hasAbstract: manualHasAbstract,
        abstractText: manualHasAbstract ? manualAbstractText : '',
        hasDownloadLink: manualHasDownload,
        downloadUrl: manualHasDownload ? manualDownloadUrl : '',
        status: 'active',
        approvedCriticStudentIds: [],
        approvedRefereeStudentIds: [],
        createdAt: new Date().toISOString()
      });

      alert("مقاله جدید به همراه تنظیمات ارزیابی با موفقیت ثبت شد.");
      setShowManualModal(false);
      setManualTitle('');
      setManualPresenter('');
      setManualAbstractText('');
      setManualDownloadUrl('');
      setManualHasAbstract(false);
      setManualHasDownload(false);
      setManagerTab('reports');
    } catch (err) {
      console.error("Error creating manual evaluation article:", err);
      alert("خطا در ایجاد مقاله جدید برای ارزیابی.");
    }
  };

  // Manager: Update Request Status (Approve/Reject)
  const handleUpdateRequestStatus = async (requestId: string, newStatus: 'approved' | 'rejected', adminNotes?: string) => {
    try {
      const req = requests.find(r => r.id === requestId);
      if (!req) return;

      await localDb.updateDoc('evaluation_requests', requestId, {
        status: newStatus,
        adminNotes: adminNotes || ''
      });

      // If approving role registration (critic/referee), update evaluation session
      if (newStatus === 'approved' && req.type === 'role_registration' && req.articleId) {
        const session = evaluationSessions.find(s => s.id === req.articleId);
        if (session) {
          if (req.requestedRole === 'critic') {
            const updated = [...(session.approvedCriticStudentIds || []), req.studentId];
            await localDb.updateDoc('article_evaluations', session.id, {
              approvedCriticStudentIds: updated
            });
          } else if (req.requestedRole === 'referee') {
            const updated = [...(session.approvedRefereeStudentIds || []), req.studentId];
            await localDb.updateDoc('article_evaluations', session.id, {
              approvedRefereeStudentIds: updated
            });
          }
        }
      }

      // If approving evaluation request for student's own article, auto create active session
      if (newStatus === 'approved' && req.type === 'evaluation_request') {
        const existingSession = evaluationSessions.find(s => s.articleId === req.articleId || s.title === req.articleTitle);
        if (!existingSession) {
          await localDb.addDoc('article_evaluations', {
            articleId: req.articleId || '',
            title: req.articleTitle,
            presenterStudentId: req.studentId,
            presenterName: req.studentName,
            studentGrade: req.studentGrade || '---',
            refereeCount: 2,
            criticCount: 1,
            allowedRoleRegistration: 'both',
            hasAbstract: false,
            hasDownloadLink: false,
            status: 'active',
            approvedCriticStudentIds: [],
            approvedRefereeStudentIds: [],
            createdAt: new Date().toISOString()
          });
        }
      }

      alert(`درخواست با موفقیت ${newStatus === 'approved' ? 'تایید' : 'رد'} شد.`);
    } catch (err) {
      console.error("Error updating request:", err);
      alert("خطا در به‌روزرسانی درخواست.");
    }
  };

  // Student: Submit Evaluation Request for Own Article
  const handleStudentSubmitEvaluationRequest = async (article: ReceivedArticle) => {
    const existingReq = requests.find(r => r.studentId === currentStudentObj.id && r.articleTitle === article.title && r.type === 'evaluation_request');
    if (existingReq) {
      alert("شما قبلاً برای این مقاله درخواست ارزیابی ثبت کرده‌اید.");
      return;
    }

    try {
      await localDb.addDoc('evaluation_requests', {
        type: 'evaluation_request',
        studentId: currentStudentObj.id,
        studentName: currentStudentObj.name,
        studentGrade: currentStudentObj.grade || '---',
        articleId: article.id,
        articleTitle: article.title,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      alert("درخواست ارزیابی مقاله شما با موفقیت برای مسئول پژوهش ارسال شد.");
    } catch (err) {
      console.error("Error submitting evaluation request:", err);
      alert("خطا در ارسال درخواست.");
    }
  };

  // Student: Submit Request to be Critic or Referee
  const handleStudentRegisterRole = async (session: ArticleEvaluationSession, role: 'critic' | 'referee') => {
    const roleLabel = role === 'critic' ? 'ناقد' : 'داور';

    const existingReq = requests.find(
      r => r.studentId === currentStudentObj.id && r.articleId === session.id && r.requestedRole === role
    );

    if (existingReq) {
      alert(`شما قبلاً درخواست ثبت‌نام به‌عنوان ${roleLabel} برای این مقاله ارسال کرده‌اید.`);
      return;
    }

    try {
      await localDb.addDoc('evaluation_requests', {
        type: 'role_registration',
        studentId: currentStudentObj.id,
        studentName: currentStudentObj.name,
        studentGrade: currentStudentObj.grade || '---',
        articleId: session.id,
        articleTitle: session.title,
        requestedRole: role,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      alert(`درخواست ثبت‌نام شما به‌عنوان ${roleLabel} مقاله با موفقیت ثبت گردید.`);
    } catch (err) {
      console.error("Error registering role request:", err);
      alert("خطا در ثبت درخواست.");
    }
  };

  // Filter Received Articles
  const filteredReceivedArticles = receivedArticles.filter(art => {
    const matchesSearch = 
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = gradeFilter === 'all' || art.studentGrade === gradeFilter || (gradeFilter === 'پایه ۷' && art.studentGrade?.includes('۷'));
    return matchesSearch && matchesGrade;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-vazir text-slate-800" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-indigo-700/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300">
            <Award size={32} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">سامانه ارزیابی مقالات و کرسی‌های پژوهشی</h1>
            <p className="text-xs text-indigo-200 mt-1 font-medium">
              {isResearchManager 
                ? 'مدیریت جلسه ارزیابی مقالات، تعیین داوران و ناقدان و بررسی درخواست‌های طلاب'
                : 'مشاهده مقالات فعال، ثبت درخواست ارزیابی مقاله خود و نام‌نویسی به‌عنوان ناقد یا داور'}
            </p>
          </div>
        </div>

        {isResearchManager && (
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>معرفی دستی مقاله جدید برای ارزیابی</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. RESEARCH OFFICER / ADMIN VIEW */}
      {/* ========================================================================= */}
      {isResearchManager ? (
        <div className="space-y-6">
          {/* Main Sub-Tabs Navigation for Research Officer */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold w-fit flex-wrap">
            <button
              type="button"
              onClick={() => setManagerTab('requests')}
              className={cn(
                "px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2",
                managerTab === 'requests' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <MessageSquare size={16} />
              <span>۱. مشاهده درخواست‌ها</span>
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-full">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setManagerTab('activate')}
              className={cn(
                "px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2",
                managerTab === 'activate' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Sparkles size={16} />
              <span>۲. فعالسازی ارزیابی مقالات</span>
            </button>

            <button
              type="button"
              onClick={() => setManagerTab('reports')}
              className={cn(
                "px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2",
                managerTab === 'reports' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <BookOpen size={16} />
              <span>۳. نمایش گزارش ارزیابی‌های برگزار شده</span>
              <span className="bg-slate-200 text-slate-700 text-[10px] font-mono px-1.5 py-0.5 rounded-full">
                {evaluationSessions.length}
              </span>
            </button>
          </div>

          {/* TAB 1: VIEW REQUESTS */}
          {managerTab === 'requests' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
              {/* Request Type Toggle */}
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold w-fit">
                <button
                  type="button"
                  onClick={() => setRequestSubTab('evaluations')}
                  className={cn(
                    "px-4 py-2 rounded-xl transition-all cursor-pointer",
                    requestSubTab === 'evaluations' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  الف) درخواست‌های ارزیابی مقالات ({requests.filter(r => r.type === 'evaluation_request').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestSubTab('roles')}
                  className={cn(
                    "px-4 py-2 rounded-xl transition-all cursor-pointer",
                    requestSubTab === 'roles' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  ب) درخواست ثبت به عنوان داور یا ناقد ({requests.filter(r => r.type === 'role_registration').length})
                </button>
              </div>

              {/* Request List Table */}
              {(() => {
                const filteredReqs = requests.filter(r => 
                  requestSubTab === 'evaluations' ? r.type === 'evaluation_request' : r.type === 'role_registration'
                );

                if (filteredReqs.length === 0) {
                  return (
                    <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-2">
                      <Clock size={36} className="mx-auto text-slate-300" />
                      <p className="text-xs text-slate-500 font-bold">هیچ درخواستی در این بخش ثبت نشده است.</p>
                    </div>
                  );
                }

                return (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                        <tr>
                          <th className="p-3">نام طلبه و پایه</th>
                          <th className="p-3">عنوان مقاله</th>
                          {requestSubTab === 'roles' && <th className="p-3 text-center">نقش درخواستی</th>}
                          <th className="p-3 text-center">تاریخ درخواست</th>
                          <th className="p-3 text-center">وضعیت</th>
                          <th className="p-3 text-center">عملیات مدیریت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredReqs.map(req => (
                          <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{req.studentName}</div>
                              <div className="text-[10px] text-slate-400">{req.studentGrade || 'پایه ۷'}</div>
                            </td>
                            <td className="p-3 font-bold text-indigo-900 max-w-xs">{req.articleTitle}</td>
                            {requestSubTab === 'roles' && (
                              <td className="p-3 text-center">
                                <span className={cn(
                                  "px-2.5 py-1 rounded-full text-[11px] font-bold",
                                  req.requestedRole === 'critic' ? "bg-purple-100 text-purple-900" : "bg-blue-100 text-blue-900"
                                )}>
                                  {req.requestedRole === 'critic' ? '🔍 ناقد مقاله' : '⚖️ داور مقاله'}
                                </span>
                              </td>
                            )}
                            <td className="p-3 text-center font-mono text-slate-500">
                              {new Date(req.createdAt).toLocaleDateString('fa-IR')}
                            </td>
                            <td className="p-3 text-center">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-bold",
                                req.status === 'pending' && "bg-amber-100 text-amber-800",
                                req.status === 'approved' && "bg-emerald-100 text-emerald-800",
                                req.status === 'rejected' && "bg-rose-100 text-rose-800"
                              )}>
                                {req.status === 'pending' && '⏳ در انتظار بررسی'}
                                {req.status === 'approved' && '✅ تایید شده'}
                                {req.status === 'rejected' && '❌ رد شده'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {req.status === 'pending' ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRequestStatus(req.id, 'approved')}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                                  >
                                    <Check size={13} />
                                    <span>تایید</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRequestStatus(req.id, 'rejected')}
                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                                  >
                                    <X size={13} />
                                    <span>رد</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-bold">بررسی شده</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: ENABLE ARTICLE EVALUATIONS */}
          {managerTab === 'activate' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">انتخاب مقاله جهت برگزاری جلسه ارزیابی</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    مقالات تحویل داده شده طلاب را تیک بزنید و مشخصات داوران، ناقدان و چکیده را تنظیم کنید.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="جستجوی نام یا مقاله..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <select
                    value={gradeFilter}
                    onChange={e => setGradeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="all">همه پایه‌ها</option>
                    <option value="پایه ۷">پایه ۷</option>
                    <option value="پایه ۸">پایه ۸</option>
                    <option value="پایه ۹">پایه ۹</option>
                    <option value="پایه ۱۰">پایه ۱۰</option>
                  </select>
                </div>
              </div>

              {/* List of Received Articles to Select */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3 text-center w-12">انتخاب</th>
                      <th className="p-3">عنوان مقاله</th>
                      <th className="p-3">طلبه ارائه دهنده</th>
                      <th className="p-3 text-center">پایه</th>
                      <th className="p-3 text-center">نوع پژوهش</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredReceivedArticles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                          هیچ مقاله‌ای یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredReceivedArticles.map(art => {
                        const isChecked = selectedArticleIds.includes(art.id);
                        return (
                          <tr key={art.id} className={cn("hover:bg-slate-50 transition-colors", isChecked && "bg-indigo-50/50")}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedArticleIds([...selectedArticleIds, art.id]);
                                    if (art.summary) setAbstractText(art.summary);
                                  } else {
                                    setSelectedArticleIds(selectedArticleIds.filter(id => id !== art.id));
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded-md cursor-pointer accent-indigo-600"
                              />
                            </td>
                            <td className="p-3 font-bold text-indigo-950">{art.title}</td>
                            <td className="p-3 font-bold text-slate-900">{art.studentName}</td>
                            <td className="p-3 text-center text-slate-500 font-bold">{art.studentGrade || '---'}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] text-slate-600 font-bold">
                                {art.type === 'group' ? 'گروهی' : 'فردی'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* EVALUATION CONFIGURATION FOR SELECTED ARTICLES */}
              {selectedArticleIds.length > 0 && (
                <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-3xl p-6 space-y-5 animate-fadeIn">
                  <h4 className="font-black text-indigo-950 text-sm flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-500" />
                    <span>تنظیمات جلسه ارزیابی برای ({selectedArticleIds.length}) مقاله انتخاب شده</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">تعداد ناقد مورد نیاز:</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={criticCount}
                        onChange={e => setCriticCount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">تعداد داور مورد نیاز:</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={refereeCount}
                        onChange={e => setRefereeCount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1">امکان ثبت‌نام طلاب برای:</label>
                      <select
                        value={allowedRoleRegistration}
                        onChange={e => setAllowedRoleRegistration(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="both">ناقد و داور (هر دو)</option>
                        <option value="critic">فقط ناقد مقاله</option>
                        <option value="referee">فقط داور مقاله</option>
                      </select>
                    </div>
                  </div>

                  {/* ABSTRACT CONFIG */}
                  <div className="space-y-2 pt-2 border-t border-indigo-100">
                    <label className="flex items-center gap-2 font-bold text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasAbstract}
                        onChange={e => setHasAbstract(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded-md accent-indigo-600 cursor-pointer"
                      />
                      <span>دارای چکیده مقاله هست</span>
                    </label>

                    {hasAbstract && (
                      <textarea
                        rows={3}
                        placeholder="متن چکیده مقاله را اینجا وارد یا پیست نمایید..."
                        value={abstractText}
                        onChange={e => setAbstractText(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />
                    )}
                  </div>

                  {/* DOWNLOAD LINK CONFIG */}
                  <div className="space-y-2 pt-2 border-t border-indigo-100">
                    <label className="flex items-center gap-2 font-bold text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasDownloadLink}
                        onChange={e => setHasDownloadLink(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded-md accent-indigo-600 cursor-pointer"
                      />
                      <span>دارای لینک دانلود فایل مقاله هست</span>
                    </label>

                    {hasDownloadLink && (
                      <input
                        type="text"
                        placeholder="https://example.com/article.pdf"
                        value={downloadUrl}
                        onChange={e => setDownloadUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleActivateSelectedArticles}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md cursor-pointer transition-all"
                    >
                      <CheckCircle size={16} />
                      <span>تایید نهایی و فعالسازی ارزیابی مقالات انتخاب‌شده</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CONDUCTED EVALUATION REPORTS */}
          {managerTab === 'reports' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-900">گزارش جلسات و مقالات فعال ارزیابی</h3>
                <span className="text-xs font-bold text-slate-500">تعداد کل: {evaluationSessions.length} جلسه</span>
              </div>

              {evaluationSessions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-2">
                  <BookOpen size={36} className="mx-auto text-slate-300" />
                  <p className="text-xs text-slate-500 font-bold">هیچ ارزیابی مقاله‌ای تا کنون تعریف نشده است.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {evaluationSessions.map(sess => (
                    <div key={sess.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3 hover:border-indigo-300 transition-all shadow-2xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">{sess.title}</h4>
                          <p className="text-xs text-slate-500 font-bold mt-0.5">
                            ارائه‌دهنده: <span className="text-indigo-900 font-black">{sess.presenterName}</span> ({sess.studentGrade || 'پایه ۷'})
                          </p>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                          {sess.status === 'active' ? '🟢 فعال جهت ثبت‌نام' : '⚪ پایان یافته'}
                        </span>
                      </div>

                      {/* Capacity Badges */}
                      <div className="flex items-center gap-3 text-xs font-bold bg-white p-2 rounded-xl border border-slate-200">
                        <div className="text-purple-800">
                          🔍 ناقدان: <span className="font-mono font-black">{sess.approvedCriticStudentIds?.length || 0}</span> از <span className="font-mono">{sess.criticCount}</span>
                        </div>
                        <div className="text-blue-800">
                          ⚖️ داوران: <span className="font-mono font-black">{sess.approvedRefereeStudentIds?.length || 0}</span> از <span className="font-mono">{sess.refereeCount}</span>
                        </div>
                      </div>

                      {/* Optional Buttons */}
                      <div className="flex items-center gap-2 pt-1 text-xs">
                        {sess.hasAbstract && sess.abstractText && (
                          <button
                            type="button"
                            onClick={() => setSelectedAbstractText(sess.abstractText || '')}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <FileText size={13} />
                            <span>مشاهده چکیده</span>
                          </button>
                        )}

                        {sess.hasDownloadLink && sess.downloadUrl && (
                          <a
                            href={sess.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg font-bold flex items-center gap-1 transition-all"
                          >
                            <Download size={13} />
                            <span>دانلود مقاله</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. STUDENT / LEVEL 3 VIEW */
        /* ========================================================================= */
        <div className="space-y-8">
          {/* SECTION 1: STUDENT'S OWN ARTICLES */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-600" />
                <span>۱. مقالات و پژوهش‌های تکمیل‌شده من (درخواست ارزیابی)</span>
              </h3>
            </div>

            {(() => {
              const myCompletedArticles = receivedArticles.filter(a => 
                a.studentId === currentStudentObj.id || a.studentName === currentStudentObj.name
              );

              if (myCompletedArticles.length === 0) {
                return (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 font-bold text-xs">
                    هنوز مقاله‌ای با وضعیت تکمیل‌شده برای شما ثبت نشده است.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myCompletedArticles.map(art => {
                    const existingReq = requests.find(r => r.studentId === currentStudentObj.id && r.articleTitle === art.title && r.type === 'evaluation_request');

                    return (
                      <div key={art.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                        <div className="font-black text-sm text-slate-900">{art.title}</div>
                        <p className="text-xs text-slate-500 line-clamp-2">{art.summary || 'بدون خلاصه ثبت‌شده'}</p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                          {existingReq ? (
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold",
                              existingReq.status === 'pending' && "bg-amber-100 text-amber-800",
                              existingReq.status === 'approved' && "bg-emerald-100 text-emerald-800",
                              existingReq.status === 'rejected' && "bg-rose-100 text-rose-800"
                            )}>
                              {existingReq.status === 'pending' && '⏳ درخواست ارزیابی در انتظار بررسی'}
                              {existingReq.status === 'approved' && '✅ ارزیابی مقاله تایید و فعال شد'}
                              {existingReq.status === 'rejected' && '❌ درخواست ارزیابی رد شد'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStudentSubmitEvaluationRequest(art)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                            >
                              <Award size={14} />
                              <span>ثبت درخواست ارزیابی مقاله</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* SECTION 2: ACTIVE ARTICLES OPEN FOR EVALUATION (REGISTER AS CRITIC / REFEREE) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  <span>۲. مقالات فعال جهت ثبت‌نام به عنوان ناقد یا داور</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  لیست مقالاتی که مسئول پژوهش برای نقد و داوری قرار داده است.
                </p>
              </div>
            </div>

            {evaluationSessions.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 font-bold text-xs">
                در حال حاضر هیچ مقاله‌ای جهت ثبت‌نام ناقد یا داور وجود ندارد.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {evaluationSessions.map(sess => {
                  const criticReq = requests.find(r => r.studentId === currentStudentObj.id && r.articleId === sess.id && r.requestedRole === 'critic');
                  const refereeReq = requests.find(r => r.studentId === currentStudentObj.id && r.articleId === sess.id && r.requestedRole === 'referee');

                  const isAlreadyCriticApproved = sess.approvedCriticStudentIds?.includes(currentStudentObj.id);
                  const isAlreadyRefereeApproved = sess.approvedRefereeStudentIds?.includes(currentStudentObj.id);

                  return (
                    <div key={sess.id} className="border-2 border-slate-200 rounded-3xl p-5 bg-gradient-to-b from-white to-slate-50/80 space-y-4 hover:border-indigo-300 transition-all shadow-xs">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="font-black text-base text-slate-900">{sess.title}</h4>
                          <p className="text-xs text-slate-600 font-bold mt-1">
                            ارائه‌دهنده: <span className="text-indigo-900 font-black">{sess.presenterName}</span> ({sess.studentGrade || 'پایه ۷'})
                          </p>
                        </div>
                        <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 text-[10px] font-bold rounded-full flex-shrink-0">
                          {sess.allowedRoleRegistration === 'both' ? 'ناقد و داور' : sess.allowedRoleRegistration === 'critic' ? 'فقط ناقد' : 'فقط داور'}
                        </span>
                      </div>

                      {/* CONDITIONAL ABSTRACT DISPLAY */}
                      {sess.hasAbstract && sess.abstractText && (
                        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 text-xs text-slate-800 space-y-1">
                          <span className="font-black text-amber-900 text-[11px] block">📌 چکیده مقاله:</span>
                          <p className="font-medium text-slate-700 leading-relaxed line-clamp-4">{sess.abstractText}</p>
                        </div>
                      )}

                      {/* CONDITIONAL DOWNLOAD LINK DISPLAY */}
                      {sess.hasDownloadLink && sess.downloadUrl && (
                        <div>
                          <a
                            href={sess.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold transition-all"
                          >
                            <Download size={14} />
                            <span>دانلود متن کامل مقاله</span>
                          </a>
                        </div>
                      )}

                      {/* REGISTRATION BUTTONS & STATUS */}
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        {/* Critic Section */}
                        {(sess.allowedRoleRegistration === 'both' || sess.allowedRoleRegistration === 'critic') && (
                          <div>
                            {isAlreadyCriticApproved ? (
                              <span className="px-2.5 py-1 bg-purple-100 text-purple-900 text-[11px] font-bold rounded-xl flex items-center gap-1">
                                <CheckCircle size={13} />
                                <span>شما ناقد تاییدشده این مقاله هستید</span>
                              </span>
                            ) : criticReq ? (
                              <span className={cn(
                                "px-2.5 py-1 rounded-xl text-[11px] font-bold",
                                criticReq.status === 'pending' && "bg-amber-100 text-amber-800",
                                criticReq.status === 'approved' && "bg-purple-100 text-purple-900",
                                criticReq.status === 'rejected' && "bg-rose-100 text-rose-800"
                              )}>
                                {criticReq.status === 'pending' && '⏳ درخواست ناقد (در انتظار)'}
                                {criticReq.status === 'approved' && '✅ ناقد تایید شد'}
                                {criticReq.status === 'rejected' && '❌ درخواست ناقد رد شد'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStudentRegisterRole(sess, 'critic')}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                              >
                                <UserCheck size={14} />
                                <span>ثبت‌نام به‌عنوان ناقد</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Referee Section */}
                        {(sess.allowedRoleRegistration === 'both' || sess.allowedRoleRegistration === 'referee') && (
                          <div>
                            {isAlreadyRefereeApproved ? (
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-900 text-[11px] font-bold rounded-xl flex items-center gap-1">
                                <CheckCircle size={13} />
                                <span>شما داور تاییدشده این مقاله هستید</span>
                              </span>
                            ) : refereeReq ? (
                              <span className={cn(
                                "px-2.5 py-1 rounded-xl text-[11px] font-bold",
                                refereeReq.status === 'pending' && "bg-amber-100 text-amber-800",
                                refereeReq.status === 'approved' && "bg-blue-100 text-blue-900",
                                refereeReq.status === 'rejected' && "bg-rose-100 text-rose-800"
                              )}>
                                {refereeReq.status === 'pending' && '⏳ درخواست داور (در انتظار)'}
                                {refereeReq.status === 'approved' && '✅ داور تایید شد'}
                                {refereeReq.status === 'rejected' && '❌ درخواست داور رد شد'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStudentRegisterRole(sess, 'referee')}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                              >
                                <Award size={14} />
                                <span>ثبت‌نام به‌عنوان داور</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANUAL ARTICLE CREATION MODAL FOR MANAGER */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-5 border border-slate-200 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">معرفی دستی مقاله جدید برای ارزیابی</h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateManualArticle} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1">عنوان مقاله:</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: بررسی تطبیقی مبانی فقهی..."
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">نام ارائه‌دهنده (طلبه):</label>
                  <input
                    type="text"
                    required
                    placeholder="مثلاً: طلبه علیرضا حسینی"
                    value={manualPresenter}
                    onChange={e => setManualPresenter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">پایه تحصیلی:</label>
                  <select
                    value={manualGrade}
                    onChange={e => setManualGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="پایه ۷">پایه ۷</option>
                    <option value="پایه ۸">پایه ۸</option>
                    <option value="پایه ۹">پایه ۹</option>
                    <option value="پایه ۱۰">پایه ۱۰</option>
                    <option value="سایر">سایر</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">تعداد ناقد:</label>
                  <input
                    type="number"
                    min={0}
                    value={manualCriticCount}
                    onChange={e => setManualCriticCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">تعداد داور:</label>
                  <input
                    type="number"
                    min={0}
                    value={manualRefereeCount}
                    onChange={e => setManualRefereeCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">امکان ثبت‌نام:</label>
                  <select
                    value={manualAllowedRole}
                    onChange={e => setManualAllowedRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="both">هر دو (ناقد و داور)</option>
                    <option value="critic">فقط ناقد</option>
                    <option value="referee">فقط داور</option>
                  </select>
                </div>
              </div>

              {/* ABSTRACT TOGGLE */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 font-bold text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualHasAbstract}
                    onChange={e => setManualHasAbstract(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md cursor-pointer accent-indigo-600"
                  />
                  <span>دارای چکیده مقاله هست</span>
                </label>

                {manualHasAbstract && (
                  <textarea
                    rows={3}
                    placeholder="چکیده مقاله را اینجا بنویسید..."
                    value={manualAbstractText}
                    onChange={e => setManualAbstractText(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                )}
              </div>

              {/* DOWNLOAD LINK TOGGLE */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 font-bold text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualHasDownload}
                    onChange={e => setManualHasDownload(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md cursor-pointer accent-indigo-600"
                  />
                  <span>دارای لینک دانلود مقاله هست</span>
                </label>

                {manualHasDownload && (
                  <input
                    type="text"
                    placeholder="https://..."
                    value={manualDownloadUrl}
                    onChange={e => setManualDownloadUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                >
                  ثبت مقاله جدید
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ABSTRACT MODAL */}
      {selectedAbstractText !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-200 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                <span>چکیده مقاله</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAbstractText(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-medium max-h-80 overflow-y-auto whitespace-pre-wrap">
              {selectedAbstractText || 'چکیده‌ای ثبت نشده است.'}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAbstractText(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
