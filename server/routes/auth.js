/**
 * 认证路由 - 注册/登录/获取用户信息
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码为必填项' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }

    // 检查邮箱是否已注册
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }

    // 创建用户
    const user = new User({ email, password, nickname: nickname || '手札用户' });
    await user.save();

    // 生成 JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      message: '注册成功',
      token,
      user: user.toSafeJSON()
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码为必填项' });
    }

    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 验证密码
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 生成 JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      message: '登录成功',
      token,
      user: user.toSafeJSON()
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error('[Auth] Get me error:', err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

/**
 * PUT /api/auth/profile
 * 更新用户信息
 */
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;
    await user.save();

    res.json({ message: '更新成功', user: user.toSafeJSON() });
  } catch (err) {
    console.error('[Auth] Update profile error:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

/**
 * POST /api/auth/register-device
 * 注册设备
 */
router.post('/register-device', authMiddleware, async (req, res) => {
  try {
    const { deviceId, deviceName } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    // 更新或添加设备
    const existing = user.devices.find(d => d.deviceId === deviceId);
    if (existing) {
      existing.lastSyncAt = new Date();
      existing.deviceName = deviceName || existing.deviceName;
    } else {
      user.devices.push({ deviceId, deviceName, lastSyncAt: new Date() });
    }
    await user.save();

    res.json({ message: '设备已注册' });
  } catch (err) {
    console.error('[Auth] Register device error:', err);
    res.status(500).json({ error: '注册设备失败' });
  }
});

export default router;
