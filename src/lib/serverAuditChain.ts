import crypto from 'crypto';
import { HashChainedAuditLog } from '../types';

const PEPPER = process.env.AUDIT_PEPPER;

if (!PEPPER || PEPPER.length < 24) {
  console.error('FATAL ERROR: AUDIT_PEPPER not set or too short.');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}
const SAFE_PEPPER = PEPPER || 'fallback_for_dev_only_very_long_string_1234567890';
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes a SHA-256 hash for an audit log record, cryptographically chained to previous_hash.
 */
export function computeRecordHash(entry: {
  id: string;
  previous_hash?: string;
  user_id?: string;
  user_name?: string;
  role?: string;
  action: string;
  module: string;
  target_id?: string;
  target_type?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  created_at: string;
}): string {
  const normalizedPrev = entry.previous_hash || GENESIS_HASH;
  const oldValStr = entry.old_values ? JSON.stringify(entry.old_values) : '';
  const newValStr = entry.new_values ? JSON.stringify(entry.new_values) : '';

  const payload = [
    normalizedPrev,
    entry.id || '',
    entry.user_id || '',
    entry.user_name || '',
    entry.role || '',
    entry.action || '',
    entry.module || '',
    entry.target_id || '',
    entry.target_type || '',
    oldValStr,
    newValStr,
    entry.ip_address || '',
    entry.created_at || '',
    PEPPER
  ].join('|#|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Validates the entire blockchain-style audit log hash chain from oldest to newest.
 */
export function verifyAuditChain(logs: HashChainedAuditLog[]): {
  isValid: boolean;
  brokenAtIndex?: number;
  brokenRecordId?: string;
  reason?: string;
  totalVerified: number;
} {
  if (!Array.isArray(logs) || logs.length === 0) {
    return { isValid: true, totalVerified: 0 };
  }

  // Ensure chronological order (oldest first)
  const sorted = [...logs].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime() || 0;
    const timeB = new Date(b.created_at).getTime() || 0;
    return timeA - timeB;
  });

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];
    const actualPrevHash = record.previous_hash || GENESIS_HASH;

    // 1. Verify previous_hash linkage
    if (i > 0 && actualPrevHash !== expectedPrevHash) {
      return {
        isValid: false,
        brokenAtIndex: i,
        brokenRecordId: record.id,
        reason: `گسستگی در زنجیره هش در ردیف ${i + 1} (شناسه: ${record.id}). هش ماقبل ثبت‌شده با هش رکورد قبلی تطابق ندارد.`,
        totalVerified: i
      };
    }

    // 2. Re-compute current_hash from raw data
    const recalculatedHash = computeRecordHash({
      id: record.id,
      previous_hash: actualPrevHash,
      user_id: record.user_id,
      user_name: record.user_name,
      role: record.role,
      action: record.action,
      module: record.module,
      target_id: record.target_id,
      target_type: record.target_type,
      old_values: record.old_values,
      new_values: record.new_values,
      ip_address: record.ip_address,
      created_at: record.created_at
    });

    if (recalculatedHash !== record.current_hash) {
      return {
        isValid: false,
        brokenAtIndex: i,
        brokenRecordId: record.id,
        reason: `دستکاری در داده‌های لاگ ردیف ${i + 1} (شناسه: ${record.id}). هش محاسبه‌شده با هش ثبت‌شده در پایگاه داده مغایرت دارد.`,
        totalVerified: i
      };
    }

    expectedPrevHash = record.current_hash;
  }

  return {
    isValid: true,
    totalVerified: sorted.length
  };
}
