import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

/* کاربر ادمین از env خوانده می‌شود */
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * احراز هویت با مقایسه مستقیم با مقادیر env.
 * برای امنیت، مقایسه‌ی رمز به‌صورت constant-time انجام می‌شود.
 */
export async function authenticate(username, password) {
  // همیشه هر دو مقایسه را انجام می‌دهیم تا timing attack ممکن نباشد
  const usernameMatch = safeEqual(username, ADMIN_USERNAME);
  const passwordMatch = safeEqual(password, ADMIN_PASSWORD);

  if (usernameMatch && passwordMatch) {
    return { username: ADMIN_USERNAME, role: 'admin' };
  }
  return null;
}

export function generateToken(user) {
  return jwt.sign(
    { sub: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * مقایسه‌ی امن در برابر timing attack.
 * طول‌های مختلف را با padding مقایسه می‌کند.
 */
function safeEqual(a = '', b = '') {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  const len = Math.max(bufA.length, bufB.length);

  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  bufA.copy(padA);
  bufB.copy(padB);

  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < len; i++) {
    diff |= padA[i] ^ padB[i];
  }
  return diff === 0;
}