import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  Download,
  Upload,
  Database,
  HardDrive,
  Users,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Info,
  Layers,
  ArrowDownToLine,
  Search,
  Check,
  X,
  Lock,
  Unlock,
  Eye,
  CloudUpload,
  CloudDownload,
  History,
  KeyRound,
  FileText,
  FolderDown,
  Camera,
  FolderUp,
  Copy,
  ExternalLink,
  Server,
  Code
} from 'lucide-react';
import { localDb, getMentorKeyForGrade, normalizeNationalId } from '../lib/localDb';
import { Student } from '../types';
import { useMentor, MentorId, MENTORS } from '../context/MentorContext';
import {
  CloudBackupRecord,
  uploadBackupToCloud,
  fetchCloudBackups,
  deleteCloudBackup,
  downloadBackupPackage,
  generateBackupFilename,
  getPersianDateTime
} from '../lib/cloudBackups';
import { SUPABASE_SCHEMA_SQL } from '../lib/supabaseSqlScript';
import { testSupabaseConnection, syncAllToSupabase, ConnectionStatus } from '../lib/supabaseSync';
import { getSupabaseCredentials, saveSupabaseCredentials } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';



function base64ToUint8Array(dataUrl: string): { data: Uint8Array; ext: string } {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  let ext = 'jpg';
  if (header.includes('png')) ext = 'png';
  else if (header.includes('webp')) ext = 'webp';
  else if (header.includes('gif')) ext = 'gif';

  const base64Str = parts[1] || parts[0];
  const binaryStr = window.atob(base64Str);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { data: bytes, ext };
}

function extractNationalIdFromFilename(filename: string): string {
  const nameOnly = filename.split('/').pop()?.split('\\').pop() || filename;
  const nameWithoutExt = nameOnly.substring(0, nameOnly.lastIndexOf('.')) || nameOnly;
  const normalized = normalizeNationalId(nameWithoutExt);
  const tenDigitMatch = normalized.match(/\d{10}/);
  if (tenDigitMatch) {
    return tenDigitMatch[0];
  }
  const digitsOnly = normalized.replace(/\D/g, '');
  return digitsOnly || normalized;
}

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface MentorStats {
  id: MentorId;
  name: string;
  role: string;
  gradeLabel: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  studentCount: number;
  photoCount: number;
  lastBackupDate?: string;
}

