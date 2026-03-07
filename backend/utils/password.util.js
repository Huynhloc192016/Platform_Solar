const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Legacy DES: khớp EncryptDES mới (key và IV đều là "!#$a54?3" ASCII)
const LEGACY_DES_KEY = process.env.LEGACY_PASSWORD_KEY || '!#$a54?3';
// IV cũ (code C# Decrypt cũ): dùng khi password trong DB được mã hóa bằng code cũ
const LEGACY_DES_IV_OLD = Buffer.from([10, 20, 30, 40, 50, 60, 70, 80]);

const getLegacyDesKeyAndIv = () => {
  const raw = String(LEGACY_DES_KEY).substring(0, 8);
  const buf = Buffer.from(raw, 'ascii');
  return { key: buf, iv: buf };
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/** Kiểm tra stored có phải hash bcrypt không (bắt đầu bằng $2a$ hoặc $2b$) */
const isBcryptHash = (stored) => {
  if (!stored || typeof stored !== 'string') return false;
  return /^\$2[ab]\$/.test(stored.trim());
};

/**
 * Giải mã DES-CBC với key và IV cho trước.
 */
const decryptDes = (base64Cipher, key, iv) => {
  try {
    const decipher = crypto.createDecipheriv('des-cbc', key, iv);
    const decoded = Buffer.from(base64Cipher.trim(), 'base64');
    return decipher.update(decoded).toString('utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
};

/**
 * Giải mã password legacy DES-CBC.
 * Thử IV mới (key = IV) trước, nếu fail thử IV cũ [10,20,...,80].
 */
const decryptLegacyDes = (base64Cipher) => {
  if (!base64Cipher || typeof base64Cipher !== 'string') return null;
  const { key, iv } = getLegacyDesKeyAndIv();
  const withNewIv = decryptDes(base64Cipher, key, iv);
  if (withNewIv !== null) return withNewIv;
  return decryptDes(base64Cipher, key, LEGACY_DES_IV_OLD);
};

/**
 * So sánh password với giá trị lưu đã mã hóa DES (legacy).
 * Thử IV mới (key=IV) rồi IV cũ [10,20,...,80] — khớp format nào thì dùng.
 */
const comparePasswordLegacyDes = (password, storedBase64) => {
  if (!storedBase64 || !password) return false;
  const p = String(password).trim();
  const { key, iv } = getLegacyDesKeyAndIv();
  const decryptedNew = decryptDes(storedBase64, key, iv);
  if (decryptedNew !== null && decryptedNew.trim() === p) return true;
  const decryptedOld = decryptDes(storedBase64, key, LEGACY_DES_IV_OLD);
  return decryptedOld !== null && decryptedOld.trim() === p;
};

/**
 * So sánh password với giá trị lưu dạng Base64 thuần (không mã hóa).
 */
const comparePasswordLegacyBase64 = (password, storedBase64) => {
  if (!storedBase64 || !password) return false;
  try {
    const encoded = Buffer.from(String(password), 'utf8').toString('base64');
    return encoded === String(storedBase64).trim();
  } catch {
    return false;
  }
};

const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * So sánh password: bcrypt → legacy DES → legacy Base64 → plain text (stored = password nhập).
 */
const comparePasswordWithLegacy = async (password, storedPassword) => {
  if (!storedPassword) return false;
  const stored = String(storedPassword).trim();
  if (isBcryptHash(stored)) {
    return await comparePassword(password, stored);
  }
  if (comparePasswordLegacyDes(password, stored)) return true;
  if (comparePasswordLegacyBase64(password, stored)) return true;
  // Cho phép đăng nhập bằng chính giá trị đang lưu trong DB (plain text)
  if (stored === String(password).trim()) return true;
  return false;
};

module.exports = {
  hashPassword,
  comparePassword,
  comparePasswordWithLegacy,
  comparePasswordLegacyBase64,
  comparePasswordLegacyDes,
  decryptLegacyDes,
  isBcryptHash,
};
