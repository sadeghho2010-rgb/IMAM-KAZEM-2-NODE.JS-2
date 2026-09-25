import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Student } from '../types';
import { isStudentActive, getMentorKeyForGrade } from '../lib/localDb';
import { useAuth } from './AuthContext';

export type MentorId = 'hayati' | 'hosseini' | 'soleimani' | 'asadi' | 'shahpoori';
export type ShahpooriFilter = 'all' | 'hayati' | 'hosseini' | 'soleimani' | 'asadi';

export interface MentorInfo {
  id: MentorId;
  name: string;
  role: string;
  gradeLabel: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  isHeadManager?: boolean;
}

export const MENTORS: Record<MentorId, MentorInfo> = {
  hayati: {
    id: 'hayati',
    name: 'استاد حیاتی',
    role: 'مسئول پایه ۷',
    gradeLabel: 'پایه ۷',
    avatarBg: 'bg-emerald-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  hosseini: {
    id: 'hosseini',
    name: 'استاد حسینی',
    role: 'مسئول پایه ۸',
    gradeLabel: 'پایه ۸',
    avatarBg: 'bg-sky-600',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
    dotColor: 'bg-sky-500',
  },
  soleimani: {
    id: 'soleimani',
    name: 'استاد سلیمانی',
    role: 'مسئول پایه ۹',
    gradeLabel: 'پایه ۹',
    avatarBg: 'bg-purple-600',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    dotColor: 'bg-purple-500',
  },
  asadi: {
    id: 'asadi',
    name: 'استاد اسدی',
    role: 'مسئول پایه ۱۰',
    gradeLabel: 'پایه ۱۰',
    avatarBg: 'bg-rose-600',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    dotColor: 'bg-rose-500',
  },
  shahpoori: {
    id: 'shahpoori',
    name: 'استاد شاهپوری',
    role: 'مسئول آموزش',
    gradeLabel: 'کل پایه‌ها',
    avatarBg: 'bg-amber-600',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    isHeadManager: true,
  },
};

export function getStudentMentorKey(grade?: string): 'hayati' | 'hosseini' | 'soleimani' | 'asadi' | 'other' {
  return getMentorKeyForGrade(grade);
}

export function resolveMentorIdForUser(user: any): MentorId {
  if (!user) return 'shahpoori';

  const uname = (user.username || '').toUpperCase();
  const role = user.role || '';
  const scope = user.scope || '';
  const gradeLabel = user.gradeLabel || '';
  const mentorId = (user.mentorId || '') as MentorId;

  // Grade 7 Mentor (استاد حیاتی)
  if (
    uname === 'ISJ' || 
    scope === 'grade_7' || 
    mentorId === 'hayati' ||
    role === 'grade_supervisor_7' ||
    (role === 'grade_mentor' && (gradeLabel.includes('7') || gradeLabel.includes('۷') || gradeLabel.includes('هفت')))
  ) {
    return 'hayati';
  }

  // Grade 8 Mentor (استاد حسینی)
  if (
    uname === 'HO' || 
    scope === 'grade_8' || 
    mentorId === 'hosseini' ||
    role === 'grade_supervisor_8' ||
    (role === 'grade_mentor' && (gradeLabel.includes('8') || gradeLabel.includes('۸') || gradeLabel.includes('هشت')))
  ) {
    return 'hosseini';
  }

  // Grade 9 Mentor (استاد سلیمانی)
  if (
    uname === 'SOL' || 
    scope === 'grade_9' || 
    mentorId === 'soleimani' ||
    role === 'grade_supervisor_9' ||
    (role === 'grade_mentor' && (gradeLabel.includes('9') || gradeLabel.includes('۹') || gradeLabel.includes('نهم') || gradeLabel.includes('نه')))
  ) {
    return 'soleimani';
  }

  // Grade 10 Mentor (استاد اسدی)
  if (
    uname === 'ASADI' || 
    scope === 'grade_10' || 
    mentorId === 'asadi' ||
    role === 'grade_supervisor_10' ||
    (role === 'grade_mentor' && (gradeLabel.includes('10') || gradeLabel.includes('۱۰') || gradeLabel.includes('دهم') || gradeLabel.includes('ده')))
  ) {
    return 'asadi';
  }

  // Education Manager (استاد شاهپوری), Super Admin (صادق), School Manager (استاد رهنما), Research Manager (استاد یزدانی), Finance Manager (مسئول مالی)
  return 'shahpoori';
}

interface MentorContextType {
  currentMentorId: MentorId;
  currentMentor: MentorInfo;
  setCurrentMentorId: (id: MentorId) => void;
  shahpooriFilter: ShahpooriFilter;
  setShahpooriFilter: (filter: ShahpooriFilter) => void;
  filterStudents: (students: Student[], onlyActive?: boolean) => Student[];
  getMentorForStudent: (grade?: string) => MentorInfo | null;
  isMentorModalOpen: boolean;
  setIsMentorModalOpen: (open: boolean) => void;
}

const MentorContext = createContext<MentorContextType | undefined>(undefined);

