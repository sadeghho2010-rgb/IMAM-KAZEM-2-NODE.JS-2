import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  Printer, 
  Copy, 
  Check, 
  BookOpen, 
  Layers, 
  UserCheck, 
  Building, 
  Info,
  CalendarDays,
  ChevronLeft,
  XCircle,
  HelpCircle,
  Save,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMentor } from '../context/MentorContext';
import { localDb } from '../lib/localDb';
import { Student, Program, Enrollment, DiscussionGroup, MadrasRoom, ConsultationAdvisorProposal, ProposedConsultationClass, CustomStudentSchedule } from '../types';

interface ConsultationAdvisorProps {
  onNavigate?: (tab: string, studentId?: string) => void;
}

interface ClassSlotConfig {
  id: string;
  name: string;
  advisorName: string;
}

const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه'];

// Standard suggested 2-day patterns per institutional rules
const COMMON_DAY_PAIRS = [
  { days: ['شنبه', 'سه‌شنبه'], label: 'شنبه و سه‌شنبه' },
  { days: ['یکشنبه', 'چهارشنبه'], label: 'یک‌شنبه و چهارشنبه' }
];

// 1-Hour standard slots on the hour from 07:00 to 17:00
export const HOURLY_TIME_SLOTS = [
  { start: '07:00', end: '08:00', hour: 7, label: 'ساعت ۰۷:۰۰ تا ۰۸:۰۰ (صبح)' },
  { start: '08:00', end: '09:00', hour: 8, label: 'ساعت ۰۸:۰۰ تا ۰۹:۰۰ (صبح)' },
  { start: '09:00', end: '10:00', hour: 9, label: 'ساعت ۰۹:۰۰ تا ۱۰:۰۰ (صبح)' },
  { start: '10:00', end: '11:00', hour: 10, label: 'ساعت ۱۰:۰۰ تا ۱۱:۰۰ (صبح)' },
  { start: '11:00', end: '12:00', hour: 11, label: 'ساعت ۱۱:۰۰ تا ۱۲:۰۰ (ظهر)' },
  { start: '12:00', end: '13:00', hour: 12, label: 'ساعت ۱۲:۰۰ تا ۱۳:۰۰ (ظهر)' },
  { start: '13:00', end: '14:00', hour: 13, label: 'ساعت ۱۳:۰۰ تا ۱۴:۰۰ (عصر)' },
  { start: '14:00', end: '15:00', hour: 14, label: 'ساعت ۱۴:۰۰ تا ۱۵:۰۰ (عصر)' },
  { start: '15:00', end: '16:00', hour: 15, label: 'ساعت ۱۵:۰۰ تا ۱۶:۰۰ (عصر)' },
  { start: '16:00', end: '17:00', hour: 16, label: 'ساعت ۱۶:۰۰ تا ۱۷:۰۰ (عصر)' },
  { start: '17:00', end: '18:00', hour: 17, label: 'ساعت ۱۷:۰۰ تا ۱۸:۰۰ (عصر)' },
];

export const normalizeGrade = (gradeStr?: string): string => {
  if (!gradeStr) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
  let normalized = gradeStr.toString().trim();
  for (let i = 0; i < 10; i++) {
    normalized = normalized.split(persianDigits[i]).join(i.toString());
    normalized = normalized.split(arabicDigits[i]).join(i.toString());
  }
  const digits = normalized.replace(/\D/g, '');
  if (digits) {
    return `پایه ${digits}`;
  }
  return normalized;
};

export const gradesMatch = (gradeA?: string, gradeB?: string): boolean => {
  if (!gradeA && !gradeB) return true;
  if (!gradeA || !gradeB) return false;
  return normalizeGrade(gradeA) === normalizeGrade(gradeB);
};

