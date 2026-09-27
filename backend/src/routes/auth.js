import { Router } from 'express';
import { authenticate, generateToken } from '../services/authService.js';
import { loginSchema, validate } from '../middleware/validate.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await authenticate(username, password);
    if (!user) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    const token = generateToken(user);
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: { username: req.user.sub, role: req.user.role } });
});

export default router;