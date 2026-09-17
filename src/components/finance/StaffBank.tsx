import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  CheckCircle2, 
  Phone, 
  CreditCard, 
  UserCheck, 
  UserX, 
  FileSpreadsheet, 
  Printer, 
  Building2, 
  BadgeCheck,
  Briefcase,
  DollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { StaffMember } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

export default function StaffBank() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [roleTitle, setRoleTitle] = useState('خادم و انباردار');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bankName, setBankName] = useState('بانک تجارت');
  const [bankAccount, setBankAccount] = useState('');
  const [bankSheba, setBankSheba] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadStaffData = async () => {
    setIsLoading(true);
    try {
      let stored = await localDb.getDocs<StaffMember>('staff');
      if (!stored || stored.length === 0) {
        const initialStaff: StaffMember[] = [
          {
            id: 'staff-1',
            fullName: 'حاج احمد حسینی',
            staffCode: 'STF-101',
            nationalId: '0012345678',
            roleTitle: 'مسئول آشپزخانه و متصدی تغذیه',
            phoneNumber: '09121112233',
            bankName: 'بانک تجارت',
            bankAccount: '۶۲۷۳-۸۱۱۰-۴۴۵۵-۶۶۷۷',
            bankSheba: 'IR120180000000001234567801',
            monthlySalary: 12000000,
            isActive: true,
            notes: 'مسئول اصلی طبخ و توزیع غذای طلاب و اساتید',
            createdAt: new Date().toISOString()
          },
          {
            id: 'staff-2',
            fullName: 'کربلایی محمد محمدی',
            staffCode: 'STF-102',
            nationalId: '0023456789',
            roleTitle: 'خادم و انباردار',
            phoneNumber: '09122223344',
            bankName: 'بانک ملی',
            bankAccount: '۶۰۳۷-۹۹۱۱-۲۲۳۳-۴۴۵۵',
            bankSheba: 'IR120170000000001234567802',
            monthlySalary: 10500000,
            isActive: true,
            notes: 'تحویل‌دار انبار مواد غذایی و خدمات عمومی',
            createdAt: new Date().toISOString()
          },
          {
            id: 'staff-3',
            fullName: 'آقای رضا تقوی',
            staffCode: 'STF-103',
            nationalId: '0034567890',
            roleTitle: 'راننده و خدمات تاسیسات',
            phoneNumber: '09123334455',
            bankName: 'بانک ملت',
            bankAccount: '۶۱۰۴-۳۳۷۷-۵۵۶۶-۷۷۸۸',
            bankSheba: 'IR120120000000001234567803',
            monthlySalary: 11000000,
            isActive: true,
            notes: 'راننده سرویس پشتیبانی و نگهداری تاسیسات',
            createdAt: new Date().toISOString()
          },
          {
            id: 'staff-4',
            fullName: 'آقای علیرضا علوی',
            staffCode: 'STF-104',
            nationalId: '0045678901',
            roleTitle: 'مسئول دفتر و دبیرخانه',
            phoneNumber: '09124445566',
            bankName: 'بانک سپه',
            bankAccount: '۵۸۹۲-۱۰۱۲-۶۶۷۷-۸۸۹۹',
            bankSheba: 'IR120150000000001234567804',
            monthlySalary: 11500000,
            isActive: true,
            notes: 'پیگیری امور اداری و ثبت نامه‌های جاری',
            createdAt: new Date().toISOString()
          }
        ];

        for (const item of initialStaff) {
          await localDb.setDoc('staff', item.id, item);
        }
        stored = initialStaff;
      }
      setStaffList(stored);
    } catch (e) {
      console.error('Error loading staff data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, []);

  const openAddModal = () => {
    setEditingStaff(null);
    setFullName('');
    setStaffCode(`STF-${Math.floor(100 + Math.random() * 900)}`);
    setNationalId('');
    setRoleTitle('خادم و انباردار');
    setPhoneNumber('');
    setBankName('بانک تجارت');
    setBankAccount('');
    setBankSheba('');
    setMonthlySalary('10000000');
    setIsActive(true);
    setNotes('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFullName(staff.fullName || '');
    setStaffCode(staff.staffCode || '');
    setNationalId(staff.nationalId || '');
    setRoleTitle(staff.roleTitle || 'خادم و انباردار');
    setPhoneNumber(staff.phoneNumber || '');
    setBankName(staff.bankName || 'بانک تجارت');
    setBankAccount(staff.bankAccount || '');
    setBankSheba(staff.bankSheba || '');
    setMonthlySalary(staff.monthlySalary ? String(staff.monthlySalary) : '');
    setIsActive(staff.isActive !== false);
    setNotes(staff.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!fullName.trim()) {
      alert('لطفاً نام و نام خانوادگی کارمند را وارد کنید.');
      return;
    }

    const docId = editingStaff ? editingStaff.id : `staff_${Date.now()}`;
    const newStaff: StaffMember = {
      id: docId,
      fullName: fullName.trim(),
      staffCode: staffCode.trim() || `STF-${Math.floor(100 + Math.random() * 900)}`,
      nationalId: nationalId.trim(),
      roleTitle: roleTitle.trim() || 'کارمند مجموعه',
      phoneNumber: phoneNumber.trim(),
      bankName: bankName.trim(),
      bankAccount: bankAccount.trim(),
      bankSheba: bankSheba.trim(),
      monthlySalary: Number(monthlySalary) || 0,
      isActive: isActive,
      notes: notes.trim(),
      createdAt: editingStaff ? editingStaff.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('staff', docId, newStaff);

    if (editingStaff) {
      setStaffList(prev => prev.map(s => s.id === docId ? newStaff : s));
      showToast(`مشخصات کارمند "${fullName}" با موفقیت بروزرسانی شد.`);
    } else {
      setStaffList(prev => [newStaff, ...prev]);
      showToast(`کارمند جدید "${fullName}" با موفقیت ثبت شد.`);
    }

    setIsAddModalOpen(false);
  };

  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    await localDb.deleteDoc('staff', deletingStaff.id);
    setStaffList(prev => prev.filter(s => s.id !== deletingStaff.id));
    showToast(`کارمند "${deletingStaff.fullName}" از بانک کارکنان حذف شد.`);
    setDeletingStaff(null);
  };

  // Filtered List
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      const matchSearch = (s.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.staffCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.roleTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phoneNumber || '').includes(searchQuery) ||
        (s.nationalId || '').includes(searchQuery);

      const matchRole = roleFilter === 'all' || s.roleTitle.includes(roleFilter);
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && s.isActive !== false) ||
        (statusFilter === 'inactive' && s.isActive === false);

      return matchSearch && matchRole && matchStatus;
    });
  }, [staffList, searchQuery, roleFilter, statusFilter]);

  // Unique Roles for Filter
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach(s => {
      if (s.roleTitle) set.add(s.roleTitle);
    });
    return Array.from(set);
  }, [staffList]);

  // Metrics
  const metrics = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter(s => s.isActive !== false).length;
    const totalSalary = staffList.reduce((acc, s) => acc + (s.monthlySalary || 0), 0);
    return { total, active, totalSalary };
  }, [staffList]);

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredStaff.map((s, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی': s.fullName,
      'کد پرسنلی': s.staffCode || '-',
      'کد ملی': s.nationalId || '-',
      'سمت / عنوان شغلی': s.roleTitle,
      'شماره تماس': s.phoneNumber || '-',
      'بانک عامل': s.bankName || '-',
      'شماره حساب': s.bankAccount || '-',
      'شماره شبا': s.bankSheba || '-',
      'حقوق / مزایا (تومان)': s.monthlySalary || 0,
      'وضعیت': s.isActive !== false ? 'فعال' : 'غیرفعال',
      'توضیحات': s.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'لیست کارکنان');
    XLSX.writeFile(wb, `بانک_کارکنان_مجموعه_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xlsx`);
    showToast('خروجی اکسل بانک کارکنان مجموعه با موفقیت ایجاد شد.');
  };

  // Print PDF
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredStaff.map((s, idx) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${s.fullName}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${s.staffCode || '-'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${s.roleTitle}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${s.phoneNumber || '-'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${s.bankName || 'تجارت'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; text-align: center;">${s.bankAccount || '-'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; font-family: monospace;">${(s.monthlySalary || 0).toLocaleString('fa-IR')} تومان</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <title>گزارش رسمی بانک کارکنان مجموعه</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0 0 5px 0;">لیست اسامی و اطلاعات بانک کارکنان مجموعه</h2>
          <div>تاریخ تنظیم: ${new Date().toLocaleDateString('fa-IR')} | تعداد پرسنل: ${filteredStaff.length} نفر</div>
        </div>
        <table>
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 8px; border: 1px solid #cbd5e1;">ردیف</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">نام و نام خانوادگی</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">کد پرسنلی</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">سمت / عنوان شغلی</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">شماره تماس</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">بانک</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">شماره حساب</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">حقوق و مزایا</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          <div>امضاء مسئول امور مالی<br><br>...........................</div>
          <div>امضاء مدیر مجموعه<br><br>...........................</div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری بانک اطلاعات کارکنان مجموعه...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      {/* Toast Notification */}
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
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs border border-indigo-100">
            <Briefcase size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">بانک کارکنان مجموعه</h1>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-black rounded-lg">
                کادر اجرایی و خادمین
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ثبت و مدیریت کامل مشخصات پرسنل، خادمین، آشپزخانه و خدمات جهت استفاده در رزرو غذای دستی، پرداخت حقوق و امور اداری
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>خروجی اکسل</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPDF}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={15} />
            <span>نسخه چاپی</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>ثبت کارمند جدید</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کل تعداد کارکنان ثبت‌شده</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.total} <span className="text-xs font-medium text-slate-500">نفر</span>
          </div>
          <p className="text-[11px] text-slate-400">کادر اجرایی، خادمین و پشتیبانی</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کارکنان شاغل و فعال</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {metrics.active} <span className="text-xs font-medium text-slate-500">نفر فعال</span>
          </div>
          <p className="text-[11px] text-slate-400">آماده استفاده در رزرو غذا و امور مالی</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">جمع کل حقوق ماهیانه</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.totalSalary.toLocaleString('fa-IR')} <span className="text-xs font-medium text-slate-500">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">بر اساس اطلاعات پایه ثبت‌شده</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[260px] flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام، کد پرسنلی، سمت، شماره تماس..."
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">عنوان شغلی:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="all">همه سمت‌ها</option>
              {availableRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">وضعیت:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فقط فعال</option>
              <option value="inactive">فقط غیرفعال</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          تعداد یافته‌ها: <strong className="text-slate-900 font-mono">{filteredStaff.length}</strong> نفر
        </div>
      </div>

      {/* Main Staff Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                <th className="p-3.5">نام و نام خانوادگی کارمند</th>
                <th className="p-3.5 text-center">کد پرسنلی / شناسه</th>
                <th className="p-3.5 text-center">سمت و مسئولیت</th>
                <th className="p-3.5 text-center">شماره تماس</th>
                <th className="p-3.5 text-center">اطلاعات بانکی</th>
                <th className="p-3.5 text-center">حقوق ماهانه</th>
                <th className="p-3.5 text-center">وضعیت</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    هیچ کارمندی با مشخصات جستجو شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-black text-slate-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0 border border-slate-200">
                          {staff.fullName.slice(0, 1)}
                        </div>
                        <div>
                          <span>{staff.fullName}</span>
                          {staff.nationalId && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              کد ملی: {staff.nationalId}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">
                        {staff.staffCode || '-'}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg font-bold text-[11px]">
                        {staff.roleTitle}
                      </span>
                    </td>

                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                      {staff.phoneNumber ? (
                        <a href={`tel:${staff.phoneNumber}`} className="hover:text-indigo-600 transition-colors">
                          {staff.phoneNumber}
                        </a>
                      ) : '-'}
                    </td>

                    <td className="p-3.5 text-center font-mono text-slate-600">
                      <div>{staff.bankName || 'بانک تجارت'}</div>
                      <div className="text-[10px] text-slate-400">{staff.bankAccount || '-'}</div>
                    </td>

                    <td className="p-3.5 text-center font-mono font-bold text-emerald-700">
                      {staff.monthlySalary ? `${staff.monthlySalary.toLocaleString('fa-IR')} ت` : '-'}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-black border",
                        staff.isActive !== false
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      )}>
                        {staff.isActive !== false ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(staff)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="ویرایش مشخصات"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingStaff(staff)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Briefcase size={18} className="text-indigo-600" />
                <span>{editingStaff ? 'ویرایش مشخصات کارمند' : 'ثبت کارمند جدید در بانک کارکنان'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">نام و نام خانوادگی (*):</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثلاً: کربلایی محمد محمدی"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">کد پرسنلی / شناسه:</label>
                  <input
                    type="text"
                    value={staffCode}
                    onChange={(e) => setStaffCode(e.target.value)}
                    placeholder="STF-101"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">سمت / عنوان شغلی (*):</label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="مثلاً: خادم، مسئول آشپزخانه، انباردار، راننده..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">شماره تماس همراه:</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="۰۹۱۲..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">کد ملی:</label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="۰۰۱۲۳۴۵۶۷۸"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">حقوق و مزایای ماهانه (تومان):</label>
                  <input
                    type="number"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="10000000"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="font-bold text-slate-800 block">مشخصات حساب بانکی جهت حقوق/مزایا:</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="نام بانک (تجارت)"
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="شماره کارت/حساب"
                    className="p-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 col-span-2"
                  />
                </div>
                <input
                  type="text"
                  value={bankSheba}
                  onChange={(e) => setBankSheba(e.target.value)}
                  placeholder="شماره شبا (IR...)"
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 text-left"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-bold">توضیحات و یادداشت:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="سایر توضیحات تکمیلی..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-0 cursor-pointer"
                />
                <label htmlFor="isActiveCheck" className="font-bold text-slate-700 cursor-pointer">
                  کارمند فعال و مشغول به کار در مجموعه
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveStaff}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs"
              >
                {editingStaff ? 'بروزرسانی مشخصات' : 'ذخیره کارمند'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl mx-auto flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">حذف کارمند از بانک اطلاعات</h3>
              <p className="text-xs text-slate-500">
                آیا از حذف کارمند <strong className="text-slate-800">{deletingStaff.fullName}</strong> اطمینان دارید؟
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