export const ConsultationAdvisor: React.FC<ConsultationAdvisorProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { currentMentor } = useMentor();

  // Wizard Step (1 to 7)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Data Loaded from LocalDB
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [discussionGroups, setDiscussionGroups] = useState<DiscussionGroup[]>([]);
  const [classrooms, setClassrooms] = useState<MadrasRoom[]>([]);
  const [customSchedules, setCustomSchedules] = useState<CustomStudentSchedule[]>([]);
  const [savedProposals, setSavedProposals] = useState<ConsultationAdvisorProposal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Wizard Form States
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [includeAllProgramTypes, setIncludeAllProgramTypes] = useState<boolean>(false);
  const [selectedMainProgramId, setSelectedMainProgramId] = useState<string>('');
  const [numberOfClasses, setNumberOfClasses] = useState<number>(2);
  const [minCapacity, setMinCapacity] = useState<number>(3);
  const [maxCapacity, setMaxCapacity] = useState<number>(8);
  const [classConfigs, setClassConfigs] = useState<ClassSlotConfig[]>([]);

  // 2-Days & Time Priorities Form States
  const [selectedDays, setSelectedDays] = useState<string[]>(['شنبه', 'سه‌شنبه']);
  const [priority1Time, setPriority1Time] = useState<{ start: string; end: string }>({ start: '15:00', end: '16:00' });
  const [enablePriority2, setEnablePriority2] = useState<boolean>(false);
  const [priority2Time, setPriority2Time] = useState<{ start: string; end: string }>({ start: '16:00', end: '17:00' });

  // Generated Result
  const [proposalResult, setProposalResult] = useState<ConsultationAdvisorProposal | null>(null);
  const [alternativeProposalResult, setAlternativeProposalResult] = useState<ConsultationAdvisorProposal | null>(null);
  const [activeViewPriority, setActiveViewPriority] = useState<1 | 2>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Determine user's restricted grade
  const isSuperOrEducation = currentUser?.level === 1 || 
    currentUser?.role === 'super_admin' || 
    currentUser?.role === 'education_manager' || 
    currentUser?.username?.toUpperCase() === 'SHAH';

  const userGrade = currentUser?.gradeLabel || currentMentor?.gradeLabel || '';

  // Load all initial data
  useEffect(() => {
    loadData();
    const unsub = localDb.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sData, pData, eData, dgData, crData, csData] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<DiscussionGroup>('discussion_groups'),
        localDb.getDocs<MadrasRoom>('classrooms'),
        localDb.getDocs<CustomStudentSchedule>('custom_student_schedules')
      ]);

      setStudents(sData || []);
      setPrograms(pData || []);
      setEnrollments(eData || []);
      setDiscussionGroups(dgData || []);
      setClassrooms(crData || []);
      setCustomSchedules(csData || []);

      // Load saved proposals from localStorage
      try {
        const storedProposals = localStorage.getItem('consultation_advisor_proposals_v1');
        if (storedProposals) {
          setSavedProposals(JSON.parse(storedProposals));
        }
      } catch (err) {
        console.error('Error loading saved proposals:', err);
      }

      // Initial grade setup
      if (!isSuperOrEducation && userGrade) {
        setSelectedGrade(normalizeGrade(userGrade));
      } else {
        setSelectedGrade('پایه 7');
      }
    } catch (e) {
      console.error('Error loading consultation advisor data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Available grades list dynamically aggregated
  const availableGrades = useMemo(() => {
    if (!isSuperOrEducation && userGrade) {
      return [normalizeGrade(userGrade) || userGrade];
    }
    const defaultGrades = ['پایه 7', 'پایه 8', 'پایه 9', 'پایه 10', 'پایه 11'];
    const detectedGrades = new Set<string>(defaultGrades);
    
    programs.forEach(p => {
      if (p.grade) detectedGrades.add(normalizeGrade(p.grade));
    });
    students.forEach(s => {
      if (s.grade) detectedGrades.add(normalizeGrade(s.grade));
    });

    return Array.from(detectedGrades).filter(Boolean).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [isSuperOrEducation, userGrade, programs, students]);

  // Ensure selectedGrade is valid
  useEffect(() => {
    if (availableGrades.length > 0) {
      if (!selectedGrade || !availableGrades.some(g => gradesMatch(g, selectedGrade))) {
        setSelectedGrade(availableGrades[0]);
      }
    }
  }, [availableGrades, selectedGrade]);

  // Main programs matching selected grade
  const filteredMainPrograms = useMemo(() => {
    return programs.filter(p => {
      // Must match selected grade
      const matchGrade = selectedGrade ? gradesMatch(p.grade, selectedGrade) : true;
      if (!matchGrade) return false;
      
      // Default: exclude consultation classes (p.type === 'مشاوره')
      if (includeAllProgramTypes) return true;
      return p.type !== 'مشاوره';
    });
  }, [programs, selectedGrade, includeAllProgramTypes]);

  // Selected Program Details & Enrolled Students
  const selectedProgram = useMemo(() => {
    return programs.find(p => p.id === selectedMainProgramId);
  }, [programs, selectedMainProgramId]);

  const enrolledStudents = useMemo(() => {
    if (!selectedMainProgramId) return [];
    const studentIds = enrollments
      .filter(e => e.programId === selectedMainProgramId)
      .map(e => e.studentId);
    return students.filter(s => studentIds.includes(s.id));
  }, [enrollments, selectedMainProgramId, students]);

  // Discussion groups relevant to this grade/program
  const relevantDiscussionGroups = useMemo(() => {
    return discussionGroups.filter(dg => {
      if (selectedMainProgramId && (dg.programId === selectedMainProgramId || dg.programTitle === selectedProgram?.title || dg.title === selectedProgram?.title)) {
        return true;
      }
      if (selectedGrade && gradesMatch(dg.grade, selectedGrade)) {
        return true;
      }
      return false;
    });
  }, [discussionGroups, selectedMainProgramId, selectedProgram, selectedGrade]);

  // Auto initialize class slots and days when number of classes or program changes
  useEffect(() => {
    if (selectedProgram && numberOfClasses > 0) {
      const initialConfigs: ClassSlotConfig[] = [];

      for (let i = 1; i <= numberOfClasses; i++) {
        const existing = classConfigs[i - 1];
        initialConfigs.push({
          id: existing?.id || `slot_${i}`,
          name: existing?.name || `کلاس مشاوره ${i} - ${selectedProgram.title}`,
          advisorName: existing?.advisorName || ''
        });
      }
      setClassConfigs(initialConfigs);

      // Default to standard day patterns (Saturday & Tuesday OR Sunday & Wednesday)
      if (selectedProgram.days && selectedProgram.days.length >= 2) {
        if (selectedProgram.days.includes('یکشنبه') || selectedProgram.days.includes('چهارشنبه')) {
          setSelectedDays(['یکشنبه', 'چهارشنبه']);
        } else {
          setSelectedDays(['شنبه', 'سه‌شنبه']);
        }
      } else if (selectedProgram.day) {
        if (selectedProgram.day === 'یکشنبه' || selectedProgram.day === 'چهارشنبه') {
          setSelectedDays(['یکشنبه', 'چهارشنبه']);
        } else {
          setSelectedDays(['شنبه', 'سه‌شنبه']);
        }
      } else {
        setSelectedDays(['شنبه', 'سه‌شنبه']);
      }
    }
  }, [numberOfClasses, selectedProgram]);

  // Helper: check if student has a time conflict across any of the selected consultation days
  const checkStudentConflict = (
    studentId: string, 
    days: string[], 
    slotStart: string, 
    slotEnd: string
  ): { hasConflict: boolean; conflictingProgramTitle?: string; conflictingDay?: string } => {
    // Find all programs student is enrolled in (except the main course itself)
    const studentEnrolledProgramIds = enrollments
      .filter(e => e.studentId === studentId)
      .map(e => e.programId);

    const studentPrograms = programs.filter(p => studentEnrolledProgramIds.includes(p.id) && p.id !== selectedMainProgramId);

    for (const prog of studentPrograms) {
      const progDays = prog.days && prog.days.length > 0 ? prog.days : (prog.day ? [prog.day] : []);
      for (const d of days) {
        if (progDays.includes(d)) {
          const progStart = prog.startTime || prog.time?.split('-')[0]?.trim() || '';
          const progEnd = prog.endTime || prog.time?.split('-')[1]?.trim() || '';

          if (progStart && progEnd) {
            // Check simple time overlap
            if (timeOverlaps(slotStart, slotEnd, progStart, progEnd)) {
              return { hasConflict: true, conflictingProgramTitle: prog.title, conflictingDay: d };
            }
          }
        }
      }
    }

    // Check custom manual student schedules (e.g., external classes)
    const studentCustoms = customSchedules.filter(cs => cs.studentId === studentId);
    for (const cs of studentCustoms) {
      for (const d of days) {
        const isDayMatch = (cs.days && Array.isArray(cs.days) && cs.days.length > 0)
          ? cs.days.includes(d)
          : (cs.day === d || cs.day?.includes(d));

        if (isDayMatch) {
          const csStart = cs.startTime || cs.time?.split('-')[0]?.trim() || '';
          const csEnd = cs.endTime || cs.time?.split('-')[1]?.trim() || '';
          if (csStart && csEnd) {
            if (timeOverlaps(slotStart, slotEnd, csStart, csEnd)) {
              return { 
                hasConflict: true, 
                conflictingProgramTitle: `${cs.title} (برنامه دستی/خارج موسسه)`, 
                conflictingDay: d 
              };
            }
          }
        }
      }
    }

    return { hasConflict: false };
  };

  // Time overlap utility (HH:MM format)
  const timeOverlaps = (startA: string, endA: string, startB: string, endB: string): boolean => {
    const toMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const sA = toMinutes(startA);
    const eA = toMinutes(endA);
    const sB = toMinutes(startB);
    const eB = toMinutes(endB);
    return Math.max(sA, sB) < Math.min(eA, eB);
  };

  // Simulate arrangement for a specific time slot & priority
  // Enforces STRICT constraint: Each student participates in AT MOST ONE consultation class for this main course.
  const simulateArrangement = (
    timeSlot: { start: string; end: string },
    priorityNum: 1 | 2
  ): ConsultationAdvisorProposal | null => {
    if (!selectedProgram || enrolledStudents.length === 0) return null;

    // 1. Group students by their discussion groups
    const enrolledIdsSet = new Set(enrolledStudents.map(s => s.id));
    const studentToGroupMap = new Map<string, DiscussionGroup>();
    const discussionGroupUnits: { id: string; name: string; memberStudentIds: string[] }[] = [];
    const processedStudentIds = new Set<string>();

    for (const dg of discussionGroups) {
      const matchedMembers = dg.memberStudentIds.filter(id => enrolledIdsSet.has(id));
      if (matchedMembers.length > 0) {
        discussionGroupUnits.push({
          id: dg.id,
          name: dg.title || dg.programTitle || `گروه مباحثه ${dg.subject || ''}`,
          memberStudentIds: matchedMembers
        });
        matchedMembers.forEach(id => {
          studentToGroupMap.set(id, dg);
          processedStudentIds.add(id);
        });
      }
    }

    // Individual students without discussion group
    const individualStudentIds = enrolledStudents
      .filter(s => !processedStudentIds.has(s.id))
      .map(s => s.id);

    // 2. Initialize Proposed Classes with 2 days & selected time
    const proposedClasses: ProposedConsultationClass[] = classConfigs.map((cfg, idx) => ({
      id: `proposed_${priorityNum}_${idx + 1}`,
      name: cfg.name,
      day: selectedDays.join(' و '),
      days: selectedDays,
      startTime: timeSlot.start,
      endTime: timeSlot.end,
      room: '',
      advisorName: cfg.advisorName,
      assignedStudentIds: [],
      discussionGroupNames: []
    }));

    // Set to strictly ensure each student is placed into at most ONE consultation class
    const assignedStudentsGlobalSet = new Set<string>();
    const unassignedGroupStudentPool: string[] = [];

    // 3. Step A: Place Discussion Groups together
    for (const unit of discussionGroupUnits) {
      const unassignedMembers = unit.memberStudentIds.filter(id => !assignedStudentsGlobalSet.has(id));
      if (unassignedMembers.length === 0) continue;

      let placed = false;
      
      // Sort classes by least populated to balance load
      const sortedClasses = [...proposedClasses].sort((a, b) => a.assignedStudentIds.length - b.assignedStudentIds.length);

      for (const cls of sortedClasses) {
        const remainingCapacity = maxCapacity - cls.assignedStudentIds.length;
        if (remainingCapacity >= unassignedMembers.length) {
          // Check if ANY member in this group has time conflict on ANY of the 2 days
          let hasGroupConflict = false;

          for (const sId of unassignedMembers) {
            const conflict = checkStudentConflict(sId, selectedDays, timeSlot.start, timeSlot.end);
            if (conflict.hasConflict) {
              hasGroupConflict = true;
              break;
            }
          }

          if (!hasGroupConflict) {
            // Assign entire discussion group to this class (each student is assigned once)
            cls.assignedStudentIds.push(...unassignedMembers);
            unassignedMembers.forEach(id => assignedStudentsGlobalSet.add(id));

            if (!cls.discussionGroupNames.includes(unit.name)) {
              cls.discussionGroupNames.push(unit.name);
            }
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        // If could not place together as whole group unit, allow individual placement in Step B
        unassignedGroupStudentPool.push(...unassignedMembers);
      }
    }

    // 4. Step B: Place Individual Students (and members of broken groups)
    const candidateIndividualPool = Array.from(new Set([...individualStudentIds, ...unassignedGroupStudentPool]))
      .filter(sId => !assignedStudentsGlobalSet.has(sId));

    const unassignedStudentIds: string[] = [];
    const unassignedReasons: Record<string, string> = {};

    for (const sId of candidateIndividualPool) {
      if (assignedStudentsGlobalSet.has(sId)) continue;

      let placed = false;
      const sortedClasses = [...proposedClasses].sort((a, b) => a.assignedStudentIds.length - b.assignedStudentIds.length);

      for (const cls of sortedClasses) {
        if (cls.assignedStudentIds.length < maxCapacity) {
          const conflict = checkStudentConflict(sId, selectedDays, timeSlot.start, timeSlot.end);
          if (!conflict.hasConflict) {
            cls.assignedStudentIds.push(sId);
            assignedStudentsGlobalSet.add(sId);
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        unassignedStudentIds.push(sId);
        const conflict = checkStudentConflict(sId, selectedDays, timeSlot.start, timeSlot.end);
        if (conflict.hasConflict) {
          unassignedReasons[sId] = `تداخل زمانی در روز ${conflict.conflictingDay} با درس «${conflict.conflictingProgramTitle}».`;
        } else {
          unassignedReasons[sId] = `تکمیل سقف ظرفیت (${maxCapacity} نفر) در تمام کلاس‌های مشاوره این درس.`;
        }
      }
    }

    // Deduplicate unassigned and ensure no assigned student is included
    const uniqueUnassigned = Array.from(new Set(unassignedStudentIds)).filter(id => !assignedStudentsGlobalSet.has(id));

    return {
      id: `prop_${priorityNum}_${Date.now()}`,
      mainProgramId: selectedProgram.id,
      mainProgramTitle: selectedProgram.title,
      grade: selectedProgram.grade || selectedGrade,
      totalEnrolledCount: enrolledStudents.length,
      classesCount: proposedClasses.length,
      minCapacity,
      maxCapacity,
      selectedDays,
      priority1Time,
      priority2Time: enablePriority2 ? priority2Time : undefined,
      activePriorityUsed: priorityNum,
      classes: proposedClasses,
      unassignedStudentIds: uniqueUnassigned,
      unassignedReasons,
      createdAt: new Date().toISOString(),
      createdByUserName: currentUser?.name || currentUser?.username
    };
  };

  // Run the Optimization & Arrangement Algorithm for Priority 1 (and Priority 2 if enabled)
  const runArrangementAlgorithm = () => {
    if (!selectedProgram || enrolledStudents.length === 0) return;

    // Ensure we have at least 2 days selected
    if (selectedDays.length < 2) {
      alert('لطفاً حداقل ۲ روز تشکیل در هفته را انتخاب نمایید.');
      return;
    }

    const p1Result = simulateArrangement(priority1Time, 1);
    let p2Result: ConsultationAdvisorProposal | null = null;

    if (enablePriority2) {
      p2Result = simulateArrangement(priority2Time, 2);
    }

    setProposalResult(p1Result);
    setAlternativeProposalResult(p2Result);
    setActiveViewPriority(1);
    setCurrentStep(7);
  };

  // Save proposal to history
  const handleSaveProposal = () => {
    if (!proposalResult) return;
    try {
      const updated = [proposalResult, ...savedProposals.filter(p => p.id !== proposalResult.id)];
      setSavedProposals(updated);
      localStorage.setItem('consultation_advisor_proposals_v1', JSON.stringify(updated));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving proposal:', err);
    }
  };

  // Copy text summary to clipboard
  const handleCopyText = () => {
    const activeResult = (activeViewPriority === 2 && alternativeProposalResult) ? alternativeProposalResult : proposalResult;
    if (!activeResult) return;

    let text = `📋 ترکیب پیشنهادی کلاس‌های مشاوره\n`;
    text += `درس اصلی: ${activeResult.mainProgramTitle} (${activeResult.grade})\n`;
    text += `روزهای برگزاری: ${activeResult.selectedDays?.join(' و ') || activeResult.classes[0]?.day || '۲ روز در هفته'}\n`;
    text += `ساعت برگزاری: ${activeResult.classes[0]?.startTime || ''} تا ${activeResult.classes[0]?.endTime || ''} (اولویت ${activeResult.activePriorityUsed || 1})\n`;
    text += `تعداد کل طلاب: ${activeResult.totalEnrolledCount} نفر | تعداد کلاس‌های مشاوره: ${activeResult.classesCount}\n`;
    text += `------------------------------------\n\n`;

    activeResult.classes.forEach((cls, idx) => {
      text += `📌 ${cls.name}\n`;
      text += `زمان: ${cls.day} ساعت ${cls.startTime} تا ${cls.endTime}\n`;
      if (cls.advisorName) text += `استاد/مشاور: ${cls.advisorName}\n`;
      text += `تعداد اعضا: ${cls.assignedStudentIds.length} نفر\n`;
      if (cls.discussionGroupNames.length > 0) {
        text += `گروه‌های بحثی: ${cls.discussionGroupNames.join('، ')}\n`;
      }
      text += `لیست طلاب:\n`;
      cls.assignedStudentIds.forEach((sId, sIdx) => {
        const s = students.find(item => item.id === sId);
        text += `  ${sIdx + 1}. ${s?.name || 'طلبه'}\n`;
      });
      text += `\n`;
    });

    if (activeResult.unassignedStudentIds.length > 0) {
      text += `⚠️ افراد جای‌نگرفته در برنامه (${activeResult.unassignedStudentIds.length} نفر):\n`;
      activeResult.unassignedStudentIds.forEach(sId => {
        const s = students.find(item => item.id === sId);
        text += `• ${s?.name || 'طلبه'}: ${activeResult.unassignedReasons[sId] || 'عدم هماهنگی ظرفیت یا زمان'}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Print View
  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-600 font-bold text-sm">در حال بارگذاری اطلاعات دستیار کلاس‌های مشاوره...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 font-vazir" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-700 via-indigo-600 to-indigo-800 text-white rounded-3xl p-6 shadow-sm border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-amber-300 shadow-inner">
            <Sparkles size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight">دستیار هوشمند چینش کلاس‌های مشاوره</h1>
              <span className="text-[10px] px-2.5 py-0.5 bg-amber-400/20 text-amber-200 border border-amber-400/30 rounded-full font-bold">
                نسخه پیشنهادی (بدون تغییر در بانک داده)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-100/90 mt-1">
              پیشنهاد هوشمند ترکیب کلاس‌های مشاوره بر اساس برنامه‌های هفتگی طلاب و گروه‌های مباحثه
            </p>
          </div>
        </div>

        {/* Quick Stepper Status */}
        <div className="flex items-center gap-1.5 bg-indigo-900/40 p-2 rounded-2xl border border-indigo-400/20 text-xs">
          <span className="text-indigo-200 font-medium px-2">گام {currentStep} از ۷:</span>
          <span className="font-black text-amber-300">
            {currentStep === 1 && 'بررسی کلاس‌های اصلی'}
            {currentStep === 2 && 'بررسی گروه‌های بحثی'}
            {currentStep === 3 && 'انتخاب کلاس اصلی'}
            {currentStep === 4 && 'تعداد کلاس مشاوره'}
            {currentStep === 5 && 'تعیین ظرفیت'}
            {currentStep === 6 && 'تنظیم روز و ساعات'}
            {currentStep === 7 && 'ترکیب پیشنهادی'}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
          style={{ width: `${(currentStep / 7) * 100}%` }}
        />
      </div>

      {/* Wizard Steps Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8">

        {/* ================= STEP 1: Main Programs Check ================= */}
        {currentStep === 1 && (
          <div className="space-y-6 max-w-2xl mx-auto text-center py-4">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <CalendarDays size={32} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">گام اول: بررسی برنامه‌های کلاس‌های اصلی</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                آیا برنامه کلاس‌های اصلی و ساعت تشکیل دروس هفتگی طلاب را در سامانه تکمیل کرده‌اید؟
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 space-y-2 text-right">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>وضعیت فعلی برنامه‌های مدرسه:</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-lg">
                  {programs.filter(p => p.type !== 'مشاوره').length} کلاس درسی ثبت شده
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                دستیار هوشمند از ساعت تشکیل کلاس‌های اصلی استفاده می‌کند تا کلاس‌های مشاوره تداخلی با ساعات درسی طلاب نداشته باشند.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={18} />
                بله، برنامه کلاس‌های اصلی تکمیل است (ادامه)
              </button>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('programs')}
                  className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={16} />
                  مشاهده و تکمیل برنامه‌های مدرسه
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 2: Discussion Groups Check ================= */}
        {currentStep === 2 && (
          <div className="space-y-6 max-w-2xl mx-auto text-center py-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <Users size={32} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">گام دوم: بررسی گروه‌های بحثی طلاب</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                آیا اطلاعات بخش گروه‌های بحثی (هم‌بحثی‌های طلاب) را در سامانه کامل کرده‌اید؟
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 space-y-2 text-right">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>وضعیت فعلی گروه‌های مباحثه:</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  {discussionGroups.length} گروه مباحثه فعال
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                دستیار هوشمند تمام تلاش خود را می‌کند تا هم‌بحثی‌ها در یک کلاس مشاوره واحد قرار گیرند تا هماهنگی علمی و مباحثاتی حفظ شود.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRight size={16} />
                مرحله قبل
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={18} />
                بله، اطلاعات گروه‌های بحثی کامل است (ادامه)
              </button>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('discussion')}
                  className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={16} />
                  بخش مباحثات
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 3: Select Grade & Main Program ================= */}
        {currentStep === 3 && (
          <div className="space-y-6 max-w-3xl mx-auto py-2">
            <div className="text-center">
              <h2 className="text-lg font-black text-slate-800">گام سوم: انتخاب کلاس اصلی برای تشکیل مشاوره</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                برای کدام کلاس اصلی می‌خواهید کلاس مشاوره برنامه‌ریزی کنید؟
              </p>
            </div>

            {/* Grade Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">انتخاب پایه تحصیلی:</label>
                <button
                  type="button"
                  onClick={() => setIncludeAllProgramTypes(!includeAllProgramTypes)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                    includeAllProgramTypes
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>{includeAllProgramTypes ? '✓ نمایش همه انواع دروس' : 'نمایش همه انواع دروس'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableGrades.map(g => {
                  const countForGrade = programs.filter(p => gradesMatch(p.grade, g) && (includeAllProgramTypes ? true : p.type !== 'مشاوره')).length;
                  const isSelected = gradesMatch(selectedGrade, g);
                  return (
                    <button
                      key={g}
                      onClick={() => {
                        setSelectedGrade(g);
                        setSelectedMainProgramId('');
                      }}
                      className={`p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300/40' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <BookOpen size={15} />
                        <span>{g}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                        isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200/70 text-slate-600'
                      }`}>
                        {countForGrade} درس
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Programs List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  لیست کلاس‌های اصلی مربوط به {selectedGrade || 'پایه انتخابی'} ({filteredMainPrograms.length} کلاس):
                </label>
                {selectedMainProgramId && (
                  <span className="text-[11px] text-emerald-600 font-bold">
                    ✓ کلاس انتخاب شد
                  </span>
                )}
              </div>
              
              {filteredMainPrograms.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-3">
                  <p className="text-slate-600 text-xs font-bold">
                    هیچ کلاسی برای «{selectedGrade}» در لیست کلاس‌های اصلی یافت نشد.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    (تعداد کل کلاس‌های ثبت‌شده در تمام پایه‌ها: {programs.filter(p => p.type !== 'مشاوره').length} کلاس)
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    {!includeAllProgramTypes && (
                      <button
                        type="button"
                        onClick={() => setIncludeAllProgramTypes(true)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition cursor-pointer"
                      >
                        نمایش سایر انواع دروس (پژوهش، ۵ شنبه و ...)
                      </button>
                    )}
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('programs')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink size={14} />
                        انتقال به بخش برنامه‌های مدرسه جهت بررسی پایه دروس
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
                  {filteredMainPrograms.map(prog => {
                    const count = enrollments.filter(e => e.programId === prog.id).length;
                    const isSelected = selectedMainProgramId === prog.id;
                    return (
                      <div
                        key={prog.id}
                        onClick={() => setSelectedMainProgramId(prog.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-600/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-slate-900">{prog.title}</h3>
                              {prog.grade && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                                  {prog.grade}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">استاد: {prog.teacher || 'نامشخص'}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {count} طلبه عضو
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {prog.days?.join('، ') || prog.day || 'روزهای مشخص'}
                          </span>
                          <span>{prog.startTime ? `${prog.startTime} تا ${prog.endTime}` : prog.time || ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight size={16} />
                مرحله قبل
              </button>
              <button
                disabled={!selectedMainProgramId}
                onClick={() => setCurrentStep(4)}
                className={`px-6 py-2.5 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 ${
                  selectedMainProgramId
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                مرحله بعد (تعیین تعداد کلاس‌های مشاوره)
                <ArrowLeft size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: Number of Consultation Classes ================= */}
        {currentStep === 4 && (
          <div className="space-y-6 max-w-2xl mx-auto py-2">
            <div className="text-center">
              <h2 className="text-lg font-black text-slate-800">گام چهارم: تعیین تعداد کلاس‌های مشاوره</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                برای درس «{selectedProgram?.title}» چند کلاس مشاوره می‌خواهید تشکیل دهید؟
              </p>
            </div>

            {/* Enrolled Students Summary Badge */}
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm">
                  {enrolledStudents.length}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">تعداد طلاب ثبت‌نام شده در این درس</h4>
                  <p className="text-[11px] text-indigo-700/80">اعضای آماده برای توزیع در کلاس‌های مشاوره</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-indigo-800 bg-white px-3 py-1 rounded-xl border border-indigo-200">
                {selectedProgram?.grade}
              </span>
            </div>

            {/* Number Selector: 1 to 5 */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700">تعداد کلاس مشاوره مورد نظر (۱ الی ۵):</label>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5].map(num => {
                  const isSelected = numberOfClasses === num;
                  const avgPerClass = Math.ceil(enrolledStudents.length / num);
                  return (
                    <button
                      key={num}
                      onClick={() => setNumberOfClasses(num)}
                      className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-600/30'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xl font-black">{num}</span>
                      <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        کلاس
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                با انتخاب {numberOfClasses} کلاس مشاوره، میانگین هر کلاس حدود {Math.ceil(enrolledStudents.length / numberOfClasses)} نفر خواهد بود.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight size={16} />
                مرحله قبل
              </button>
              <button
                onClick={() => setCurrentStep(5)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                مرحله بعد (تعیین حداقل و حداکثر ظرفیت)
                <ArrowLeft size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 5: Min / Max Capacity ================= */}
        {currentStep === 5 && (
          <div className="space-y-6 max-w-2xl mx-auto py-2">
            <div className="text-center">
              <h2 className="text-lg font-black text-slate-800">گام پنجم: تعیین حداقل و حداکثر تعداد افراد هر کلاس مشاوره</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                تعیین حد بالا و پایین ظرفیت برای حفظ کیفیت و تناسب جلسات مشاوره
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Min Capacity */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">حداقل نفرات هر کلاس:</label>
                  <span className="text-xs font-black text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-lg">
                    {minCapacity} نفر
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={minCapacity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setMinCapacity(val);
                    if (val > maxCapacity) setMaxCapacity(val);
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">کلاس‌های کمتر از این تعداد ترجیحاً تشکیل نشوند.</p>
              </div>

              {/* Max Capacity */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">حداکثر نفرات هر کلاس:</label>
                  <span className="text-xs font-black text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-lg">
                    {maxCapacity} نفر
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="12"
                  value={maxCapacity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setMaxCapacity(val);
                    if (val < minCapacity) setMinCapacity(val);
                  }}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">سقف مجاز اعضای یک کلاس مشاوره (بین ۲ الی ۱۰ یا ۱۲ نفر).</p>
              </div>
            </div>

            {/* Capacity Total Check Info */}
            <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              maxCapacity * numberOfClasses >= enrolledStudents.length 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}>
              <Info size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  مجموع حداکثر ظرفیت: {maxCapacity * numberOfClasses} نفر برای {enrolledStudents.length} طلبه عضو
                </p>
                {maxCapacity * numberOfClasses < enrolledStudents.length && (
                  <p className="text-[11px] mt-1 text-amber-700">
                    توجه: مجموع حداکثر ظرفیت کمتر از تعداد کل طلاب است. پیشنهاد می‌شود سقف ظرفیت یا تعداد کلاس‌ها را افزایش دهید.
                  </p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight size={16} />
                مرحله قبل
              </button>
              <button
                onClick={() => setCurrentStep(6)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                مرحله بعد (تنظیم روز و ساعت کلاس‌ها)
                <ArrowLeft size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 6: 2-Days & Time Priorities Configuration ================= */}
        {currentStep === 6 && (
          <div className="space-y-6 max-w-4xl mx-auto py-2">
            <div className="text-center">
              <h2 className="text-lg font-black text-slate-800">گام ششم: تنظیم روزها و ساعت برگزاری کلاس‌های مشاوره</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                کلیه کلاس‌های مشاوره این درس در <span className="font-bold text-indigo-700">۲ روز مشخص در هفته</span> و در یک ساعت هماهنگ تشکیل می‌شوند.
              </p>
            </div>

            {/* Section 1: Choose the 2 Days of the week */}
            <div className="bg-white border-2 border-indigo-100 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="text-indigo-600" size={20} />
                  <h3 className="text-sm font-black text-slate-800">۱. روزهای تشکیل کلاس‌های مشاوره (الگوهای ۲ روز در هفته)</h3>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-xl">
                  {selectedDays.length === 2 ? `انتخاب شده: ${selectedDays.join(' و ')}` : `تعداد انتخاب: ${selectedDays.length} روز`}
                </span>
              </div>

              {/* Standard Day Pairs */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-600">الگوهای استاندارد مصوب (۲ روز در هفته):</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {COMMON_DAY_PAIRS.map(pair => {
                    const isSelected = pair.days.length === selectedDays.length && pair.days.every(d => selectedDays.includes(d));
                    return (
                      <button
                        key={pair.label}
                        type="button"
                        onClick={() => setSelectedDays([...pair.days])}
                        className={`p-3.5 rounded-2xl border text-sm font-bold transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-600/30'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Calendar size={18} className={isSelected ? 'text-white' : 'text-indigo-600'} />
                          {pair.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {isSelected ? '✓ انتخاب شده' : 'انتخاب این الگو'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Day Checkboxes */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="text-[11px] font-bold text-slate-500">یا انتخاب دستی روزهای دلخواه (دقیقاً ۲ روز را تیک بزنید):</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {WEEK_DAYS.map(day => {
                    const isChecked = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setSelectedDays(prev => prev.filter(d => d !== day));
                          } else {
                            if (selectedDays.length >= 2) {
                              setSelectedDays(prev => [prev[1], day]);
                            } else {
                              setSelectedDays(prev => [...prev, day]);
                            }
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs ring-1 ring-indigo-500'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 2: Time Slots & Priorities */}
            <div className="bg-white border-2 border-indigo-100 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="text-indigo-600" size={20} />
                  <div>
                    <h3 className="text-sm font-black text-slate-800">۲. ساعت برگزاری کلاس‌های مشاوره</h3>
                    <p className="text-[11px] text-slate-500">همه کلاس‌ها ۱ ساعته هستند (شروع و پایان در رأس ساعت از ۷ صبح تا ۱۷ عصر).</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                  مدت زمان هر کلاس: ۶۰ دقیقه
                </span>
              </div>

              {/* Priority 1 (Primary) */}
              <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">۱</span>
                    اولویت اول ساعت برگزاری (اصلی):
                  </span>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-100/80 px-3 py-1 rounded-xl">
                    ساعت {priority1Time.start} تا {priority1Time.end}
                  </span>
                </div>

                {/* Dropdown Selector for Priority 1 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">انتخاب از لیست ساعت‌های رأس ساعت (۷:۰۰ الی ۱۷:۰۰):</label>
                  <select
                    value={`${priority1Time.start}-${priority1Time.end}`}
                    onChange={(e) => {
                      const [start, end] = e.target.value.split('-');
                      if (start && end) {
                        setPriority1Time({ start, end });
                      }
                    }}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl p-2.5 focus:border-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    {HOURLY_TIME_SLOTS.map(slot => (
                      <option key={`p1_opt_${slot.start}`} value={`${slot.start}-${slot.end}`}>
                        {slot.label} — [{slot.start} الی {slot.end}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hourly Quick Buttons from 7 to 17 */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-500">انتخاب سریع بازه ۱ ساعته:</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                    {HOURLY_TIME_SLOTS.map(slot => {
                      const isSelected = priority1Time.start === slot.start && priority1Time.end === slot.end;
                      return (
                        <button
                          key={`p1_btn_${slot.start}`}
                          type="button"
                          onClick={() => setPriority1Time({ start: slot.start, end: slot.end })}
                          className={`text-[11px] font-bold py-2 px-2 rounded-xl border transition cursor-pointer text-center flex flex-col items-center justify-center gap-0.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-1 ring-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="font-black text-xs">{slot.start}</span>
                          <span className={`text-[9px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>تا {slot.end}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Priority 2 (Secondary / Fallback) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enablePriority2}
                      onChange={(e) => setEnablePriority2(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-xs font-black text-slate-800">
                      تعیین اولویت دوم برای ساعت برگزاری (اختیاری - جهت مقایسه تداخلات احتمالی)
                    </span>
                  </label>
                  {enablePriority2 && (
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                      ساعت {priority2Time.start} تا {priority2Time.end}
                    </span>
                  )}
                </div>

                {enablePriority2 && (
                  <div className="bg-indigo-50/40 p-4.5 rounded-2xl border border-indigo-200 space-y-3.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px]">۲</span>
                        اولویت دوم ساعت برگزاری:
                      </span>
                      <span className="text-xs font-black text-indigo-800 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200">
                        ساعت {priority2Time.start} تا {priority2Time.end}
                      </span>
                    </div>

                    {/* Dropdown Selector for Priority 2 */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600">انتخاب اولویت دوم از لیست ساعت‌ها:</label>
                      <select
                        value={`${priority2Time.start}-${priority2Time.end}`}
                        onChange={(e) => {
                          const [start, end] = e.target.value.split('-');
                          if (start && end) {
                            setPriority2Time({ start, end });
                          }
                        }}
                        className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl p-2.5 focus:border-indigo-500 focus:outline-hidden cursor-pointer"
                      >
                        {HOURLY_TIME_SLOTS.map(slot => (
                          <option key={`p2_opt_${slot.start}`} value={`${slot.start}-${slot.end}`}>
                            {slot.label} — [{slot.start} الی {slot.end}]
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Hourly Quick Buttons for Priority 2 */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-bold text-slate-500">انتخاب سریع اولویت دوم:</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                        {HOURLY_TIME_SLOTS.map(slot => {
                          const isSelected = priority2Time.start === slot.start && priority2Time.end === slot.end;
                          return (
                            <button
                              key={`p2_btn_${slot.start}`}
                              type="button"
                              onClick={() => setPriority2Time({ start: slot.start, end: slot.end })}
                              className={`text-[11px] font-bold py-2 px-2 rounded-xl border transition cursor-pointer text-center flex flex-col items-center justify-center gap-0.5 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-1 ring-indigo-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className="font-black text-xs">{slot.start}</span>
                              <span className={`text-[9px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>تا {slot.end}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Class Names and Advisors (Optional) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Users size={16} className="text-indigo-600" />
                  ۳. عناوین کلاس‌ها و استاد مشاور (اختیاری)
                </h3>
                <span className="text-[10px] text-slate-400">تعیین استاد الزامی نیست</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {classConfigs.map((cfg, idx) => (
                  <div key={cfg.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={cfg.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setClassConfigs(prev => prev.map((c, i) => i === idx ? { ...c, name: val } : c));
                        }}
                        className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-indigo-500 focus:outline-hidden"
                        placeholder="عنوان کلاس مشاوره"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={cfg.advisorName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setClassConfigs(prev => prev.map((c, i) => i === idx ? { ...c, advisorName: val } : c));
                        }}
                        placeholder="نام استاد یا مشاور (اختیاری - بدون نیاز به تعیین اجباری)"
                        className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Informational Callout for Single-Class Constraint */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-start gap-3 text-xs text-indigo-900">
              <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">قانون هوشمند عدم تکرار (تک‌کلاسه بودن هر طلبه برای این درس):</p>
                <p className="text-[11px] text-indigo-700/90 mt-0.5 leading-relaxed">
                  هنگام اجرای چینش هوشمند، هر طلبه عضو درس «{selectedProgram?.title}» صرفاً در یک کلاس مشاوره سازمان‌دهی می‌شود و عضویت همزمان در چند کلاس مشاوره مربوط به همین درس امکان‌پذیر نخواهد بود.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setCurrentStep(5)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight size={16} />
                مرحله قبل
              </button>
              <button
                onClick={runArrangementAlgorithm}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-sm rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Sparkles size={18} />
                اجرای چینش هوشمند (پیشنهاد ترکیب کلاس‌ها)
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 7: Recommendation Output & Analysis ================= */}
        {currentStep === 7 && proposalResult && (
          <div className="space-y-6">
            
            {/* Multi-Priority Switcher (if Priority 2 was configured) */}
            {alternativeProposalResult && (
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950">نمایش نتایج چینش بر اساس اولویت‌های ساعت:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveViewPriority(1)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      activeViewPriority === 1
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>اولویت ۱ ({priority1Time.start} تا {priority1Time.end})</span>
                    {proposalResult.unassignedStudentIds.length === 0 ? (
                      <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[9px]">۱۰۰٪ کامل</span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px]">{proposalResult.unassignedStudentIds.length} تداخل</span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveViewPriority(2)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      activeViewPriority === 2
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>اولویت ۲ ({priority2Time.start} تا {priority2Time.end})</span>
                    {alternativeProposalResult.unassignedStudentIds.length === 0 ? (
                      <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[9px]">۱۰۰٪ کامل</span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px]">{alternativeProposalResult.unassignedStudentIds.length} تداخل</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Active Proposal Result to display */}
            {(() => {
              const currentActiveProposal = (activeViewPriority === 2 && alternativeProposalResult) ? alternativeProposalResult : proposalResult;

              return (
                <>
                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-600" size={18} />
                        ترکیب پیشنهادی کلاس‌های مشاوره: {currentActiveProposal.mainProgramTitle}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>پایه: {currentActiveProposal.grade}</span>
                        <span>•</span>
                        <span>روزهای تشکیل: <strong>{currentActiveProposal.selectedDays?.join(' و ') || currentActiveProposal.classes[0]?.day}</strong></span>
                        <span>•</span>
                        <span>ساعت: <strong>{currentActiveProposal.classes[0]?.startTime} تا {currentActiveProposal.classes[0]?.endTime}</strong></span>
                        <span>•</span>
                        <span>کل طلاب: {currentActiveProposal.totalEnrolledCount} نفر</span>
                        <span>•</span>
                        <span>تعداد کلاس‌ها: {currentActiveProposal.classesCount}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyText}
                        className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        {copied ? 'کپی شد!' : 'کپی متن'}
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer size={14} />
                        چاپ و PDF
                      </button>
                      <button
                        onClick={handleSaveProposal}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save size={14} />
                        {saveSuccess ? 'ذخیره شد!' : 'ذخیره در تاریخچه'}
                      </button>
                      <button
                        onClick={() => setCurrentStep(6)}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw size={14} />
                        تنظیم مجدد
                      </button>
                    </div>
                  </div>

                  {/* Proposed Classes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentActiveProposal.classes.map((cls, idx) => {
                      const assignedStudents = students.filter(s => cls.assignedStudentIds.includes(s.id));
                      const capacityPercent = Math.round((cls.assignedStudentIds.length / currentActiveProposal.maxCapacity) * 100);

                      return (
                        <div 
                          key={cls.id} 
                          className="bg-white border-2 border-indigo-100 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 left-0 h-1.5 bg-indigo-600" />

                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                  کلاس مشاوره شماره {idx + 1}
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 mt-1">{cls.name}</h4>
                              </div>
                              <span className="text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                                {cls.assignedStudentIds.length} نفر
                              </span>
                            </div>

                            {/* Day & Time info */}
                            <div className="mt-3 bg-slate-50 rounded-2xl p-2.5 text-[11px] text-slate-600 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">روزهای برگزاری:</span>
                                <span className="font-bold text-slate-800">{cls.day}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">ساعت برگزاری:</span>
                                <span className="font-bold text-indigo-700">{cls.startTime} تا {cls.endTime}</span>
                              </div>
                              {cls.advisorName && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">استاد/مشاور:</span>
                                  <span className="font-bold text-slate-800">{cls.advisorName}</span>
                                </div>
                              )}
                            </div>

                            {/* Discussion Groups Included */}
                            {cls.discussionGroupNames.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1">
                                {cls.discussionGroupNames.map((gn, gIdx) => (
                                  <span key={gIdx} className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                    👥 {gn}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Capacity Bar */}
                            <div className="mt-3">
                              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                <span>تکمیل ظرفیت</span>
                                <span className="font-bold text-slate-700">{cls.assignedStudentIds.length} از {currentActiveProposal.maxCapacity} نفر</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    cls.assignedStudentIds.length >= currentActiveProposal.minCapacity ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, capacityPercent)}%` }}
                                />
                              </div>
                            </div>

                            {/* Student List */}
                            <div className="mt-4 space-y-1.5 max-h-48 overflow-y-auto">
                              <label className="text-[10px] font-black text-slate-400">اسامی طلاب اختصاص‌یافته:</label>
                              {assignedStudents.map((s, sIdx) => (
                                <div key={s.id} className="flex items-center justify-between p-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 font-bold">{sIdx + 1}.</span>
                                    <span className="font-bold text-slate-800">{s.name}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">{s.grade || ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unassigned Students Section */}
                  {currentActiveProposal.unassignedStudentIds.length > 0 ? (
                    <div className="bg-amber-50/90 border border-amber-300/80 rounded-3xl p-6 space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                        <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                        <h4>طلاب و گروه‌های جای‌نگرفته در این چینش ({currentActiveProposal.unassignedStudentIds.length} نفر)</h4>
                      </div>
                      <p className="text-xs text-amber-800/90 leading-relaxed">
                        به دلیل تداخل با سایر برنامه‌های درسی در روزهای ({currentActiveProposal.selectedDays?.join(' و ') || currentActiveProposal.classes[0]?.day}) ساعت ({currentActiveProposal.classes[0]?.startTime} تا {currentActiveProposal.classes[0]?.endTime}) یا تکمیل ظرفیت کلاس‌ها، امکان قرارگیری این افراد فراهم نشد:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        {currentActiveProposal.unassignedStudentIds.map(sId => {
                          const s = students.find(item => item.id === sId);
                          const reason = currentActiveProposal.unassignedReasons[sId] || 'تداخل زمانی با برنامه هفتگی';
                          return (
                            <div key={sId} className="bg-white border border-amber-200/90 rounded-2xl p-3 flex flex-col justify-between gap-1 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900">{s?.name || 'طلبه'}</span>
                                <span className="text-[10px] text-slate-400">{s?.grade || ''}</span>
                              </div>
                              <p className="text-[10px] text-rose-700 font-medium">{reason}</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-white/80 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                        <span>💡 پیشنهاد: با تغییر روزها یا ساعت برگزاری در گام ۶، می‌توانید تداخلات را برطرف نمایید.</span>
                        <button
                          onClick={() => setCurrentStep(6)}
                          className="px-3 py-1.5 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition cursor-pointer"
                        >
                          اصلاح روزها و ساعت‌ها
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex items-center gap-3 text-emerald-900">
                      <CheckCircle2 size={24} className="text-emerald-600 flex-shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold">چینش کامل و ۱۰۰٪ موفق</h4>
                        <p className="text-[11px] text-emerald-700">تمامی طلاب ثبت‌نام شده در این درس بدون هیچ‌گونه تداخل زمانی در کلاس‌های مشاوره توزیع شدند.</p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Restart New Plan */}
            <div className="text-center pt-4">
              <button
                onClick={() => {
                  setSelectedMainProgramId('');
                  setCurrentStep(3);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                برنامه‌ریزی برای یک کلاس اصلی دیگر
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Saved Proposals History Drawer / Section */}
      {savedProposals.length > 0 && currentStep !== 7 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
            <Save size={16} className="text-indigo-600" />
            تاریخچه پیشنهادات ذخیره‌شده قبلی ({savedProposals.length} مورد)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {savedProposals.map(prop => (
              <div 
                key={prop.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {prop.grade}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(prop.createdAt).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-2">{prop.mainProgramTitle}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {prop.classesCount} کلاس مشاوره • {prop.totalEnrolledCount} طلبه
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                  <button
                    onClick={() => {
                      setProposalResult(prop);
                      setCurrentStep(7);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                  >
                    مشاهده ترکیب پیشنهادی
                  </button>
                  <button
                    onClick={() => {
                      const filtered = savedProposals.filter(p => p.id !== prop.id);
                      setSavedProposals(filtered);
                      localStorage.setItem('consultation_advisor_proposals_v1', JSON.stringify(filtered));
                    }}
                    className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
