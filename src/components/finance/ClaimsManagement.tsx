import React, { useState, useEffect, useMemo } from 'react';
import { 
  HandCoins, 
  Users, 
  Landmark, 
  Plus, 
  Search, 
  Check, 
  X, 
  Settings, 
  FileSpreadsheet, 
  Printer, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  PauseCircle, 
  PlayCircle,
  Building2,
  DollarSign,
  Tag,
  Clock,
  Filter,
  Layers,
  ArrowUpDown,
  BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Student, 
  FinanceDestinationAccount, 
  FinanceClaimCategory, 
  StudentClaimRecord 
} from '../../types';

interface ClaimsManagementProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function ClaimsManagement({ onNavigateTab }: ClaimsManagementProps) {
  const { currentUser, isReadOnly } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'claims_list' | 'settings'>('claims_list');
  const [claims, setClaims] = useState<StudentClaimRecord[]>([]);
  const [categories, setCategories] = useState<FinanceClaimCategory[]>([]);
  const [destinationAccounts, setDestinationAccounts] = useState<FinanceDestinationAccount[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');

  // Modals
  const [isBatchCreateOpen, setIsBatchCreateOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<StudentClaimRecord | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceDestinationAccount | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinanceClaimCategory | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  // Batch Claim Form States
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [batchDestinationAccountId, setBatchDestinationAccountId] = useState('');
  const [batchTotalDebt, setBatchTotalDebt] = useState<number>(1000000);
  const [batchMonthlyDeduction, setBatchMonthlyDeduction] = useState<number>(200000);
  const [batchStartDate, setBatchStartDate] = useState(getTodayShamsi());
  const [batchNotes, setBatchNotes] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [batchStudentSearch, setBatchStudentSearch] = useState('');
  const [batchGradeFilter, setBatchGradeFilter] = useState('all');

  // Destination Account Form States
  const [accTitle, setAccTitle] = useState('');
  const [accBankName, setAccBankName] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [accSheba, setAccSheba] = useState('');
  const [accHolder, setAccHolder] = useState('');
  const [accDescription, setAccDescription] = useState('');

  // Category Form States
  const [catTitle, setCatTitle] = useState('');
  const [catDefaultAccountId, setCatDefaultAccountId] = useState('');
  const [catDescription, setCatDescription] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedClaims, storedCats, storedAccounts, storedStudents] = await Promise.all([
        localDb.getDocs<StudentClaimRecord>('finance_student_claims'),
        localDb.getDocs<FinanceClaimCategory>('finance_claim_categories'),
        localDb.getDocs<FinanceDestinationAccount>('finance_destination_accounts'),
        localDb.getDocs<Student>('students')
      ]);

      setStudents(storedStudents || []);

      // Seed Initial Destination Accounts if empty
      let currentAccounts = storedAccounts || [];
      if (!currentAccounts || currentAccounts.length === 0) {
        const defaultAccounts: FinanceDestinationAccount[] = [
          {
            id: 'acc-cultural',
            title: 'حساب مسئول فرهنگی (عتبات، اردوها و مراسمات)',
            bankName: 'بانک صادرات',
            accountNumber: '0215588990001',
            shebaNumber: 'IR120190000000215588990001',
            accountHolder: 'امور فرهنگی و اردویی',
            description: 'جهت واریز هزینه‌های کسر شده بابت عتبات عالیات، مشهد مقدس و اردوهای طلاب',
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc-kitchen',
            title: 'حساب آشپزخانه و پذیرایی مرکزی',
            bankName: 'بانک ملی',
            accountNumber: '0109988776655',
            shebaNumber: 'IR650170000000109988776655',
            accountHolder: 'کیترینگ و آشپزخانه کوثر',
            description: 'جهت تسویه هزینه‌های نهار و شام طلاب با آشپزخانه',
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc-fund',
            title: 'حساب صندوق قرض‌الحسنه طلاب',
            bankName: 'بانک رسالت',
            accountNumber: '10.55443322.1',
            shebaNumber: 'IR880700001055443322000001',
            accountHolder: 'صندوق قرض‌الحسنه صاحب‌الزمان (عج)',
            description: 'جهت واریز اقساط وام‌های دریافتی و کمک‌های داوطلبانه به صندوق',
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc-library',
            title: 'حساب کتابخانه و کتب درسی',
            bankName: 'بانک تجارت',
            accountNumber: '4455667788',
            shebaNumber: 'IR330180000000445566778899',
            accountHolder: 'واحد پژوهش و کتابخانه',
            description: 'جهت واریز مبالغ خرید کتب و جزوات درسی طلاب',
            createdAt: new Date().toISOString()
          }
        ];
        for (const acc of defaultAccounts) {
          await localDb.setDoc('finance_destination_accounts', acc);
        }
        currentAccounts = defaultAccounts;
      }
      setDestinationAccounts(currentAccounts);

      // Seed Initial Categories if empty
      let currentCats = storedCats || [];
      if (!currentCats || currentCats.length === 0) {
        const defaultCats: FinanceClaimCategory[] = [
          {
            id: 'cat-atabat',
            title: 'وام اردو عتبات عالیات',
            defaultDestinationAccountId: 'acc-cultural',
            description: 'بدهی هزینه سفر عتبات عالیات و پیاده‌روی اربعین',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-books',
            title: 'بدهی کتب درسی و نرم‌افزار',
            defaultDestinationAccountId: 'acc-library',
            description: 'خرید دوره‌های کتب فقه و اصول و نرم‌افزارهای نور',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-mashhad',
            title: 'اردوی زیارتی مشهد مقدس',
            defaultDestinationAccountId: 'acc-cultural',
            description: 'سهم طلبه از هزینه ایاب و ذهاب و اسکان اردوی مشهد',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-damage',
            title: 'خسارت و جبران تجهیزات',
            defaultDestinationAccountId: 'acc-fund',
            description: 'جبران خسارت وسایل خوابگاه یا مَدرَس‌ها',
            createdAt: new Date().toISOString()
          }
        ];
        for (const cat of defaultCats) {
          await localDb.setDoc('finance_claim_categories', cat);
        }
        currentCats = defaultCats;
      }
      setCategories(currentCats);

      // Seed Initial Claims if empty
      if (storedClaims && storedClaims.length > 0) {
        setClaims(storedClaims);
      } else {
        const activeStuds = (storedStudents || []).filter(s => s.isActive);
        const initialClaims: StudentClaimRecord[] = [];
        
        if (activeStuds.length >= 3) {
          initialClaims.push({
            id: 'clm-1',
            claimCategoryId: 'cat-atabat',
            claimTitle: 'وام اردو عتبات عالیات',
            destinationAccountId: 'acc-cultural',
            destinationAccountTitle: 'حساب مسئول فرهنگی (عتبات، اردوها و مراسمات)',
            destinationBankInfo: 'بانک صادرات - IR120190000000215588990001',
            studentId: activeStuds[0].id,
            studentName: activeStuds[0].name,
            nationalId: activeStuds[0].nationalId,
            grade: activeStuds[0].grade,
            totalDebtAmount: 2000000,
            monthlyDeductionAmount: 200000,
            paidAmount: 600000,
            remainingAmount: 1400000,
            status: 'active',
            startDate: '۱۴۰۳/۰۵/۰۱',
            notes: 'قسط ۴ از ۱۰',
            createdAt: new Date().toISOString()
          });

          initialClaims.push({
            id: 'clm-2',
            claimCategoryId: 'cat-atabat',
            claimTitle: 'وام اردو عتبات عالیات',
            destinationAccountId: 'acc-cultural',
            destinationAccountTitle: 'حساب مسئول فرهنگی (عتبات، اردوها و مراسمات)',
            destinationBankInfo: 'بانک صادرات - IR120190000000215588990001',
            studentId: activeStuds[1].id,
            studentName: activeStuds[1].name,
            nationalId: activeStuds[1].nationalId,
            grade: activeStuds[1].grade,
            totalDebtAmount: 2000000,
            monthlyDeductionAmount: 200000,
            paidAmount: 400000,
            remainingAmount: 1600000,
            status: 'active',
            startDate: '۱۴۰۳/۰۶/۰۱',
            notes: 'قسط ۳ از ۱۰',
            createdAt: new Date().toISOString()
          });

          initialClaims.push({
            id: 'clm-3',
            claimCategoryId: 'cat-books',
            claimTitle: 'بدهی کتب درسی و نرم‌افزار',
            destinationAccountId: 'acc-library',
            destinationAccountTitle: 'حساب کتابخانه و کتب درسی',
            destinationBankInfo: 'بانک تجارت - IR330180000000445566778899',
            studentId: activeStuds[2].id,
            studentName: activeStuds[2].name,
            nationalId: activeStuds[2].nationalId,
            grade: activeStuds[2].grade,
            totalDebtAmount: 600000,
            monthlyDeductionAmount: 150000,
            paidAmount: 300000,
            remainingAmount: 300000,
            status: 'active',
            startDate: '۱۴۰۳/۰۶/۰۱',
            notes: 'خرید دوره مکاسب شیخ انصاری',
            createdAt: new Date().toISOString()
          });
        }

        for (const c of initialClaims) {
          await localDb.setDoc('finance_student_claims', c);
        }
        setClaims(initialClaims);
      }
    } catch (err) {
      console.error('Error loading claims data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.studentName?.toLowerCase().includes(q);
        const matchNat = c.nationalId?.includes(q);
        const matchTitle = c.claimTitle?.toLowerCase().includes(q);
        if (!matchName && !matchNat && !matchTitle) return false;
      }
      if (selectedCategoryFilter !== 'all' && c.claimCategoryId !== selectedCategoryFilter) {
        return false;
      }
      if (selectedStatusFilter !== 'all' && c.status !== selectedStatusFilter) {
        return false;
      }
      if (selectedGradeFilter !== 'all' && c.grade !== selectedGradeFilter) {
        return false;
      }
      return true;
    });
  }, [claims, searchQuery, selectedCategoryFilter, selectedStatusFilter, selectedGradeFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalDebt = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let monthlyDeductionSum = 0;
    let activeCount = 0;
    const studentIdsSet = new Set<string>();

    claims.forEach(c => {
      totalDebt += c.totalDebtAmount || 0;
      totalPaid += c.paidAmount || 0;
      totalRemaining += c.remainingAmount || 0;
      if (c.status === 'active') {
        activeCount++;
        monthlyDeductionSum += c.monthlyDeductionAmount || 0;
        studentIdsSet.add(c.studentId);
      }
    });

    return {
      totalDebt,
      totalPaid,
      totalRemaining,
      monthlyDeductionSum,
      activeCount,
      uniqueStudentsCount: studentIdsSet.size
    };
  }, [claims]);

  // Handle Category selection in batch modal to auto-populate destination account
  const handleBatchCategoryChange = (catId: string) => {
    setBatchCategoryId(catId);
    const foundCat = categories.find(c => c.id === catId);
    if (foundCat && foundCat.defaultDestinationAccountId) {
      setBatchDestinationAccountId(foundCat.defaultDestinationAccountId);
    }
  };

  // Filter students for batch assignment modal
  const eligibleStudentsForBatch = useMemo(() => {
    return students.filter(s => {
      if (!s.isActive) return false;
      if (batchGradeFilter !== 'all' && s.grade !== batchGradeFilter) return false;
      if (batchStudentSearch.trim()) {
        const q = batchStudentSearch.toLowerCase().trim();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchNat = s.nationalId?.includes(q);
        if (!matchName && !matchNat) return false;
      }
      return true;
    });
  }, [students, batchGradeFilter, batchStudentSearch]);

  const handleSelectAllBatchStudents = () => {
    if (selectedStudentIds.length === eligibleStudentsForBatch.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(eligibleStudentsForBatch.map(s => s.id));
    }
  };

  const handleToggleStudentInBatch = (stId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(stId) ? prev.filter(id => id !== stId) : [...prev, stId]
    );
  };

  // Submit Batch Claims
  const handleSaveBatchClaims = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCategoryId) {
      showToast('لطفاً عنوان مطالبه را انتخاب کنید.');
      return;
    }
    if (!batchDestinationAccountId) {
      showToast('لطفاً حساب واریز مقصد را مشخص کنید.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      showToast('لطفاً حداقل یک طلبه را انتخاب کنید.');
      return;
    }
    if (batchTotalDebt <= 0 || batchMonthlyDeduction <= 0) {
      showToast('مبالغ بدهی و کسر ماهانه باید بزرگتر از صفر باشند.');
      return;
    }

    const cat = categories.find(c => c.id === batchCategoryId);
    const acc = destinationAccounts.find(a => a.id === batchDestinationAccountId);
    const catTitle = cat?.title || 'مطالبه متفرقه';
    const accTitle = acc?.title || 'حساب نامشخص';
    const accBankInfo = acc ? `${acc.bankName} - ${acc.shebaNumber}` : '';

    const newClaimRecords: StudentClaimRecord[] = [];

    for (const stId of selectedStudentIds) {
      const st = students.find(s => s.id === stId);
      if (!st) continue;

      const newClaim: StudentClaimRecord = {
        id: `clm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        claimCategoryId: batchCategoryId,
        claimTitle: catTitle,
        destinationAccountId: batchDestinationAccountId,
        destinationAccountTitle: accTitle,
        destinationBankInfo: accBankInfo,
        studentId: st.id,
        studentName: st.name,
        nationalId: st.nationalId,
        grade: st.grade,
        totalDebtAmount: Number(batchTotalDebt),
        monthlyDeductionAmount: Number(batchMonthlyDeduction),
        paidAmount: 0,
        remainingAmount: Number(batchTotalDebt),
        status: 'active',
        startDate: batchStartDate || getTodayShamsi(),
        notes: batchNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('finance_student_claims', newClaim);
      newClaimRecords.push(newClaim);
    }

    setClaims(prev => [...newClaimRecords, ...prev]);
    setIsBatchCreateOpen(false);
    setSelectedStudentIds([]);
    setBatchNotes('');
    showToast(`تعداد ${newClaimRecords.length} فقره مطالبه با موفقیت ثبت شد.`);
  };

  // Edit / Update Single Claim
  const handleSaveEditClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClaim) return;

    const acc = destinationAccounts.find(a => a.id === editingClaim.destinationAccountId);
    const updated: StudentClaimRecord = {
      ...editingClaim,
      destinationAccountTitle: acc?.title || editingClaim.destinationAccountTitle,
      destinationBankInfo: acc ? `${acc.bankName} - ${acc.shebaNumber}` : editingClaim.destinationBankInfo,
      remainingAmount: Math.max(0, Number(editingClaim.totalDebtAmount) - Number(editingClaim.paidAmount)),
      status: Number(editingClaim.paidAmount) >= Number(editingClaim.totalDebtAmount) ? 'completed' : editingClaim.status,
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('finance_student_claims', updated);
    setClaims(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditingClaim(null);
    showToast('مطالبه با موفقیت ویرایش شد.');
  };

  const handleDeleteClaim = async (claimId: string) => {
    if (window.confirm('آیا از حذف این ردیف مطالبه اطمینان دارید؟')) {
      await localDb.deleteDoc('finance_student_claims', claimId);
      setClaims(prev => prev.filter(c => c.id !== claimId));
      showToast('مطالبه حذف شد.');
    }
  };

  const handleToggleClaimStatus = async (claim: StudentClaimRecord) => {
    const newStatus = claim.status === 'active' ? 'paused' : 'active';
    const updated: StudentClaimRecord = {
      ...claim,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    await localDb.setDoc('finance_student_claims', updated);
    setClaims(prev => prev.map(c => c.id === updated.id ? updated : c));
    showToast(`وضعیت مطالبه به "${newStatus === 'active' ? 'فعال' : 'متوقف'}" تغییر یافت.`);
  };

  // Account Management Handlers
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accTitle.trim() || !accBankName.trim() || !accSheba.trim()) {
      showToast('لطفاً عنوان، نام بانک و شماره شبا را تکمیل کنید.');
      return;
    }

    if (editingAccount) {
      const updated: FinanceDestinationAccount = {
        ...editingAccount,
        title: accTitle.trim(),
        bankName: accBankName.trim(),
        accountNumber: accNumber.trim(),
        shebaNumber: accSheba.trim(),
        accountHolder: accHolder.trim(),
        description: accDescription.trim(),
        updatedAt: new Date().toISOString()
      };
      await localDb.setDoc('finance_destination_accounts', updated);
      setDestinationAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast('حساب واریز مقصد با موفقیت ویرایش شد.');
    } else {
      const newAcc: FinanceDestinationAccount = {
        id: `acc-${Date.now()}`,
        title: accTitle.trim(),
        bankName: accBankName.trim(),
        accountNumber: accNumber.trim(),
        shebaNumber: accSheba.trim(),
        accountHolder: accHolder.trim(),
        description: accDescription.trim(),
        createdAt: new Date().toISOString()
      };
      await localDb.setDoc('finance_destination_accounts', newAcc);
      setDestinationAccounts(prev => [...prev, newAcc]);
      showToast('حساب واریز جدید اضافه شد.');
    }
    setIsAccountModalOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = async (accId: string) => {
    const isUsed = claims.some(c => c.destinationAccountId === accId);
    if (isUsed) {
      alert('این حساب در برخی مطالبات تعریف شده فعال است و امکان حذف آن وجود ندارد.');
      return;
    }
    if (window.confirm('آیا از حذف این حساب اطمینان دارید؟')) {
      await localDb.deleteDoc('finance_destination_accounts', accId);
      setDestinationAccounts(prev => prev.filter(a => a.id !== accId));
      showToast('حساب حذف شد.');
    }
  };

  // Category Management Handlers
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catTitle.trim() || !catDefaultAccountId) {
      showToast('لطفاً عنوان بدهی و حساب پیش‌فرض را مشخص کنید.');
      return;
    }

    if (editingCategory) {
      const updated: FinanceClaimCategory = {
        ...editingCategory,
        title: catTitle.trim(),
        defaultDestinationAccountId: catDefaultAccountId,
        description: catDescription.trim()
      };
      await localDb.setDoc('finance_claim_categories', updated);
      setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
      showToast('عنوان مطالبه با موفقیت ویرایش شد.');
    } else {
      const newCat: FinanceClaimCategory = {
        id: `cat-${Date.now()}`,
        title: catTitle.trim(),
        defaultDestinationAccountId: catDefaultAccountId,
        description: catDescription.trim(),
        createdAt: new Date().toISOString()
      };
      await localDb.setDoc('finance_claim_categories', newCat);
      setCategories(prev => [...prev, newCat]);
      showToast('عنوان مطالبه جدید اضافه شد.');
    }
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (catId: string) => {
    const isUsed = claims.some(c => c.claimCategoryId === catId);
    if (isUsed) {
      alert('این عنوان در مطالبات ثبت شده استفاده شده است و امکان حذف مستقیم آن نیست.');
      return;
    }
    if (window.confirm('آیا از حذف این عنوان مطالبه اطمینان دارید؟')) {
      await localDb.deleteDoc('finance_claim_categories', catId);
      setCategories(prev => prev.filter(c => c.id !== catId));
      showToast('عنوان مطالبه حذف شد.');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const data = filteredClaims.map((c, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی': c.studentName,
      'کد ملی': c.nationalId || '-',
      'پایه تحصیلی': c.grade || '-',
      'عنوان بدهی و مطالبه': c.claimTitle,
      'حساب مقصد واریز': c.destinationAccountTitle || '-',
      'اطلاعات بانکی مقصد': c.destinationBankInfo || '-',
      'مبلغ کل بدهی (تومان)': c.totalDebtAmount,
      'قسط ماهانه کسر از شهریه (تومان)': c.monthlyDeductionAmount,
      'کل مبالغ پرداخت شده (تومان)': c.paidAmount,
      'مانده بدهی (تومان)': c.remainingAmount,
      'وضعیت': c.status === 'active' ? 'فعال در کسر شهریه' : c.status === 'completed' ? 'تسویه شده' : 'متوقف شده',
      'تاریخ شروع': c.startDate || '-',
      'توضیحات': c.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'مطالبات طلاب');
    XLSX.writeFile(wb, `گزارش_مطالبات_طلاب_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('خروجی اکسل مطالبات با موفقیت ایجاد و دانلود شد.');
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-vazir pb-16" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-sm font-bold"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header & Sub-tabs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <HandCoins size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>مدیریت مطالبات و بدهی‌های طلاب</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  کسورات نوع دوم (ارجاعی)
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                تعریف عناوین بدهی، انتساب گروهی به طلاب، تعیین مبلغ کسر ماهانه از شهریه و تخصیص حساب‌های واریز مقصد
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (categories.length === 0 || destinationAccounts.length === 0) {
                  showToast('ابتدا در بخش تنظیمات، حداقل یک عنوان مطالبه و یک حساب مقصد تعریف کنید.');
                  setActiveSubTab('settings');
                  return;
                }
                setBatchCategoryId(categories[0]?.id || '');
                setBatchDestinationAccountId(categories[0]?.defaultDestinationAccountId || destinationAccounts[0]?.id || '');
                setSelectedStudentIds([]);
                setIsBatchCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>تعریف مطالبه جدید و ثبت گروهی</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-all cursor-pointer"
              title="خروجی فایل اکسل"
            >
              <FileSpreadsheet size={16} />
              <span>اکسل</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
              title="چاپ گزارش"
            >
              <Printer size={16} />
              <span>چاپ</span>
            </button>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <button
            onClick={() => setActiveSubTab('claims_list')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeSubTab === 'claims_list'
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            <Layers size={15} />
            <span>لیست مطالبات و اقساط ماهانه ({claims.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeSubTab === 'settings'
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            <Settings size={15} />
            <span>تنظیمات عناوین بدهی و حساب‌های واریز مقصد</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کل مبالغ مطالبات تعریف شده</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <HandCoins size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900">{stats.totalDebt.toLocaleString('fa-IR')}</span>
            <span className="text-[10px] text-slate-400 font-bold">تومان</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">تعداد {claims.length} پرونده مطالبه</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">پیش‌بینی کسر ماهانه از شهریه</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-700">{stats.monthlyDeductionSum.toLocaleString('fa-IR')}</span>
            <span className="text-[10px] text-slate-400 font-bold">تومان / ماه</span>
          </div>
          <p className="text-[10px] text-emerald-600 font-medium mt-1">در {stats.activeCount} مطالبه فعال جاری</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع وصول شده تاکنون</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-blue-700">{stats.totalPaid.toLocaleString('fa-IR')}</span>
            <span className="text-[10px] text-slate-400 font-bold">تومان</span>
          </div>
          <p className="text-[10px] text-blue-600 font-medium mt-1">
            {stats.totalDebt > 0 ? `${Math.round((stats.totalPaid / stats.totalDebt) * 100)}% پیشرفت وصول` : '۰%'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مانده وصول نشده مطالبات</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-amber-700">{stats.totalRemaining.toLocaleString('fa-IR')}</span>
            <span className="text-[10px] text-slate-400 font-bold">تومان</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">از {stats.uniqueStudentsCount} طلبه بدهکار</p>
        </div>
      </div>

      {/* Main Tab 1: Claims List */}
      {activeSubTab === 'claims_list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در نام طلبه، کد ملی یا عنوان مطالبه..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-hidden transition-all"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden focus:border-indigo-500"
              >
                <option value="all">همه عناوین بدهی</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden focus:border-indigo-500"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="active">فعال (در حال کسر)</option>
                <option value="completed">تسویه شده</option>
                <option value="paused">متوقف شده</option>
              </select>

              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden focus:border-indigo-500"
              >
                <option value="all">همه پایه‌ها</option>
                <option value="پایه ۷">پایه ۷</option>
                <option value="پایه ۸">پایه ۸</option>
                <option value="پایه ۹">پایه ۹</option>
                <option value="پایه ۱۰">پایه ۱۰</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-bold">
              نمایش {filteredClaims.length} از {claims.length} ردیف مطالبه
            </div>
          </div>

          {/* Claims Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-black">
                    <th className="py-3.5 px-3">ردیف</th>
                    <th className="py-3.5 px-3">نام و مشخصات طلبه</th>
                    <th className="py-3.5 px-3">عنوان بدهی / مطالبه</th>
                    <th className="py-3.5 px-3">حساب واریز مقصد</th>
                    <th className="py-3.5 px-3 text-center">مبلغ کل بدهی</th>
                    <th className="py-3.5 px-3 text-center">کسر ماهانه از شهریه</th>
                    <th className="py-3.5 px-3 text-center">وصول شده</th>
                    <th className="py-3.5 px-3 text-center">مانده بدهی</th>
                    <th className="py-3.5 px-3 text-center">وضعیت</th>
                    <th className="py-3.5 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <HandCoins size={36} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-bold">هیچ ردیف مطالبه‌ای با این فیلترها یافت نشد.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((claim, idx) => {
                      const percent = claim.totalDebtAmount > 0 
                        ? Math.min(100, Math.round((claim.paidAmount / claim.totalDebtAmount) * 100))
                        : 0;

                      return (
                        <tr key={claim.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3.5 px-3">
                            <div className="font-black text-slate-900">{claim.studentName}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{claim.grade || 'پایه نامشخص'}</span>
                              {claim.nationalId && <span>• کد ملی: {claim.nationalId}</span>}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-bold border border-indigo-100">
                              <Tag size={12} className="text-indigo-600" />
                              <span>{claim.claimTitle}</span>
                            </div>
                            {claim.notes && (
                              <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[200px]" title={claim.notes}>
                                {claim.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-800 text-[11px]">{claim.destinationAccountTitle || '-'}</div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{claim.destinationBankInfo || '-'}</div>
                          </td>
                          <td className="py-3.5 px-3 text-center font-black text-slate-900">
                            {claim.totalDebtAmount.toLocaleString('fa-IR')}
                            <span className="text-[9px] text-slate-400 font-normal mr-1">تومان</span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-black text-emerald-700 bg-emerald-50/40">
                            {claim.monthlyDeductionAmount.toLocaleString('fa-IR')}
                            <span className="text-[9px] text-slate-400 font-normal mr-1">تومان/ماه</span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold text-blue-700">
                            <div>{claim.paidAmount.toLocaleString('fa-IR')}</div>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full mx-auto mt-1 overflow-hidden">
                              <div 
                                className="h-full bg-blue-600 rounded-full" 
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center font-black text-amber-800">
                            {claim.remainingAmount.toLocaleString('fa-IR')}
                            <span className="text-[9px] text-slate-400 font-normal mr-1">تومان</span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={cn(
                              "text-[10px] px-2.5 py-1 rounded-full font-black border inline-flex items-center gap-1",
                              claim.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              claim.status === 'completed' ? "bg-blue-50 text-blue-700 border-blue-200" :
                              "bg-slate-100 text-slate-600 border-slate-300"
                            )}>
                              {claim.status === 'active' && <CheckCircle2 size={11} />}
                              {claim.status === 'completed' && <Check size={11} />}
                              {claim.status === 'paused' && <PauseCircle size={11} />}
                              <span>
                                {claim.status === 'active' ? 'فعال (کسر شهریه)' :
                                 claim.status === 'completed' ? 'تسویه کامل' : 'متوقف'}
                              </span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleToggleClaimStatus(claim)}
                                className={cn(
                                  "p-1.5 rounded-lg border transition-all cursor-pointer",
                                  claim.status === 'active'
                                    ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                )}
                                title={claim.status === 'active' ? 'توقف کسر از شهریه' : 'فعال‌سازی مجدد کسر'}
                              >
                                {claim.status === 'active' ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                              </button>

                              <button
                                onClick={() => setEditingClaim(claim)}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-all cursor-pointer"
                                title="ویرایش مطالبه"
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                onClick={() => handleDeleteClaim(claim.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-all cursor-pointer"
                                title="حذف مطالبه"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
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

      {/* Main Tab 2: Settings (Categories & Destination Accounts) */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          {/* Section A: Destination Accounts */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Landmark size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">حساب‌های واریز مقصد (جهت ارسال به بالادستی)</h2>
                  <p className="text-xs text-slate-500">حساب‌هایی که مبالغ کسر شده از طلاب باید به تفکیک به آنها واریز شود</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingAccount(null);
                  setAccTitle('');
                  setAccBankName('');
                  setAccNumber('');
                  setAccSheba('');
                  setAccHolder('');
                  setAccDescription('');
                  setIsAccountModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن حساب واریز مقصد</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {destinationAccounts.map(acc => (
                <div key={acc.id} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{acc.title}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-100/70 text-emerald-800 font-bold rounded-md">
                        {acc.bankName}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 font-mono">
                      <div><span className="font-vazir text-slate-400 font-normal">شماره شبا: </span><span className="font-bold font-mono">{acc.shebaNumber}</span></div>
                      {acc.accountNumber && <div><span className="font-vazir text-slate-400 font-normal">شماره حساب: </span><span className="font-bold">{acc.accountNumber}</span></div>}
                      {acc.accountHolder && <div><span className="font-vazir text-slate-400 font-normal">صاحب حساب: </span><span className="font-vazir font-bold">{acc.accountHolder}</span></div>}
                    </div>

                    {acc.description && (
                      <p className="text-[10px] text-slate-500 font-vazir pt-1 border-t border-slate-200/60">
                        {acc.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-200">
                    <button
                      onClick={() => {
                        setEditingAccount(acc);
                        setAccTitle(acc.title);
                        setAccBankName(acc.bankName);
                        setAccNumber(acc.accountNumber || '');
                        setAccSheba(acc.shebaNumber);
                        setAccHolder(acc.accountHolder || '');
                        setAccDescription(acc.description || '');
                        setIsAccountModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 transition-all cursor-pointer"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-200 transition-all cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section B: Claim Categories */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Tag size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">عناوین و دسته‌بندی‌های مطالبات</h2>
                  <p className="text-xs text-slate-500">تعریف موضوعات بدهی و تعیین حساب واریز پیش‌فرض برای هر کدام</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingCategory(null);
                  setCatTitle('');
                  setCatDefaultAccountId(destinationAccounts[0]?.id || '');
                  setCatDescription('');
                  setIsCategoryModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن عنوان مطالبه جدید</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => {
                const linkedAcc = destinationAccounts.find(a => a.id === cat.defaultDestinationAccountId);
                const claimsCount = claims.filter(c => c.claimCategoryId === cat.id).length;

                return (
                  <div key={cat.id} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">{cat.title}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md border border-indigo-100">
                          {claimsCount} طلبه
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600">
                        <span className="text-slate-400 text-[10px]">حساب واریز پیش‌فرض: </span>
                        <span className="font-bold text-slate-800">{linkedAcc?.title || 'تعیین نشده'}</span>
                      </div>

                      {cat.description && (
                        <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-200">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setCatTitle(cat.title);
                          setCatDefaultAccountId(cat.defaultDestinationAccountId);
                          setCatDescription(cat.description || '');
                          setIsCategoryModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 transition-all cursor-pointer"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-200 transition-all cursor-pointer"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Batch Create Claims (تعریف مطالبه و انتساب گروهی) */}
      <AnimatePresence>
        {isBatchCreateOpen && (
          <div className="fixed inset-0 bg-[#00000055] backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">تعریف مطالبه جدید و ثبت گروهی برای طلاب</h3>
                    <p className="text-[10px] text-slate-400">انتخاب طلاب، مبلغ کل بدهی، قسط کسر ماهانه و حساب واریز مقصد</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBatchCreateOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveBatchClaims} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {/* Claim Title & Destination Account */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان مطالبه / بدهی *</label>
                    <select
                      value={batchCategoryId}
                      onChange={(e) => handleBatchCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                      required
                    >
                      <option value="">-- انتخاب عنوان بدهی --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">حساب واریز مقصد (کسر شده واریز شود به) *</label>
                    <select
                      value={batchDestinationAccountId}
                      onChange={(e) => setBatchDestinationAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                      required
                    >
                      <option value="">-- انتخاب حساب مقصد --</option>
                      {destinationAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.title} ({a.bankName})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">مبلغ کل بدهی هر طلبه (تومان) *</label>
                    <input
                      type="number"
                      value={batchTotalDebt}
                      onChange={(e) => setBatchTotalDebt(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-hidden focus:border-indigo-500"
                      placeholder="مثلاً 2000000"
                      min={0}
                      step={50000}
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{batchTotalDebt.toLocaleString('fa-IR')} تومان</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">مبلغ کسر ماهانه از شهریه (تومان) *</label>
                    <input
                      type="number"
                      value={batchMonthlyDeduction}
                      onChange={(e) => setBatchMonthlyDeduction(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-emerald-700 outline-hidden focus:border-emerald-500"
                      placeholder="مثلاً 200000"
                      min={0}
                      step={10000}
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{batchMonthlyDeduction.toLocaleString('fa-IR')} تومان در ماه</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">تاریخ شروع کسر</label>
                    <input
                      type="text"
                      value={batchStartDate}
                      onChange={(e) => setBatchStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-indigo-500 font-mono"
                      placeholder="۱۴۰۳/۰۷/۰۱"
                    />
                  </div>
                </div>

                {/* Student Multi-Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Users size={15} className="text-indigo-600" />
                      <span>انتخاب طلاب مشمول این بدهی</span>
                      <span className="text-[10px] px-2 py-0.2 bg-indigo-100 text-indigo-700 rounded-full font-bold">
                        {selectedStudentIds.length} نفر انتخاب شده
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleSelectAllBatchStudents}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      {selectedStudentIds.length === eligibleStudentsForBatch.length ? 'لغو انتخاب همه' : 'انتخاب همه لیست'}
                    </button>
                  </div>

                  {/* Filter inside student picker */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={batchStudentSearch}
                        onChange={(e) => setBatchStudentSearch(e.target.value)}
                        placeholder="جستجوی طلبه..."
                        className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden"
                      />
                    </div>
                    <select
                      value={batchGradeFilter}
                      onChange={(e) => setBatchGradeFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-hidden"
                    >
                      <option value="all">همه پایه‌ها</option>
                      <option value="پایه ۷">پایه ۷</option>
                      <option value="پایه ۸">پایه ۸</option>
                      <option value="پایه ۹">پایه ۹</option>
                      <option value="پایه ۱۰">پایه ۱۰</option>
                    </select>
                  </div>

                  {/* Students Checkbox Grid */}
                  <div className="border border-slate-200 rounded-2xl p-2 max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50/50">
                    {eligibleStudentsForBatch.map(s => {
                      const isSelected = selectedStudentIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleToggleStudentInBatch(s.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all",
                            isSelected 
                              ? "bg-indigo-50/90 border-indigo-300 text-indigo-900 font-bold" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors",
                            isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                          )}>
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </div>
                          <span className="truncate flex-1">{s.name}</span>
                          <span className="text-[9px] text-slate-400 shrink-0">{s.grade}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات و یادداشت</label>
                  <input
                    type="text"
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    placeholder="توضیحات تکمیلی، شماره مصوبه، تعداد اقساط و..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Batch Summary */}
                {selectedStudentIds.length > 0 && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-xs space-y-1 text-indigo-950">
                    <div className="font-black flex items-center justify-between">
                      <span>خلاصه ثبت دسته‌ای:</span>
                      <span>{selectedStudentIds.length} طلبه</span>
                    </div>
                    <div className="text-[11px] flex items-center justify-between">
                      <span>مجموع کل بدهی ثبت شونده:</span>
                      <span className="font-bold">{(selectedStudentIds.length * batchTotalDebt).toLocaleString('fa-IR')} تومان</span>
                    </div>
                    <div className="text-[11px] flex items-center justify-between">
                      <span>مجموع کسر ماهانه از شهریه طلاب:</span>
                      <span className="font-bold text-emerald-700">{(selectedStudentIds.length * batchMonthlyDeduction).toLocaleString('fa-IR')} تومان/ماه</span>
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBatchCreateOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
                  >
                    ثبت و اعمال مطالبات برای {selectedStudentIds.length} طلبه
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Edit Single Claim */}
      <AnimatePresence>
        {editingClaim && (
          <div className="fixed inset-0 bg-[#00000055] backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900">ویرایش مطالبه: {editingClaim.studentName}</h3>
                <button
                  onClick={() => setEditingClaim(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEditClaim} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان مطالبه</label>
                  <input
                    type="text"
                    value={editingClaim.claimTitle}
                    onChange={(e) => setEditingClaim({ ...editingClaim, claimTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حساب واریز مقصد</label>
                  <select
                    value={editingClaim.destinationAccountId}
                    onChange={(e) => setEditingClaim({ ...editingClaim, destinationAccountId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {destinationAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.title} ({a.bankName})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ کل بدهی (تومان)</label>
                    <input
                      type="number"
                      value={editingClaim.totalDebtAmount}
                      onChange={(e) => setEditingClaim({ ...editingClaim, totalDebtAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">قسط ماهانه کسر (تومان)</label>
                    <input
                      type="number"
                      value={editingClaim.monthlyDeductionAmount}
                      onChange={(e) => setEditingClaim({ ...editingClaim, monthlyDeductionAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-700"
                      min={0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ پرداخت شده تاکنون</label>
                    <input
                      type="number"
                      value={editingClaim.paidAmount}
                      onChange={(e) => setEditingClaim({ ...editingClaim, paidAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-700"
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">وضعیت مطالبه</label>
                    <select
                      value={editingClaim.status}
                      onChange={(e) => setEditingClaim({ ...editingClaim, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="active">فعال (در حال کسر)</option>
                      <option value="completed">تسویه کامل</option>
                      <option value="paused">متوقف شده</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">یادداشت و توضیحات</label>
                  <input
                    type="text"
                    value={editingClaim.notes || ''}
                    onChange={(e) => setEditingClaim({ ...editingClaim, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingClaim(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ذخیره تغییرات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Destination Account Form */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <div className="fixed inset-0 bg-[#00000055] backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900">
                  {editingAccount ? 'ویرایش حساب واریز مقصد' : 'افزودن حساب واریز مقصد جدید'}
                </h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="p-1 rounded-lg text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان حساب *</label>
                  <input
                    type="text"
                    value={accTitle}
                    onChange={(e) => setAccTitle(e.target.value)}
                    placeholder="مثلاً: حساب مسئول فرهنگی (عتبات و اردو)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نام بانک *</label>
                    <input
                      type="text"
                      value={accBankName}
                      onChange={(e) => setAccBankName(e.target.value)}
                      placeholder="مثلاً: بانک صادرات"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نام صاحب حساب</label>
                    <input
                      type="text"
                      value={accHolder}
                      onChange={(e) => setAccHolder(e.target.value)}
                      placeholder="مثلاً: امور فرهنگی"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">شماره شبا (IBAN) *</label>
                  <input
                    type="text"
                    value={accSheba}
                    onChange={(e) => setAccSheba(e.target.value)}
                    placeholder="IR120190000000215588990001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">شماره حساب</label>
                  <input
                    type="text"
                    value={accNumber}
                    onChange={(e) => setAccNumber(e.target.value)}
                    placeholder="0215588990001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات و بابت</label>
                  <input
                    type="text"
                    value={accDescription}
                    onChange={(e) => setAccDescription(e.target.value)}
                    placeholder="توضیح جهت درج در صورت وضعیت بالادستی"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ذخیره حساب
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Category Form */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-[#00000055] backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900">
                  {editingCategory ? 'ویرایش عنوان مطالبه' : 'افزودن عنوان مطالبه جدید'}
                </h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-1 rounded-lg text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان مطالبه / بدهی *</label>
                  <input
                    type="text"
                    value={catTitle}
                    onChange={(e) => setCatTitle(e.target.value)}
                    placeholder="مثلاً: وام اردو عتبات، بدهی کتب درسی"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حساب واریز پیش‌فرض *</label>
                  <select
                    value={catDefaultAccountId}
                    onChange={(e) => setCatDefaultAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    required
                  >
                    <option value="">-- انتخاب حساب پیش‌فرض --</option>
                    {destinationAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.title} ({a.bankName})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات</label>
                  <input
                    type="text"
                    value={catDescription}
                    onChange={(e) => setCatDescription(e.target.value)}
                    placeholder="توضیحات مختصر درباره این عنوان بدهی"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ذخیره عنوان مطالبه
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