export const MentorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [currentMentorId, setCurrentMentorIdState] = useState<MentorId>(() => {
    return resolveMentorIdForUser(currentUser);
  });

  const [shahpooriFilter, setShahpooriFilterState] = useState<ShahpooriFilter>('all');
  const [isMentorModalOpen, setIsMentorModalOpen] = useState<boolean>(false);

  // Automatically sync mentor context whenever the logged-in user changes
  useEffect(() => {
    const targetMentorId = resolveMentorIdForUser(currentUser);
    setCurrentMentorIdState(targetMentorId);

    // If education manager, super admin, or school manager, default to seeing all grades
    if (targetMentorId === 'shahpoori') {
      setShahpooriFilterState('all');
    }

    try {
      localStorage.setItem('current_mentor_id', targetMentorId);
    } catch (e) {}
  }, [currentUser]);

  const setCurrentMentorId = (id: MentorId) => {
    setCurrentMentorIdState(id);
    try {
      localStorage.setItem('current_mentor_id', id);
    } catch (e) {}
  };

  const setShahpooriFilter = (filter: ShahpooriFilter) => {
    setShahpooriFilterState(filter);
    try {
      localStorage.setItem('shahpoori_active_filter', filter);
    } catch (e) {}
  };

  // Dynamically resolve mentor badge and identity according to active user
  const currentMentor = useMemo<MentorInfo>(() => {
    if (currentMentorId === 'shahpoori') {
      if (currentUser?.role === 'super_admin' || currentUser?.username?.toUpperCase() === 'SADEGH') {
        return {
          id: 'shahpoori',
          name: currentUser?.name || 'صادق (سوپر ادمین)',
          role: 'مدیر کل سیستم',
          gradeLabel: 'کل سیستم',
          avatarBg: 'bg-indigo-700',
          badgeBg: 'bg-indigo-50',
          badgeText: 'text-indigo-800',
          badgeBorder: 'border-indigo-200',
          dotColor: 'bg-indigo-500',
          isHeadManager: true,
        };
      }
      if (currentUser?.role === 'school_manager' || currentUser?.username?.toUpperCase() === 'RAHNAMA') {
        return {
          id: 'shahpoori',
          name: currentUser?.name || 'استاد رهنما',
          role: 'مدیر مدرسه',
          gradeLabel: 'کل سیستم',
          avatarBg: 'bg-slate-700',
          badgeBg: 'bg-slate-100',
          badgeText: 'text-slate-800',
          badgeBorder: 'border-slate-300',
          dotColor: 'bg-slate-500',
          isHeadManager: true,
        };
      }
      if (currentUser?.role === 'research_manager' || currentUser?.username?.toUpperCase() === 'YAZDANI') {
        return {
          id: 'shahpoori',
          name: currentUser?.name || 'استاد یزدانی',
          role: 'مسئول پژوهش',
          gradeLabel: 'بخش پژوهش',
          avatarBg: 'bg-teal-700',
          badgeBg: 'bg-teal-50',
          badgeText: 'text-teal-800',
          badgeBorder: 'border-teal-200',
          dotColor: 'bg-teal-500',
          isHeadManager: true,
        };
      }
      if (currentUser?.role === 'finance_manager' || currentUser?.username?.toUpperCase() === 'MALI') {
        return {
          id: 'shahpoori',
          name: currentUser?.name || 'مسئول مالی',
          role: 'امور مالی',
          gradeLabel: 'کل سیستم',
          avatarBg: 'bg-cyan-700',
          badgeBg: 'bg-cyan-50',
          badgeText: 'text-cyan-800',
          badgeBorder: 'border-cyan-200',
          dotColor: 'bg-cyan-500',
          isHeadManager: true,
        };
      }
      // Default for Education Manager (استاد شاهپوری)
      return MENTORS.shahpoori;
    }

    return MENTORS[currentMentorId] || MENTORS.shahpoori;
  }, [currentMentorId, currentUser]);

  const getMentorForStudent = (grade?: string): MentorInfo | null => {
    const key = getStudentMentorKey(grade);
    if (key !== 'other') {
      return MENTORS[key];
    }
    return null;
  };

  const filterStudents = (students: Student[], onlyActive: boolean = true): Student[] => {
    return students.filter(s => {
      // In User Management ("مدیریت همه کاربران"), all students are shared across mentors
      if (!onlyActive) return true;

      // For active students / other tabs:
      if (!isStudentActive(s)) return false;

      // If Education Manager / Head Manager (Shahpoori / Level 1) or scope is all:
      if (currentMentorId === 'shahpoori') {
        if (shahpooriFilter === 'all') return true;
        const key = getStudentMentorKey(s.grade);
        return key === shahpooriFilter;
      }

      // For individual grade mentors (Hayati = 7, Hosseini = 8, Soleimani = 9, Asadi = 10):
      const mentorKey = getStudentMentorKey(s.grade);
      return mentorKey === currentMentorId;
    });
  };

  return (
    <MentorContext.Provider
      value={{
        currentMentorId,
        currentMentor,
        setCurrentMentorId,
        shahpooriFilter,
        setShahpooriFilter,
        filterStudents,
        getMentorForStudent,
        isMentorModalOpen,
        setIsMentorModalOpen,
      }}
    >
      {children}
    </MentorContext.Provider>
  );
};

export const useMentor = () => {
  const context = useContext(MentorContext);
  if (!context) {
    throw new Error('useMentor must be used within a MentorProvider');
  }
  return context;
};
