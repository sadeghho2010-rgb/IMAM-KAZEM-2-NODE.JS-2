import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { Program, ProgramType } from '../types';

export const ProgramInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'عنوان برنامه یا درس الزامی است.'),
  type: z.enum(['اصلی', 'مشاوره', 'پژوهش', 'دروس 5 شنبه', 'سایر']).default('اصلی'),
  day: z.string().optional(),
  days: z.array(z.string()).optional(),
  time: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  teacher: z.string().optional(),
  teacherId: z.string().optional(),
  madrasRoom: z.string().optional(),
  classroom: z.string().optional(),
  grade: z.string().optional(),
  capacity: z.number().optional(),
  notes: z.string().optional(),
  mentorId: z.string().optional(),
  parentProgramId: z.string().optional(),
  representativeStudentIds: z.array(z.string()).optional(),
  representativeNames: z.array(z.string()).optional(),
  customRepresentative: z.string().optional()
});

// Helper to check time overlap (format "HH:mm")
function isTimeOverlapping(start1: string, end1: string, start2: string, end2: string): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return (start1 < end2) && (start2 < end1);
}

export class ProgramService {
  /**
   * Fetch all programs with scoping based on user level and assigned grade
   */
  public static async getAllPrograms(callerUser?: any): Promise<Program[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'programs', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی مشاهده برنامه آموزشی را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('programs', callerUser);
    const programs = Array.isArray(items) ? (items as Program[]) : [];

    // Scoping for Grade Mentors (Level 2 with scope e.g. 'grade_7')
    if (callerUser && callerUser.level === 2 && callerUser.scope && callerUser.scope.startsWith('grade_')) {
      const gradeMap: Record<string, string> = {
        'grade_7': 'پایه ۷',
        'grade_8': 'پایه ۸',
        'grade_9': 'پایه ۹',
        'grade_10': 'پایه ۱۰'
      };
      const assignedGrade = gradeMap[callerUser.scope];
      if (assignedGrade) {
        return programs.filter(p => !p.grade || p.grade === assignedGrade || p.grade === 'عمومی');
      }
    }

    // Scoping for Teachers (Level 3 teacher role)
    if (callerUser && callerUser.role === 'teacher') {
      const uName = callerUser.name?.trim();
      return programs.filter(p => 
        (p.teacher && uName && p.teacher.trim() === uName) ||
        (callerUser.teacherId && (p as any).teacherId === callerUser.teacherId)
      );
    }

    return programs;
  }

  /**
   * Fetch single program by ID
   */
  public static async getProgramById(id: string, callerUser?: any): Promise<Program> {
    const programs = await this.getAllPrograms(callerUser);
    const program = programs.find(p => p.id === id);
    if (!program) {
      throw new AppError('برنامه یا کلاس درسی مورد نظر یافت نشد.', { statusCode: 404 });
    }
    return program;
  }

