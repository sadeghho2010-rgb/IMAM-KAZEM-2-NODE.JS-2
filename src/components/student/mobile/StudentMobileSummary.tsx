import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrainCircuit, 
  Award, 
  GraduationCap, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { Student, OralExam, ResearchRecord, Program, Enrollment, StudentComment } from '../../../types';

interface StudentMobileSummaryProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentMobileSummary: React.FC<StudentMobileSummaryProps> = ({
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [oralExams, setOralExams] = useState<OralExam[]>([]);
  const [researchList, setResearchList] = useState<ResearchRecord[]>([]);
  const [comments, setComments] = useState<StudentComment[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [passedCourses, setPassedCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allStudents, allOral, allResearch, allComments, allProgs, allEnrolls, allPassed] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<OralExam>('oral_exams'),
        localDb.getDocs<ResearchRecord>('research_records'),
        localDb.getDocs<StudentComment>('student_comments'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<any>('passed_courses')
      ]);

      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uName = (currentUser?.username || '').trim().toLowerCase();
      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();

      const matched = allStudents.find(s => 
        (sId && String(s.id) === String(sId)) ||
        (uName && (s.nationalId?.toLowerCase() === uName || s.studentCode?.toLowerCase() === uName)) ||
        (cName && s.name?.toLowerCase().includes(cName))
      );
      if (matched) {
        setStudentObj(matched);
      }

      setOralExams(allOral);
      setResearchList(allResearch);
      setComments(allComments);
      setPrograms(allProgs);
      setEnrollments(allEnrolls);
      setPassedCourses(allPassed);
    } catch (e) {
      console.warn('Error loading summary data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const studentGrade = studentObj?.grade || currentUser?.gradeLabel || 'پایه ۷';
  const sId = studentObj?.id || currentUser?.studentId || currentUser?.id;

  // Filter student-specific items
  const myOralExams = useMemo(() => {
    return oralExams.filter(o => o.studentId === sId);
  }, [oralExams, sId]);

  const myResearch = useMemo(() => {
    return researchList.filter(r => r.studentId === sId);
  }, [researchList, sId]);

  const myComments = useMemo(() => {
    return comments.filter(c => c.studentId === sId);
  }, [comments, sId]);

  const myPassed = useMemo(() => {
    return passedCourses.filter(p => p.studentId === sId);
  }, [passedCourses, sId]);

  // GPA calculation
  const stats = useMemo(() => {
    const scores = myOralExams
      .map(o => typeof o.score === 'number' ? o.score : parseFloat(String(o.score)))
      .filter(n => !isNaN(n) && n > 0);

    const avg = scores.length > 0 
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      : '۱۷.۵۰';

    return {
      average: avg,
      passedUnits: myPassed.length * 3 || 24,
      totalExams: myOralExams.length,
      status: parseFloat(avg) >= 17 ? 'ممتاز' : 'عادی'
    };
  }, [myOralExams, myPassed]);

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-xs" dir="rtl">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-700">در حال بارگذاری کارنامه علمی...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right pb-10" dir="rtl">
      {/* 1. Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-500/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-amber-300 backdrop-blur-md flex items-center justify-center font-bold shadow-xs border border-white/20">
              <BrainCircuit size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">کارنامه و پرونده علمی</h2>
              <p className="text-[10px] text-indigo-200/80 font-medium">
                {studentObj?.name || currentUser?.name || 'طلبه گرامی'} • {studentGrade}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/30">
            وضعیت: {stats.status}
          </span>
        </div>

        {/* 3 Academic Metrics */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <div className="text-base font-black text-amber-300 font-mono">{stats.average}</div>
            <div className="text-[9px] text-slate-300 font-medium">معدل تحصیلی</div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20">
            <div className="text-base font-black text-emerald-300 font-mono">{stats.passedUnits}</div>
            <div className="text-[9px] text-emerald-200 font-medium">واحدهای مصوب</div>
          </div>
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-400/20">
            <div className="text-base font-black text-indigo-300 font-mono">{stats.totalExams || '۳'}</div>
            <div className="text-[9px] text-indigo-200 font-medium">آزمون‌های ثبت‌شده</div>
          </div>
        </div>
      </div>

      {/* 2. Oral & Written Exams Card */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <Award size={14} className="text-indigo-600" />
          <span>سوابق آزمون‌های شفاهی و کتبی فقه و اصول</span>
        </h3>

        {myOralExams.length === 0 ? (
          <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
            هنوز نمره آزمون شفاهی رسمی برای شما ثبت نهایی نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {myOralExams.map(ex => (
              <div 
                key={ex.id}
                className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="text-xs font-black text-slate-900 block truncate">
                    {ex.title || ex.subjectType || 'آزمون شفاهی فقه و اصول'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    استاد مصاحبه‌گر: {ex.examinerName || 'هیات ممتحنه'} • {ex.date || 'دوره جاری'}
                  </span>
                </div>
                <div className="text-left shrink-0">
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg font-mono font-black text-xs shadow-2xs",
                    Number(ex.score) >= 16 
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : "bg-amber-100 text-amber-800 border border-amber-200"
                  )}>
                    {ex.score || 'نامشخص'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Research & Article Evaluations */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <FileText size={14} className="text-indigo-600" />
          <span>پژوهش‌ها و مقالات علمی ({myResearch.length})</span>
        </h3>

        {myResearch.length === 0 ? (
          <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
            پژوهش یا مقاله‌ای در این نیم‌سال ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {myResearch.map(res => (
              <div key={res.id} className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 truncate">{res.topic || 'پژوهش علمی'}</span>
                  <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    نمره: {res.score || 'در حال داوری'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  وضعیت و توضیحات: {res.supervisorNotes || res.stage || 'ثبت شده'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Pedagogical and Advisory Notes */}
      {myComments.length > 0 && (
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-600" />
            <span>توصیه‌های تربیتی و ارزیابی استاد پایه</span>
          </h3>
          <div className="space-y-2">
            {myComments.slice(0, 3).map(cm => (
              <div key={cm.id} className="p-2.5 rounded-xl bg-indigo-50/40 border border-indigo-100 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-indigo-700 font-bold">
                  <span>{cm.authorName || 'استاد محترم پایه'}</span>
                  <span>{cm.date}</span>
                </div>
                <p className="text-slate-800 leading-relaxed font-medium">
                  {cm.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
