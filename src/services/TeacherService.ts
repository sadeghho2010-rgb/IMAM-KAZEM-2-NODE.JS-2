import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { Teacher, TeacherCategory } from '../types';

export const TeacherInputSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2, 'نام و نام خانوادگی استاد الزامی است.'),
  name: z.string().optional(),
  nationalId: z.string().optional(),
  teacherCode: z.string().optional(),
  phoneNumber: z.string().optional(),
  phone: z.string().optional(),
  subjectSpecialty: z.string().optional(),
  courses: z.array(z.string()).optional(),
  managedGrades: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  priority: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankSheba: z.string().optional(),
  notes: z.string().optional(),
  experienceHistory: z.string().optional(),
  isExternal: z.boolean().optional()
});

export class TeacherService {
  /**
   * Fetch all teachers with role-based scoping:
   * Level 1 & 2 managers see all teachers; Teachers (level 3) see only their own record.
   */
  public static async getAllTeachers(callerUser?: any): Promise<Teacher[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'teachers', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز دسترسی به بانک اساتید را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('teachers', callerUser);
    const teachersList = Array.isArray(items) ? (items as Teacher[]) : [];

    // Role-based scoping for individual teachers
    if (callerUser && (callerUser.role === 'teacher' || (callerUser.level === 3 && callerUser.teacherId))) {
      const targetTeacherId = callerUser.teacherId || callerUser.linkedTeacherId || callerUser.id;
      const filtered = teachersList.filter(t => 
        t.id === targetTeacherId || 
        t.fullName?.trim() === callerUser.name?.trim() ||
        t.name?.trim() === callerUser.name?.trim()
      );
      return filtered;
    }

    return teachersList;
  }

  /**
   * Fetch single teacher by ID with scoping check
   */
  public static async getTeacherById(id: string, callerUser?: any): Promise<Teacher> {
    const teachers = await this.getAllTeachers(callerUser);
    const teacher = teachers.find(t => t.id === id || t.teacherCode === id);
    if (!teacher) {
      throw new AppError('اطلاعات استاد مورد نظر یافت نشد یا شما دسترسی مشاهده آن را ندارید.', { statusCode: 404 });
    }
    return teacher;
  }

  /**
   * Create or update a teacher with strict Zod validation
   */
  public static async saveTeacher(rawData: unknown, callerUser?: any): Promise<Teacher> {
    const authCheck = authorizeCollectionAccess(callerUser, 'teachers', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت یا ویرایش اطلاعات اساتید را ندارید.', { statusCode: 403 });
    }

    const validationResult = TeacherInputSchema.safeParse(rawData);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]?.message || 'اطلاعات وارد شده نامعتبر است.';
      throw new AppError(firstError, { statusCode: 400 });
    }

    const validData = validationResult.data;
    const id = validData.id || `tea_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const teacherRecord: Teacher = {
      id,
      fullName: validData.fullName.trim(),
      name: validData.name?.trim() || validData.fullName.trim(),
      nationalId: validData.nationalId?.trim() || '',
      teacherCode: validData.teacherCode?.trim() || '',
      phoneNumber: validData.phoneNumber || validData.phone || '',
      phone: validData.phoneNumber || validData.phone || '',
      subjectSpecialty: validData.subjectSpecialty || '',
      courses: validData.courses || [],
      managedGrades: validData.managedGrades || [],
      categories: (validData.categories as TeacherCategory[]) || ['فقه'],
      priority: (validData.priority as 1 | 2 | 3) || 1,
      isActive: validData.isActive !== false,
      bankName: validData.bankName || '',
      bankAccount: validData.bankAccount || '',
      bankSheba: validData.bankSheba || '',
      notes: validData.notes || '',
      experienceHistory: validData.experienceHistory || '',
      isExternal: Boolean(validData.isExternal),
      createdAt: (rawData as any)?.createdAt || nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('teachers', teacherRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_TEACHER' : 'CREATE_TEACHER',
      entityType: 'teacher',
      entityId: id,
      description: `ثبت یا به‌روزرسانی پرونده استاد: ${teacherRecord.fullName}`,
      newState: teacherRecord
    });

    logger.info(`[TeacherService] Saved teacher ${id} (${teacherRecord.fullName}) by ${callerUser?.username || 'system'}`);
    return teacherRecord;
  }

  /**
   * Delete or archive a teacher
   */
  public static async deleteTeacher(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'teachers', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'تنها مدیران ارشد مجاز به حذف پرونده اساتید هستند.', { statusCode: 403 });
    }

    await serverDeleteDoc('teachers', id, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'DELETE_TEACHER',
      entityType: 'teacher',
      entityId: id,
      description: `حذف پرونده استاد با شناسه ${id}`
    });

    logger.warn(`[TeacherService] Deleted teacher ${id} by ${callerUser?.username || 'system'}`);
    return true;
  }

  /**
   * Calculate and fetch weekly teaching schedule for a teacher
   */
  public static async getTeacherSchedule(teacherId: string, callerUser?: any) {
    const teacher = await this.getTeacherById(teacherId, callerUser);
    const allPrograms = await serverQueryCollection('programs', callerUser);

    const programsList = Array.isArray(allPrograms) ? allPrograms : [];
    const teacherPrograms = programsList.filter((p: any) => 
      p.teacherId === teacher.id || 
      p.teacherName?.trim() === teacher.fullName.trim() ||
      p.teacherName?.trim() === teacher.name?.trim()
    );

    // Group by day of week
    const daysOrder = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const scheduleByDay: Record<string, any[]> = {};
    daysOrder.forEach(d => { scheduleByDay[d] = []; });

    teacherPrograms.forEach((prog: any) => {
      const day = prog.dayOfWeek || prog.day || 'نامشخص';
      if (!scheduleByDay[day]) scheduleByDay[day] = [];
      scheduleByDay[day].push({
        id: prog.id,
        title: prog.title || prog.courseTitle || 'درس بدون عنوان',
        grade: prog.grade || 'عمومی',
        startTime: prog.startTime || '',
        endTime: prog.endTime || '',
        classroom: prog.classroomTitle || prog.classroomName || prog.room || 'کلاس نامشخص',
        type: prog.programType || prog.type || 'اصلی'
      });
    });

    return {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      totalCourses: teacherPrograms.length,
      scheduleByDay,
      rawPrograms: teacherPrograms
    };
  }
}
