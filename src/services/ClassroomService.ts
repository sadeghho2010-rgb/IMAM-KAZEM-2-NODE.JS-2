import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { MadrasRoom } from '../types';

export const ClassroomInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'نام مَدرَس یا کلاس الزامی است.'),
  code: z.string().optional(),
  capacity: z.number().min(1, 'ظرفیت باید حداقل ۱ نفر باشد.').optional(),
  floor: z.string().optional(),
  facilities: z.array(z.string()).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional()
});

export class ClassroomService {
  /**
   * Fetch all classrooms
   */
  public static async getAllClassrooms(callerUser?: any): Promise<MadrasRoom[]> {
    const items = await serverQueryCollection('classrooms', callerUser);
    return Array.isArray(items) ? (items as MadrasRoom[]) : [];
  }

  /**
   * Fetch single classroom by ID
   */
  public static async getClassroomById(id: string, callerUser?: any): Promise<MadrasRoom> {
    const classrooms = await this.getAllClassrooms(callerUser);
    const room = classrooms.find(r => r.id === id || r.name === id);
    if (!room) {
      throw new AppError('مَدرَس مورد نظر یافت نشد.', { statusCode: 404 });
    }
    return room;
  }

  /**
   * Create or update a classroom
   */
  public static async saveClassroom(rawData: unknown, callerUser?: any): Promise<MadrasRoom> {
    const authCheck = authorizeCollectionAccess(callerUser, 'classrooms', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت یا ویرایش کلاس‌ها را ندارید.', { statusCode: 403 });
    }

    const parsed = ClassroomInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات وارد شده نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const roomRecord: MadrasRoom = {
      id,
      name: validData.name.trim(),
      code: validData.code?.trim() || '',
      capacity: validData.capacity || 25,
      floor: validData.floor?.trim() || '',
      facilities: validData.facilities || [],
      description: validData.description?.trim() || '',
      color: validData.color || 'blue',
      isActive: validData.isActive !== false,
      createdAt: (rawData as any)?.createdAt || nowIso
    };

    await serverSaveDoc('classrooms', roomRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_CLASSROOM' : 'CREATE_CLASSROOM',
      entityType: 'classroom',
      entityId: id,
      description: `ثبت یا ویرایش مَدرَس: ${roomRecord.name} (ظرفیت: ${roomRecord.capacity})`,
      newState: roomRecord as unknown as Record<string, unknown>
    });

    logger.info(`[ClassroomService] Saved classroom ${id} (${roomRecord.name}) by ${callerUser?.username || 'system'}`);
    return roomRecord;
  }

  /**
   * Delete a classroom
   */
  public static async deleteClassroom(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'classrooms', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز حذف کلاس را ندارید.', { statusCode: 403 });
    }

    await serverDeleteDoc('classrooms', id, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'DELETE_CLASSROOM',
      entityType: 'classroom',
      entityId: id,
      description: `حذف مَدرَس با شناسه ${id}`
    });

    logger.warn(`[ClassroomService] Deleted classroom ${id} by ${callerUser?.username || 'system'}`);
    return true;
  }

  /**
   * Get capacity analysis and active programs hosted in this classroom
   */
  public static async getClassroomCapacity(id: string, callerUser?: any) {
    const room = await this.getClassroomById(id, callerUser);
    const allPrograms = await serverQueryCollection('programs', callerUser);
    const programsInRoom = Array.isArray(allPrograms) 
      ? allPrograms.filter(p => (p.madrasRoom && p.madrasRoom === room.name) || (p.classroom && p.classroom === room.name))
      : [];

    return {
      classroomId: room.id,
      classroomName: room.name,
      definedCapacity: room.capacity || 25,
      activeProgramsCount: programsInRoom.length,
      assignedPrograms: programsInRoom.map(p => ({
        id: p.id,
        title: p.title,
        grade: p.grade,
        teacher: p.teacher,
        days: p.days || (p.day ? [p.day] : []),
        time: p.time || `${p.startTime} - ${p.endTime}`
      }))
    };
  }
}
