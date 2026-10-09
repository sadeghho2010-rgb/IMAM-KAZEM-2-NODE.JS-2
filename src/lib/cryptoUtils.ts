import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(
  process.env.APP_ENCRYPTION_KEY || 'a1b2c3d4e5f678901234567890abcdefa1b2c3d4e5f678901234567890abcdef',
  'hex'
); // 32 bytes (256 bits)

const HMAC_SECRET = process.env.APP_HMAC_SECRET || 'sem_hmac_secret_key_998877665544332211';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt sensitive field using AES-256-GCM
 */
export function encryptSensitiveField(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return JSON.stringify({
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag
  });
}

/**
 * Decrypt sensitive field using AES-256-GCM
 */
export function decryptSensitiveField(encryptedJson: string): string {
  if (!encryptedJson) return '';
  try {
    const payload: EncryptedPayload = JSON.parse(encryptedJson);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(payload.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
    
    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '[Encrypted Value]';
  }
}

/**
 * Generate HMAC Blind Index for fast searchable database lookup
 */
export function generateBlindIndex(value: string): string {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  return crypto.createHmac('sha256', HMAC_SECRET).update(normalized).digest('hex');
}

/**
 * Mask National ID for logging / unprivileged view
 */
export function maskNationalId(nationalId: string): string {
  if (!nationalId || nationalId.length < 6) return '***';
  return nationalId.substring(0, 3) + '****' + nationalId.substring(nationalId.length - 3);
}

/**
 * Mask Phone Number for logging
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  return phone.substring(0, 4) + '***' + phone.substring(phone.length - 4);
}
