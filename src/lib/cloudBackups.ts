import { localDb } from './localDb';

export function getFolderForMentor(mentorId: string): string {
  switch (mentorId) {
    case 'hosseini':
      return 'hosseini';
    case 'hayati':
      return 'hayati';
    case 'soleimani':
    case 'soleymani':
      return 'soleymani';
    case 'asadi':
      return 'asadi';
    case 'shahpoori':
    case 'boss':
      return 'boss';
    default:
      return 'boss';
  }
}

export interface CloudBackupRecord {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorRole: string;
  fileName: string;
  folderPath?: string;
  createdAt: string;
  persianDate: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  totalRecords: number;
  studentCount: number;
  backupData: any;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '۰ کیلوبایت';
  const k = 1024;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val.toLocaleString('fa-IR')} ${sizes[i]}`;
}

export function getPersianDateTime(dateInput: Date | string = new Date()): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  try {
    const dStr = date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const tStr = date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    return `${dStr} - ساعت ${tStr}`;
  } catch (e) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function generateBackupFilename(mentorName: string, dateInput: Date = new Date()): string {
  const cleanName = (mentorName || 'کاربر').replace(/\s+/g, '_');
  let dStr = '';
  try {
    dStr = dateInput.toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-');
  } catch (e) {
    dStr = dateInput.toISOString().slice(0, 10);
  }
  const timeStr = dateInput.toTimeString().slice(0, 5).replace(/:/g, '-');
  return `پشتیبان_${cleanName}_${dStr}_${timeStr}.json`;
}

export function generateStorageKey(mentorId: string, dateInput: Date = new Date()): string {
  const cleanId = (mentorId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
  let dStr = '';
  try {
    dStr = dateInput.toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-');
  } catch (e) {
    dStr = dateInput.toISOString().slice(0, 10);
  }
  const timeStr = dateInput.toTimeString().slice(0, 5).replace(/:/g, '-');
  return `backup_${cleanId}_${dStr}_${timeStr}.json`;
}

export function stripPhotosFromBackupPackage(backupPackage: any): any {
  if (!backupPackage || typeof backupPackage !== 'object') return backupPackage;
  const cloned = JSON.parse(JSON.stringify(backupPackage));

  if (cloned._meta) {
    cloned._meta.hasPhotos = false;
  }

  if (Array.isArray(cloned.students)) {
    cloned.students = cloned.students.map((s: any) => {
      if (s) {
        delete s.photoUrl;
      }
      return s;
    });
  }

  if (cloned.student && typeof cloned.student === 'object') {
    delete cloned.student.photoUrl;
  }

  return cloned;
}

/**
 * Uploads a backup package to Dedicated Server Storage & Local DB
 */
export async function uploadBackupToCloud(
  mentorId: string,
  mentorName: string,
  mentorRole: string,
  backupPackage: any
): Promise<CloudBackupRecord> {
  const now = new Date();
  
  // Rule: Photos are stored ONLY offline. Strip photoUrl completely before uploading to cloud database.
  const sanitizedPackage = stripPhotosFromBackupPackage(backupPackage);

  const jsonStr = JSON.stringify(sanitizedPackage, null, 2);
  const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
  const fileSizeBytes = jsonBlob.size;
  const fileName = generateBackupFilename(mentorName, now);
  const storageKey = generateStorageKey(mentorId, now);

  const folder = getFolderForMentor(mentorId);
  const filePath = `${folder}/${storageKey}`;

  const studentCount = Array.isArray(sanitizedPackage.students) 
    ? sanitizedPackage.students.length 
    : (sanitizedPackage.student ? 1 : 0);

  const totalRecords = sanitizedPackage._meta?.totalRecords || 
    (Array.isArray(sanitizedPackage.students) ? sanitizedPackage.students.length : 1);

  // 1. Try saving directly to Server Backups (/api/backups)
  let savedOnServer = false;
  try {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/backups', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        fileName,
        backupPackage: sanitizedPackage,
        record: {
          id: `backup_${mentorId}_${Date.now()}`,
          mentorId,
          mentorName,
          mentorRole,
          persianDate: getPersianDateTime(now),
          totalRecords,
          studentCount
        }
      })
    });

    if (res.ok) {
      savedOnServer = true;
    }
  } catch (serverErr) {
    console.warn('Server backup save notice:', serverErr);
  }

  const recordId = `backup_${mentorId}_${Date.now()}`;

  const record: CloudBackupRecord = {
    id: recordId,
    mentorId,
    mentorName,
    mentorRole,
    fileName,
    folderPath: filePath,
    createdAt: now.toISOString(),
    persianDate: getPersianDateTime(now),
    fileSizeBytes,
    fileSizeFormatted: formatBytes(fileSizeBytes),
    totalRecords,
    studentCount,
    backupData: backupPackage
  };

  // 2. Sync metadata via Server Data API if not already persisted
  if (!savedOnServer) {
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/data/cloud_backups', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(record)
      });
    } catch (e) {
      console.warn('Server cloud_backups sync notice:', e);
    }
  }

  // 3. Always store in local IndexedDB store
  await localDb.addDoc('cloud_backups', record);

  return record;
}

/**
 * Fetches backups from Server Database & Local DB
 */
export async function fetchCloudBackups(
  filterMentorId?: string,
  isManager: boolean = false
): Promise<CloudBackupRecord[]> {
  const allRecordsMap = new Map<string, CloudBackupRecord>();

  // 1. Fetch from Dedicated Server Storage (/api/backups)
  try {
    const res = await fetch('/api/backups');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.items)) {
        json.items.forEach((item: any) => {
          allRecordsMap.set(item.id, item);
        });
      }
    }
  } catch (e) {
    console.warn('Server backups fetch notice:', e);
  }

  // 2. Fetch from Local IndexedDB store
  try {
    const localRecords = await localDb.getDocs<CloudBackupRecord>('cloud_backups');
    localRecords.forEach(rec => {
      if (!allRecordsMap.has(rec.id)) {
        allRecordsMap.set(rec.id, rec);
      }
    });
  } catch (e) {
    console.error('Error fetching local backups store:', e);
  }

  const activeMentorId = isManager ? (filterMentorId || 'all') : filterMentorId;

  let list = Array.from(allRecordsMap.values());

  // Sort by created date descending
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // STRICT SECURITY FILTERING:
  // If user is NOT a manager, strictly restrict to their own mentor folder/id ONLY
  if (!isManager) {
    const targetFolder = getFolderForMentor(activeMentorId || '');
    return list.filter(r => 
      r.mentorId === activeMentorId || 
      (targetFolder && getFolderForMentor(r.mentorId) === targetFolder)
    );
  }

  // If user IS a manager, apply specific mentor filter if selected
  if (activeMentorId && activeMentorId !== 'all') {
    const targetFolder = getFolderForMentor(activeMentorId);
    return list.filter(r => 
      r.mentorId === activeMentorId || 
      (targetFolder && getFolderForMentor(r.mentorId) === targetFolder)
    );
  }

  return list;
}

/**
 * Downloads full backup content from Server Storage if backupData is missing
 */
export async function downloadBackupPackage(record: CloudBackupRecord): Promise<any> {
  if (record.backupData) {
    return record.backupData;
  }

  try {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : '';
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/backups/${encodeURIComponent(record.id)}`, { headers });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.item?.backupData) {
        return json.item.backupData;
      }
    }
  } catch (e) {
    console.error('Error downloading from Server Storage:', e);
  }

  throw new Error('محتوای فایل پشتیبان یافت نشد.');
}

/**
 * Deletes a backup record from Dedicated Server & Local DB
 */
export async function deleteCloudBackup(backupRecord: CloudBackupRecord): Promise<void> {
  // 1. Delete from Server Storage API
  try {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : '';
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`/api/backups/${encodeURIComponent(backupRecord.id)}`, {
      method: 'DELETE',
      headers,
      credentials: 'include'
    });
  } catch (e) {
    console.warn('Server backup deletion notice:', e);
  }

  // Delete from Local DB
  await localDb.deleteDoc('cloud_backups', backupRecord.id);
}
