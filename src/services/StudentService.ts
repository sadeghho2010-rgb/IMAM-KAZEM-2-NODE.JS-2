import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';

export interface StudentEntity {
  id: string;
  studentCode?: string;
  nationalId?: string;
  name: string;
  fatherName?: string;
  grade: string;
  phone?: string;
  address?: string;
  status?: string;
  isActive?: boolean;
  entryYear?: string;
  mentorId?: string;
  notes?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export class StudentService {
  /**
   * Fetch all students with role-based scoping (Level 1: all, Level 2: grade-scoped, Level 3: self only)
   */
  public static async getAllStudents(callerUser?: any): Promise<StudentEntity[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'students', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی مشاهده پرونده طلاب را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('students', callerUser);
    return Array.isArray(items) ? (items as StudentEntity[]) : [];
  }

  /**
   * Fetch single student by ID
   */
  public static async getStudentById(id: string, callerUser?: any): Promise<StudentEntity> {
    const students = await this.getAllStudents(callerUser);
    const student = students.find(s => s.id === id || s.studentCode === id);
    if (!student) {
      throw new AppError('پرونده طلبه مورد نظر یافت نشد.', { statusCode: 404 });
    }
    return student;
  }

  /**
   * Create or update student record
   */
  public static async saveStudent(studentData: Partial<StudentEntity>, callerUser?: any): Promise<StudentEntity> {
    const authCheck = authorizeCollectionAccess(callerUser, 'students', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت یا ویرایش پرونده طلاب را ندارید.', { statusCode: 403 });
    }

    if (!studentData.name || !studentData.grade) {
      throw new AppError('نام و پایه تحصیلی طلبه الزامی است.', { statusCode: 400 });
    }

    const id = studentData.id || `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullRecord: StudentEntity = {
      ...studentData,
      id,
      name: String(studentData.name).trim(),
      grade: String(studentData.grade).trim(),
      updatedAt: new Date().toISOString()
    };

    await serverSaveDoc('students', fullRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: studentData.id ? 'UPDATE_STUDENT' : 'CREATE_STUDENT',
      entityType: 'student',
      entityId: id,
      description: `ثبت یا ویرایش اطلاعات طلبه: ${fullRecord.name} (${fullRecord.grade})`,
      newState: fullRecord
    });

    logger.info(`[StudentService] Saved student ${id} (${fullRecord.name}) by ${callerUser?.username || 'system'}`);
    return fullRecord;
  }

  /**
   * Delete or archive a student
   */
  public static async deleteStudent(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'students', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'تنها مدیران ارشد مجاز به حذف پرونده طلاب هستند.', { statusCode: 403 });
    }

    await serverDeleteDoc('students', id, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'DELETE_STUDENT',
      entityType: 'student',
      entityId: id,
      description: `حذف پرونده طلبه با شناسه ${id}`
    });

    logger.warn(`[StudentService] Deleted student ${id} by ${callerUser?.username || 'system'}`);
    return true;
  }
}
