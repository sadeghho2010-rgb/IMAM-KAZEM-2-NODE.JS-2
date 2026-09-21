import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartHandshake, 
  Users, 
  GraduationCap, 
  Briefcase, 
  Search, 
  Save, 
  CheckCircle2, 
  Calendar, 
  FileSpreadsheet, 
  Printer, 
  User, 
  Coins, 
  Clock, 
  TrendingUp, 
  Filter, 
  Info,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { ShamsiDatePicker } from '../ShamsiDatePicker';

export interface FundDonationConfig {
  id: string;
  personId: string;
  personType: 'student' | 'teacher' | 'staff';
  personName: string;
  monthlyAmount: number;
  gradeOrRole?: string;
  nationalId?: string;
  updatedAt?: string;
}

export interface FundDonation {
  id: string;
  personId: string;
  personType: 'student' | 'teacher' | 'staff';
  personName: string;
  amount: number;
  periodTitle?: string;
  deductionDate?: string;
  isConfirmed: boolean;
  confirmedAt?: string;
  confirmedByName?: string;
}

export default function FundDonations() {
  const { currentUser } = useAuth();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'configs' | 'monthly_report' | 'individual_report'>('configs');
  const [configSubTab, setConfigSubTab] = useState<'student' | 'teacher' | 'staff'>('student');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');

  // Date filters for reports
  const today = getTodayShamsi();
  const defaultStart = today.substring(0, 8) + '01';
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);

  // Individual report selection
  const [selectedIndividualId, setSelectedIndividualId] = useState('');

  // Core Data
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [configs, setConfigs] = useState<FundDonationConfig[]>([]);
  const [donations, setDonations] = useState<FundDonation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Form editing state for configs
  const [monthlyInputs, setMonthlyInputs] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [studs, tchs, stff, cfgs, dons] = await Promise.all([
        localDb.getDocs('students'),
        localDb.getDocs('teachers'),
        localDb.getDocs('finance_staff'),
        localDb.getDocs<FundDonationConfig>('fund_donation_configs'),
        localDb.getDocs<FundDonation>('fund_donations')
      ]);

      setStudents(studs || []);
      setTeachers(tchs || []);
      setStaff(stff && stff.length > 0 ? stff : [
        { id: 'st-1', name: 'حجت‌الاسلام حسینی', role: 'مدیر مدرسه' },
        { id: 'st-2', name: 'استاد شاه‌فضل', role: 'مسئول آموزش' },
        { id: 'st-3', name: 'آقای صادقی', role: 'مسئول امور مالی' },
        { id: 'st-4', name: 'آقای محمدی', role: 'کادر اجرایی' }
      ]);
      setConfigs(cfgs || []);
      setDonations(dons || []);

      // Initialize inputs map
      const inputMap: Record<string, number> = {};
      (cfgs || []).forEach(c => {
        inputMap[c.personId] = c.monthlyAmount || 0;
      });
      setMonthlyInputs(inputMap);
    } catch (err) {
      console.error('Error fetching fund donations data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => {
      fetchData();
    });
    return () => unsub();
  }, []);

  // Save Config for a Person
  const handleSaveConfig = async (personId: string, personType: 'student' | 'teacher' | 'staff', personName: string, gradeOrRole?: string) => {
    setIsSaving(true);
    try {
      const amount = monthlyInputs[personId] || 0;
      const configId = `cfg-fund-${personId}`;
      const configDoc: FundDonationConfig = {
        id: configId,
        personId,
        personType,
        personName,
        monthlyAmount: amount,
        gradeOrRole,
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('fund_donation_configs', configDoc);
      setConfigs(prev => {
        const idx = prev.findIndex(c => c.personId === personId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = configDoc;
          return next;
        }
        return [...prev, configDoc];
      });

      showToast(`مبلغ کمک ماهانه برای "${personName}" به میزان ${amount.toLocaleString('fa-IR')} تومان ثبت گردید.`);
    } catch (err) {
      console.error('Error saving fund config:', err);
      alert('خطا در ذخیره مبلغ کمک به صندوق.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered persons list for config tab
  const currentPersons = useMemo(() => {
    if (configSubTab === 'student') {
      return students.filter(s => {
        const matchesQuery = !searchQuery || s.name?.includes(searchQuery) || s.nationalId?.includes(searchQuery);
        const matchesGrade = gradeFilter === 'all' || s.grade === gradeFilter;
        return matchesQuery && matchesGrade;
      }).map(s => ({
        id: s.id,
        name: s.name,
        type: 'student' as const,
        gradeOrRole: s.grade,
        nationalId: s.nationalId
      }));
    } else if (configSubTab === 'teacher') {
      return teachers.filter(t => !searchQuery || t.name?.includes(searchQuery)).map(t => ({
        id: t.id,
        name: t.name,
        type: 'teacher' as const,
        gradeOrRole: t.specialty || 'استاد',
        nationalId: t.phone || '-'
      }));
    } else {
      return staff.filter(st => !searchQuery || st.name?.includes(searchQuery)).map(st => ({
        id: st.id,
        name: st.name,
        type: 'staff' as const,
        gradeOrRole: st.role || 'کادر',
        nationalId: '-'
      }));
    }
  }, [configSubTab, students, teachers, staff, searchQuery, gradeFilter]);

  // Confirmed Donations List filtered by date range
  const confirmedDonationsInPeriod = useMemo(() => {
    return donations.filter(d => {
      if (!d.isConfirmed) return false;
      if (d.deductionDate) {
        return d.deductionDate >= startDate && d.deductionDate <= endDate;
      }
      return true;
    });
  }, [donations, startDate, endDate]);

  // Report Summary
  const reportSummary = useMemo(() => {
    const totalAmount = confirmedDonationsInPeriod.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const count = confirmedDonationsInPeriod.length;
    const studentTotal = confirmedDonationsInPeriod.filter(d => d.personType === 'student').reduce((a, b) => a + (b.amount || 0), 0);
    const teacherTotal = confirmedDonationsInPeriod.filter(d => d.personType === 'teacher').reduce((a, b) => a + (b.amount || 0), 0);
    const staffTotal = confirmedDonationsInPeriod.filter(d => d.personType === 'staff').reduce((a, b) => a + (b.amount || 0), 0);

    return { totalAmount, count, studentTotal, teacherTotal, staffTotal };
  }, [confirmedDonationsInPeriod]);

  // All Persons List for Individual Report selector
  const allPersonsList = useMemo(() => {
    const list: { id: string; name: string; typeTitle: string }[] = [];
    students.forEach(s => list.push({ id: s.id, name: `${s.name} (طلبه - ${s.grade || ''})`, typeTitle: 'طلبه' }));
    teachers.forEach(t => list.push({ id: t.id, name: `${t.name} (استاد)`, typeTitle: 'استاد' }));
    staff.forEach(st => list.push({ id: st.id, name: `${st.name} (کادر - ${st.role || ''})`, typeTitle: 'کادر' }));
    return list;
  }, [students, teachers, staff]);

  // Individual person confirmed history
  const individualHistory = useMemo(() => {
    if (!selectedIndividualId) return [];
    return donations.filter(d => d.personId === selectedIndividualId && d.isConfirmed);
  }, [selectedIndividualId, donations]);

  const individualTotalConfirmed = useMemo(() => {
    return individualHistory.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [individualHistory]);

  // Export Excel for Monthly Report
  const handleExportExcel = () => {
    try {
      const rows = confirmedDonationsInPeriod.map((item, index) => ({
        'ردیف': index + 1,
        'نام و نام خانوادگی': item.personName,
        'نوع فرد': item.personType === 'student' ? 'طلبه' : item.personType === 'teacher' ? 'استاد' : 'کادر',
        'مبلغ کمک (تومان)': item.amount || 0,
        'دوره / ماه': item.periodTitle || '-',
        'تاریخ کسر': item.deductionDate || '-',
        'وضعیت': 'تایید و قطعی شده توسط مسئول مالی'
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش کمک به صندوق');
      XLSX.writeFile(workbook, `گزارش_کمک_به_صندوق_${startDate.replace(/\//g, '-')}_تا_${endDate.replace(/\//g, '-')}.xlsx`);
      showToast('فایل اکسل گزارش با موفقیت دانلود شد.');
    } catch (err) {
      console.error('Error exporting excel:', err);
      alert('خطا در دانلود اکسل.');
    }
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-5 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 border border-emerald-500/30"
          >
            <CheckCircle2 size={18} />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 opacity-10 pointer-events-none">
          <HeartHandshake size={220} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-800/60 text-emerald-200 px-3 py-1 rounded-full text-xs font-bold mb-2 backdrop-blur-xs">
              <Coins size={14} />
              <span>مدیریت صندوق قرض‌الحسنه و کمک‌های داوطلبانه</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black">کمک به صندوق (کسر از شهریه / حق‌الزحمه)</h1>
            <p className="text-xs text-emerald-100/80 mt-1 max-w-2xl leading-relaxed font-medium">
              تعیین و کسر داوطلبانه ماهانه جهت تقویت صندوق قرض‌الحسنه حوزه. این مبالغ بدهی نبوده و با رضایت افراد از شهریه یا حق‌الزحمه کسر شده و پس از تایید نهایی مسئول مالی قطعی می‌گردد.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <HeartHandshake size={22} />
            </div>
            <div>
              <span className="block text-[10px] text-emerald-200">کل کمک‌های قطعی‌شده</span>
              <span className="text-sm font-black font-mono text-emerald-300">
                {donations.filter(d => d.isConfirmed).reduce((a, b) => a + (b.amount || 0), 0).toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-xs flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('configs')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer",
            activeTab === 'configs' 
              ? "bg-emerald-600 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <Users size={16} />
          <span>تعیین کسر ماهانه کمک به صندوق</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monthly_report')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer",
            activeTab === 'monthly_report' 
              ? "bg-emerald-600 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <Calendar size={16} />
          <span>گزارش ماهانه و دوره‌ای (کمک‌های قطعی)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('individual_report')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer",
            activeTab === 'individual_report' 
              ? "bg-emerald-600 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <User size={16} />
          <span>گزارش انفرادی هر شخص</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CONFIGS (طلاب، اساتید، کارکنان)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'configs' && (
        <div className="space-y-4">
          {/* Sub-tabs: Students, Teachers, Staff */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfigSubTab('student')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                  configSubTab === 'student' ? "bg-white text-emerald-800 shadow-xs border border-emerald-200" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <GraduationCap size={15} />
                <span>طلاب ({students.length} نفر)</span>
              </button>

              <button
                type="button"
                onClick={() => setConfigSubTab('teacher')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                  configSubTab === 'teacher' ? "bg-white text-emerald-800 shadow-xs border border-emerald-200" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Briefcase size={15} />
                <span>اساتید ({teachers.length} نفر)</span>
              </button>

              <button
                type="button"
                onClick={() => setConfigSubTab('staff')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                  configSubTab === 'staff' ? "bg-white text-emerald-800 shadow-xs border border-emerald-200" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Users size={15} />
                <span>کارکنان ({staff.length} نفر)</span>
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              {configSubTab === 'student' && (
                <select
                  value={gradeFilter}
                  onChange={e => setGradeFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl text-xs font-bold px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">همه پایه‌ها</option>
                  <option value="پایه ۷">پایه ۷</option>
                  <option value="پایه ۸">پایه ۸</option>
                  <option value="پایه ۹">پایه ۹</option>
                  <option value="پایه ۱۰">پایه ۱۰</option>
                  <option value="پایه ۱۱">پایه ۱۱</option>
                  <option value="پایه ۱۲">پایه ۱۲</option>
                </select>
              )}

              <div className="relative flex-1 md:w-64">
                <Search className="absolute right-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="جستجوی نام یا کد..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Table of Persons */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3 w-12 text-center">ردیف</th>
                    <th className="p-3">نام و نام خانوادگی</th>
                    <th className="p-3">عنوان / پایه / سمت</th>
                    <th className="p-3">کد / شناسه</th>
                    <th className="p-3">مبلغ کسر ماهانه کمک به صندوق (تومان)</th>
                    <th className="p-3 text-center">عملیات ثبت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {currentPersons.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                        هیچ فردی با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    currentPersons.map((person, index) => {
                      const currentVal = monthlyInputs[person.id] ?? 0;
                      const isSaved = configs.some(c => c.personId === person.id && c.monthlyAmount === currentVal && currentVal > 0);

                      return (
                        <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-mono">{index + 1}</td>
                          <td className="p-3 font-bold text-slate-800">{person.name}</td>
                          <td className="p-3 text-slate-600">{person.gradeOrRole || '-'}</td>
                          <td className="p-3 text-slate-500 font-mono">{person.nationalId || '-'}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 max-w-xs">
                              <input
                                type="number"
                                step="10000"
                                value={currentVal}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setMonthlyInputs(prev => ({ ...prev, [person.id]: val }));
                                }}
                                className="w-36 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-emerald-800 font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                              />
                              <span className="text-[11px] text-slate-500">تومان</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleSaveConfig(person.id, person.type, person.name, person.gradeOrRole)}
                              disabled={isSaving}
                              className={cn(
                                "px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1",
                                isSaved 
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-300" 
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              )}
                            >
                              {isSaved ? <Check size={14} /> : <Save size={14} />}
                              <span>{isSaved ? 'ثبت شده' : 'ذخیره'}</span>
                            </button>
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

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY / PERIODIC CONFIRMED REPORT                                */}
      {/* ========================================================================= */}
      {activeTab === 'monthly_report' && (
        <div className="space-y-6">
          {/* Controls & Summary Cards */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Calendar size={15} />
                  <span>بازه زمانی گزارش:</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">از</span>
                  <ShamsiDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    className="w-32 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono"
                  />
                  <span className="text-xs text-slate-500">تا</span>
                  <ShamsiDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    className="w-32 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={15} />
                  <span>خروجی اکسل</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={15} />
                  <span>چاپ</span>
                </button>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                <span className="block text-[11px] font-bold text-emerald-800">مجموع کمک‌های قطعی در بازه</span>
                <span className="text-lg font-black font-mono text-emerald-900 mt-1 block">
                  {reportSummary.totalAmount.toLocaleString('fa-IR')} تومان
                </span>
                <span className="text-[10px] text-emerald-600 mt-1 block">{reportSummary.count} مورد پرداخت قطعی</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <span className="block text-[11px] font-bold text-slate-700">سهم طلاب</span>
                <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                  {reportSummary.studentTotal.toLocaleString('fa-IR')} تومان
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <span className="block text-[11px] font-bold text-slate-700">سهم اساتید</span>
                <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                  {reportSummary.teacherTotal.toLocaleString('fa-IR')} تومان
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <span className="block text-[11px] font-bold text-slate-700">سهم کارکنان</span>
                <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
                  {reportSummary.staffTotal.toLocaleString('fa-IR')} تومان
                </span>
              </div>
            </div>
          </div>

          {/* Table of Confirmed Contributions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>ریز کمک‌های تایید و قطعی شده توسط مسئول مالی</span>
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                {confirmedDonationsInPeriod.length} تراکنش ثبت شده
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3 w-12 text-center">ردیف</th>
                    <th className="p-3">نام و نام خانوادگی</th>
                    <th className="p-3">نوع فرد</th>
                    <th className="p-3">دوره / ماه مربوطه</th>
                    <th className="p-3">تاریخ تایید و کسر</th>
                    <th className="p-3 font-mono">مبلغ کسر قطعی (تومان)</th>
                    <th className="p-3 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {confirmedDonationsInPeriod.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        در این بازه زمانی هیچ کمک قطعی‌شده‌ای ثبت نگردیده است.
                      </td>
                    </tr>
                  ) : (
                    confirmedDonationsInPeriod.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800">{item.personName}</td>
                        <td className="p-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[11px] font-bold",
                            item.personType === 'student' ? "bg-blue-50 text-blue-700" :
                            item.personType === 'teacher' ? "bg-purple-50 text-purple-700" : "bg-amber-50 text-amber-700"
                          )}>
                            {item.personType === 'student' ? 'طلبه' : item.personType === 'teacher' ? 'استاد' : 'کادر'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.periodTitle || '-'}</td>
                        <td className="p-3 text-slate-500 font-mono">{item.deductionDate || '-'}</td>
                        <td className="p-3 font-mono font-bold text-emerald-800">
                          {(item.amount || 0).toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                            <Check size={12} />
                            <span>تایید قطعی مالی</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INDIVIDUAL REPORT                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'individual_report' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <User size={16} className="text-emerald-600" />
              <span>جستجو و انتخاب شخص جهت مشاهده سوابق کمک به صندوق</span>
            </h3>

            <div className="max-w-md">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">انتخاب فرد:</label>
              <select
                value={selectedIndividualId}
                onChange={e => setSelectedIndividualId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- یک فرد را انتخاب کنید --</option>
                {allPersonsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedIndividualId && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs text-slate-500 font-bold block">مجموع کل کمک‌های قطعی‌شده این شخص از ابتدا:</span>
                  <span className="text-2xl font-black text-emerald-800 font-mono mt-1 block">
                    {individualTotalConfirmed.toLocaleString('fa-IR')} تومان
                  </span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800">تعداد ماه‌های کسر شده: {individualHistory.length} ماه</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <th className="p-3 w-12 text-center">ردیف</th>
                      <th className="p-3">عنوان دوره / ماه</th>
                      <th className="p-3">تاریخ کسر</th>
                      <th className="p-3 font-mono">مبلغ کسر شده (تومان)</th>
                      <th className="p-3 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {individualHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                          هنوز هیچ کمک قطعی‌شده‌ای برای این شخص ثبت نشده است.
                        </td>
                      </tr>
                    ) : (
                      individualHistory.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-50">
                          <td className="p-3 text-center text-slate-400 font-mono">{index + 1}</td>
                          <td className="p-3 font-bold text-slate-800">{item.periodTitle || 'دوره شهریه / حق‌الزحمه'}</td>
                          <td className="p-3 text-slate-600 font-mono">{item.deductionDate || '-'}</td>
                          <td className="p-3 font-mono font-bold text-emerald-800">
                            {(item.amount || 0).toLocaleString('fa-IR')}
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">
                              قطعی‌شده
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
