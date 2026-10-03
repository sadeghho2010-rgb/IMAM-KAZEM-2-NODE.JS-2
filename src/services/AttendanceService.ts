import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { AttendanceSessionLog, StudentAttendanceDetail, AttendanceStatus } from '../types';

export const StudentAttendanceSchema = z.object({
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  nationalId: z.string().optional(),
  status: z.enum(['present', 'absent', 'late', 'excused', 'unspecified']).default('unspecified'),
  note: z.string().optional(),
  lateMinutes: z.number().nonnegative().optional(),
  isExcused: z.boolean().optional(),
  excuseReason: z.string().optional(),
  hasEducationalWarning: z.boolean().optional()
});

export const AttendanceSessionSchema = z.object({
  id: z.string().optional(),
  programId: z.string().min(1, 'شناسه برنامه یا درس الزامی است.'),
  programTitle: z.string().min(1, 'عنوان برنامه الزامی است.'),
  grade: z.string().optional(),
  date: z.string().min(1, 'تاریخ برگزاری الزامی است.'),
  dayOfWeek: z.string().min(1, 'روز هفته الزامی است.'),
  isCancelled: z.boolean().default(false),
  cancellationReason: z.string().optional(),
  hasSubstituteTeacher: z.boolean().optional(),
  substituteTeacherId: z.string().optional(),
  substituteTeacherName: z.string().optional(),
  substituteTeacherNotes: z.string().optional(),
  notes: z.string().optional(),
  students: z.array(StudentAttendanceSchema).default([])
});

export class AttendanceService {
  /**
   * Record or update an attendance session log
   */
  public static async recordAttendanceSession(rawData: unknown, callerUser?: any): Promise<AttendanceSessionLog> {
    const authCheck = authorizeCollectionAccess(callerUser, 'attendance', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت حضور و غیاب را ندارید.', { statusCode: 403 });
    }

    const parsed = AttendanceSessionSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات حضور و غیاب نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const sessionId = validData.id || `${validData.programId}_${validData.date.replace(/\//g, '-')}`;
    const nowIso = new Date().toISOString();

    const sessionRecord: AttendanceSessionLog = {
      id: sessionId,
      programId: validData.programId,
      programTitle: validData.programTitle,
      grade: validData.grade,
      date: validData.date,
      dayOfWeek: validData.dayOfWeek,
      isCancelled: validData.isCancelled,
      cancellationReason: validData.cancellationReason,
      hasSubstituteTeacher: validData.hasSubstituteTeacher,
      substituteTeacherId: validData.substituteTeacherId,
      substituteTeacherName: validData.substituteTeacherName,
      substituteTeacherNotes: validData.substituteTeacherNotes,
      notes: validData.notes,
      recordedByUserId: callerUser?.userId || callerUser?.id,
      recordedByName: callerUser?.fullName || callerUser?.username || 'system',
      recordedAt: nowIso,
      students: validData.students as StudentAttendanceDetail[]
    };

    await serverSaveDoc('attendance', sessionRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'RECORD_ATTENDANCE_SESSION',
      entityType: 'attendance_session',
      entityId: sessionId,
      description: `ثبت جلسه حضور و غیاب درس «${sessionRecord.programTitle}» مورخ ${sessionRecord.date} (تعداد طلاب: ${sessionRecord.students.length})`,
      newState: sessionRecord as unknown as Record<string, unknown>
    });

