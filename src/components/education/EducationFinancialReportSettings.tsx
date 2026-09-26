import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Send, 
  CheckCircle2, 
  Search, 
  Plus, 
  Minus, 
  Edit3, 
  Trash2, 
  User, 
  DollarSign, 
  Clock, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Filter,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { cn } from '../../lib/utils';
import { Student, EducationFinancialReport, EducationFinancialItem } from '../../types';
import { ShamsiDatePicker } from '../ShamsiDatePicker';

interface EducationFinancialReportSettingsProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function EducationFinancialReportSettings({ onNavigateTab }: EducationFinancialReportSettingsProps) {
  const { currentUser } = useAuth();
  const today = getTodayShamsi();
  const defaultStart = today.substring(0, 8) + '01';

  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<EducationFinancialReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Report Form State with Date Range
  const [reportTitle, setReportTitle] = useState('تنظیم گزارش افزایش/کاهش شهریه طلاب');
  const [selectedMonth, setSelectedMonth] = useState('مهر ۱۴۰۳');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [reportNotes, setReportNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');

  // Items per student: studentId -> EducationFinancialItem
  const [itemsMap, setItemsMap] = useState<Record<string, EducationFinancialItem>>({});
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedReportDetail, setSelectedReportDetail] = useState<EducationFinancialReport | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allStudents, allReports] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<EducationFinancialReport>('education_financial_reports')
      ]);

      setStudents((allStudents || []).filter(s => s.isActive));
      setReports(allReports || []);
    } catch (err) {
      console.error('Error loading education financial report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = localDb.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  // Initialize or update items map when students load
  useEffect(() => {
    if (students.length > 0) {
      setItemsMap(prev => {
        const next = { ...prev };
        students.forEach(st => {
          if (!next[st.id]) {
            next[st.id] = {
              studentId: st.id,
              studentName: st.name,
              nationalId: st.nationalId,
              grade: st.grade,
              type: 'none',
              amount: 0,
              reason: ''
            };
          }
        });
        return next;
      });
    }
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = 
        !searchQuery ||
        s.name.includes(searchQuery) ||
        (s.nationalId && s.nationalId.includes(searchQuery)) ||
        (s.grade && s.grade.includes(searchQuery));
      
      const matchGrade = gradeFilter === 'all' || s.grade === gradeFilter;
      return matchSearch && matchGrade;
    });
  }, [students, searchQuery, gradeFilter]);

  // Handle item change
  const handleItemChange = (studentId: string, field: keyof EducationFinancialItem, value: any) => {
    setItemsMap(prev => {
      const existing = prev[studentId] || {
        studentId,
        studentName: students.find(s => s.id === studentId)?.name || '',
        nationalId: students.find(s => s.id === studentId)?.nationalId,
        grade: students.find(s => s.id === studentId)?.grade,
        type: 'none',
        amount: 0,
        reason: ''
      };
      return {
        ...prev,
        [studentId]: {
          ...existing,
          [field]: value
        }
      };
    });
  };

  // Calculated count of adjusted students
  const adjustedItems = useMemo(() => {
    return Object.values(itemsMap).filter(item => item.type !== 'none' && item.amount > 0);
  }, [itemsMap]);

  const totalIncreaseSum = useMemo(() => {
    return adjustedItems
      .filter(it => it.type === 'increase')
      .reduce((sum, it) => sum + (it.amount || 0), 0);
  }, [adjustedItems]);

  const totalDecreaseSum = useMemo(() => {
    return adjustedItems
      .filter(it => it.type === 'decrease')
      .reduce((sum, it) => sum + (it.amount || 0), 0);
  }, [adjustedItems]);

  // Send Report to Finance Manager
  const handleSendReport = async () => {
    if (adjustedItems.length === 0) {
      alert('هیچ موردی برای افزایش یا کاهش شهریه تنظیم نشده است. لطفاً حداقل برای یک طلبه مبلغ و علت را وارد کنید.');
      return;
    }

    // Check that reasons are entered
    const missingReason = adjustedItems.find(it => !it.reason || it.reason.trim() === '');
    if (missingReason) {
      alert(`لطفاً علت افزایش یا کاهش را برای «${missingReason.studentName}» بنویسید.`);
      return;
    }

    setIsSending(true);
    try {
      const reportId = `edufin-${Date.now()}`;
      const dateRangeStr = `${startDate} تا ${endDate}`;
      const newReport: EducationFinancialReport = {
        id: reportId,
        title: reportTitle.trim() || `گزارش تنظیم مالی طلاب (${dateRangeStr})`,
        month: selectedMonth,
        startDate,
        endDate,
        dateRangeStr,
        senderUserId: currentUser?.id,
        senderUserName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'مسئول آموزش',
        senderRoleTitle: currentUser?.roleTitle || 'مسئول آموزش',
        status: 'sent',
        items: adjustedItems,
        notes: reportNotes,
        createdAt: new Date().toISOString()
      };

      await localDb.setDoc('education_financial_reports', newReport);

      // Notify through workflow/notice if exists
      try {
        await localDb.setDoc('workflow_items', {
          id: `wf-edufin-${Date.now()}`,
          type: 'approval',
          category: 'presence_finance_report',
          title: `گزارش جدید مالی طلاب ارسالی از آموزش (${dateRangeStr})`,
          description: `مسئول آموزش (${newReport.senderUserName}) گزارشی با ${adjustedItems.length} مورد تعدیل شهریه برای بازه زمانی ${dateRangeStr} (مجموع افزایش: ${totalIncreaseSum.toLocaleString('fa-IR')} تومان، کاهش: ${totalDecreaseSum.toLocaleString('fa-IR')} تومان) جهت بررسی، تایید و اعمال خودکار در محاسبه مکانیزه شهریه ارسال نمود.`,
          status: 'pending',
          requiresEducationApproval: false,
          createdByUserId: currentUser?.id,
          createdByName: newReport.senderUserName,
          createdAt: new Date().toISOString()
        });
      } catch (wfErr) {
        console.warn('Could not post workflow notification:', wfErr);
      }

      showToast('گزارش مالی آموزشی با موفقیت ثبت و به مسئول مالی ارسال شد.');
      // Reset adjusted items
      setItemsMap(prev => {
        const reset: Record<string, EducationFinancialItem> = {};
        Object.keys(prev).forEach(k => {
          reset[k] = { ...prev[k], type: 'none', amount: 0, reason: '' };
        });
        return reset;
      });
      setReportNotes('');
      setActiveTab('history');
    } catch (err) {
      console.error('Error sending report:', err);
      alert('خطا در ارسال گزارش.');
    } finally {
      setIsSending(false);
    }
  };

  // Delete sent report (if not yet applied)
  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('آیا از حذف این گزارش مطمئن هستید؟')) return;
    try {
      await localDb.deleteDoc('education_financial_reports', reportId);
      showToast('گزارش با موفقیت حذف گردید.');
    } catch (err) {
      console.error('Error deleting report:', err);
      alert('خطا در حذف گزارش.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری بخش تنظیم گزارش مالی آموزش...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-vazir" dir="rtl">
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs border border-indigo-100 shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">تنظیم گزارش مالی طلاب (افزایش و کاهش شهریه)</h2>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-black rounded-lg">
                ویژه مسئول آموزش
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              تنظیم مبالغ پاداش تشویقی یا جریمه‌های انضباطی/آموزشی هر طلبه در یک بازه زمانی مشخص به همراه ذکر علت جهت تایید و اعمال خودکار در محاسبه شهریه
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === 'create'
                ? "bg-white text-indigo-700 shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Edit3 size={14} />
            <span>تنظیم و ارسال گزارش بازه‌ای</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === 'history'
                ? "bg-white text-indigo-700 shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Clock size={14} />
            <span>سوابق گزارش‌های ارسالی</span>
            {reports.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-mono font-bold">
                {reports.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* CREATE TAB */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Form Header Info Box */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-300 font-bold mb-1.5">عنوان گزارش ارسالی:</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  placeholder="مثلاً: گزارش تشویقی‌ها و کسورات مهرماه ۱۴۰۳"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-bold mb-1.5">ماه یا دوره مربوطه:</label>
                <input
                  type="text"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  placeholder="مثلاً: مهر ۱۴۰۳"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-bold mb-1.5">از تاریخ (شروع بازه):</label>
                <ShamsiDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="تاریخ شروع"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-bold mb-1.5">تا تاریخ (پایان بازه):</label>
                <ShamsiDatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="تاریخ پایان"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800">
              <label className="block text-xs text-slate-300 font-bold mb-1.5">یادداشت کلی مسئول آموزش برای مسئول مالی:</label>
              <input
                type="text"
                value={reportNotes}
                onChange={e => setReportNotes(e.target.value)}
                placeholder="توضیحات تکمیلی یا پیام همراه برای مسئول مالی جهت اعمال در محاسبه شهریه..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-400"
              />
            </div>

            {/* Quick Metrics of Current Report */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-800 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-400 font-bold">تعداد طلاب دارای تغییر:</span>
                <span className="font-mono font-black text-indigo-400 text-sm">
                  {adjustedItems.length} نفر
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <TrendingUp size={14} />
                  <span>مجموع مبالغ افزایش (+):</span>
                </span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  +{totalIncreaseSum.toLocaleString('fa-IR')} تومان
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 flex items-center justify-between">
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <TrendingDown size={14} />
                  <span>مجموع مبالغ کاهش (-):</span>
                </span>
                <span className="font-mono font-black text-rose-400 text-sm">
                  -{totalDecreaseSum.toLocaleString('fa-IR')} تومان
                </span>
              </div>
            </div>
          </div>

          {/* Student Filter & Actions Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی طلبه با نام یا کد ملی..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">همه پایه‌ها</option>
                <option value="پایه ۷">پایه ۷</option>
                <option value="پایه ۸">پایه ۸</option>
                <option value="پایه ۹">پایه ۹</option>
                <option value="پایه ۱۰">پایه ۱۰</option>
              </select>
            </div>

            <button
              type="button"
              disabled={isSending || adjustedItems.length === 0}
              onClick={handleSendReport}
              className={cn(
                "w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer",
                adjustedItems.length > 0 && !isSending
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              )}
            >
              <Send size={15} />
              <span>ارسال نهایی گزارش به مسئول مالی ({adjustedItems.length} مورد)</span>
            </button>
          </div>

          {/* Students List Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                    <th className="py-3 px-3">ردیف</th>
                    <th className="py-3 px-3">نام و مشخصات طلبه</th>
                    <th className="py-3 px-3">پایه</th>
                    <th className="py-3 px-3">نوع تغییر</th>
                    <th className="py-3 px-3">مبلغ تغییر (تومان)</th>
                    <th className="py-3 px-3">علت و توضیحات آموزش</th>
                    <th className="py-3 px-3 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 font-bold">
                        طلبه‌ای با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const item = itemsMap[st.id] || {
                        studentId: st.id,
                        studentName: st.name,
                        nationalId: st.nationalId,
                        grade: st.grade,
                        type: 'none',
                        amount: 0,
                        reason: ''
                      };
                      const hasChange = item.type !== 'none' && (item.amount || 0) > 0;

                      return (
                        <tr
                          key={st.id}
                          className={cn(
                            "transition-colors",
                            item.type === 'increase' && (item.amount || 0) > 0 ? "bg-emerald-50/40" : "",
                            item.type === 'decrease' && (item.amount || 0) > 0 ? "bg-rose-50/40" : "",
                            item.type === 'none' ? "hover:bg-slate-50/70" : ""
                          )}
                        >
                          <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <span className="font-black text-slate-900 block">{st.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              کد ملی: {st.nationalId || '---'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-bold">{st.grade || '---'}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleItemChange(st.id, 'type', item.type === 'increase' ? 'none' : 'increase')}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer",
                                  item.type === 'increase'
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                                )}
                              >
                                <Plus size={12} />
                                <span>افزایش</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemChange(st.id, 'type', item.type === 'decrease' ? 'none' : 'decrease')}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer",
                                  item.type === 'decrease'
                                    ? "bg-rose-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                                )}
                              >
                                <Minus size={12} />
                                <span>کاهش</span>
                              </button>
                              {item.type !== 'none' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleItemChange(st.id, 'type', 'none');
                                    handleItemChange(st.id, 'amount', 0);
                                    handleItemChange(st.id, 'reason', '');
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 text-[10px]"
                                  title="حذف تغییر"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              disabled={item.type === 'none'}
                              value={item.amount || ''}
                              onChange={e => handleItemChange(st.id, 'amount', Number(e.target.value))}
                              placeholder={item.type === 'none' ? 'بدون تغییر' : 'مبلغ به تومان'}
                              className={cn(
                                "w-36 px-2.5 py-1.5 border rounded-xl font-mono text-xs outline-none transition-all",
                                item.type === 'none'
                                  ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                  : item.type === 'increase'
                                  ? "bg-white border-emerald-300 text-emerald-800 focus:ring-1 focus:ring-emerald-500 font-bold"
                                  : "bg-white border-rose-300 text-rose-800 focus:ring-1 focus:ring-rose-500 font-bold"
                              )}
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              disabled={item.type === 'none'}
                              value={item.reason || ''}
                              onChange={e => handleItemChange(st.id, 'reason', e.target.value)}
                              placeholder={
                                item.type === 'increase'
                                  ? "مثلاً: پاداش پژوهش برتر یا فعالیت شاخص"
                                  : item.type === 'decrease'
                                  ? "مثلاً: جریمه تاخیر مکرر یا بی‌نظمی آموزشی"
                                  : "بدون تغییر"
                              }
                              className={cn(
                                "w-full min-w-[200px] px-2.5 py-1.5 border rounded-xl text-xs outline-none transition-all",
                                item.type === 'none'
                                  ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                  : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"
                              )}
                            />
                          </td>
                          <td className="py-3 px-3 text-center">
                            {hasChange ? (
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                                item.type === 'increase' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                              )}>
                                {item.type === 'increase' ? <Plus size={10} /> : <Minus size={10} />}
                                {(item.amount || 0).toLocaleString('fa-IR')}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-medium">عادی</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">سوابق گزارش‌های مالی ارسالی به امور مالی</h3>
              <p className="text-xs text-slate-500 mt-0.5">مشاهده وضعیت، بررسی و گزارش‌های قبلی</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.length === 0 ? (
              <div className="col-span-full bg-white rounded-3xl p-10 text-center border border-slate-200 text-slate-400 font-bold">
                تاکنون گزارشی برای امور مالی ارسال نشده است.
              </div>
            ) : (
              reports.map(rep => {
                const totalInc = (rep.items || [])
                  .filter(it => it.type === 'increase')
                  .reduce((acc, it) => acc + (it.amount || 0), 0);
                const totalDec = (rep.items || [])
                  .filter(it => it.type === 'decrease')
                  .reduce((acc, it) => acc + (it.amount || 0), 0);

                return (
                  <div
                    key={rep.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-indigo-200 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-indigo-600 block">
                            ماه: {rep.month}
                          </span>
                          <h4 className="text-sm font-black text-slate-900 mt-0.5">{rep.title}</h4>
                        </div>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-black shrink-0",
                            rep.status === 'applied'
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : rep.status === 'reviewed'
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : rep.status === 'rejected'
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          )}
                        >
                          {rep.status === 'applied' && 'اعمال شده در شهریه'}
                          {rep.status === 'reviewed' && 'بررسی شده'}
                          {rep.status === 'rejected' && 'رد شده'}
                          {rep.status === 'sent' && 'در انتظار بررسی مالی'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="flex justify-between">
                          <span>تعداد طلاب مشمول:</span>
                          <span className="font-mono font-bold">{rep.items?.length || 0} نفر</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>مجموع افزایش:</span>
                          <span className="font-mono">+{totalInc.toLocaleString('fa-IR')} ت</span>
                        </div>
                        <div className="flex justify-between text-rose-700 font-bold">
                          <span>مجموع کاهش:</span>
                          <span className="font-mono">-{totalDec.toLocaleString('fa-IR')} ت</span>
                        </div>
                      </div>

                      {rep.notes && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50/50 p-2 rounded-xl">
                          «{rep.notes}»
                        </p>
                      )}

                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
                        <span>ارسال‌کننده: {rep.senderUserName}</span>
                        <span>{new Date(rep.createdAt).toLocaleDateString('fa-IR')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-4 mt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedReportDetail(rep)}
                        className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                      >
                        مشاهده تفصیل
                      </button>

                      {rep.status === 'sent' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(rep.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-rose-200"
                          title="حذف گزارش"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedReportDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8"
              dir="rtl"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black">{selectedReportDetail.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span>ماه: {selectedReportDetail.month}</span>
                    <span>•</span>
                    <span>ارسال توسط: {selectedReportDetail.senderUserName}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReportDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-3">نام طلبه</th>
                        <th className="py-2.5 px-3">پایه</th>
                        <th className="py-2.5 px-3">نوع</th>
                        <th className="py-2.5 px-3">مبلغ (تومان)</th>
                        <th className="py-2.5 px-3">علت افزایش/کاهش</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReportDetail.items?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{it.studentName}</td>
                          <td className="py-2.5 px-3 text-slate-600">{it.grade}</td>
                          <td className="py-2.5 px-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md font-bold text-[10px]",
                              it.type === 'increase' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            )}>
                              {it.type === 'increase' ? 'افزایش (+)' : 'کاهش (-)'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold">
                            {(it.amount || 0).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{it.reason || '---'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedReportDetail(null)}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-all"
                  >
                    بستن
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
