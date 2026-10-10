import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { FieldCrypto, aad } from '../src/lib/cryptoUtils';

const KEY = crypto.randomBytes(32).toString('hex');
const HMAC_KEY = 'k'.repeat(40);
const ID1 = '018f26a2-e63f-7000-8000-000000000001';
const ID2 = '018f26a2-e63f-7000-8000-000000000002';

describe('FieldCrypto Security Tests', () => {
  it('encrypts and decrypts with matching AAD context', () => {
    const cryptoInstance = new FieldCrypto(KEY, HMAC_KEY);
    const blob = cryptoInstance.encrypt('0499370899', aad('students', 'national_id', ID1));
    expect(cryptoInstance.decrypt(blob, aad('students', 'national_id', ID1))).toBe('0499370899');
  });

  it('rejects a ciphertext moved to another record (AAD mismatch)', () => {
    const cryptoInstance = new FieldCrypto(KEY, HMAC_KEY);
    const blob = cryptoInstance.encrypt('0499370899', aad('students', 'national_id', ID1));
    expect(() => cryptoInstance.decrypt(blob, aad('students', 'national_id', ID2))).toThrow();
  });

  it('rejects tampered ciphertext payload', () => {
    const cryptoInstance = new FieldCrypto(KEY, HMAC_KEY);
    const blob = cryptoInstance.encrypt('0499370899', aad('students', 'national_id', ID1));
    const parts = blob.split(':');
    const buf = Buffer.from(parts[3], 'base64');
    buf[0] ^= 0xff;
    const tampered = [parts[0], parts[1], parts[2], buf.toString('base64')].join(':');
    expect(() => cryptoInstance.decrypt(tampered, aad('students', 'national_id', ID1))).toThrow();
  });

  it('generates fresh random IV for every encryption operation', () => {
    const cryptoInstance = new FieldCrypto(KEY, HMAC_KEY);
    const a = cryptoInstance.encrypt('same_data', 'context_ad');
    const b = cryptoInstance.encrypt('same_data', 'context_ad');
    expect(a).not.toBe(b);
  });

  it('produces equal blind index for Persian/Arabic and ASCII digits', () => {
    const cryptoInstance = new FieldCrypto(KEY, HMAC_KEY);
    expect(cryptoInstance.blindIndex('۰۴۹۹۳۷۰۸۹۹', 'national_id')).toBe(
      cryptoInstance.blindIndex('0499370899', 'national_id')
    );
    expect(cryptoInstance.blindIndex('0499370899', 'national_id')).not.toBe(
      cryptoInstance.blindIndex('0499370899', 'phone')
    );
  });
});
