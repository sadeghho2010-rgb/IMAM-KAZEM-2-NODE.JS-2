import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(
  process.env.APP_ENCRYPTION_KEY || 'a1b2c3d4e5f678901234567890abcdefa1b2c3d4e5f678901234567890abcdef',
  'hex'
);

const HMAC_SECRET = process.env.APP_HMAC_SECRET || 'sem_hmac_secret_key_998877665544332211';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function aad(table: string, column: string, recordId: string): string {
  return `${table}.${column}|${recordId}`;
}

export class FieldCrypto {
  private encKey: Buffer;
  private hmacKey: Buffer;

  constructor(encKeyHex: string, hmacKeyStr: string) {
    this.encKey = Buffer.from(encKeyHex, 'hex');
    if (this.encKey.length !== 32) throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    this.hmacKey = Buffer.from(hmacKeyStr, 'utf8');
    if (this.hmacKey.length < 32) throw new Error('HMAC key must be at least 32 bytes');
  }

  encrypt(plaintext: string, associatedData: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encKey, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64'), tag.toString('base64'), body.toString('base64')].join(':');
  }

  decrypt(blob: string, associatedData: string): string {
    const parts = blob.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error('Unsupported ciphertext format');
    }
    const [, ivB64, tagB64, bodyB64] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encKey, Buffer.from(ivB64, 'base64'), { authTagLength: 16 });
    decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(bodyB64, 'base64')), decipher.final()]).toString('utf8');
  }

  blindIndex(value: string, kind: 'national_id' | 'phone'): string {
    const normalized = value.replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0)).trim();
    return crypto.createHmac('sha256', this.hmacKey).update(`${kind}|${normalized}`).digest('hex');
  }
}

export function encryptSensitiveField(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return JSON.stringify({ ciphertext: encrypted, iv: iv.toString('hex'), tag });
}

export function decryptSensitiveField(encryptedJson: string): string {
  if (!encryptedJson) return '';
  try {
    const payload: EncryptedPayload = JSON.parse(encryptedJson);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '[Encrypted Value]';
  }
}

export function generateBlindIndex(value: string): string {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  return crypto.createHmac('sha256', HMAC_SECRET).update(normalized).digest('hex');
}

export function maskNationalId(nationalId: string): string {
  if (!nationalId || nationalId.length < 6) return '***';
  return nationalId.substring(0, 3) + '****' + nationalId.substring(nationalId.length - 3);
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  return phone.substring(0, 4) + '***' + phone.substring(phone.length - 4);
}