  /**
   * Create or update a program with Zod validation, collision detection, and audit logging
   */
  public static async saveProgram(rawData: unknown, callerUser?: any): Promise<Program> {
    const authCheck = authorizeCollectionAccess(callerUser, 'programs', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت یا ویرایش برنامه‌های آموزشی را ندارید.', { statusCode: 403 });
    }

    const parsed = ProgramInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات برنامه درسی نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const targetRoom = validData.madrasRoom || validData.classroom;
    const targetDays = validData.days && validData.days.length > 0 
      ? validData.days 
      : (validData.day ? [validData.day] : []);

    const id = validData.id || `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Collision Detection: Check if the room is already occupied at overlapping hours on any same day
    if (targetRoom && targetDays.length > 0 && validData.startTime && validData.endTime) {
      const allPrograms = await serverQueryCollection('programs', callerUser);
      if (Array.isArray(allPrograms)) {
        for (const existing of allPrograms) {
          if (existing.id === id) continue; // skip self during update
          const existingRoom = existing.madrasRoom || existing.classroom;
          if (existingRoom && existingRoom.trim().toLowerCase() === targetRoom.trim().toLowerCase()) {
            const existingDays = existing.days && existing.days.length > 0 
              ? existing.days 
              : (existing.day ? [existing.day] : []);
            
            const sharedDays = targetDays.filter(d => existingDays.includes(d));
            if (sharedDays.length > 0) {
              const startEx = existing.startTime || '';
              const endEx = existing.endTime || '';
              if (isTimeOverlapping(validData.startTime, validData.endTime, startEx, endEx)) {
                throw new AppError(
                  `تزاحم زمان و مکان: مَدرَس «${targetRoom}» در روز ${sharedDays.join(' و ')} ساعت ${startEx} تا ${endEx} قبلاً برای درس «${existing.title}» تخصیص داده شده است.`,
                  { statusCode: 409 }
                );
              }
            }
          }
        }
      }
    }

    const programRecord: Program = {
      id,
      title: validData.title.trim(),
      type: validData.type as ProgramType,
      day: validData.day,
      days: validData.days,
      time: validData.time || (validData.startTime && validData.endTime ? `${validData.startTime} - ${validData.endTime}` : undefined),
      startTime: validData.startTime,
      endTime: validData.endTime,
      teacher: validData.teacher?.trim(),
      madrasRoom: targetRoom?.trim(),
      classroom: targetRoom?.trim(),
      grade: validData.grade?.trim(),
      capacity: validData.capacity,
      notes: validData.notes?.trim(),
      mentorId: validData.mentorId,
      parentProgramId: validData.parentProgramId,
      representativeStudentIds: validData.representativeStudentIds,
      representativeNames: validData.representativeNames,
      customRepresentative: validData.customRepresentative
    };

    await serverSaveDoc('programs', programRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_PROGRAM' : 'CREATE_PROGRAM',
      entityType: 'program',
      entityId: id,
      description: `ثبت یا ویرایش برنامه درسی: ${programRecord.title} (${programRecord.grade || 'عمومی'})`,
      newState: programRecord as unknown as Record<string, unknown>
    });

    logger.info(`[ProgramService] Program saved: ${id} (${programRecord.title}) by ${callerUser?.username || 'system'}`);
    return programRecord;
  }

  /**
   * Delete a program
   */
  public static async deleteProgram(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'programs', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز حذف برنامه درسی را ندارید.', { statusCode: 403 });
    }

    await serverDeleteDoc('programs', id, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'DELETE_PROGRAM',
      entityType: 'program',
      entityId: id,
      description: `حذف برنامه درسی با شناسه ${id}`
    });

    logger.warn(`[ProgramService] Deleted program ${id} by ${callerUser?.username || 'system'}`);
    return true;
  }

  /**
   * Get weekly school schedule grouped by days of the week
   */
  public static async getWeeklySchedule(callerUser?: any) {
    const programs = await this.getAllPrograms(callerUser);
    const daysOrder = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const schedule: Record<string, Program[]> = {};
    daysOrder.forEach(d => { schedule[d] = []; });

    programs.forEach(prog => {
      const days = prog.days && prog.days.length > 0 ? prog.days : (prog.day ? [prog.day] : []);
      days.forEach(d => {
        if (schedule[d]) {
          schedule[d].push(prog);
        } else {
          schedule[d] = [prog];
        }
      });
    });

    // Sort programs in each day by startTime
    daysOrder.forEach(d => {
      schedule[d].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    });

    return {
      totalPrograms: programs.length,
      schedule
    };
  }

  /**
   * Get programs filtered by grade
   */
  public static async getProgramsByGrade(grade: string, callerUser?: any): Promise<Program[]> {
    const all = await this.getAllPrograms(callerUser);
    const decodedGrade = decodeURIComponent(grade).trim();
    return all.filter(p => p.grade && p.grade.trim() === decodedGrade);
  }

  /**
   * Get programs filtered by teacher ID or teacher Name
   */
  public static async getProgramsByTeacher(teacherIdOrName: string, callerUser?: any): Promise<Program[]> {
    const all = await this.getAllPrograms(callerUser);
    const target = decodeURIComponent(teacherIdOrName).trim();
    return all.filter(p => 
      ((p as any).teacherId && (p as any).teacherId === target) ||
      (p.teacher && p.teacher.trim() === target)
    );
  }
}
