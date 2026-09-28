import { z } from 'zod';

/**
 * Validates an Iranian 10-digit National Code (کد ملی)
 * using the official modulo 11 checksum algorithm.
 */
export function isValidIranianNationalCode(code: string | undefined | null): boolean {
  if (!code) return false;
  const cleanCode = String(code).trim();
  if (!/^\d{10}$/.test(cleanCode)) return false;

  // Disallow all identical digits (e.g. 0000000000, 1111111111)
  if (/^(\d)\1{9}$/.test(cleanCode)) return false;

  const digits = cleanCode.split('').map(Number);
  const checkDigit = digits[9];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  const remainder = sum % 11;
  return (remainder < 2 && checkDigit === remainder) || (remainder >= 2 && checkDigit === 11 - remainder);
}

/**
 * Validates Iranian Mobile Phone numbers (e.g. 09123456789)
 */
export function isValidIranianMobile(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const cleanPhone = String(phone).trim();
  return /^09\d{9}$/.test(cleanPhone);
}

// 1. Zod Schema for Login
export const LoginInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'نام کاربری باید حداقل ۲ کاراکتر باشد')
    .max(50, 'نام کاربری حداکثر ۵۰ کاراکتر است')
    .regex(/^[a-zA-Z0-9_\u0600-\u06FF\s-]+$/, 'نام کاربری شامل کاراکترهای نامعتبر است'),
  password: z
    .string()
    .min(4, 'رمز عبور باید حداقل ۴ کاراکتر باشد')
    .max(100, 'طول رمز عبور نامعتبر است')
});

// 2. Allowed System Roles
export const SystemRoleEnum = z.enum([
  'super_admin',
  'school_manager',
  'education_manager',
  'education_officer',
  'grade_mentor',
  'finance_manager',
  'financial_officer',
  'teacher',
  'student',
  'class_representative',
  'custom'
]);

// 3. Zod Schema for User Management (Creation / Update)
export const UserManagementSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'نام کاربری باید حداقل ۲ کاراکتر باشد')
    .max(50, 'نام کاربری حداکثر ۵۰ کاراکتر است'),
  name: z
    .string()
    .trim()
    .min(2, 'نام و نام خانوادگی الزامی است')
    .max(100)
    .optional(),
  password: z
    .string()
    .min(4, 'رمز عبور باید حداقل ۴ کاراکتر باشد')
    .max(100)
    .optional(),
  role: SystemRoleEnum.default('custom'),
  level: z.number().int().min(1).max(3).default(2),
  roleTitle: z.string().max(100).optional(),
  nationalCode: z
    .string()
    .optional()
    .refine(val => !val || isValidIranianNationalCode(val), {
      message: 'کد ملی وارد شده با الگوریتم استاندارد ۱۰ رقمی مطابقت ندارد'
    }),
  phone: z
    .string()
    .optional()
    .refine(val => !val || isValidIranianMobile(val), {
      message: 'شماره تلفن همراه باید با ۰۹ شروع شده و ۱۱ رقم باشد'
    }),
  allowedTabs: z.array(z.string()).optional(),
  editableTabs: z.array(z.string()).optional(),
  modulePermissions: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().default(true)
});

// 4. Zod Schema for Student Registration / Profile
export const StudentInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'نام باید حداقل ۲ کاراکتر باشد'),
  nationalId: z
    .string()
    .optional()
    .refine(val => !val || isValidIranianNationalCode(val), {
      message: 'کد ملی طلبه نامعتبر است'
    }),
  studentCode: z.string().trim().max(30).optional(),
  grade: z.string().trim().optional(),
  phoneNumber: z
    .string()
    .optional()
    .refine(val => !val || isValidIranianMobile(val), {
      message: 'شماره موبایل طلبه نامعتبر است'
    }),
  isActive: z.boolean().default(true),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  fatherName: z.string().optional(),
  maritalStatus: z.enum(['مجرد', 'متاهل']).optional(),
  tammomStatus: z.enum(['معمم', 'غیر معمم']).optional()
});

// 5. Zod Schema for Collection Document Mutation
export const DocumentMutationSchema = z.object({
  collection: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'نام مجموعه نامعتبر است'),
  id: z
    .string()
    .min(1, 'شناسه نمی‌تواند خالی باشد'),
  record: z.record(z.string(), z.any())
});