export default function BackupAndRestore() {
  const { currentMentor, currentMentorId } = useMentor();
  const { currentUser } = useAuth();
  const isManager = currentMentor.isHeadManager || currentMentorId === 'shahpoori';
  
  const isEduOrFinanceManager = 
    currentUser?.role === 'education_manager' || 
    currentUser?.role === 'finance_manager' || 
    currentUser?.username === 'SHAH' || 
    currentUser?.username === 'FINANCE' ||
    currentUser?.role === 'super_admin';

  const [allowOfflineMode, setAllowOfflineMode] = useState<boolean>(() => {
    return localStorage.getItem('allow_offline_storage_mode') === 'true';
  });

  const handleToggleOfflineMode = (enabled: boolean) => {
    setAllowOfflineMode(enabled);
    localStorage.setItem('allow_offline_storage_mode', enabled ? 'true' : 'false');
    setStatusMessage({
      type: 'info',
      text: enabled 
        ? 'حالت ذخیره محلی (آفلاین) برای شما فعال شد. در صورت قطعی اینترنت، داده‌ها محلی ثبت و بعداً همگام خواهند شد.'
        : 'حالت ذخیره مستقیم ابری فعال است. در صورت قطعی اینترنت، ثبت اطلاعات متوقف و خطا اعلام می‌شود.'
    });
  };

  const [isPurging, setIsPurging] = useState<boolean>(false);
  const handlePurgeTestData = async () => {
    if (!window.confirm('هشدار مهم و نهایی: آیا می‌خواهید تمامی داده‌های تستی (طلاب، حضور و غیاب، نمرات، درخواست‌ها و سوابق) پاک شوند تا نرم‌افزار برای بهره‌برداری نهایی آماده شود؟\n\nبخش‌هایی که کاملاً حفظ خواهند شد:\n۱. سوپر ادمین\n۲. کاربران سطح ۲\n۳. بانک دروس\n۴. مدرس‌ها و کلاس‌های درس')) {
      return;
    }
    try {
      setIsPurging(true);
      await localDb.purgeTestData();
      alert('پاکسازی اطلاعات تستی با موفقیت انجام شد. اطلاعات پایه (سوپر ادمین، کاربران سطح ۲، بانک دروس، مدرس‌ها و کلاس‌ها) با موفقیت محافظت و حفظ شدند.');
      window.location.reload();
    } catch (e: any) {
      alert('خطا در پاکسازی اطلاعات: ' + (e?.message || e));
    } finally {
      setIsPurging(false);
    }
  };

  const [students, setStudents] = useState<Student[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportingMentorId, setExportingMentorId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('merge');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Cloud Backups & Password State
  const [cloudBackups, setCloudBackups] = useState<CloudBackupRecord[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);
  const [isUploadingToCloud, setIsUploadingToCloud] = useState<boolean>(false);
  const [selectedMentorFilter, setSelectedMentorFilter] = useState<string>('all');

  // Automated On-Disk Backups & Snapshot State
  const [onDiskBackups, setOnDiskBackups] = useState<Array<{ name: string; sizeBytes: number; createdAt: string; isAutomated: boolean }>>([]);
  const [isLoadingDiskBackups, setIsLoadingDiskBackups] = useState<boolean>(false);
  const [isTakingSnapshot, setIsTakingSnapshot] = useState<boolean>(false);
  const snapshotFileInputRef = useRef<HTMLInputElement>(null);
  const [snapshotPreviewData, setSnapshotPreviewData] = useState<{
    metadata: any;
    data: any;
    isValidChecksum: boolean;
    computedChecksum: string;
  } | null>(null);

  const loadScheduledBackups = async () => {
    setIsLoadingDiskBackups(true);
    try {
      const res = await fetch('/api/database/scheduled-backups');
      const data = await res.json();
      if (data.success && Array.isArray(data.backups)) {
        setOnDiskBackups(data.backups);
      }
    } catch (e) {
      console.warn('Error loading scheduled backups:', e);
    } finally {
      setIsLoadingDiskBackups(false);
    }
  };

  const handleDownloadFullSnapshot = async () => {
    setIsTakingSnapshot(true);
    try {
      const res = await fetch('/api/database/snapshot');
      if (!res.ok) throw new Error('خطا در دریافت خروجی اسنپ‌شات از سرور.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `madrasah_full_snapshot_${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatusMessage({
        type: 'success',
        text: 'اسنپ‌شات کامل پایگاه داده همراه با امضای هش SHA-256 با موفقیت دانلود شد.'
      });
      loadScheduledBackups();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'خطا در تهیه اسنپ‌شات کامل دیتابیس.' });
    } finally {
      setIsTakingSnapshot(false);
    }
  };

  const handleTriggerScheduledNow = async () => {
    setIsTakingSnapshot(true);
    try {
      const res = await fetch('/api/database/scheduled-backups/run-now', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: data.message });
        loadScheduledBackups();
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'خطا در اجرای پشتیبان‌گیری خودکار.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'خطا در ارتباط با سرور.' });
    } finally {
      setIsTakingSnapshot(false);
    }
  };

  const handleSnapshotFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      if (!payload.metadata || !payload.data) {
        alert('فایل انتخاب‌شده ساختار معتبر اسنپ‌شات دیتابیس را ندارد.');
        return;
      }

      // Compute SHA-256 checksum
      const crypto = window.crypto?.subtle;
      let computedHex = '';
      if (crypto) {
        const jsonStr = JSON.stringify(payload.data);
        const encoded = new TextEncoder().encode(jsonStr);
        const hashBuf = await crypto.digest('SHA-256', encoded);
        computedHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const isValidChecksum = !payload.metadata.checksum || !computedHex || payload.metadata.checksum === computedHex;

      setSnapshotPreviewData({
        metadata: payload.metadata,
        data: payload.data,
        isValidChecksum,
        computedChecksum: computedHex
      });
    } catch (err: any) {
      alert('خطا در خواندن فایل اسنپ‌شات: ' + err?.message);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmSnapshotRestore = async () => {
    if (!snapshotPreviewData) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/database/restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotPayload: { metadata: snapshotPreviewData.metadata, data: snapshotPreviewData.data } })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: data.message });
        setSnapshotPreviewData(null);
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'خطا در بازگردانی اسنپ‌شات.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'خطا در ارتباط با سرور بازگردانی.' });
    } finally {
      setIsImporting(false);
    }
  };

  // Password Verification State
  const [isPasswordVerified, setIsPasswordVerified] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Modals State
  const [showAllFilesModal, setShowAllFilesModal] = useState<boolean>(false);
  const [fileSearchTerm, setFileSearchTerm] = useState<string>('');
  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = useState<boolean>(false);
  const [pendingFileToRestore, setPendingFileToRestore] = useState<{ data: any; name: string } | null>(null);

  const [stats, setStats] = useState<{
    totalStudents: number;
    totalActiveStudents: number;
    totalPhotos: number;
    photosSizeEstimateKB: number;
    collectionCounts: Record<string, number>;
  }>({
    totalStudents: 0,
    totalActiveStudents: 0,
    totalPhotos: 0,
    photosSizeEstimateKB: 0,
    collectionCounts: {}
  });

  const universalFileInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');

  // Cached Backup payload before applying to database
  const [cachedBackupForRestore, setCachedBackupForRestore] = useState<{
    data: any;
    name: string;
    totalRecords: number;
    moduleCounts: Record<string, number>;
  } | null>(null);
  const [showRestoreApplyModal, setShowRestoreApplyModal] = useState<boolean>(false);

  // Photo Management State
  const [isProcessingPhotos, setIsProcessingPhotos] = useState<boolean>(false);
  const [showPhotoResultModal, setShowPhotoResultModal] = useState<boolean>(false);
  const [photoResult, setPhotoResult] = useState<{
    matched: { studentName: string; nationalId: string; fileName: string }[];
    unmatched: string[];
    totalFiles: number;
  } | null>(null);

  // Supabase Database Setup & Testing State
  const [isTestingDb, setIsTestingDb] = useState<boolean>(false);
  const [dbTestResult, setDbTestResult] = useState<ConnectionStatus | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ col: string; pct: number } | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [showSqlCodeModal, setShowSqlCodeModal] = useState<boolean>(false);
  const [showCredentialsForm, setShowCredentialsForm] = useState<boolean>(false);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState<string>(() => getSupabaseCredentials().url);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState<string>(() => getSupabaseCredentials().anonKey);
  const [credentialsSavedMsg, setCredentialsSavedMsg] = useState<string>('');

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(supabaseUrlInput, supabaseKeyInput);
    setCredentialsSavedMsg('تنظیمات اتصال با موفقیت ذخیره شد.');
    setTimeout(() => setCredentialsSavedMsg(''), 4000);
    handleTestDatabase();
  };

  const handleResetDefaultCredentials = () => {
    const defaultUrl = 'https://jqfgkkpbdojzjttoziwl.supabase.co';
    const defaultKey = 'sb_publishable_2GWIGLxWLh-KSY2LAKM1uQ_cDSphAPq';
    setSupabaseUrlInput(defaultUrl);
    setSupabaseKeyInput(defaultKey);
    saveSupabaseCredentials(defaultUrl, defaultKey);
    setCredentialsSavedMsg('آدرس و کلید به پروژه پیش‌فرض بازنشانی گردید.');
    setTimeout(() => setCredentialsSavedMsg(''), 4000);
    handleTestDatabase();
  };

  const handleTestDatabase = async () => {
    setIsTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setDbTestResult(res);
    } catch (err: any) {
      setDbTestResult({
        connected: false,
        message: `خطای تست اتصال: ${err?.message || 'نامشخص'}`
      });
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleCopySqlScript = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch (e) {
      console.error('Failed to copy SQL:', e);
    }
  };

  const handleDownloadSqlScript = () => {
    const blob = new Blob([SUPABASE_SCHEMA_SQL], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncAllToCloud = async () => {
    setIsSyncingAll(true);
    setSyncProgress(null);
    try {
      const results = await syncAllToSupabase((col, pct) => {
        setSyncProgress({ col, pct });
      });
      const totalCount = results.reduce((acc, r) => acc + r.count, 0);
      setStatusMessage({
        type: 'success',
        text: `همگام‌سازی کامل شد: تعداد ${totalCount} رکورد در دیتابیس Supabase ذخیره شدند.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `خطا در همگام‌سازی با Supabase: ${err?.message || 'نامشخص'}`
      });
    } finally {
      setIsSyncingAll(false);
      setSyncProgress(null);
    }
  };

  const loadData = async () => {
    try {
      const allStudents = await localDb.getDocs<Student>('students');
      setStudents(allStudents);
      const storageStats = await localDb.getStorageStats();
      setStats(storageStats);
      await loadCloudBackups();
    } catch (e) {
      console.error('Error loading backup stats:', e);
    }
  };

  const loadCloudBackups = async () => {
    setIsLoadingCloud(true);
    try {
      const targetFilter = isManager ? selectedMentorFilter : currentMentorId;
      const records = await fetchCloudBackups(targetFilter, isManager);
      setCloudBackups(records);
    } catch (err) {
      console.error('Error fetching cloud backups:', err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = localDb.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [currentMentorId, selectedMentorFilter]);

  // Utility to download JSON
  const downloadJsonFile = (data: any, filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Password verification logic
  const handleVerifyPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (currentUser && (currentUser.level === 1 || currentUser.role === 'super_admin')) {
      setIsPasswordVerified(true);
      setPasswordError('');
      setShowPasswordModal(false);
      setPasswordInput('');
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setPasswordError(`رمز عبور وارد شده نادرست است.`);
    }
  };

  const requirePassword = (action: () => void) => {
    if (isPasswordVerified) {
      action();
    } else {
      setPendingAction(() => action);
      setPasswordError('');
      setPasswordInput('');
      setShowPasswordModal(true);
    }
  };

  // 1. Offline Backup Download - 100% Comprehensive System Data
  const handleExportOfflineBackup = async (_mentorIdTarget?: MentorId) => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      // Regardless of which user/mentor is logged in or clicks this button,
      // ALWAYS export 100% full software database (Finance, Education, Super Admin, Mentors, Students, etc.)
      const backupPackage = await localDb.exportFullBackup();

      const filename = generateBackupFilename('کامل_سامانه');
      downloadJsonFile(backupPackage, filename);

      const totalRecs = backupPackage._meta?.totalRecords || 0;
      const totalCols = backupPackage._meta?.totalCollections || 0;

      setStatusMessage({
        type: 'success',
        text: `فایل پشتیبان کامل و ۱۰۰٪ نرم‌افزار (شامل تمامی دیتای مسئول مالی، آموزش، سوپرادمین، اساتید، طلاب و...) با موفقیت دانلود شد (${filename} — ${totalRecs} رکورد در ${totalCols} بخش، اعتبارسنجی سه‌مرحله‌ای تایید گردید).`
      });
    } catch (err: any) {
      console.error('Offline backup export error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در دانلود پشتیبان کامل: ${err?.message || 'خطای ناشناخته'}`
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Upload Backup to Cloud Database - 100% Comprehensive System Data
  const handleUploadToDatabase = async () => {
    setIsUploadingToCloud(true);
    setStatusMessage(null);
    try {
      // Regardless of user role, always backup 100% full system database
      const backupPackage = await localDb.exportFullBackup();

      const record = await uploadBackupToCloud(
        currentMentorId,
        currentMentor.name,
        currentMentor.role,
        backupPackage
      );

      setStatusMessage({
        type: 'success',
        text: `نسخه پشتیبان کامل سامانه (۱۰۰٪ دیتای کل نرم‌افزار) با موفقیت تحت نام «${currentMentor.name}» و تاریخ «${record.persianDate}» در دیتابیس ثبت و ذخیره گردید.`
      });

      await loadCloudBackups();
    } catch (err: any) {
      console.error('Database backup upload error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در ارسال نسخه پشتیبان به دیتابیس: ${err?.message || 'خطای اتصال'}`
      });
    } finally {
      setIsUploadingToCloud(false);
    }
  };

  // 3. Restore Data Logic (Handles Merge vs Overwrite with confirmation)
  const executeRestore = async (backupData: any, filename: string, overrideMode?: 'overwrite' | 'merge') => {
    const effectiveMode = overrideMode || importMode;
    setIsImporting(true);
    setStatusMessage(null);
    try {
      const result = await localDb.restoreAnyBackup(backupData, effectiveMode);
      setStatusMessage({
        type: 'success',
        text: result.message
      });
      await loadData();
    } catch (err: any) {
      console.error('Restore error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در بازیابی اطلاعات: ${err?.message || 'فرمت فایل پشتیبان نامعتبر است'}`
      });
    } finally {
      setIsImporting(false);
      setPendingFileToRestore(null);
      setShowOverwriteConfirmModal(false);
      setShowRestoreApplyModal(false);
      setCachedBackupForRestore(null);
      if (universalFileInputRef.current) universalFileInputRef.current.value = '';
    }
  };

  const handleSelectFileToRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsedData = JSON.parse(text);

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('فرمت فایل پشتیبان نامعتبر است.');
      }

      // Step 1: Cache the imported data first in memory state
      let totalRecords = 0;
      const moduleCounts: Record<string, number> = {
        طلاب: Array.isArray(parsedData.students) ? parsedData.students.length : (parsedData.student ? 1 : 0),
        مالی_و_شهریه: 0,
        آموزش_و_تقویم: 0,
        حضور_غیاب_و_مطالعه: 0,
        اساتید_و_پرسنل: 0,
        سایر_بخش‌ها: 0
      };

      for (const [key, val] of Object.entries(parsedData)) {
        if (!key.startsWith('_') && Array.isArray(val)) {
          totalRecords += val.length;
          if (key.startsWith('finance') || key.startsWith('tuition') || key.includes('meal') || key.includes('claim')) {
            moduleCounts.مالی_و_شهریه += val.length;
          } else if (key.startsWith('academic') || key === 'programs' || key === 'enrollments' || key === 'classrooms') {
            moduleCounts.آموزش_و_تقویم += val.length;
          } else if (key.startsWith('attendance') || key.startsWith('study')) {
            moduleCounts.حضور_غیاب_و_مطالعه += val.length;
          } else if (key.startsWith('teacher') || key === 'staff' || key === 'drivers') {
            moduleCounts.اساتید_و_پرسنل += val.length;
          } else if (key !== 'students') {
            moduleCounts.سایر_بخش‌ها += val.length;
          }
        }
      }

      setCachedBackupForRestore({
        data: parsedData,
        name: file.name,
        totalRecords,
        moduleCounts
      });

      // Step 2: Show the prominent message asking if they want to apply/load into the database
      setShowRestoreApplyModal(true);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `خطا در خواندن فایل انتخاب شده: ${err?.message || 'فایل JSON معتبر نیست'}`
      });
      if (universalFileInputRef.current) universalFileInputRef.current.value = '';
    }
  };

  const handleDownloadCloudRecord = (record: CloudBackupRecord) => {
    requirePassword(async () => {
      try {
        const pkg = await downloadBackupPackage(record);
        downloadJsonFile(pkg, record.fileName);
        setStatusMessage({
          type: 'success',
          text: `فایل پشتیبان دیتابیس «${record.fileName}» با موفقیت دانلود شد.`
        });
      } catch (e: any) {
        setStatusMessage({
          type: 'error',
          text: `خطا در دریافت فایل: ${e?.message || 'مشکل اتصال'}`
        });
      }
    });
  };

  const handleRestoreCloudRecord = (record: CloudBackupRecord) => {
    requirePassword(async () => {
      try {
        const pkg = await downloadBackupPackage(record);
        if (importMode === 'overwrite') {
          setPendingFileToRestore({ data: pkg, name: record.fileName });
          setShowOverwriteConfirmModal(true);
        } else {
          executeRestore(pkg, record.fileName, 'merge');
        }
      } catch (e: any) {
        setStatusMessage({
          type: 'error',
          text: `خطا در بازیابی فایل: ${e?.message || 'مشکل اتصال'}`
        });
      }
    });
  };

  const handleDeleteCloudRecord = async (record: CloudBackupRecord) => {
    requirePassword(async () => {
      try {
        await deleteCloudBackup(record);
        setStatusMessage({
          type: 'info',
          text: 'فایل پشتیبان انتخاب شده از دیتابیس حذف گردید.'
        });
        await loadCloudBackups();
      } catch (err: any) {
        console.error('Error deleting cloud backup:', err);
      }
    });
  };

  // Export photos package (JSON)
  const handleExportAllPhotosJson = async () => {
    try {
      const allStudents = await localDb.getDocs<Student>('students');
      const studentsWithPhotos = allStudents.filter((s) => s.photoUrl);
      const photoPackage = {
        _meta: {
          exportType: 'photos_only',
          exportDate: new Date().toISOString(),
          totalPhotos: studentsWithPhotos.length
        },
        photos: studentsWithPhotos.map((s) => ({
          studentId: s.id,
          studentName: s.name,
          nationalId: s.nationalId,
          photoUrl: s.photoUrl
        }))
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      downloadJsonFile(photoPackage, `آرشیو_عکس_طلاب_${dateStr}.json`);
      setStatusMessage({
        type: 'success',
        text: `پکیج اختصاصی عکس‌های طلاب با موفقیت دانلود شد (${studentsWithPhotos.length} عکس).`
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `خطا در استخراج عکس‌ها: ${e?.message || 'نامشخص'}`
      });
    }
  };

  // Upload and Match Photos by National ID (Individual files or ZIP folder)
  const handlePhotoFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsProcessingPhotos(true);
    setStatusMessage(null);

    const matchedList: { studentName: string; nationalId: string; fileName: string }[] = [];
    const unmatchedList: string[] = [];
    let processedCount = 0;

    try {
      const allStudents = await localDb.getDocs<Student>('students');
      const studentNatMap = new Map<string, Student>();
      allStudents.forEach(st => {
        if (st.nationalId) {
          const norm = normalizeNationalId(st.nationalId);
          if (norm) studentNatMap.set(norm, st);
        }
      });

      const files: File[] = Array.from(fileList);

      for (const file of files) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        // 1. ZIP File containing photos
        if (ext === '.zip') {
          try {
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(file);

            for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
              if (zipEntry.dir) continue;
              if (relativePath.includes('__MACOSX') || relativePath.startsWith('.')) continue;

              const entryName = relativePath.split('/').pop() || '';
              const entryExt = entryName.substring(entryName.lastIndexOf('.')).toLowerCase();

              if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].includes(entryExt)) {
                processedCount++;
                const extractedNatId = extractNationalIdFromFilename(entryName);
                const targetStudent = studentNatMap.get(extractedNatId);

                if (targetStudent) {
                  const base64 = await zipEntry.async('base64');
                  let mime = 'image/jpeg';
                  if (entryExt === '.png') mime = 'image/png';
                  else if (entryExt === '.webp') mime = 'image/webp';
                  const dataUrl = `data:${mime};base64,${base64}`;

                  targetStudent.photoUrl = dataUrl;
                  await localDb.updateDoc('students', targetStudent.id, { photoUrl: dataUrl });

                  matchedList.push({
                    studentName: targetStudent.name,
                    nationalId: targetStudent.nationalId || extractedNatId,
                    fileName: entryName
                  });
                } else {
                  unmatchedList.push(`${entryName} (کد استخراج شده: ${extractedNatId || 'نامشخص'})`);
                }
              }
            }
          } catch (zipErr: any) {
            console.error('Error unzipping photo folder:', zipErr);
            setStatusMessage({
              type: 'error',
              text: `خطا در خواندن پوشه ZIP عکس‌ها: ${zipErr?.message || 'نامعتبر'}`
            });
          }
        }
        // 2. Direct Image Files (.jpg, .png, etc.)
        else if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].includes(ext)) {
          processedCount++;
          const extractedNatId = extractNationalIdFromFilename(file.name);
          const targetStudent = studentNatMap.get(extractedNatId);

          if (targetStudent) {
            const dataUrl = await readFileAsDataUrl(file);
            targetStudent.photoUrl = dataUrl;
            await localDb.updateDoc('students', targetStudent.id, { photoUrl: dataUrl });

            matchedList.push({
              studentName: targetStudent.name,
              nationalId: targetStudent.nationalId || extractedNatId,
              fileName: file.name
            });
          } else {
            unmatchedList.push(`${file.name} (کد استخراج شده: ${extractedNatId || 'نامشخص'})`);
          }
        }
        // 3. JSON Photo Archive
        else if (ext === '.json') {
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const photoItems = parsed.photos || parsed.students || [];

            for (const item of photoItems) {
              const itemNatId = normalizeNationalId(item.nationalId || item.nationalCode || item.code);
              if (itemNatId && item.photoUrl) {
                processedCount++;
                const targetStudent = studentNatMap.get(itemNatId);
                if (targetStudent) {
                  targetStudent.photoUrl = item.photoUrl;
                  await localDb.updateDoc('students', targetStudent.id, { photoUrl: item.photoUrl });
                  matchedList.push({
                    studentName: targetStudent.name,
                    nationalId: targetStudent.nationalId || itemNatId,
                    fileName: `عکس ${targetStudent.name}`
                  });
                } else {
                  unmatchedList.push(`کد ملی ${itemNatId} مربوط به طلبه‌ای یافت نشد`);
                }
              }
            }
          } catch (jsonErr: any) {
            console.error('Error parsing photo json:', jsonErr);
          }
        }
      }

      setPhotoResult({
        matched: matchedList,
        unmatched: unmatchedList,
        totalFiles: processedCount
      });
      setShowPhotoResultModal(true);
      await loadData();
    } catch (err: any) {
      console.error('Photo upload processing error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در پردازش عکس‌ها: ${err?.message || 'نامشخص'}`
      });
    } finally {
      setIsProcessingPhotos(false);
      if (photoFileInputRef.current) photoFileInputRef.current.value = '';
    }
  };

  // Export Photos as ZIP Folder named by National ID
  const handleExportPhotosZip = async () => {
    setIsProcessingPhotos(true);
    setStatusMessage(null);
    try {
      const allStudents = await localDb.getDocs<Student>('students');
      const studentsWithPhotos = allStudents.filter(s => !!s.photoUrl);

      if (studentsWithPhotos.length === 0) {
        setStatusMessage({
          type: 'info',
          text: 'هیچ عکسی برای طلاب در پایگاه داده محلی ذخیره نشده است.'
        });
        setIsProcessingPhotos(false);
        return;
      }

      const zip = new JSZip();
      const folderName = `عکس_های_طلاب`;
      const photoFolder = zip.folder(folderName) || zip;

      let addedCount = 0;
      studentsWithPhotos.forEach(s => {
        if (s.photoUrl) {
          const { data, ext } = base64ToUint8Array(s.photoUrl);
          const natId = normalizeNationalId(s.nationalId) || s.id;
          const fileName = `${natId}.${ext}`;
          photoFolder.file(fileName, data);
          addedCount++;
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const dateStr = new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-');
      const zipFileName = `آرشیو_عکس_طلاب_کد_ملی_${dateStr}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: `پوشه فشرده (ZIP) شامل ${addedCount} عکس با نام‌های کد ملی با موفقیت دانلود شد (${zipFileName}).`
      });
    } catch (err: any) {
      console.error('Photo ZIP export error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در تولید فایل ZIP عکس‌ها: ${err?.message || 'نامشخص'}`
      });
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  // Mentor card information
  const mentorCards: MentorStats[] = [
    {
      id: 'hayati',
      name: 'استاد حیاتی',
      role: 'مسئول پایه ۷',
      gradeLabel: 'پایه ۷',
      avatarBg: 'bg-emerald-600',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      dotColor: 'bg-emerald-500',
      studentCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'hayati').length,
      photoCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'hayati' && s.photoUrl).length
    },
    {
      id: 'hosseini',
      name: 'استاد حسینی',
      role: 'مسئول پایه ۸',
      gradeLabel: 'پایه ۸',
      avatarBg: 'bg-sky-600',
      badgeBg: 'bg-sky-50',
      badgeText: 'text-sky-700',
      badgeBorder: 'border-sky-200',
      dotColor: 'bg-sky-500',
      studentCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'hosseini').length,
      photoCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'hosseini' && s.photoUrl).length
    },
    {
      id: 'soleimani',
      name: 'استاد سلیمانی',
      role: 'مسئول پایه ۹',
      gradeLabel: 'پایه ۹',
      avatarBg: 'bg-purple-600',
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      badgeBorder: 'border-purple-200',
      dotColor: 'bg-purple-500',
      studentCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'soleimani').length,
      photoCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'soleimani' && s.photoUrl).length
    },
    {
      id: 'asadi',
      name: 'استاد اسدی',
      role: 'مسئول پایه ۱۰',
      gradeLabel: 'پایه ۱۰',
      avatarBg: 'bg-rose-600',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
      badgeBorder: 'border-rose-200',
      dotColor: 'bg-rose-500',
      studentCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'asadi').length,
      photoCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'asadi' && s.photoUrl).length
    },
    {
      id: 'asadi',
      name: 'استاد اسدی',
      role: 'مسئول پایه ۱۰',
      gradeLabel: 'پایه ۱۰',
      avatarBg: 'bg-rose-600',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
      badgeBorder: 'border-rose-200',
      dotColor: 'bg-rose-500',
      studentCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'asadi').length,
      photoCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'asadi' && s.photoUrl).length
    },
    {
      id: 'shahpoori',
      name: 'مدیریت',
      role: 'مدیر اصلی',
      gradeLabel: 'کل پایه‌ها',
      avatarBg: 'bg-amber-600',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-200',
      dotColor: 'bg-amber-500',
      studentCount: students.length,
      photoCount: stats.totalPhotos
    }
  ];

  // Recent 4 cloud files for preview in database section
  const recentCloudFiles = cloudBackups.slice(0, 4);

  // Filtered files for "View All Files" modal
  const filteredModalFiles = cloudBackups.filter(r => {
    if (!fileSearchTerm.trim()) return true;
    const term = fileSearchTerm.trim().toLowerCase();
    return (
      r.fileName.toLowerCase().includes(term) ||
      r.mentorName.toLowerCase().includes(term) ||
      r.persianDate.includes(term)
    );
  });

  const isHeadManager = currentMentor.isHeadManager || currentMentorId === 'shahpoori' || isEduOrFinanceManager;

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-right font-vazir" dir="rtl">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={universalFileInputRef}
        onChange={handleSelectFileToRestore}
        accept=".json"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-800 via-indigo-700 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-xs font-bold backdrop-blur-md">
              <HardDrive size={14} className="text-emerald-300" />
              <span>پشتیبانی کامل آنلاین و آفلاین دیتابیس</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              بخش پشتیبانی و مدیریت فایل‌های دیتا
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              کاربر جاری: <strong className="text-amber-300">{currentMentor.name} ({currentMentor.role})</strong> — 
              در این بخش می‌توانید از دیتای اختصاصی خود پشتیبان آفلاین با نام و تاریخ دریافت کنید، نسخه پشتیبان را به دیتابیس ارسال کنید و یا با وارد کردن رمز عبور فایل‌های ثبت شده قبلی را دانلود و بازیابی نمایید.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-md border border-white/20">
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-white">{stats.totalStudents}</span>
              <span className="text-[11px] text-indigo-200">کل طلاب</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-emerald-300">{cloudBackups.length}</span>
              <span className="text-[11px] text-indigo-200">نسخه‌های دیتابیس</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-amber-300">{stats.totalPhotos}</span>
              <span className="text-[11px] text-indigo-200">عکس موجود</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Notifications */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl flex items-start gap-3 shadow-sm border",
              statusMessage.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-900",
              statusMessage.type === 'error' && "bg-rose-50 border-rose-200 text-rose-900",
              statusMessage.type === 'info' && "bg-sky-50 border-sky-200 text-sky-900"
            )}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={20} />}
            {statusMessage.type === 'error' && <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />}
            {statusMessage.type === 'info' && <Info className="text-sky-600 shrink-0 mt-0.5" size={20} />}
            <div className="flex-1 text-sm font-medium">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: Offline Backup & Upload to Database */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Offline Backup Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <Download size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">۱. دانلود پشتیبان کامل نرم‌افزار (۱۰۰٪ کل داده‌ها)</h2>
                <p className="text-xs text-slate-500">دانلود و ذخیره ۱۰۰٪ تمامی داده‌های نرم‌افزار روی سیستم شخصی</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>عنوان فایل خروجی:</span>
                <span className="text-indigo-600 font-mono text-[11px]">پشتیبان_کامل_سامانه_[تاریخ].json</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                تضمین ۱۰۰٪ دیتای نرم‌افزار: این فایل شامل کل داده‌های تمامی بخش‌ها (مسئول مالی و شهریه، سوپرادمین، مسئول آموزش، اساتید، حضور و غیاب، وام، امتحانات و طلاب با تمامی تصاویر) می‌باشد. فرقی ندارد کدام کاربر دانلود کند، در صورت بروز هرگونه مشکل، با بارگذاری مجدد این فایل کل سامانه به طور کامل احیا خواهد شد.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleExportOfflineBackup()}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2.5 py-4 px-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white rounded-2xl font-black transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50 text-sm"
          >
            {isExporting ? <RefreshCw size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
            <span>دانلود فایل پشتیبان کامل سامانه (۱۰۰٪ کل دیتای نرم‌افزار)</span>
          </button>
        </div>

        {/* Upload to Cloud Database Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CloudUpload size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">۲. ارسال نسخه پشتیبان کامل به دیتابیس</h2>
                <p className="text-xs text-slate-500">ثبت و ذخیره‌سازی نسخه پشتیبان ۱۰۰٪ دیتای نرم‌افزار در پایگاه داده</p>
              </div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs text-emerald-900 leading-relaxed">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>ذخیره خودکار در پایگاه داده:</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                با زدن این دکمه، ۱۰۰٪ دیتای جامع نرم‌افزار (شامل کلیه بخش‌های مالی، آموزش، اساتید، مدیریت و طلاب) در پایگاه داده همراه با برچسب زمان دقیق ثبت می‌گردد.
              </p>
            </div>
          </div>

          <button
            onClick={handleUploadToDatabase}
            disabled={isUploadingToCloud}
            className="w-full flex items-center justify-center gap-2.5 py-4 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-emerald-200 disabled:opacity-50 text-sm"
          >
            {isUploadingToCloud ? <RefreshCw size={18} className="animate-spin" /> : <CloudUpload size={18} />}
            <span>ارسال و ثبت نسخه پشتیبان جدید در دیتابیس</span>
          </button>
        </div>
      </div>

      {/* MYSQL 8 RUNFLARE DATABASE STATUS CARD */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">پایگاه داده اصلی سیستم (MySQL 8 روی رانفلر - Runflare)</h2>
                <span className="text-[11px] px-2.5 py-0.5 bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 rounded-full font-bold">
                  MySQL 8.0 Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                طبق دستور شما، دیتابیس Supabase به طور کامل قطع گردیده و تمامی تراکنش‌ها فقط روی دیتابیس MySQL 8 رانفلر ذخیره می‌شوند.
              </p>
            </div>
          </div>
        </div>

        {/* Supabase Connection Credentials Form (Toggleable) */}
        <AnimatePresence>
          {showCredentialsForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">تنظیمات مستقیم اتصال به دیتابیس Supabase در مرورگر</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    اگر از هاست کلادفلر یا دامنه اختصاصی استفاده می‌کنید، مقادیر پروژه خود را در این بخش بررسی یا وارد کنید.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaultCredentials}
                  className="text-xs text-amber-400 hover:text-amber-300 underline font-bold"
                >
                  بازنشانی به دیتابیس پیش‌فرض
                </button>
              </div>

              <form onSubmit={handleSaveCredentials} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    آدرس پروژه سوپابیس (Supabase URL):
                  </label>
                  <input
                    type="text"
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://xxxx.supabase.co"
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    کلید عمومی کلاینت (Supabase Publishable / Anon Key):
                  </label>
                  <input
                    type="text"
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    placeholder="sb_publishable_... یا eyJ..."
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    <span>ذخیره و تست اتصال</span>
                  </button>

                  {credentialsSavedMsg && (
                    <span className="text-xs text-emerald-400 font-bold animate-pulse">
                      {credentialsSavedMsg}
                    </span>
                  )}
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Database Test Result Status Message */}
        {dbTestResult && (
          <div className={cn(
            "p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3",
            dbTestResult.connected
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
              : "bg-amber-950/60 border-amber-500/40 text-amber-200"
          )}>
            {dbTestResult.connected ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <strong className="block font-bold">
                {dbTestResult.connected ? 'اتصال موفق به دیتابیس Supabase' : 'توجه: نیاز به ساخت جدول‌ها در Supabase'}
              </strong>
              <p className="text-[11px]">{dbTestResult.message}</p>
            </div>
          </div>
        )}

        {/* Step-by-step setup guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">۱</span>
              <span>کپی یا دانلود اسکریپت SQL</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              کدهای استاندارد شامل جدول‌های طلاب، اساتید، حضورغیاب، شهریه، باکت backups و مجوزها آماده شده‌اند.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">۲</span>
              <span>اجرا در SQL Editor سوپابیس</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              در پنل Supabase وارد بخش <strong>SQL Editor</strong> شده، کدهای کپی شده را Paste کنید و دکمه <strong>Run</strong> را بزنید.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">۳</span>
              <span>همگام‌سازی و بهره‌برداری</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              پس از اجرای اسکریپت، دکمه «تست اتصال» را بزنید و اطلاعات را با یک کلیک به دیتابیس منتقل نمایید.
            </p>
          </div>
        </div>

        {/* Action Buttons for SQL Script */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleCopySqlScript}
            className="flex items-center gap-2 py-3 px-5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            {copiedSql ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedSql ? 'کد اسکریپت SQL کپی شد!' : 'کپی اسکریپت کامل SQL ساخت جدول‌ها'}</span>
          </button>

          <button
            onClick={handleDownloadSqlScript}
            className="flex items-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            <Download size={15} />
            <span>دانلود فایل supabase_schema.sql</span>
          </button>

          <button
            onClick={() => setShowSqlCodeModal(true)}
            className="flex items-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            <Code size={15} />
            <span>مشاهده متن اسکریپت</span>
          </button>

          <button
            onClick={handleSyncAllToCloud}
            disabled={isSyncingAll}
            className="flex items-center gap-2 py-3 px-5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md mr-auto disabled:opacity-50"
          >
            {isSyncingAll ? <RefreshCw size={16} className="animate-spin" /> : <CloudUpload size={16} />}
            <span>
              {isSyncingAll
                ? `در حال همگام‌سازی (${syncProgress?.col || ''} - ${syncProgress?.pct || 0}%)...`
                : 'همگام‌سازی و انتقال کلیه اطلاعات به دیتابیس ابری'}
            </span>
          </button>
        </div>

        {/* DATABASE STRICT SYNC POLICY & MANAGER OFFLINE TOGGLE */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-4 text-right" dir="rtl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">سیاست ثبت همگام اطلاعات در پایگاه داده و مهلت ۴ ثانیه</h3>
                <p className="text-[11px] text-slate-400">
                  برای کلیه کاربران (به ویژه طلاب و سطح ۳)، ذخیره‌سازی آفلاین غیرفعال است و در صورت عدم اتصال یا ثبت نشدن ظرف ۴ ثانیه، خطا صادر می‌شود.
                </p>
              </div>
            </div>
          </div>

          {isEduOrFinanceManager ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-700/80">
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <span>حالت آفلاین اختیاری (ویژه مسئول آموزش و مسئول مالی)</span>
                  <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-mono">
                    {allowOfflineMode ? 'فعال' : 'غیرفعال (ثبت مستقیم ابری)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  با فعال‌سازی این گزینه، در صورت قطعی اینترنت اطلاعات شما موقتاً در حافظه لپ‌تاپ ذخیره و در اتصال بعدی با پایگاه داده همگام می‌شود. در صورت خاموش بودن، در قطعی اینترنت ثبت اطلاعات متوقف و خطا داده می‌شود.
                </p>
              </div>
              <button
                onClick={() => handleToggleOfflineMode(!allowOfflineMode)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2",
                  allowOfflineMode
                    ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600"
                )}
              >
                <HardDrive size={15} />
                <span>{allowOfflineMode ? 'غیرفعال‌سازی حالت آفلاین' : 'فعال‌سازی حالت آفلاین اختیاری'}</span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              ⚡ سیستم روی حالت «ثبت برخط و مستقیم در پایگاه داده» تنظیم است. هرگونه قطعی اینترنت یا تأخیر بیش از ۴ ثانیه بلافاصله توسط سیستم لغو شده و خطای عدم ثبت نمایش داده می‌شود.
            </div>
          )}
        </div>

        {/* DATA PURGE FOR PRODUCTION (پاکسازی اطلاعات تستی) */}
        <div className="bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 rounded-2xl p-5 space-y-4 text-right" dir="rtl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">آماده‌سازی نهایی و پاکسازی داده‌های تستی (پایان دوران تست)</h3>
                <p className="text-[11px] text-rose-300/80">
                  حذف کامل تمام اطلاعات تستی طلاب، حضور و غیاب، نمرات و سوابق با حفظ دقیق سوپر ادمین، کاربران سطح ۲، بانک دروس، مدرس‌ها و کلاس‌های درس.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePurgeTestData}
              disabled={isPurging}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-rose-950/50 flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isPurging ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
              <span>{isPurging ? 'در حال پاکسازی...' : 'پاکسازی اطلاعات تستی و آماده‌سازی'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Download Data from Database (Password Protected + Admin Access) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0">
              <CloudDownload size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800">۳. دانلود دیتا از دیتابیس</h2>
                <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">
                  <Lock size={12} /> نیازمند رمز عبور
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                لیست فایل‌های ثبت شده از نسخه‌های سابق کاربران همراه با امکان دانلود و مشاهده تاریخچه کامل
              </p>
            </div>
          </div>

          {/* Admin Mentor Filter Selector */}
          {isManager ? (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs">
              <ShieldCheck size={16} className="text-amber-600 shrink-0 mr-1" />
              <span className="font-bold text-slate-700 hidden md:inline">دسترسی مدیر (فیلتر کاربر):</span>
              <select
                value={selectedMentorFilter}
                onChange={(e) => setSelectedMentorFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-1.5 font-bold focus:outline-none text-xs"
              >
                <option value="all">همه کاربران (کل به‌روزرسانی‌ها)</option>
                <option value="hayati">استاد حیاتی (پایه ۷)</option>
                <option value="hosseini">استاد حسینی (پایه ۸)</option>
                <option value="soleimani">استاد سلیمانی (پایه ۹)</option>
                <option value="shahpoori">مدیریت (مدیر کل)</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200">
              <span>فایل‌های ثبت شده برای:</span>
              <span className="text-indigo-600">{currentMentor.name}</span>
            </div>
          )}
        </div>

        {/* Password Lock Status Banner or Prompt */}
        {!isPasswordVerified ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <KeyRound size={28} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-black text-slate-800">تأیید رمز عبور جهت مشاهده و دانلود فایل‌ها</h3>
              <p className="text-xs text-slate-500">
                جهت حفظ امنیت اطلاعات، تمامی دانلودهای این بخش مستلزم ورود رمز عبور می‌باشند.
              </p>
            </div>

            <form onSubmit={handleVerifyPassword} className="max-w-xs mx-auto flex gap-2">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="رمز عبور را وارد کنید..."
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shrink-0"
              >
                تأیید
              </button>
            </form>

            {passwordError && (
              <p className="text-xs font-bold text-rose-600">{passwordError}</p>
            )}
          </div>
        ) : (
          /* Unlocked Content: Display Recent Files List */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <History size={16} className="text-sky-600" />
                <span>لیست فایل‌های اخیر ثبت شده در دیتابیس ({recentCloudFiles.length} مورد از {cloudBackups.length}):</span>
              </div>

              <button
                onClick={() => setShowAllFilesModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-xl text-xs font-bold transition-all shadow-2xs"
              >
                <Eye size={15} />
                <span>مشاهده همه فایل‌ها ({cloudBackups.length})</span>
              </button>
            </div>

            {isLoadingCloud ? (
              <div className="py-12 text-center space-y-2 text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto text-sky-500" />
                <span className="text-xs">در حال دریافت فایل‌های دیتابیس...</span>
              </div>
            ) : recentCloudFiles.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs space-y-2">
                <FileJson size={32} className="mx-auto text-slate-300" />
                <p>هنوز نسخه پشتیبانی در دیتابیس ثبت نشده است.</p>
                <p className="text-[11px] text-slate-400">
                  از دکمه «ارسال نسخه پشتیبان به دیتابیس» بالا برای ذخیره‌سازی اولین نسخه استفاده کنید.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentCloudFiles.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-sky-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs sm:text-sm">{rec.fileName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="text-indigo-600 font-bold">{rec.mentorName}</span>
                          <span>•</span>
                          <span>{rec.persianDate}</span>
                        </div>
                      </div>

                      <span className="text-[10px] px-2.5 py-1 bg-white border border-slate-200 rounded-full font-bold text-slate-600 shrink-0">
                        {rec.fileSizeFormatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                      <button
                        onClick={() => handleDownloadCloudRecord(rec)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
                      >
                        <Download size={14} className="text-sky-600" />
                        <span>دانلود فایل</span>
                      </button>

                      <button
                        onClick={() => handleRestoreCloudRecord(rec)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        <Upload size={14} />
                        <span>بازیابی در سیستم</span>
                      </button>

                      <button
                        onClick={() => handleDeleteCloudRecord(rec)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        title="حذف از دیتابیس"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: Load Downloaded Backup into Software (Merge vs Full Overwrite) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <Upload size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">۴. بارگذاری فایل پشتیبان دانلودی در نرم‌افزار</h2>
            <p className="text-xs text-slate-500">انتخاب فایل پشتیبان (.json) و اعمال آن بر روی پایگاه داده محلی سیستم</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Mode Selector */}
          <div className="md:col-span-5 space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <label className="block text-xs font-bold text-slate-700">نحوه بارگذاری اطلاعات:</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setImportMode('merge')}
                className={cn(
                  "py-2 px-3 rounded-lg transition-all text-center",
                  importMode === 'merge' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                ادغام (پیش‌فرض)
              </button>
              <button
                onClick={() => setImportMode('overwrite')}
                className={cn(
                  "py-2 px-3 rounded-lg transition-all text-center",
                  importMode === 'overwrite' ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                جایگذاری کامل
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              {importMode === 'merge'
                ? 'حالت پیش‌فرض: اطلاعات جدید اضافه شده و رکوردها با حفظ پرونده‌های قبلی ادغام می‌گردند.'
                : 'حالت جایگذاری کامل: پیش از اعمال نیازمند تأییدیه کاربر می‌باشد و داده‌های فعلی پاک خواهند شد.'}
            </p>
          </div>

          {/* Upload Dropzone */}
          <div className="md:col-span-7 flex flex-col justify-center">
            <button
              onClick={() => universalFileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full h-full min-h-[120px] flex flex-col items-center justify-center gap-2 p-6 bg-purple-50/50 hover:bg-purple-100/60 border-2 border-dashed border-purple-300 hover:border-purple-500 text-purple-900 rounded-2xl font-bold transition-all disabled:opacity-50"
            >
              <Upload size={28} className="text-purple-600" />
              <span className="text-sm">انتخاب و بارگذاری فایل پشتیبان (.json)</span>
              <span className="text-[11px] text-purple-600/80 font-normal">کلیک کنید تا فایل از سیستم شما انتخاب گردد</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 5: Dedicated User Photo Management & Offline Backup */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
        {/* Hidden Photo File Input */}
        <input
          type="file"
          ref={photoFileInputRef}
          onChange={handlePhotoFilesUpload}
          accept=".jpg,.jpeg,.png,.webp,.bmp,.zip,.json"
          multiple
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Camera size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800">۵. بخش ویژه بارگذاری، تطبیق و پشتیبان‌گیری عکس‌های طلاب</h2>
                <span className="text-[11px] px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold flex items-center gap-1">
                  <ShieldCheck size={12} /> ۱۰۰٪ آفلاین
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                بارگذاری عکس‌ها (با کد ملی)، تطبیق هوشمند با طلاب و دریافت پوشه فشرده ZIP یا فایل پشتیبان آفلاین عکس‌ها
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-2xl text-xs font-bold text-slate-700 shrink-0">
            <ImageIcon size={16} className="text-amber-600" />
            <span>عکس‌های ثبت شده: </span>
            <span className="text-amber-700 text-sm font-black">{stats.totalPhotos}</span>
            <span className="text-slate-400">از {stats.totalStudents} طلبه</span>
          </div>
        </div>

        {/* Privacy & Cloud Exclusions Banner */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-bold">دستورالعمل محرمانه بودن عکس‌های طلاب:</strong>
            <p className="text-amber-800 text-[11px]">
              عکس‌های طلاب صرفاً به صورت آفلاین روی مرورگر سیستم شما ذخیره شده و فقط در پشتیبان‌گیری‌های آفلاین (فایل ZIP یا فایل‌های JSON محلی) قرار می‌گیرند. <strong>هنگام ارسال یا پشتیبان‌گیری در دیتابیس ابری، عکس‌ها به صورت خودکار حذف می‌گردند</strong> تا هیچ تصویری به سرور ارسال نشود.
            </p>
          </div>
        </div>

        {/* Grid Action Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Box 1: Upload Photos with National ID Matching */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <FolderUp size={18} className="text-indigo-600" />
                <span>الف) بارگذاری عکس‌ها / پوشه ZIP (تطبیق خودکار)</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                عکس یا پوشه فشرده (ZIP) عکس‌ها را انتخاب کنید. نام هر عکس باید برابر با <strong>کد ملی طلبه</strong> باشد (مثلاً <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-indigo-600">0012345678.jpg</code>). نرم‌افزار به صورت هوشمند هر عکس را به طلبه مربوطه متصل می‌نماید.
              </p>
            </div>

            <button
              onClick={() => photoFileInputRef.current?.click()}
              disabled={isProcessingPhotos}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50"
            >
              {isProcessingPhotos ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>در حال پردازش و تطبیق عکس‌ها...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>انتخاب عکس‌ها یا پوشه ZIP عکس (تطبیق با کد ملی)</span>
                </>
              )}
            </button>
          </div>

          {/* Box 2: Export Photos as ZIP Folder */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <FolderDown size={18} className="text-amber-600" />
                <span>ب) پشتیبان‌گیری و دانلود پوشه عکس‌های طلاب</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                با کلیک بر روی این دکمه، یک پوشه فشرده (ZIP) شامل تمام عکس‌های طلاب موجود در سیستم تولید و دانلود می‌شود. نام هر فایل داخل پوشه برابر با <strong>کد ملی طلبه</strong> خواهد بود.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleExportPhotosZip}
                disabled={isProcessingPhotos || stats.totalPhotos === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-amber-200 disabled:opacity-50"
              >
                {isProcessingPhotos ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <FolderDown size={16} />
                )}
                <span>دانلود پوشه ZIP عکس‌ها</span>
              </button>

              <button
                onClick={handleExportAllPhotosJson}
                disabled={isProcessingPhotos || stats.totalPhotos === 0}
                className="flex items-center justify-center gap-1.5 py-3 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                title="دانلود نسخه JSON آفلاین"
              >
                <Download size={14} className="text-slate-500" />
                <span>دانلود JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Database Stats Breakdown & Reset Button */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <span>آمار رکوردهای محلی:</span>
            <span className="font-bold text-slate-800">{stats.collectionCounts.students || 0} طلبه</span>
            <span>•</span>
            <span className="font-bold text-slate-800">{stats.collectionCounts.discussion_groups || 0} گروه مباحثه</span>
            <span>•</span>
            <span className="font-bold text-slate-800">{stats.collectionCounts.todos || 0} پیگیری</span>
            <span>•</span>
            <span className="font-bold text-slate-800">{stats.collectionCounts.research || 0} پژوهش</span>
            <span>•</span>
            <span className="font-bold text-slate-800">{stats.collectionCounts.study_periods || 0} دوره مطالعه</span>
          </div>

          <button
            onClick={() => setShowResetConfirmModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all font-bold shrink-0"
          >
            <Trash2 size={14} />
            <span>پاک‌سازی کامل دیتابیس محلی</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: Password Required Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 text-right"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <KeyRound size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">ورود رمز عبور جهت دانلود و بازیابی</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                جهت دسترسی به دیتای دیتابیس، لطفاً رمز عبور را وارد کنید:
              </p>

              <form onSubmit={handleVerifyPassword} className="space-y-3">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="رمز عبور..."
                  autoFocus
                  className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                />

                {passwordError && (
                  <p className="text-xs font-bold text-rose-600 text-center">{passwordError}</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    تأیید و ادامه
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPendingAction(null);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: View All Files Modal */}
      <AnimatePresence>
        {showAllFilesModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-3xl w-full border border-slate-200 shadow-2xl space-y-4 text-right max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">تاریخچه کامل فایل‌های دیتابیس</h3>
                    <p className="text-xs text-slate-500">لیست تمامی نسخه‌های ثبت شده به ترتیب تاریخ</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAllFilesModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={fileSearchTerm}
                  onChange={(e) => setFileSearchTerm(e.target.value)}
                  placeholder="جستجو بر اساس نام فایل، تاریخ یا اسم کاربر..."
                  className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Files Table / List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {filteredModalFiles.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">هیچ فایلی مطابق جستجوی شما پیدا نشد.</p>
                ) : (
                  filteredModalFiles.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-sky-300 transition-all text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <FileText size={15} className="text-sky-600 shrink-0" />
                          <span>{rec.fileName}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded-full font-bold text-slate-600">
                            {rec.fileSizeFormatted}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="text-indigo-600 font-bold">{rec.mentorName}</span>
                          <span>•</span>
                          <span>{rec.persianDate}</span>
                          <span>•</span>
                          <span>رکوردهای ثبت شده: {rec.totalRecords}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleDownloadCloudRecord(rec)}
                          className="flex items-center gap-1 py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
                        >
                          <Download size={13} className="text-sky-600" />
                          <span>دانلود</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowAllFilesModal(false);
                            handleRestoreCloudRecord(rec);
                          }}
                          className="flex items-center gap-1 py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <Upload size={13} />
                          <span>بازیابی</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Full Replacement / Overwrite Confirmation Modal */}
      <AnimatePresence>
        {showOverwriteConfirmModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-right"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">تأییدیه جایگذاری کامل اطلاعات</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                توجه: شما حالت <strong>«جایگذاری کامل»</strong> را انتخاب کرده‌اید. با تأیید این عملیات، تمامی داده‌های فعلی پایگاه داده محلی پاک شده و دقیقاً اطلاعات موجود در فایل <strong>«{pendingFileToRestore?.name}»</strong> جایگزین خواهد شد.
              </p>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-bold">
                آیا از جایگذاری کامل اطلاعات اطمینان دارید؟
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    if (pendingFileToRestore) {
                      executeRestore(pendingFileToRestore.data, pendingFileToRestore.name, 'overwrite');
                    }
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  تأیید و جایگذاری کامل
                </button>
                <button
                  onClick={() => {
                    setShowOverwriteConfirmModal(false);
                    setPendingFileToRestore(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Caching Step Confirmation & Apply to Database Modal */}
      <AnimatePresence>
        {showRestoreApplyModal && cachedBackupForRestore && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-slate-200 shadow-2xl space-y-5 text-right font-vazir"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0 shadow-inner">
                  <Database size={28} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black mb-1">
                    <CheckCircle2 size={13} />
                    <span>مرحله ۱: داده‌ها در حافظه موقت کش گردید</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    آیا می‌خواهید اطلاعات در دیتابیس نیز بارگذاری و اعمال شود؟
                  </h3>
                </div>
              </div>

              {/* Summary of cached file */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-700 font-bold border-b border-slate-200 pb-2">
                  <span>نام فایل پشتیبان:</span>
                  <span className="font-mono text-indigo-700 text-xs">{cachedBackupForRestore.name}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>مجموع رکوردهای شناسایی‌شده در فایل:</span>
                  <span className="font-black text-emerald-600 text-sm">{cachedBackupForRestore.totalRecords} رکورد</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">طلاب و پرونده‌ها:</span>
                    <strong className="text-indigo-600 font-bold">{cachedBackupForRestore.moduleCounts.طلاب || 0}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">بخش مالی و شهریه:</span>
                    <strong className="text-emerald-600 font-bold">{cachedBackupForRestore.moduleCounts.مالی_و_شهریه || 0}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">آموزش و تقویم:</span>
                    <strong className="text-amber-600 font-bold">{cachedBackupForRestore.moduleCounts.آموزش_و_تقویم || 0}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">حضور و مطالعه:</span>
                    <strong className="text-sky-600 font-bold">{cachedBackupForRestore.moduleCounts.حضور_غیاب_و_مطالعه || 0}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">اساتید و پرسنل:</span>
                    <strong className="text-purple-600 font-bold">{cachedBackupForRestore.moduleCounts.اساتید_و_پرسنل || 0}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">سایر جداول نرم‌افزار:</span>
                    <strong className="text-slate-700 font-bold">{cachedBackupForRestore.moduleCounts.سایر_بخش‌ها || 0}</strong>
                  </div>
                </div>
              </div>

              {/* Big Important Notice Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs text-amber-900 leading-relaxed">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                  <span>پیغام مهم سیستم: انتخاب نحوه اعمال در دیتابیس</span>
                </div>
                <p>
                  اطلاعات فایل در حافظه بررسی و کش گردیده است. اکنون مشخص نمایید مایلید داده‌ها چگونه در پایگاه داده اعمال شوند:
                </p>
              </div>

              {/* Two Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const pkg = cachedBackupForRestore.data;
                    const name = cachedBackupForRestore.name;
                    setShowRestoreApplyModal(false);
                    setCachedBackupForRestore(null);
                    executeRestore(pkg, name, 'merge');
                  }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-indigo-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    <span>تأیید و ادغام با دیتابیس (بدون حذف داده‌های دیگر)</span>
                  </div>
                  <span className="text-[11px] opacity-80 font-normal">پیشنهادی</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const pkg = cachedBackupForRestore.data;
                    const name = cachedBackupForRestore.name;
                    setShowRestoreApplyModal(false);
                    setCachedBackupForRestore(null);
                    executeRestore(pkg, name, 'overwrite');
                  }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-rose-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 size={18} />
                    <span>تأیید و جایگزینی کامل دیتابیس (پاک‌سازی قبلی و درج فایل)</span>
                  </div>
                  <span className="text-[11px] opacity-80 font-normal">جایگزینی صددرصد</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRestoreApplyModal(false);
                    setCachedBackupForRestore(null);
                    if (universalFileInputRef.current) universalFileInputRef.current.value = '';
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all text-center"
                >
                  انصراف و لغو اعمال در دیتابیس
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: Reset DB Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-right"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">آیا از حذف کامل اطلاعات اطمینان دارید؟</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                این عملیات تمامی طلاب، نمرات، عکس‌ها، دوره‌ها و داده‌های ذخیره شده در مرورگر را پاک می‌کند. قبل از این کار حتماً یک نسخه پشتیبان دانلود نمایید.
              </p>

              <div className="space-y-1 text-xs">
                <label className="text-slate-600 font-bold">جهت تأیید، عبارت «حذف» را تایپ کنید:</label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="حذف"
                  className="w-full p-2.5 border border-rose-200 rounded-xl text-center font-bold text-rose-700 bg-rose-50/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={async () => {
                    if (resetConfirmText.trim() === 'حذف') {
                      await localDb.resetAllDatabase();
                      setShowResetConfirmModal(false);
                      setResetConfirmText('');
                      setStatusMessage({
                        type: 'info',
                        text: 'تمامی اطلاعات پایگاه داده محلی پاک‌سازی شد.'
                      });
                      await loadData();
                    } else {
                      alert('عبارت تأیید صحیح نیست.');
                    }
                  }}
                  disabled={resetConfirmText.trim() !== 'حذف'}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all"
                >
                  تأیید و پاک‌سازی کامل
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirmModal(false);
                    setResetConfirmText('');
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: Photo Matching Result Modal */}
      <AnimatePresence>
        {showPhotoResultModal && photoResult && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-right max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">گزارش تطبیق و بارگذاری عکس‌های طلاب</h3>
                    <p className="text-xs text-slate-500">تعداد پردازش کل: {photoResult.totalFiles} فایل</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPhotoResultModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                {/* Summary Badges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-center space-y-0.5">
                    <span className="block text-xl font-black text-emerald-700">{photoResult.matched.length}</span>
                    <span className="text-xs font-bold text-emerald-800">عکس‌های منطبق شده</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-center space-y-0.5">
                    <span className="block text-xl font-black text-amber-700">{photoResult.unmatched.length}</span>
                    <span className="text-xs font-bold text-amber-800">عکس‌های بدون تطبیق</span>
                  </div>
                </div>

                {/* Matched List */}
                {photoResult.matched.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>طلاب به‌روزرسانی شده ({photoResult.matched.length} مورد):</span>
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-1.5 text-xs">
                      {photoResult.matched.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-800">{m.studentName}</span>
                          <span className="text-[11px] text-slate-500 font-mono">کد ملی: {m.nationalId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched List */}
                {photoResult.unmatched.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <AlertTriangle size={15} className="text-amber-600" />
                      <span>عکس‌های بدون کد ملی مطابقت یافته ({photoResult.unmatched.length} مورد):</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      مطمئن شوید نام فایل دقیقاً برابر کد ملی طلبه در سیستم است (مثلاً 0012345678.jpg).
                    </p>
                    <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 max-h-36 overflow-y-auto space-y-1 text-xs font-mono text-amber-900">
                      {photoResult.unmatched.map((u, idx) => (
                        <div key={idx} className="py-1 border-b border-amber-100 last:border-0 truncate">
                          • {u}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowPhotoResultModal(false)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  متوجه شدم و بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Supabase SQL Script Code Modal */}
        {showSqlCodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database size={20} className="text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">کدهای SQL ایجاد جدول‌ها و تنظیمات Supabase</h3>
                </div>
                <button
                  onClick={() => setShowSqlCodeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                این اسکریپت را کپی کرده و در داشبورد Supabase در مسیر <strong>SQL Editor</strong> قرار داده و دکمه <strong>Run</strong> را بزنید:
              </p>

              <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed dir-ltr select-all">
                <pre>{SUPABASE_SCHEMA_SQL}</pre>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySqlScript}
                    className="flex items-center gap-1.5 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSql ? 'کپی شد!' : 'کپی کدهای SQL'}</span>
                  </button>

                  <button
                    onClick={handleDownloadSqlScript}
                    className="flex items-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700"
                  >
                    <Download size={14} />
                    <span>دانلود فایل supabase_schema.sql</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowSqlCodeModal(false)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
}
