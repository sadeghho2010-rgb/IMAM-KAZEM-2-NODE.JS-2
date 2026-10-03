import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { DriverInfo, TeacherWeeklyTransportRoutine, TeacherTransportSingleTrip } from '../types';

export const DriverSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2, 'نام و نام خانوادگی راننده الزامی است.'),
  name: z.string().optional(),
  phoneNumber: z.string().optional(),
  phone: z.string().optional(),
  carModel: z.string().optional(),
  plateNumber: z.string().optional(),
  carPlate: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional()
});

export const WeeklyRoutineSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string().min(1, 'شناسه استاد الزامی است.'),
  teacherName: z.string().min(1, 'نام استاد الزامی است.'),
  daysOfWeek: z.array(z.string()).default([]),
  arrivalEnabled: z.boolean().optional(),
  arrivalTime: z.string().default(''),
  arrivalAddressTitle: z.string().default(''),
  arrivalAddressDetails: z.string().default(''),
  departureEnabled: z.boolean().optional(),
  departureTime: z.string().default(''),
  departureAddressTitle: z.string().default(''),
  departureAddressDetails: z.string().default(''),
  costPerTrip: z.number().nonnegative().optional(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional()
});

export const SingleTripSchema = z.object({
  id: z.string().optional(),
  teacherId: z.string().min(1, 'شناسه استاد الزامی است.'),
  teacherName: z.string().min(1, 'نام استاد الزامی است.'),
  date: z.string().min(1, 'تاریخ سفر الزامی است.'),
  tripType: z.enum(['arrival', 'departure', 'both', 'round_trip']).default('both'),
  arrivalTime: z.string().optional(),
  arrivalAddressTitle: z.string().optional(),
  arrivalAddressDetails: z.string().optional(),
  departureTime: z.string().optional(),
  departureAddressTitle: z.string().optional(),
  departureAddressDetails: z.string().optional(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  tripsCount: z.number().positive().default(1),
  cost: z.number().nonnegative().default(0),
  status: z.enum(['scheduled', 'completed', 'cancelled']).default('completed'),
  notes: z.string().optional()
});

export class TransportService {
  public static async getAllDrivers(callerUser?: any): Promise<DriverInfo[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'drivers', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به بانک رانندگان را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('drivers', callerUser);
    return Array.isArray(items) ? (items as DriverInfo[]) : [];
  }

  public static async saveDriver(rawData: unknown, callerUser?: any): Promise<DriverInfo> {
    const authCheck = authorizeCollectionAccess(callerUser, 'drivers', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت یا ویرایش اطلاعات راننده را ندارید.', { statusCode: 403 });
    }

    const parsed = DriverSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات راننده نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const valid = parsed.data;
    const id = valid.id || `drv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: DriverInfo = {
      id,
      fullName: valid.fullName.trim(),
      name: valid.name?.trim() || valid.fullName.trim(),
      phoneNumber: valid.phoneNumber || valid.phone || '',
      phone: valid.phoneNumber || valid.phone || '',
      carModel: valid.carModel?.trim() || '',
      plateNumber: valid.plateNumber?.trim() || valid.carPlate?.trim() || '',
      carPlate: valid.plateNumber?.trim() || valid.carPlate?.trim() || '',
      isActive: valid.isActive,
      notes: valid.notes || '',
      createdAt: (rawData as any)?.createdAt || nowIso
    };

    await serverSaveDoc('drivers', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: valid.id ? 'UPDATE_DRIVER' : 'CREATE_DRIVER',
      entityType: 'driver',
      entityId: id,
      description: `ثبت یا ویرایش راننده سرویس: ${record.fullName}`,
      newState: record as unknown as Record<string, unknown>
    });

    return record;
  }

  public static async deleteDriver(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'drivers', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز حذف راننده را ندارید.', { statusCode: 403 });
    }

    await serverDeleteDoc('drivers', id, callerUser);
    return true;
  }

  public static async getWeeklyRoutines(teacherId?: string, callerUser?: any): Promise<TeacherWeeklyTransportRoutine[]> {
    const items = await serverQueryCollection('teacher_transport_routines', callerUser);
    const routines = Array.isArray(items) ? (items as TeacherWeeklyTransportRoutine[]) : [];
    return teacherId ? routines.filter(r => r.teacherId === teacherId) : routines;
  }

  public static async saveWeeklyRoutine(rawData: unknown, callerUser?: any): Promise<TeacherWeeklyTransportRoutine> {
    const authCheck = authorizeCollectionAccess(callerUser, 'teacher_transport_routines', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت برنامه هفتگی سرویس را ندارید.', { statusCode: 403 });
    }

    const parsed = WeeklyRoutineSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات برنامه هفتگی نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const valid = parsed.data;
    const id = valid.id || `routine_${valid.teacherId}`;
    const nowIso = new Date().toISOString();

    const record: TeacherWeeklyTransportRoutine = {
      id,
      teacherId: valid.teacherId,
      teacherName: valid.teacherName.trim(),
      daysOfWeek: valid.daysOfWeek,
      arrivalEnabled: valid.arrivalEnabled,
      arrivalTime: valid.arrivalTime,
      arrivalAddressTitle: valid.arrivalAddressTitle,
      arrivalAddressDetails: valid.arrivalAddressDetails,
      departureEnabled: valid.departureEnabled,
      departureTime: valid.departureTime,
      departureAddressTitle: valid.departureAddressTitle,
      departureAddressDetails: valid.departureAddressDetails,
      costPerTrip: valid.costPerTrip,
      driverId: valid.driverId,
      driverName: valid.driverName,
      isActive: valid.isActive,
      notes: valid.notes,
      createdAt: (rawData as any)?.createdAt || nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('teacher_transport_routines', record, callerUser);
    return record;
  }

  public static async getAllTrips(filters?: { teacherId?: string; date?: string }, callerUser?: any): Promise<TeacherTransportSingleTrip[]> {
    const items = await serverQueryCollection('teacher_transport_trips', callerUser);
    let trips = Array.isArray(items) ? (items as TeacherTransportSingleTrip[]) : [];
    if (filters?.teacherId) trips = trips.filter(t => t.teacherId === filters.teacherId);
    if (filters?.date) trips = trips.filter(t => t.date === filters.date);
    return trips;
  }

  public static async saveSingleTrip(rawData: unknown, callerUser?: any): Promise<TeacherTransportSingleTrip> {
    const authCheck = authorizeCollectionAccess(callerUser, 'teacher_transport_trips', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت سرویس رفت و آمد را ندارید.', { statusCode: 403 });
    }

    const parsed = SingleTripSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات سرویس رفت و آمد نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const valid = parsed.data;
    const id = valid.id || `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: TeacherTransportSingleTrip = {
      id,
      teacherId: valid.teacherId,
      teacherName: valid.teacherName.trim(),
      date: valid.date,
      tripType: valid.tripType,
      arrivalTime: valid.arrivalTime,
      arrivalAddressTitle: valid.arrivalAddressTitle,
      arrivalAddressDetails: valid.arrivalAddressDetails,
      departureTime: valid.departureTime,
      departureAddressTitle: valid.departureAddressTitle,
      departureAddressDetails: valid.departureAddressDetails,
      driverId: valid.driverId,
      driverName: valid.driverName,
      tripsCount: valid.tripsCount,
      cost: valid.cost,
      status: valid.status,
      notes: valid.notes,
      createdAt: (rawData as any)?.createdAt || nowIso
    };

    await serverSaveDoc('teacher_transport_trips', record, callerUser);
    return record;
  }
}
