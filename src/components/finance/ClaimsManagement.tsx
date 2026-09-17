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
  BookOpen,
  GraduationCap,
  Briefcase,
  UserCheck,
  Receipt,
  HelpCircle,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Student, 
  Teacher,
  StaffMember,
  FinanceDestinationAccount, 
  FinanceClaimCategory, 
  StudentClaimRecord 
} from '../../types';

interface ClaimsManagementProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

type ClaimTargetGroup = 'student' | 'teacher' | 'staff';

export default function ClaimsManagement({ onNavigateTab }: ClaimsManagementProps) {
  const { currentUser, isReadOnly } = useAuth();

  // Active Main Navigation: 3 Target Sections + Bank Settings
  const [activeGroup, setActiveGroup] = useState<ClaimTargetGroup | 'settings'>('student');

  // Main Data States
  const [claims, setClaims] = useState<StudentClaimRecord[]>([]);
  const [categories, setCategories] = useState<FinanceClaimCategory[]>([]);
  const [destinationAccounts, setDestinationAccounts] = useState<FinanceDestinationAccount[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all'); // for students
  const [selectedStaffRoleFilter, setSelectedStaffRoleFilter] = useState('all'); // for staff

  // Modals
  const [isBatchCreateOpen, setIsBatchCreateOpen] = useState(false);
  const [modalTargetGroup, setModalTargetGroup] = useState<ClaimTargetGroup>('student');
  const [editingClaim, setEditingClaim] = useState<StudentClaimRecord | null>(null);
  const [settlingClaim, setSettlingClaim] = useState<StudentClaimRecord | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementMethod, setSettlementMethod] = useState<'deduction' | 'cash' | 'transfer'>('deduction');
  const [settlementDate, setSettlementDate] = useState(getTodayShamsi());
  const [settlementNotes, setSettlementNotes] = useState('');

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
  
  // Selection IDs for Batch Form
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [batchEntitySearch, setBatchEntitySearch] = useState('');
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
  const [catTargetType, setCatTargetType] = useState<ClaimTargetGroup | 'all'>('all');
  const [settingsCatFilter, setSettingsCatFilter] = useState<string>('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        storedClaims, 
        storedCats, 
        storedAccounts, 
        storedStudents, 
        storedTeachers, 
        storedStaff
      ] = await Promise.all([
        localDb.getDocs<StudentClaimRecord>('finance_student_claims'),
        localDb.getDocs<FinanceClaimCategory>('finance_claim_categories'),
        localDb.getDocs<FinanceDestinationAccount>('finance_destination_accounts'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<StaffMember>('staff')
      ]);

      setStudents(storedStudents || []);
      setTeachers(storedTeachers || []);
      setStaffList(storedStaff || []);

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
            description: 'جهت تسویه هزینه‌های نهار و شام طلاب و پرسنل با آشپزخانه',
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc-fund',
            title: 'صندوق قرض‌الحسنه کارکنان و طلاب',
            bankName: 'بانک رسالت',
            accountNumber: '10.55443322.1',
            shebaNumber: 'IR880700001055443322000001',
            accountHolder: 'صندوق قرض‌الحسنه صاحب‌الزمان (عج)',
            description: 'جهت واریز اقساط وام‌های دریافتی، مساعده‌ها و کمک‌های داوطلبانه',
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc-library',
            title: 'حساب کتابخانه، پژوهش و فناوری',
            bankName: 'بانک تجارت',
            accountNumber: '4455667788',
            shebaNumber: 'IR330180000000445566778899',
            accountHolder: 'واحد پژوهش و کتب تخصصی',
            description: 'جهت واریز مبالغ خرید کتب و جزوات درسی و نرم‌افزارهای نور',
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
          // Student Categories
          {
            id: 'cat-atabat',
            title: 'وام اردو عتبات عالیات طلاب',
            defaultDestinationAccountId: 'acc-cultural',
            targetType: 'student',
            description: 'بدهی هزینه سفر عتبات عالیات و پیاده‌روی اربعین طلاب',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-books',
            title: 'بدهی کتب درسی و نرم‌افزار طلاب',
            defaultDestinationAccountId: 'acc-library',
            targetType: 'student',
            description: 'خرید دوره‌های کتب فقه و اصول و نرم‌افزارهای نور',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-mashhad',
            title: 'اردوی زیارتی مشهد مقدس طلاب',
            defaultDestinationAccountId: 'acc-cultural',
            targetType: 'student',
            description: 'سهم طلبه از هزینه ایاب و ذهاب و اسکان اردوی مشهد',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-damage',
            title: 'خسارت و جبران تجهیزات طلاب',
            defaultDestinationAccountId: 'acc-fund',
            targetType: 'student',
            description: 'جبران خسارت وسایل خوابگاه یا مَدرَس‌ها توسط طلبه',
            createdAt: new Date().toISOString()
          },
          // Teacher Categories
          {
            id: 'cat-teacher-advance',
            title: 'مساعده و علی‌الحساب حق‌التدریس اساتید',
            defaultDestinationAccountId: 'acc-fund',
            targetType: 'teacher',
            description: 'مساعده دریافتی اساتید کسر شونده از حق‌الزحمه ماهانه',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-teacher-laptop',
            title: 'تسهیلات خرید تجهیزات و لپ‌تاپ اساتید',
            defaultDestinationAccountId: 'acc-fund',
            targetType: 'teacher',
            description: 'اقساط خرید لپ‌تاپ و تجهیزات تدریس آنلاین اساتید',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-teacher-books',
            title: 'خرید کتب و مراجع تخصصی اساتید',
            defaultDestinationAccountId: 'acc-library',
            targetType: 'teacher',
            description: 'کتب مرجع و تخصصی تهیه شده جهت تدریس استاد',
            createdAt: new Date().toISOString()
          },
          // Staff Categories
          {
            id: 'cat-staff-advance',
            title: 'مساعده حقوق و دستمزد پرسنل',
            defaultDestinationAccountId: 'acc-fund',
            targetType: 'staff',
            description: 'مساعده دریافت شده توسط کارکنان قابل کسر از حقوق ماه جاری',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-staff-loan',
            title: 'وام قرض‌الحسنه کارکنان مجموعه',
            defaultDestinationAccountId: 'acc-fund',
            targetType: 'staff',
            description: 'اقساط ماهانه وام اضطراری صندوق رفاه کارکنان',
            createdAt: new Date().toISOString()
          },
          {
            id: 'cat-staff-insurance',
            title: 'سهم بیمه تکمیلی پرسنل',
            defaultDestinationAccountId: 'acc-fund',
            targetType: 'staff',
            description: 'کسورات ماهانه بابت حق بیمه تکمیلی درمان کارکنان',
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
        // Ensure every claim has targetType set
        const normalized = storedClaims.map(c => ({
          ...c,
          targetType: c.targetType || 'student'
        }));
        setClaims(normalized);
      } else {
        const activeStuds = (storedStudents || []).filter(s => s.isActive);
        const initialClaims: StudentClaimRecord[] = [];
        
        // Seed Students Claims
        if (activeStuds.length >= 2) {
          initialClaims.push({
            id: 'clm-st-1',
            claimCategoryId: 'cat-atabat',
            claimTitle: 'وام اردو عتبات عالیات طلاب',
            targetType: 'student',
            targetId: activeStuds[0].id,
            targetName: activeStuds[0].name,
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
            id: 'clm-st-2',
            claimCategoryId: 'cat-books',
            claimTitle: 'بدهی کتب درسی و نرم‌افزار طلاب',
            targetType: 'student',
            targetId: activeStuds[1].id,
            targetName: activeStuds[1].name,
            destinationAccountId: 'acc-library',
            destinationAccountTitle: 'حساب کتابخانه، پژوهش و فناوری',
            destinationBankInfo: 'بانک تجارت - IR330180000000445566778899',
            studentId: activeStuds[1].id,
            studentName: activeStuds[1].name,
            nationalId: activeStuds[1].nationalId,
            grade: activeStuds[1].grade,
            totalDebtAmount: 600000,
            monthlyDeductionAmount: 150000,
            paidAmount: 300000,
            remainingAmount: 300000,
            status: 'active',
            startDate: '۱۴۰۳/۰۶/۰۱',
            notes: 'خرید دوره مکاسب',
            createdAt: new Date().toISOString()
          });
        }

        // Seed Teachers Claims
        const activeTeachers = (storedTeachers || []).filter(t => t.isActive);
        if (activeTeachers.length >= 1) {
          initialClaims.push({
            id: 'clm-tc-1',
            claimCategoryId: 'cat-teacher-advance',
            claimTitle: 'مساعده و علی‌الحساب حق‌التدریس اساتید',
            targetType: 'teacher',
            targetId: activeTeachers[0].id,
            targetName: activeTeachers[0].fullName,
            studentId: activeTeachers[0].id,
            studentName: activeTeachers[0].fullName,
            roleOrTitle: activeTeachers[0].teacherCode || activeTeachers[0].subjectSpecialty || 'استاد',
            destinationAccountId: 'acc-fund',
            destinationAccountTitle: 'صندوق قرض‌الحسنه کارکنان و طلاب',
            destinationBankInfo: 'بانک رسالت - IR880700001055443322000001',
            totalDebtAmount: 3000000,
            monthlyDeductionAmount: 1000000,
            paidAmount: 1000000,
            remainingAmount: 2000000,
            status: 'active',
            startDate: '۱۴۰۳/۰۶/۱۵',
            notes: 'مساعده مصوب شروع سال تحصیلی',
            createdAt: new Date().toISOString()
          });
        }

        // Seed Staff Claims
        const activeStaffList = (storedStaff || []).filter(s => s.isActive);
        if (activeStaffList.length >= 1) {
          initialClaims.push({
            id: 'clm-sf-1',
            claimCategoryId: 'cat-staff-advance',
            claimTitle: 'مساعده حقوق و دستمزد پرسنل',
            targetType: 'staff',
            targetId: activeStaffList[0].id,
            targetName: activeStaffList[0].fullName,
            studentId: activeStaffList[0].id,
            studentName: activeStaffList[0].fullName,
            roleOrTitle: activeStaffList[0].roleTitle || 'کادر اجرایی',
            destinationAccountId: 'acc-fund',
            destinationAccountTitle: 'صندوق قرض‌الحسنه کارکنان و طلاب',
            destinationBankInfo: 'بانک رسالت - IR880700001055443322000001',
            totalDebtAmount: 1500000,
            monthlyDeductionAmount: 500000,
            paidAmount: 500000,
            remainingAmount: 1000000,
            status: 'active',
            startDate: '۱۴۰۳/۰۶/۰۱',
            notes: 'مساعده ماه جاری',
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

  // Filtered Claims for Current Active Group
  const currentGroupClaims = useMemo(() => {
    if (activeGroup === 'settings') return [];
    return claims.filter(c => {
      const claimType = c.targetType || 'student';
      return claimType === activeGroup;
    });
  }, [claims, activeGroup]);

  // Apply Search and Table Filters
  const filteredClaims = useMemo(() => {
    return currentGroupClaims.filter(c => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.studentName || c.targetName || '').toLowerCase().includes(q);
        const matchNat = (c.nationalId || '').includes(q);
        const matchTitle = (c.claimTitle || '').toLowerCase().includes(q);
        const matchRole = (c.roleOrTitle || '').toLowerCase().includes(q);
        if (!matchName && !matchNat && !matchTitle && !matchRole) return false;
      }
      // Category filter
      if (selectedCategoryFilter !== 'all' && c.claimCategoryId !== selectedCategoryFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'all' && c.status !== selectedStatusFilter) {
        return false;
      }
      // Group-specific filters
      if (activeGroup === 'student' && selectedGradeFilter !== 'all' && c.grade !== selectedGradeFilter) {
        return false;
      }
      if (activeGroup === 'staff' && selectedStaffRoleFilter !== 'all' && c.roleOrTitle !== selectedStaffRoleFilter) {
        return false;
      }
      return true;
    });
  }, [currentGroupClaims, searchQuery, selectedCategoryFilter, selectedStatusFilter, selectedGradeFilter, selectedStaffRoleFilter, activeGroup]);

  // Overall Group Statistics
  const groupStats = useMemo(() => {
    let totalDebt = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let monthlyDeductionSum = 0;
    let activeCount = 0;
    const uniqueEntitySet = new Set<string>();

    currentGroupClaims.forEach(c => {
      totalDebt += c.totalDebtAmount || 0;
      totalPaid += c.paidAmount || 0;
      totalRemaining += c.remainingAmount || 0;
      if (c.status === 'active') {
        activeCount++;
        monthlyDeductionSum += c.monthlyDeductionAmount || 0;
        uniqueEntitySet.add(c.targetId || c.studentId);
      }
    });

    return {
      totalDebt,
      totalPaid,
      totalRemaining,
      monthlyDeductionSum,
      activeCount,
      uniqueCount: uniqueEntitySet.size
    };
  }, [currentGroupClaims]);

  // Categories available for the batch creation modal according to modalTargetGroup
  const modalEligibleCategories = useMemo(() => {
    return categories.filter(c => {
      if (!c.targetType || c.targetType === 'all') return true;
      return c.targetType === modalTargetGroup;
    });
  }, [categories, modalTargetGroup]);

  // Handle Category selection in batch modal to auto-populate destination account
  const handleBatchCategoryChange = (catId: string) => {
    setBatchCategoryId(catId);
    const foundCat = categories.find(c => c.id === catId);
    if (foundCat && foundCat.defaultDestinationAccountId) {
      setBatchDestinationAccountId(foundCat.defaultDestinationAccountId);
    }
  };

  // Filter entities list for batch modal
  const eligibleEntitiesForBatch = useMemo(() => {
    const q = batchEntitySearch.toLowerCase().trim();

    if (modalTargetGroup === 'student') {
      return students.filter(s => {
        if (!s.isActive) return false;
        if (batchGradeFilter !== 'all' && s.grade !== batchGradeFilter) return false;
        if (q) {
          const matchName = s.name?.toLowerCase().includes(q);
          const matchNat = s.nationalId?.includes(q);
          if (!matchName && !matchNat) return false;
        }
        return true;
      }).map(s => ({
        id: s.id,
        name: s.name,
        code: s.nationalId || '-',
        subtitle: s.grade || 'پایه نامشخص'
      }));
    } else if (modalTargetGroup === 'teacher') {
      return teachers.filter(t => {
        if (t.isActive === false) return false;
        if (q) {
          const matchName = t.fullName.toLowerCase().includes(q);
          const matchCode = (t.teacherCode || '').toLowerCase().includes(q);
          const matchSpecialty = (t.subjectSpecialty || '').toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchSpecialty) return false;
        }
        return true;
      }).map(t => ({
        id: t.id,
        name: t.fullName,
        code: t.teacherCode || '-',
        subtitle: t.subjectSpecialty || 'استاد حوزه'
      }));
    } else {
      // staff
      return staffList.filter(s => {
        if (s.isActive === false) return false;
        if (q) {
          const matchName = s.fullName.toLowerCase().includes(q);
          const matchCode = (s.staffCode || '').toLowerCase().includes(q);
          const matchRole = (s.roleTitle || '').toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchRole) return false;
        }
        return true;
      }).map(s => ({
        id: s.id,
        name: s.fullName,
        code: s.staffCode || s.nationalId || '-',
        subtitle: s.roleTitle || 'کادر اجرایی'
      }));
    }
  }, [modalTargetGroup, students, teachers, staffList, batchEntitySearch, batchGradeFilter]);

  const handleSelectAllBatchEntities = () => {
    if (selectedEntityIds.length === eligibleEntitiesForBatch.length) {
      setSelectedEntityIds([]);
    } else {
      setSelectedEntityIds(eligibleEntitiesForBatch.map(e => e.id));
    }
  };

  const handleToggleEntityInBatch = (id: string) => {
    setSelectedEntityIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Open Batch Modal with Pre-set Group
  const openBatchCreateModal = (group: ClaimTargetGroup) => {
    setModalTargetGroup(group);
    setSelectedEntityIds([]);
    setBatchEntitySearch('');
    setBatchGradeFilter('all');

    const groupCats = categories.filter(c => !c.targetType || c.targetType === 'all' || c.targetType === group);
    if (groupCats.length > 0) {
      setBatchCategoryId(groupCats[0].id);
      setBatchDestinationAccountId(groupCats[0].defaultDestinationAccountId || destinationAccounts[0]?.id || '');
    } else {
      setBatchCategoryId('');
      setBatchDestinationAccountId(destinationAccounts[0]?.id || '');
    }

    setIsBatchCreateOpen(true);
  };

  // Submit Batch Claims
  const handleSaveBatchClaims = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCategoryId) {
      showToast('لطفاً سرفصل مطالبه را انتخاب کنید.');
      return;
    }
    if (!batchDestinationAccountId) {
      showToast('لطفاً حساب واریز مقصد را مشخص کنید.');
      return;
    }
    if (selectedEntityIds.length === 0) {
      showToast('لطفاً حداقل یک نفر را انتخاب کنید.');
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

    for (const entityId of selectedEntityIds) {
      let entityName = '';
      let entityNationalId = '';
      let entityGrade = '';
      let entityRole = '';

      if (modalTargetGroup === 'student') {
        const st = students.find(s => s.id === entityId);
        if (!st) continue;
        entityName = st.name;
        entityNationalId = st.nationalId;
        entityGrade = st.grade;
      } else if (modalTargetGroup === 'teacher') {
        const tc = teachers.find(t => t.id === entityId);
        if (!tc) continue;
        entityName = tc.fullName;
        entityRole = tc.teacherCode || tc.subjectSpecialty || 'استاد';
      } else {
        const sf = staffList.find(s => s.id === entityId);
        if (!sf) continue;
        entityName = sf.fullName;
        entityNationalId = sf.nationalId;
        entityRole = sf.roleTitle || sf.staffCode || 'کارمند';
      }

      const newClaim: StudentClaimRecord = {
        id: `clm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        claimCategoryId: batchCategoryId,
        claimTitle: catTitle,
        targetType: modalTargetGroup,
        targetId: entityId,
        targetName: entityName,
        destinationAccountId: batchDestinationAccountId,
        destinationAccountTitle: accTitle,
        destinationBankInfo: accBankInfo,
        studentId: entityId,
        studentName: entityName,
        nationalId: entityNationalId,
        grade: entityGrade,
        roleOrTitle: entityRole,
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
    setSelectedEntityIds([]);
    setBatchNotes('');
    showToast(`تعداد ${newClaimRecords.length} فقره مطالبه با موفقیت ثبت شد.`);
  };

  // Edit / Update Single Claim
  const handleSaveEditClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClaim) return;

    const acc = destinationAccounts.find(a => a.id === editingClaim.destinationAccountId);
    const cat = categories.find(c => c.id === editingClaim.claimCategoryId);
    const updated: StudentClaimRecord = {
      ...editingClaim,
      claimTitle: cat?.title || editingClaim.claimTitle,
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

  // Quick Settlement Handler
  const handleOpenSettlement = (claim: StudentClaimRecord) => {
    setSettlingClaim(claim);
    setSettlementAmount(claim.monthlyDeductionAmount > claim.remainingAmount ? claim.remainingAmount : claim.monthlyDeductionAmount);
    setSettlementMethod('deduction');
    setSettlementDate(getTodayShamsi());
    setSettlementNotes('');
  };

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingClaim) return;

    const amount = Number(settlementAmount);
    if (amount <= 0) {
      showToast('مبلغ تسویه باید بزرگتر از صفر باشد.');
      return;
    }

    const newPaid = Number(settlingClaim.paidAmount || 0) + amount;
    const newRemaining = Math.max(0, Number(settlingClaim.totalDebtAmount) - newPaid);
    const isCompleted = newRemaining === 0;

    const methodLabel = settlementMethod === 'deduction' 
      ? 'کسر از پرداختی ماهیانه' 
      : settlementMethod === 'cash' 
        ? 'پرداخت نقدی' 
        : 'واریز به حساب مقصد';

    const historyNote = `\n[تسویه ${amount.toLocaleString('fa-IR')} ت در ${settlementDate} به روش ${methodLabel}] ${settlementNotes ? '- ' + settlementNotes : ''}`;

    const updated: StudentClaimRecord = {
      ...settlingClaim,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: isCompleted ? 'completed' : settlingClaim.status,
      notes: (settlingClaim.notes || '') + historyNote,
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('finance_student_claims', updated);
    setClaims(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSettlingClaim(null);
    showToast(`مبلغ ${amount.toLocaleString('fa-IR')} تومان با موفقیت ثبت شد.${isCompleted ? ' بدهی به طور کامل تسویه شد.' : ''}`);
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
        targetType: catTargetType,
        description: catDescription.trim()
      };
      await localDb.setDoc('finance_claim_categories', updated);
      setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
      showToast('سرفصل مطالبه با موفقیت ویرایش شد.');
    } else {
      const newCat: FinanceClaimCategory = {
        id: `cat-${Date.now()}`,
        title: catTitle.trim(),
        defaultDestinationAccountId: catDefaultAccountId,
        targetType: catTargetType,
        description: catDescription.trim(),
        createdAt: new Date().toISOString()
      };
      await localDb.setDoc('finance_claim_categories', newCat);
      setCategories(prev => [...prev, newCat]);
      showToast('سرفصل مطالبه جدید اضافه شد.');
    }
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (catId: string) => {
    const isUsed = claims.some(c => c.claimCategoryId === catId);
    if (isUsed) {
      alert('این سرفصل در مطالبات ثبت شده استفاده شده است و امکان حذف مستقیم آن نیست.');
      return;
    }
    if (window.confirm('آیا از حذف این سرفصل مطالبه اطمینان دارید؟')) {
      await localDb.deleteDoc('finance_claim_categories', catId);
      setCategories(prev => prev.filter(c => c.id !== catId));
      showToast('سرفصل مطالبه حذف شد.');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const targetLabel = activeGroup === 'student' ? 'طلاب' : activeGroup === 'teacher' ? 'اساتید' : 'کارکنان';
    const data = filteredClaims.map((c, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی': c.studentName || c.targetName,
      'مشخصه / سمت / پایه': activeGroup === 'student' ? (c.grade || '-') : (c.roleOrTitle || '-'),
      'کد ملی / شناسه': c.nationalId || '-',
      'سرفصل بدهی': c.claimTitle,
      'حساب مقصد واریز': c.destinationAccountTitle || '-',
      'اطلاعات بانکی مقصد': c.destinationBankInfo || '-',
      'مبلغ کل بدهی (تومان)': c.totalDebtAmount,
      'قسط ماهانه کسر (تومان)': c.monthlyDeductionAmount,
      'کل مبالغ پرداخت شده (تومان)': c.paidAmount,
      'مانده بدهی (تومان)': c.remainingAmount,
      'وضعیت': c.status === 'active' ? 'جاری (کسر خودکار)' : c.status === 'completed' ? 'تسویه شده' : 'متوقف شده',
      'تاریخ شروع': c.startDate || '-',
      'توضیحات': c.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `مطالبات ${targetLabel}`);
    XLSX.writeFile(wb, `گزارش_مطالبات_${targetLabel}_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast(`خروجی اکسل مطالبات ${targetLabel} با موفقیت دانلود شد.`);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Get Target Label
  const getSectionTitle = (group: ClaimTargetGroup) => {
    switch (group) {
      case 'student': return 'مطالبات از طلاب';
      case 'teacher': return 'مطالبات از اساتید';
      case 'staff': return 'مطالبات از کارکنان و سایر';
    }
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

      {/* Main Header & 3-Way Target Split Tabs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <HandCoins size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>مدیریت مطالبات و بدهی‌ها</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  سه بخش مجزا: طلاب • اساتید • کارکنان
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                تفکیک مستقل بدهی‌ها، سرفصل‌های اختصاصی، تعیین مبلغ کسر ماهانه و تخصیص حساب‌های مقصد واریز
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeGroup !== 'settings' && (
              <button
                onClick={() => openBatchCreateModal(activeGroup)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>ثبت مطالبه جدید برای {activeGroup === 'student' ? 'طلاب' : activeGroup === 'teacher' ? 'اساتید' : 'کارکنان'}</span>
              </button>
            )}

            {activeGroup !== 'settings' && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* 3 Main Sections Navigation Tabs + Bank Settings */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => { setActiveGroup('student'); setSearchQuery(''); setSelectedCategoryFilter('all'); }}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeGroup === 'student'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <GraduationCap size={17} />
            <span>۱. مطالبات از طلاب</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeGroup === 'student' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {claims.filter(c => (!c.targetType || c.targetType === 'student')).length}
            </span>
          </button>

          <button
            onClick={() => { setActiveGroup('teacher'); setSearchQuery(''); setSelectedCategoryFilter('all'); }}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeGroup === 'teacher'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <BookOpen size={17} />
            <span>۲. مطالبات از اساتید</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeGroup === 'teacher' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {claims.filter(c => c.targetType === 'teacher').length}
            </span>
          </button>

          <button
            onClick={() => { setActiveGroup('staff'); setSearchQuery(''); setSelectedCategoryFilter('all'); }}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeGroup === 'staff'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <Briefcase size={17} />
            <span>۳. مطالبات از کارکنان و سایر</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeGroup === 'staff' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {claims.filter(c => c.targetType === 'staff').length}
            </span>
          </button>

          <button
            onClick={() => setActiveGroup('settings')}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeGroup === 'settings'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <Settings size={17} />
            <span>بانک سرفصل‌ها و حساب‌ها</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeGroup === 'settings' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {categories.length} سرفصل
            </span>
          </button>
        </div>
      </div>

      {/* Main Content: Group Views or Settings */}
      {activeGroup !== 'settings' ? (
        <div className="space-y-6">
          {/* Group Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">مجموع کل بدهی‌های تعریف‌شده</span>
              <div className="text-base font-black text-slate-900">
                {groupStats.totalDebt.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
              </div>
              <div className="text-[10px] text-indigo-600 font-bold">
                {getSectionTitle(activeGroup)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">کل مبالغ وصول‌شده تاکنون</span>
              <div className="text-base font-black text-emerald-600">
                {groupStats.totalPaid.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-bold">
                {groupStats.totalDebt > 0 ? `${Math.round((groupStats.totalPaid / groupStats.totalDebt) * 100)}٪ وصولی` : '۰٪'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">مانده کل بدهی وصول نشده</span>
              <div className="text-base font-black text-rose-600">
                {groupStats.totalRemaining.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
              </div>
              <div className="text-[10px] text-rose-500 font-medium">
                در انتظار کسر از دوره‌های آتی
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">مجموع کسر ماهانه جاری</span>
              <div className="text-base font-black text-amber-600">
                {groupStats.monthlyDeductionSum.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
              </div>
              <div className="text-[10px] text-amber-600 font-bold">
                کسر در هر دوره مالی
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 col-span-2 md:col-span-1">
              <span className="text-[11px] text-slate-500 font-medium">تعداد افراد دارای بدهی فعال</span>
              <div className="text-base font-black text-slate-800">
                {groupStats.uniqueCount} <span className="text-[10px] font-normal text-slate-500">نفر</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {groupStats.activeCount} پرونده جاری مطالبه
              </div>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeGroup === 'student' 
                      ? 'جستجوی نام طلبه، کد ملی یا عنوان بدهی...' 
                      : activeGroup === 'teacher' 
                        ? 'جستجوی نام استاد، کد استادی، تخصص...' 
                        : 'جستجوی نام کارمند، سمت، کد پرسنلی...'
                  }
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
                >
                  <option value="all">همه سرفصل‌های بدهی</option>
                  {categories
                    .filter(c => !c.targetType || c.targetType === 'all' || c.targetType === activeGroup)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="active">جاری (کسر فعال)</option>
                  <option value="completed">تسویه کامل شده</option>
                  <option value="paused">متوقف شده</option>
                </select>
              </div>

              {/* Group Specific Extra Filter */}
              {activeGroup === 'student' && (
                <div>
                  <select
                    value={selectedGradeFilter}
                    onChange={(e) => setSelectedGradeFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
                  >
                    <option value="all">همه پایه‌های تحصیلی</option>
                    <option value="پایه ۷">پایه ۷</option>
                    <option value="پایه ۸">پایه ۸</option>
                    <option value="پایه ۹">پایه ۹</option>
                    <option value="پایه ۱۰">پایه ۱۰</option>
                  </select>
                </div>
              )}

              {activeGroup === 'staff' && (
                <div>
                  <select
                    value={selectedStaffRoleFilter}
                    onChange={(e) => setSelectedStaffRoleFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
                  >
                    <option value="all">همه سمت‌های سازمانی</option>
                    {Array.from(new Set(staffList.map(s => s.roleTitle))).filter(Boolean).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeGroup === 'teacher' && (
                <div className="flex items-center justify-end">
                  <span className="text-xs text-slate-500 font-bold">
                    نمایش {filteredClaims.length} از {currentGroupClaims.length} پرونده
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Claims Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={17} className="text-indigo-600" />
                <h2 className="text-xs font-black text-slate-800">
                  فهرست مطالبات و بدهی‌های {getSectionTitle(activeGroup)} ({filteredClaims.length})
                </h2>
              </div>

              <div className="text-[11px] text-slate-500 font-medium">
                جهت ثبت قسط دستی یا تسویه کامل، از دکمه <span className="font-bold text-indigo-600">«تسویه / قسط»</span> استفاده نمایید.
              </div>
            </div>

            {filteredClaims.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <HandCoins size={28} />
                </div>
                <p className="text-xs font-bold text-slate-500">هیچ ردیف مطالبه‌ای با فیلترهای انتخابی یافت نشد.</p>
                <button
                  onClick={() => openBatchCreateModal(activeGroup)}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all"
                >
                  ثبت اولین مطالبه برای این بخش
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center">ردیف</th>
                      <th className="py-3 px-4">
                        {activeGroup === 'student' ? 'نام طلبه و پایه' : activeGroup === 'teacher' ? 'نام استاد و تخصص' : 'نام کارمند و سمت'}
                      </th>
                      <th className="py-3 px-4">سرفصل بدهی</th>
                      <th className="py-3 px-4">حساب مقصد واریز</th>
                      <th className="py-3 px-3 text-center">مبلغ کل بدهی</th>
                      <th className="py-3 px-3 text-center">کسر ماهانه</th>
                      <th className="py-3 px-3 text-center">وصول‌شده</th>
                      <th className="py-3 px-3 text-center">مانده بدهی</th>
                      <th className="py-3 px-3 text-center">وضعیت</th>
                      <th className="py-3 px-4 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClaims.map((claim, idx) => {
                      const percentPaid = claim.totalDebtAmount > 0 
                        ? Math.min(100, Math.round((claim.paidAmount / claim.totalDebtAmount) * 100)) 
                        : 0;

                      return (
                        <tr key={claim.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">
                            {(idx + 1).toLocaleString('fa-IR')}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">
                              {claim.studentName || claim.targetName}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              {activeGroup === 'student' && claim.grade && (
                                <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
                                  {claim.grade}
                                </span>
                              )}
                              {activeGroup !== 'student' && claim.roleOrTitle && (
                                <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                                  {claim.roleOrTitle}
                                </span>
                              )}
                              {claim.nationalId && (
                                <span className="font-mono text-slate-400">کد: {claim.nationalId}</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-indigo-900 bg-indigo-50/70 px-2 py-0.5 rounded-lg border border-indigo-100/80">
                              {claim.claimTitle}
                            </span>
                            {claim.startDate && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                شروع: {claim.startDate}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800 text-[11px]">
                              {claim.destinationAccountTitle}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {claim.destinationBankInfo}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center font-bold text-slate-800">
                            {claim.totalDebtAmount.toLocaleString('fa-IR')}
                          </td>

                          <td className="py-3 px-3 text-center font-bold text-amber-600">
                            {claim.monthlyDeductionAmount.toLocaleString('fa-IR')}
                          </td>

                          <td className="py-3 px-3 text-center font-bold text-emerald-600">
                            <div>{claim.paidAmount.toLocaleString('fa-IR')}</div>
                            <div className="w-16 mx-auto bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full" 
                                style={{ width: `${percentPaid}%` }} 
                              />
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center font-black text-rose-600">
                            {claim.remainingAmount.toLocaleString('fa-IR')}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-black inline-block",
                              claim.status === 'active' 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                : claim.status === 'completed'
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                            )}>
                              {claim.status === 'active' ? 'جاری (کسر خودکار)' : claim.status === 'completed' ? 'تسویه کامل' : 'متوقف شده'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Quick Settlement Button */}
                              {claim.remainingAmount > 0 && (
                                <button
                                  onClick={() => handleOpenSettlement(claim)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
                                  title="ثبت تسویه یا واریز قسط دستی"
                                >
                                  <Receipt size={13} />
                                  <span>تسویه/قسط</span>
                                </button>
                              )}

                              {/* Pause / Resume */}
                              {claim.status !== 'completed' && (
                                <button
                                  onClick={() => handleToggleClaimStatus(claim)}
                                  className={cn(
                                    "p-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                                    claim.status === 'active'
                                      ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                                      : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                                  )}
                                  title={claim.status === 'active' ? "توقف کسر خودکار" : "فعال‌سازی مجدد کسر"}
                                >
                                  {claim.status === 'active' ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                                </button>
                              )}

                              {/* Edit */}
                              <button
                                onClick={() => setEditingClaim(claim)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                                title="ویرایش اطلاعات مطالبه"
                              >
                                <Edit3 size={14} />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteClaim(claim.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer"
                                title="حذف مطالبه"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Settings Tab: Categories Bank and Destination Accounts */
        <div className="space-y-6">
          {/* Categories Management */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Tag size={18} className="text-indigo-600" />
                  <span>بانک سرفصل‌های بدهی و مطالبات</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تعریف عناوین با تفکیک نوع مخاطب (طلاب، اساتید، کارکنان یا عمومی) و تخصیص حساب پیش‌فرض واریز
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={settingsCatFilter}
                  onChange={(e) => setSettingsCatFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden"
                >
                  <option value="all">همه سرفصل‌ها</option>
                  <option value="student">مخصوص طلاب</option>
                  <option value="teacher">مخصوص اساتید</option>
                  <option value="staff">مخصوص کارکنان</option>
                </select>

                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setCatTitle('');
                    setCatDefaultAccountId(destinationAccounts[0]?.id || '');
                    setCatDescription('');
                    setCatTargetType('student');
                    setIsCategoryModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <Plus size={15} />
                  <span>افزودن سرفصل جدید</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {categories
                .filter(c => settingsCatFilter === 'all' || c.targetType === settingsCatFilter || (!c.targetType && settingsCatFilter === 'student'))
                .map((cat) => {
                  const targetBadge = cat.targetType === 'teacher' 
                    ? { text: 'مخصوص اساتید', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                    : cat.targetType === 'staff'
                      ? { text: 'مخصوص کارکنان', color: 'bg-amber-50 text-amber-700 border-amber-200' }
                      : cat.targetType === 'all'
                        ? { text: 'عمومی و مشترک', color: 'bg-purple-50 text-purple-700 border-purple-200' }
                        : { text: 'مخصوص طلاب', color: 'bg-blue-50 text-blue-700 border-blue-200' };

                  const acc = destinationAccounts.find(a => a.id === cat.defaultDestinationAccountId);

                  return (
                    <div key={cat.id} className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-xs">{cat.title}</span>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border", targetBadge.color)}>
                            {targetBadge.text}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-slate-500 mt-1">{cat.description}</p>
                        )}
                        <div className="text-[10px] text-slate-600 mt-2 flex items-center gap-1">
                          <Landmark size={12} className="text-slate-400" />
                          <span>حساب واریز: </span>
                          <span className="font-bold text-indigo-700">{acc?.title || 'تعیین نشده'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-200/60">
                        <button
                          onClick={() => {
                            setEditingCategory(cat);
                            setCatTitle(cat.title);
                            setCatDefaultAccountId(cat.defaultDestinationAccountId);
                            setCatDescription(cat.description || '');
                            setCatTargetType(cat.targetType || 'student');
                            setIsCategoryModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 transition-all"
                        >
                          ویرایش
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold border border-rose-200 transition-all"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Destination Accounts Management */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Landmark size={18} className="text-indigo-600" />
                  <span>حساب‌های بانکی مقصد واریز</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  حساب‌هایی که مبالغ کسر شده از شهریه و حقوق به آنها واریز می‌گردد
                </p>
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
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <Plus size={15} />
                <span>تعریف حساب مقصد جدید</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {destinationAccounts.map((acc) => (
                <div key={acc.id} className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-xs">{acc.title}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md">
                        {acc.bankName}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs">
                      <div className="text-slate-600">
                        صاحب حساب: <span className="font-bold text-slate-800">{acc.accountHolder || '-'}</span>
                      </div>
                      <div className="text-slate-600 font-mono text-[11px]">
                        شبا: <span className="text-indigo-700 font-bold">{acc.shebaNumber}</span>
                      </div>
                      {acc.accountNumber && (
                        <div className="text-slate-500 font-mono text-[11px]">
                          شماره حساب: {acc.accountNumber}
                        </div>
                      )}
                      {acc.description && (
                        <div className="text-slate-400 text-[10px] pt-1">
                          {acc.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60">
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
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 transition-all"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold border border-rose-200 transition-all"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Batch / Create Claim Modal */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isBatchCreateOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-100 space-y-5 my-8"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      ثبت مطالبه و انتساب بدهی جدید ({getSectionTitle(modalTargetGroup)})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      انتخاب افراد، سرفصل بدهی، مبلغ کل و تعیین قسط کسر ماهانه
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsBatchCreateOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Target Type Selector inside modal */}
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setModalTargetGroup('student');
                    setSelectedEntityIds([]);
                    const cats = categories.filter(c => !c.targetType || c.targetType === 'student');
                    if (cats.length > 0) handleBatchCategoryChange(cats[0].id);
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-xl transition-all",
                    modalTargetGroup === 'student' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  برای طلاب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalTargetGroup('teacher');
                    setSelectedEntityIds([]);
                    const cats = categories.filter(c => !c.targetType || c.targetType === 'teacher');
                    if (cats.length > 0) handleBatchCategoryChange(cats[0].id);
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-xl transition-all",
                    modalTargetGroup === 'teacher' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  برای اساتید
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalTargetGroup('staff');
                    setSelectedEntityIds([]);
                    const cats = categories.filter(c => !c.targetType || c.targetType === 'staff');
                    if (cats.length > 0) handleBatchCategoryChange(cats[0].id);
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-xl transition-all",
                    modalTargetGroup === 'staff' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  برای کارکنان
                </button>
              </div>

              <form onSubmit={handleSaveBatchClaims} className="space-y-4">
                {/* Category and Destination Account */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">سرفصل بدهی و مطالبه *</label>
                    <select
                      value={batchCategoryId}
                      onChange={(e) => handleBatchCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      required
                    >
                      <option value="">-- انتخاب سرفصل مطالبه --</option>
                      {modalEligibleCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">حساب مقصد واریز *</label>
                    <select
                      value={batchDestinationAccountId}
                      onChange={(e) => setBatchDestinationAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      required
                    >
                      <option value="">-- انتخاب حساب مقصد --</option>
                      {destinationAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.title} ({a.bankName})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Amounts and Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ کل بدهی هر نفر (تومان) *</label>
                    <input
                      type="number"
                      value={batchTotalDebt}
                      onChange={(e) => setBatchTotalDebt(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      required
                      min={1000}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">قسط کسر ماهانه (تومان) *</label>
                    <input
                      type="number"
                      value={batchMonthlyDeduction}
                      onChange={(e) => setBatchMonthlyDeduction(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      required
                      min={1000}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ شروع کسر</label>
                    <input
                      type="text"
                      value={batchStartDate}
                      onChange={(e) => setBatchStartDate(e.target.value)}
                      placeholder="۱۴۰۳/۰۶/۰۱"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Person Selection Box */}
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-800">
                      انتخاب افراد مشمول بدهی ({selectedEntityIds.length} نفر انتخاب شده)
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllBatchEntities}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                      >
                        {selectedEntityIds.length === eligibleEntitiesForBatch.length ? 'لغو انتخاب همه' : 'انتخاب همه افراد لیست'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={batchEntitySearch}
                      onChange={(e) => setBatchEntitySearch(e.target.value)}
                      placeholder="جستجوی نام، کد یا عنوان..."
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-hidden"
                    />

                    {modalTargetGroup === 'student' && (
                      <select
                        value={batchGradeFilter}
                        onChange={(e) => setBatchGradeFilter(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-hidden"
                      >
                        <option value="all">همه پایه‌ها</option>
                        <option value="پایه ۷">پایه ۷</option>
                        <option value="پایه ۸">پایه ۸</option>
                        <option value="پایه ۹">پایه ۹</option>
                        <option value="پایه ۱۰">پایه ۱۰</option>
                      </select>
                    )}
                  </div>

                  {/* List of Checkboxes */}
                  <div className="max-h-48 overflow-y-auto space-y-1 p-1 divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                    {eligibleEntitiesForBatch.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        موردی یافت نشد.
                      </div>
                    ) : (
                      eligibleEntitiesForBatch.map(item => {
                        const isSelected = selectedEntityIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs",
                              isSelected ? "bg-indigo-50/60 font-bold text-indigo-900" : "hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleEntityInBatch(item.id)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                              <span>{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({item.subtitle})</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات و مصوبه</label>
                  <input
                    type="text"
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    placeholder="مثال: مصوب جلسه شورای مالی - کسر از اول مهر"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBatchCreateOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ثبت نهایی مطالبه برای ({selectedEntityIds.length} نفر)
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* Quick Settlement Modal */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {settlingClaim && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Receipt size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">ثبت تسویه یا واریز قسط دستی</h3>
                    <p className="text-[11px] text-slate-500">{settlingClaim.studentName || settlingClaim.targetName}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSettlingClaim(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">سرفصل بدهی:</span>
                  <span className="font-bold text-slate-800">{settlingClaim.claimTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مبلغ کل بدهی:</span>
                  <span className="font-mono text-slate-800">{settlingClaim.totalDebtAmount.toLocaleString('fa-IR')} تومان</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">وصول‌شده تاکنون:</span>
                  <span className="font-mono text-emerald-600 font-bold">{settlingClaim.paidAmount.toLocaleString('fa-IR')} تومان</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-rose-600 font-bold">مانده قابل تسویه:</span>
                  <span className="font-mono text-rose-600 font-black">{settlingClaim.remainingAmount.toLocaleString('fa-IR')} تومان</span>
                </div>
              </div>

              <form onSubmit={handleSaveSettlement} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ واریزی / تسویه (تومان) *</label>
                  <input
                    type="number"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(Number(e.target.value))}
                    max={settlingClaim.remainingAmount}
                    min={1000}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-hidden"
                    required
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setSettlementAmount(settlingClaim.monthlyDeductionAmount)}
                      className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md"
                    >
                      مبلغ یک قسط ({settlingClaim.monthlyDeductionAmount.toLocaleString('fa-IR')} ت)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementAmount(settlingClaim.remainingAmount)}
                      className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md"
                    >
                      تسویه کل مانده ({settlingClaim.remainingAmount.toLocaleString('fa-IR')} ت)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">روش تسویه</label>
                    <select
                      value={settlementMethod}
                      onChange={(e) => setSettlementMethod(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    >
                      <option value="deduction">کسر از حقوق / شهریه</option>
                      <option value="cash">پرداخت نقدی</option>
                      <option value="transfer">واریز مستقیم به حساب</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ پرداخت</label>
                    <input
                      type="text"
                      value={settlementDate}
                      onChange={(e) => setSettlementDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">یادداشت</label>
                  <input
                    type="text"
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    placeholder="شماره فیش، شماره پیگیری، علت تسویه..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSettlingClaim(null)}
                    className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ثبت دریافت و کسر بدهی
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* Edit Single Claim Modal */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {editingClaim && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">
                  ویرایش ردیف مطالبه ({editingClaim.studentName || editingClaim.targetName})
                </h3>
                <button
                  onClick={() => setEditingClaim(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveEditClaim} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سرفصل بدهی</label>
                  <select
                    value={editingClaim.claimCategoryId}
                    onChange={(e) => setEditingClaim({ ...editingClaim, claimCategoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حساب مقصد واریز</label>
                  <select
                    value={editingClaim.destinationAccountId}
                    onChange={(e) => setEditingClaim({ ...editingClaim, destinationAccountId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                  >
                    {destinationAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.title} ({a.bankName})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ کل بدهی (تومان)</label>
                    <input
                      type="number"
                      value={editingClaim.totalDebtAmount}
                      onChange={(e) => setEditingClaim({ ...editingClaim, totalDebtAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">قسط کسر ماهانه (تومان)</label>
                    <input
                      type="number"
                      value={editingClaim.monthlyDeductionAmount}
                      onChange={(e) => setEditingClaim({ ...editingClaim, monthlyDeductionAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">کل پرداخت شده (تومان)</label>
                    <input
                      type="number"
                      value={editingClaim.paidAmount}
                      onChange={(e) => setEditingClaim({ ...editingClaim, paidAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">وضعیت مطالبه</label>
                    <select
                      value={editingClaim.status}
                      onChange={(e) => setEditingClaim({ ...editingClaim, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    >
                      <option value="active">جاری (کسر خودکار)</option>
                      <option value="paused">متوقف شده</option>
                      <option value="completed">تسویه کامل</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">یادداشت</label>
                  <input
                    type="text"
                    value={editingClaim.notes || ''}
                    onChange={(e) => setEditingClaim({ ...editingClaim, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden"
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
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ذخیره تغییرات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* Category Modal (Add / Edit) */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">
                  {editingCategory ? 'ویرایش سرفصل مطالبه' : 'تعریف سرفصل بدهی جدید'}
                </h3>
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان سرفصل بدهی *</label>
                  <input
                    type="text"
                    value={catTitle}
                    onChange={(e) => setCatTitle(e.target.value)}
                    placeholder="مثال: وام عتبات، مساعده اساتید، بیمه پرسنل..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مربوط به کدام بخش است؟ *</label>
                  <select
                    value={catTargetType}
                    onChange={(e) => setCatTargetType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                  >
                    <option value="student">مطالبات از طلاب</option>
                    <option value="teacher">مطالبات از اساتید</option>
                    <option value="staff">مطالبات از کارکنان و سایر</option>
                    <option value="all">عمومی و مشترک بین همه</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حساب مقصد پیش‌فرض *</label>
                  <select
                    value={catDefaultAccountId}
                    onChange={(e) => setCatDefaultAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    required
                  >
                    <option value="">-- انتخاب حساب واریز --</option>
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
                    placeholder="توضیحات مختصر درباره نحوه کسر یا شرایط..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-hidden"
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
                    ذخیره سرفصل
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* Destination Account Modal (Add / Edit) */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">
                  {editingAccount ? 'ویرایش حساب واریز مقصد' : 'تعریف حساب مقصد جدید'}
                </h3>
                <button
                  onClick={() => setIsAccountModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان حساب *</label>
                  <input
                    type="text"
                    value={accTitle}
                    onChange={(e) => setAccTitle(e.target.value)}
                    placeholder="مثال: حساب صندوق قرض‌الحسنه، حساب آشپزخانه..."
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
                      placeholder="مثال: بانک تجارت"
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
                      placeholder="مثال: امور مالی مدرسه"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">شماره شبا (با IR) *</label>
                  <input
                    type="text"
                    value={accSheba}
                    onChange={(e) => setAccSheba(e.target.value)}
                    placeholder="IR120180000000001234567801"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">شماره حساب / کارت</label>
                  <input
                    type="text"
                    value={accNumber}
                    onChange={(e) => setAccNumber(e.target.value)}
                    placeholder="مثال: ۰۲۱۵۵۸۸۹۹۰۰۰۱"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات</label>
                  <input
                    type="text"
                    value={accDescription}
                    onChange={(e) => setAccDescription(e.target.value)}
                    placeholder="توضیحات تکمیلی..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-hidden"
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
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ذخیره حساب
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
