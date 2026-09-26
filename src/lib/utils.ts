import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];

export function getProgramDays(p: { day?: string; days?: string[] }): string[] {
  if (p.days && Array.isArray(p.days) && p.days.length > 0) {
    return p.days;
  }
  if (!p.day) return [];
  if (p.day.includes('هر روز') || p.day.includes('شنبه تا چهارشنبه')) {
    return ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];
  }
  const matched = WEEK_DAYS.filter(d => p.day?.includes(d));
  if (matched.length > 0) return matched;
  return [p.day];
}

export function normalizeGrade(val?: string | number | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';
  
  // Convert Persian/Arabic digits to English digits
  const englishDigits = str.replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
                           .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
  
  // Extract number if present
  const match = englishDigits.match(/\d+/);
  if (match) return match[0];
  
  // Words mapping
  if (str.includes('هفت') || str.includes('۷')) return '7';
  if (str.includes('هشت') || str.includes('۸')) return '8';
  if (str.includes('نه') || str.includes('۹')) return '9';
  if (str.includes('ده') || str.includes('۱۰')) return '10';
  if (str.includes('یازده') || str.includes('۱۱')) return '11';
  return str;
}

export function matchesGradeFilter(itemGrade?: string | number | null, filterValue?: string | number | null): boolean {
  if (!filterValue || filterValue === 'all' || filterValue === 'همه') return true;
  if (!itemGrade) return false;
  
  const normItem = normalizeGrade(itemGrade);
  const normFilter = normalizeGrade(filterValue);

  if (normItem && normFilter && normItem === normFilter) return true;

  const itemStr = String(itemGrade).trim();
  const filterStr = String(filterValue).trim();
  return itemStr.includes(filterStr) || filterStr.includes(itemStr);
}