    logger.info(`[AttendanceService] Recorded session ${sessionId} for ${sessionRecord.programTitle}`);
    return sessionRecord;
  }

  /**
   * Fetch all attendance sessions
   */
  public static async getAllSessions(callerUser?: any): Promise<AttendanceSessionLog[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'attendance', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به سوابق حضور و غیاب را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('attendance', callerUser);
    return Array.isArray(items) ? (items as AttendanceSessionLog[]) : [];
  }

  /**
   * Fetch attendance sessions for a specific program
   */
  public static async getAttendanceByProgram(programId: string, callerUser?: any): Promise<AttendanceSessionLog[]> {
    const sessions = await this.getAllSessions(callerUser);
    return sessions.filter(s => s.programId === programId);
  }

  /**
   * Fetch attendance history for a single student across all sessions
   */
  public static async getAttendanceByStudent(studentId: string, callerUser?: any) {
    const sessions = await this.getAllSessions(callerUser);
    const studentHistory: Array<{
      sessionId: string;
      programId: string;
      programTitle: string;
      date: string;
      dayOfWeek: string;
      status: AttendanceStatus;
      note?: string;
      lateMinutes?: number;
      isExcused?: boolean;
      excuseReason?: string;
      hasEducationalWarning?: boolean;
    }> = [];

    sessions.forEach(session => {
      const studentRecord = session.students?.find(st => st.studentId === studentId);
      if (studentRecord) {
        studentHistory.push({
          sessionId: session.id,
          programId: session.programId,
          programTitle: session.programTitle,
          date: session.date,
          dayOfWeek: session.dayOfWeek,
          status: studentRecord.status,
          note: studentRecord.note,
          lateMinutes: studentRecord.lateMinutes,
          isExcused: studentRecord.isExcused,
          excuseReason: studentRecord.excuseReason,
          hasEducationalWarning: studentRecord.hasEducationalWarning
        });
      }
    });

    // Calculate Summary Stats
    const totalSessions = studentHistory.length;
    const presentCount = studentHistory.filter(h => h.status === 'present').length;
    const absentCount = studentHistory.filter(h => h.status === 'absent' && !h.isExcused).length;
    const excusedCount = studentHistory.filter(h => h.status === 'excused' || (h.status === 'absent' && h.isExcused)).length;
    const lateCount = studentHistory.filter(h => h.status === 'late').length;

    return {
      studentId,
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      lateCount,
      attendanceRate: totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100,
      history: studentHistory
    };
  }

  /**
   * Justify / Excuse a student absence
   */
  public static async justifyAbsence(
    sessionId: string,
    studentId: string,
    reason: string,
    callerUser?: any
  ): Promise<AttendanceSessionLog> {
    const authCheck = authorizeCollectionAccess(callerUser, 'attendance', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز موجه‌سازی غیبت را ندارید.', { statusCode: 403 });
    }

    const sessions = await this.getAllSessions(callerUser);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      throw new AppError('جلسه حضور و غیاب یافت نشد.', { statusCode: 404 });
    }

    const studentRecord = session.students?.find(st => st.studentId === studentId);
    if (!studentRecord) {
      throw new AppError('طلبه مورد نظر در این جلسه یافت نشد.', { statusCode: 404 });
    }

    studentRecord.status = 'excused';
    studentRecord.isExcused = true;
    studentRecord.excuseReason = reason;

    await serverSaveDoc('attendance', session, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'JUSTIFY_ABSENCE',
      entityType: 'attendance_record',
      entityId: `${sessionId}_${studentId}`,
      description: `موجه‌سازی غیبت طلبه ${studentRecord.studentName} در جلسه ${session.programTitle} (${session.date}). علت: ${reason}`
    });

    return session;
  }

  /**
   * Aggregate attendance statistics across school, program, or grade
   */
  public static async getAttendanceStats(filters?: { grade?: string; programId?: string }, callerUser?: any) {
    let sessions = await this.getAllSessions(callerUser);

    if (filters?.grade) {
      sessions = sessions.filter(s => s.grade === filters.grade);
    }
    if (filters?.programId) {
      sessions = sessions.filter(s => s.programId === filters.programId);
    }

    let totalAttendanceMarks = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalExcused = 0;
    let totalLate = 0;
    let totalWarnings = 0;

    sessions.forEach(s => {
      s.students?.forEach(st => {
        totalAttendanceMarks++;
        if (st.status === 'present') totalPresent++;
        else if (st.status === 'absent' && !st.isExcused) totalAbsent++;
        else if (st.status === 'excused' || (st.status === 'absent' && st.isExcused)) totalExcused++;
        else if (st.status === 'late') totalLate++;
        if (st.hasEducationalWarning) totalWarnings++;
      });
    });

    return {
      totalSessions: sessions.length,
      totalAttendanceMarks,
      totalPresent,
      totalAbsent,
      totalExcused,
      totalLate,
      totalWarnings,
      overallPresencePercentage: totalAttendanceMarks > 0 
        ? Math.round(((totalPresent + totalLate) / totalAttendanceMarks) * 100) 
        : 100
    };
  }
}
