import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeDigits(input?: string | number | null): string {
  if (input === undefined || input === null) return '';
  const str = String(input);
  return str
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584));
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
  const englishDigits = str
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632));
  
  // Extract number if present
  const match = englishDigits.match(/\d+/);
  if (match) return match[0];
  
  // Words mapping
  const lower = str.toLowerCase();
  if (lower.includes('اول') || lower.includes('یک')) return '1';
  if (lower.includes('دوم') || lower.includes('دو')) return '2';
  if (lower.includes('سوم') || lower.includes('سه')) return '3';
  if (lower.includes('چهارم') || lower.includes('چهار')) return '4';
  if (lower.includes('پنجم') || lower.includes('پنج')) return '5';
  if (lower.includes('ششم') || lower.includes('شش')) return '6';
  if (lower.includes('هفتم') || lower.includes('هفت')) return '7';
  if (lower.includes('هشتم') || lower.includes('هشت')) return '8';
  if (lower.includes('نهم') || lower.includes('نه')) return '9';
  if (lower.includes('دهم') || lower.includes('ده')) return '10';
  if (lower.includes('یازدهم') || lower.includes('یازده')) return '11';
  if (lower.includes('دوازدهم') || lower.includes('دوازده')) return '12';
  
  return str;
}

export function isSameGrade(g1?: string | number | null, g2?: string | number | null): boolean {
  if (g1 === g2) return true;
  if (!g1 || !g2) return false;
  
  const norm1 = normalizeGrade(g1);
  const norm2 = normalizeGrade(g2);
  if (norm1 && norm2 && norm1 === norm2) return true;

  const str1 = String(g1).trim();
  const str2 = String(g2).trim();
  return str1 === str2 || str1.includes(str2) || str2.includes(str1);
}

export function matchesGradeFilter(itemGrade?: string | number | null, filterValue?: string | number | null): boolean {
  if (!filterValue || filterValue === 'all' || filterValue === 'همه' || filterValue === 'ALL') return true;
  if (!itemGrade) return false;
  
  return isSameGrade(itemGrade, filterValue);
}

export function formatGradeLabel(val?: string | number | null): string {
  if (!val) return 'پایه نامشخص';
  const norm = normalizeGrade(val);
  if (norm && /^\d+$/.test(norm)) {
    return `پایه ${norm}`;
  }
  return String(val).trim();
}


