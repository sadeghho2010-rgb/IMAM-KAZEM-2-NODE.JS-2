/**
 * Central Monitoring Access Control
 * Strictly enforces that ONLY the 3 trusted roles have access to monitoring:
 * 1. Super Admin (مدیر ارشد) - level 1, super_admin, school_manager, SADEGH
 * 2. Education Manager (مسئول آموزش) - education_manager, education_officer, SHAH
 * 3. Finance Manager (مسئول مالی) - finance_manager, financial_officer, MALI
 *
 * All other roles are strictly denied at the server level.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/serverAuth';

export interface MonitoringCaller {
  id: string;
  username: string;
  name: string;
  role: string;
  level: number;
}

export function isAuthorizedForMonitoring(user: any): boolean {
  if (!user) return false;

  const usernameUpper = (user.username || '').toUpperCase();
  const role = user.role || '';
  const level = Number(user.level) || 0;
  const name = user.name || user.fullName || '';

  // 1. Super Admin
  const isSuperAdmin = 
    level === 1 || 
    role === 'super_admin' || 
    role === 'school_manager' || 
    role === 'manager_principal' ||
    usernameUpper === 'SADEGH';

  // 2. Education Manager
  const isEducationManager = 
    role === 'education_manager' || 
    role === 'education_officer' || 
    usernameUpper === 'SHAH' || 
    name.includes('آموزش');

  // 3. Finance Manager
  const isFinanceManager = 
    role === 'finance_manager' || 
    role === 'financial_officer' || 
    usernameUpper === 'MALI' || 
    name.includes('مالی');

  return isSuperAdmin || isEducationManager || isFinanceManager;
}

/**
 * Strict Maintenance & Announcement Management Authorization:
 * ONLY non-read-only Super Admin (SADEGH / super_admin) and Education Officer (SHAH / education_manager / education_officer).
 * Finance Manager, School Manager (RAHNAMA), Research Manager, Mentors, Teachers, and Students are excluded.
 */
export function isAuthorizedForMaintenance(user: any): boolean {
  if (!user) return false;
  if (user.isReadOnly === true || user.canEdit === false) return false;

  const usernameUpper = String(user.username || '').toUpperCase().trim();
  const role = String(user.role || '').trim();
  const level = Number(user.level) || 0;

  if (role === 'school_manager' || role === 'manager_principal' || usernameUpper === 'RAHNAMA') {
    return false;
  }

  const isSuperAdmin =
    role === 'super_admin' ||
    usernameUpper === 'SADEGH' ||
    (level === 1 && role !== 'school_manager');

  const isEducationOfficer =
    role === 'education_manager' ||
    role === 'education_officer' ||
    usernameUpper === 'SHAH' ||
    usernameUpper === 'SHAHPOORI';

  return isSuperAdmin || isEducationOfficer;
}

export function extractMonitoringToken(req: Request): string | null {
  if (req.cookies && req.cookies.auth_access_token) {
    return req.cookies.auth_access_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Express middleware to strictly gate monitoring API endpoints
 */
export function requireMonitoringAccess(req: Request, res: Response, next: NextFunction) {
  const token = extractMonitoringToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'احراز هویت الزامی است. دسترسی به بخش پایش سامانه مسدود گردید.'
    });
  }

  const result = verifyAccessToken(token);
  if (!result.valid || !result.decoded) {
    return res.status(401).json({
      success: false,
      message: 'اعتبار نشست کاربری منقضی شده است.'
    });
  }

  const user = result.decoded as any;
  if (!isAuthorizedForMonitoring(user)) {
    return res.status(403).json({
      success: false,
      message: 'دسترسی به بخش پایش و عیب‌یابی سامانه فقط برای مدیر ارشد، مسئول آموزش و مسئول مالی مجاز است.'
    });
  }

  (req as any).monitoringUser = {
    id: user.id || user.userId || '',
    username: user.username || '',
    name: user.name || user.fullName || user.username || '',
    role: user.role || '',
    level: user.level || 2,
  };

  next();
}

/**
 * Express middleware strictly gating Maintenance Mode control to Super Admin & Education Officer
 */
export function requireMaintenanceAccess(req: Request, res: Response, next: NextFunction) {
  const token = extractMonitoringToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'احراز هویت الزامی است.'
    });
  }

  const result = verifyAccessToken(token);
  if (!result.valid || !result.decoded) {
    return res.status(401).json({
      success: false,
      message: 'اعتبار نشست کاربری منقضی شده است.'
    });
  }

  const user = result.decoded as any;
  if (!isAuthorizedForMaintenance(user)) {
    return res.status(403).json({
      success: false,
      message: 'مدیریت حالت تعمیر سایت منحصراً در اختیار مسئول آموزش و سوپر ادمین است.'
    });
  }

  (req as any).monitoringUser = {
    id: user.id || user.userId || '',
    username: user.username || '',
    name: user.name || user.fullName || user.username || '',
    role: user.role || '',
    level: user.level || 2,
  };

  next();
}

