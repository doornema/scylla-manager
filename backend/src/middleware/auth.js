import { verifyToken } from '../services/authService.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'توکن احراز هویت یافت نشد' });

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده است' });
  }
}

export function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'دسترسی ادمین مورد نیاز است' });
  }
  next();
}