/**
 * 万物手札后端 API 服务
 * Express + SQLite (better-sqlite3) + JWT 认证
 * 零外部依赖，数据库文件存储在 server/data/journal.db
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'journal.db');

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 动态导入 better-sqlite3
let Database;
try {
  const mod = await import('better-sqlite3');
  Database = mod.default;
} catch (e) {
  console.error('Failed to load better-sqlite3:', e);
  process.exit(1);
}

// ==================== 安全加固 ====================

// 登录/注册频率限制 (防暴力破解)
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 分钟
const RATE_LIMIT_MAX_LOGIN = 10; // 每窗口最多 10 次登录
const rateLimitMap = new Map(); // key: IP -> { count, resetTime }

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  let record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, record);
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX_LOGIN) {
    const remaining = Math.ceil((record.resetTime - now) / 1000);
    return res.status(429).json({ error: `请求过于频繁，请 ${remaining} 秒后重试` });
  }

  next();
}

// 清理过期的频率限制记录 (每 5 分钟)
// NOTE: rateLimitMap 是内存存储，服务器重启后会丢失。
// 对于单服务器、低频重启的场景，这是可接受的。
// 如果需要持久化，可考虑 SQLite 或 Redis。
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// ==================== CSRF 防护 ====================
// 采用双重提交 Cookie 模式 (double-submit cookie pattern)
// SameSite=Strict cookie 已保护同源请求，此中间件额外验证跨站请求

function csrfMiddleware(req, res, next) {
  // 从 cookie 头手动解析 csrf_token（不引入 cookie-parser 依赖）
  let csrfCookie = null;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    if (match) csrfCookie = match[1];
  }
  const tokenHeader = req.headers['x-csrf-token'];
  if (!tokenHeader || tokenHeader !== csrfCookie) {
    return res.status(403).json({ error: 'CSRF 验证失败' });
  }
  next();
}

// 邮箱格式校验 (RFC 5322 简化版)
function isValidEmail(email) {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email);
}

// 邮箱规范化
function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

// 初始化数据库
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT DEFAULT '手札用户',
    max_usn INTEGER DEFAULT 0,
    devices TEXT DEFAULT '[]',
    token_version INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    mood TEXT,
    status TEXT DEFAULT 'in-use',
    favorite INTEGER DEFAULT 0,
    photos TEXT DEFAULT '[]',
    location TEXT,
    links TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    blocks TEXT DEFAULT '[]',
    usn INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    deleted_at DATETIME,
    trash_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id);
  CREATE INDEX IF NOT EXISTS idx_records_usn ON records(user_id, usn);
  CREATE INDEX IF NOT EXISTS idx_records_updated ON records(user_id, updated_at);
  CREATE INDEX IF NOT EXISTS idx_records_deleted ON records(user_id, deleted);
`);

console.log(`[DB] SQLite initialized at ${DB_PATH}`);

// 加密工具
import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// 防时序攻击：预生成的虚拟密码哈希，用于用户不存在时仍执行 bcrypt 比较
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('dummy-password-for-timing-protection', 10);

// JWT 密钥 — 生产环境必须通过 .env 配置强密钥，否则启动时自动生成并持久化
const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET !== 'your-super-secret-jwt-key-change-in-production'
  ? process.env.JWT_SECRET
  : (() => {
      const envPath = path.join(__dirname, '.env');
      const generated = randomBytes(32).toString('hex');
      // 自动生成并写入 .env，避免每次重启密钥变化
      try {
        const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (!existing.includes('JWT_SECRET=')) {
          fs.appendFileSync(envPath, `\nJWT_SECRET=${generated}\n`);
        }
      } catch (e) {
        console.error('[Server] WARNING: Cannot persist JWT_SECRET to .env. Sessions will be invalidated on restart.');
        return generated;
      }
      return generated;
    })();
const JWT_EXPIRY = '30d';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, tokenVersion: user.token_version || 0 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function authMiddleware(req, res, next) {
  // v7.0.3: 优先从 httpOnly cookie 读取 token，兼容 Authorization header
  let token = null;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    // 精确匹配 journal_token，避免 cookie 注入攻击
    const match = cookieHeader.match(/(?:^|;\s*)journal_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // 验证 token 版本（密码修改/登出后会递增）
    const user = db.prepare('SELECT id, token_version FROM users WHERE id = ?').get(decoded.userId);
    if (!user || decoded.tokenVersion !== user.token_version) {
      return res.status(401).json({ error: '令牌无效或已过期' });
    }
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
}

// 设置 httpOnly cookie 的辅助函数
function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieVal = encodeURIComponent(token);
  res.setHeader('Set-Cookie',
    `journal_token=${cookieVal}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}${isProd ? '; Secure' : ''}`
  );
}

// 设置 CSRF token cookie (非 httpOnly，供客户端读取)
function setCSRFCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const token = randomBytes(32).toString('hex');
  res.setHeader('Set-Cookie',
    `csrf_token=${token}; SameSite=Strict; Path=/${isProd ? '; Secure' : ''}`
  );
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie',
    'journal_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
  );
}

// 中间件
const app = express();
const PORT = process.env.PORT || 4000;

// 安全响应头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 (前端)
if (process.env.SERVE_FRONTEND === 'true') {
  const frontendDir = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'dist');
  app.use(express.static(frontendDir));
  console.log(`[Static] Serving frontend from ${frontendDir}`);
}

// 日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ==================== 路由 ====================

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: 'sqlite',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ========== Auth ==========

app.post('/api/auth/register', rateLimitMiddleware, (req, res) => {
  const { email, password, nickname } = req.body;
  const normalizedEmail = normalizeEmail(email || '');
  if (!normalizedEmail || !password) return res.status(400).json({ error: '邮箱和密码必填' });
  if (!isValidEmail(normalizedEmail)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  if (password.length > 128) return res.status(400).json({ error: '密码过长' });

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) return res.status(409).json({ error: '邮箱已被注册' });

    const hash = hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)'
    ).run(normalizedEmail, hash, nickname || '手札用户');

    const user = db.prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    // 仅设置 httpOnly cookie，不在响应体中返回 token（防止 XSS 窃取）
    setAuthCookie(res, token);
    setCSRFCookie(res);
    res.status(201).json({ user });
  } catch (e) {
    console.error('[Auth] Register error:', e);
    res.status(500).json({ error: '注册失败' });
  }
});

app.post('/api/auth/login', rateLimitMiddleware, (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email || '');
  if (!normalizedEmail || !password) return res.status(400).json({ error: '邮箱和密码必填' });
  if (!isValidEmail(normalizedEmail)) return res.status(400).json({ error: '邮箱格式不正确' });

  try {
    const user = db.prepare('SELECT id, email, nickname, password_hash, created_at FROM users WHERE email = ?').get(normalizedEmail);
    // 防时序攻击：即使用户不存在也执行 bcrypt 比较（使用预生成的真实哈希）
    const isValid = user ? verifyPassword(password, user.password_hash) : verifyPassword(password, DUMMY_BCRYPT_HASH);

    if (!user || !isValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);
    // 仅设置 httpOnly cookie，不在响应体中返回 token（防止 XSS 窃取）
    setAuthCookie(res, token);
    setCSRFCookie(res);
    res.json({ user: safeUser });
  } catch (e) {
    console.error('[Auth] Login error:', e);
    res.status(500).json({ error: '登录失败' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  setCSRFCookie(res);
  res.json({ user });
});

app.put('/api/auth/profile', rateLimitMiddleware, authMiddleware, csrfMiddleware, (req, res) => {
  const { nickname } = req.body;
  if (!nickname || typeof nickname !== 'string') return res.status(400).json({ error: '昵称格式不正确' });
  if (nickname.length > 50) return res.status(400).json({ error: '昵称过长' });
  db.prepare('UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nickname, req.userId);
  const user = db.prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

// v7.0.3: 登出端点 — 清除 httpOnly cookie 并作废 token
app.post('/api/auth/logout', authMiddleware, csrfMiddleware, (req, res) => {
  // 递增 token 版本，使当前 JWT 失效
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.userId);
  clearAuthCookie(res);
  res.json({ success: true });
});

// v7.1.0: 修改密码（增加速率限制）
app.put('/api/auth/change-password', rateLimitMiddleware, authMiddleware, csrfMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '当前密码和新密码必填' });
  if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
  if (newPassword.length > 128) return res.status(400).json({ error: '新密码过长' });

  try {
    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.userId);
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const newHash = hashPassword(newPassword);
    // 递增 token 版本，使旧 JWT 失效
    db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.userId);
    // 生成新 token 并设置 cookie，避免用户修改密码后被踢出
    const refreshedUser = db.prepare('SELECT id, email, nickname, token_version FROM users WHERE id = ?').get(req.userId);
    const newToken = generateToken(refreshedUser);
    setAuthCookie(res, newToken);
    res.json({ success: true, user: { id: refreshedUser.id, email: refreshedUser.email, nickname: refreshedUser.nickname } });
  } catch (e) {
    console.error('[Auth] Change password error:', e);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// v7.1.0: 删除账号（增加速率限制）
app.delete('/api/auth/account', rateLimitMiddleware, authMiddleware, csrfMiddleware, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '密码必填' });

  try {
    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.userId);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: '密码不正确' });
    }

    // 使用事务：先删除用户的所有记录，再删除用户
    const deleteAccount = db.transaction(() => {
      db.prepare('DELETE FROM records WHERE user_id = ?').run(req.userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
    });
    deleteAccount();

    clearAuthCookie(res);
    res.json({ success: true });
  } catch (e) {
    console.error('[Auth] Delete account error:', e);
    res.status(500).json({ error: '删除账号失败' });
  }
});

// ========== Records ==========

app.get('/api/records', authMiddleware, (req, res) => {
  try {
    const { usn, since, deleted } = req.query;
    let query = 'SELECT * FROM records WHERE user_id = ?';
    const params = [req.userId];

    if (usn) {
      query += ' AND usn > ?';
      params.push(parseInt(usn));
    }
    if (since) {
      query += ' AND updated_at > ?';
      params.push(since);
    }
    if (deleted === 'true') {
      query += ' AND deleted = 1';
    } else {
      query += ' AND deleted = 0';
    }

    query += ' ORDER BY updated_at DESC';
    const records = db.prepare(query).all(...params);

    records.forEach(r => {
      r.tags = JSON.parse(r.tags || '[]');
      r.photos = JSON.parse(r.photos || '[]');
      r.links = JSON.parse(r.links || '[]');
      r.metadata = JSON.parse(r.metadata || '{}');
      r.blocks = JSON.parse(r.blocks || '[]');
      r.createdAt = new Date(r.created_at).getTime();
      r.updatedAt = new Date(r.updated_at).getTime();
      delete r.created_at;
      delete r.updated_at;
    });

    res.json({ records });
  } catch (e) {
    console.error('[Records] Query error:', e);
    res.status(500).json({ error: '查询记录失败' });
  }
});

app.post('/api/records', authMiddleware, csrfMiddleware, (req, res) => {
  const record = req.body;
  try {
    // v7.0.3: 使用事务确保 USN 递增和记录插入原子性
    const createRecord = db.transaction(() => {
      const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
      const usn = user.max_usn + 1;
      db.prepare('UPDATE users SET max_usn = ? WHERE id = ?').run(usn, req.userId);
      db.prepare(`
        INSERT INTO records (id, user_id, name, notes, tags, mood, status, favorite, photos, location, links, metadata, blocks, usn, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        record.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        req.userId, record.name || '', record.notes || '',
        JSON.stringify(record.tags || []), record.mood || null,
        record.status || 'in-use', record.favorite ? 1 : 0,
        JSON.stringify(record.photos || []), record.location || null,
        JSON.stringify(record.links || []), JSON.stringify(record.metadata || {}),
        JSON.stringify(record.blocks || []), usn
      );
      return usn;
    });
    const usn = createRecord();
    res.status(201).json({ record: { ...record, usn } });
  } catch (e) {
    console.error('[Records] Create error:', e);
    res.status(500).json({ error: '创建记录失败' });
  }
});

app.put('/api/records/:id', authMiddleware, csrfMiddleware, (req, res) => {
  const record = db.prepare('SELECT * FROM records WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!record) return res.status(404).json({ error: '记录不存在' });

  try {
    // v7.0.3: 使用事务确保 USN 递增和记录更新原子性
    const updateRecord = db.transaction(() => {
      const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
      const usn = user.max_usn + 1;
      const updates = req.body;
      const fields = [];
      const values = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
      if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
      if (updates.mood !== undefined) { fields.push('mood = ?'); values.push(updates.mood); }
      if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
      if (updates.favorite !== undefined) { fields.push('favorite = ?'); values.push(updates.favorite ? 1 : 0); }
      if (updates.photos !== undefined) { fields.push('photos = ?'); values.push(JSON.stringify(updates.photos)); }
      if (updates.deleted !== undefined) {
        fields.push('deleted = ?'); values.push(updates.deleted ? 1 : 0);
        if (updates.deleted) {
          fields.push('deleted_at = CURRENT_TIMESTAMP');
        }
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.params.id, req.userId);

      db.prepare(`UPDATE records SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
      db.prepare('UPDATE users SET max_usn = ? WHERE id = ?').run(usn, req.userId);
      return usn;
    });
    const usn = updateRecord();
    res.json({ usn });
  } catch (e) {
    console.error('[Records] Update error:', e);
    res.status(500).json({ error: '更新记录失败' });
  }
});

app.delete('/api/records/:id', authMiddleware, csrfMiddleware, (req, res) => {
  const record = db.prepare('SELECT * FROM records WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!record) return res.status(404).json({ error: '记录不存在' });

  try {
    // v7.0.3: 使用事务确保 USN 递增和删除操作原子性
    const deleteRecord = db.transaction(() => {
      const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
      const usn = user.max_usn + 1;
      db.prepare('UPDATE records SET deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, usn = ? WHERE id = ? AND user_id = ?').run(usn, req.params.id, req.userId);
      db.prepare('UPDATE users SET max_usn = ? WHERE id = ?').run(usn, req.userId);
      return usn;
    });
    const usn = deleteRecord();
    res.json({ usn });
  } catch (e) {
    console.error('[Records] Delete error:', e);
    res.status(500).json({ error: '删除记录失败' });
  }
});

// ========== Sync ==========

app.post('/api/sync/pull', authMiddleware, csrfMiddleware, (req, res) => {
  try {
    const { lastSyncUsn } = req.body;
    const usn = lastSyncUsn || 0;

    const records = db.prepare(
      'SELECT * FROM records WHERE user_id = ? AND usn > ? ORDER BY usn ASC'
    ).all(req.userId, usn);

    records.forEach(r => {
      r.tags = JSON.parse(r.tags || '[]');
      r.photos = JSON.parse(r.photos || '[]');
      r.links = JSON.parse(r.links || '[]');
      r.metadata = JSON.parse(r.metadata || '{}');
      r.blocks = JSON.parse(r.blocks || '[]');
      r.createdAt = new Date(r.created_at).getTime();
      r.updatedAt = new Date(r.updated_at).getTime();
      delete r.created_at;
      delete r.updated_at;
    });

    const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
    res.json({ records, serverMaxUsn: user.max_usn });
  } catch (e) {
    console.error('[Sync] Pull error:', e);
    res.status(500).json({ error: '拉取同步数据失败' });
  }
});

app.post('/api/sync/push', authMiddleware, csrfMiddleware, (req, res) => {
  const { changes } = req.body;
  const results = [];

  // v7.0.3: 使用事务确保原子性，部分失败时全部回滚
  const runInTransaction = db.transaction((changesList) => {
    for (const change of changesList) {
      const existing = db.prepare('SELECT usn FROM records WHERE id = ? AND user_id = ?').get(change.id, req.userId);
      const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
      const newUsn = user.max_usn + 1;

      // 删除操作
      if (change._deleted) {
        if (existing) {
          db.prepare(
            'UPDATE records SET deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, usn = ? WHERE id = ? AND user_id = ?'
          ).run(newUsn, change.id, req.userId);
        }
        db.prepare('UPDATE users SET max_usn = ? WHERE id = ?').run(newUsn, req.userId);
        results.push({ id: change.id, usn: newUsn, deleted: true });
        continue;
      }

      if (!existing) {
        // 新记录
        db.prepare(`
          INSERT INTO records (id, user_id, name, notes, tags, mood, status, favorite, photos, location, links, metadata, blocks, usn, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          change.id, req.userId,
          change.name || '', change.notes || '',
          JSON.stringify(change.tags || []), change.mood,
          change.status || 'in-use', change.favorite ? 1 : 0,
          JSON.stringify(change.photos || []), change.location,
          JSON.stringify(change.links || []), JSON.stringify(change.metadata || {}),
          JSON.stringify(change.blocks || []), newUsn
        );
      } else {
        // 更新：只覆盖客户端版本
        db.prepare(`
          UPDATE records SET name = ?, notes = ?, tags = ?, mood = ?, status = ?, favorite = ?, photos = ?, location = ?, links = ?, metadata = ?, blocks = ?, usn = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).run(
          change.name || '', change.notes || '',
          JSON.stringify(change.tags || []), change.mood,
          change.status || 'in-use', change.favorite ? 1 : 0,
          JSON.stringify(change.photos || []), change.location,
          JSON.stringify(change.links || []), JSON.stringify(change.metadata || {}),
          JSON.stringify(change.blocks || []), newUsn,
          change.id, req.userId
        );
      }

      db.prepare('UPDATE users SET max_usn = ? WHERE id = ?').run(newUsn, req.userId);
      results.push({ id: change.id, usn: newUsn });
    }
  });

  try {
    if (changes && changes.length > 0) {
      runInTransaction(changes);
    }
  } catch (e) {
    console.error('[Sync] Push transaction failed:', e);
    return res.status(500).json({ error: '同步失败，请重试' });
  }

  res.json({ results, serverMaxUsn: db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId).max_usn });
});

app.get('/api/sync/status', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT max_usn, created_at FROM users WHERE id = ?').get(req.userId);
  const recordCount = db.prepare('SELECT COUNT(*) as count FROM records WHERE user_id = ? AND deleted = 0').get(req.userId);
  res.json({ maxUsn: user.max_usn, recordCount: recordCount.count, connectedAt: user.created_at });
});

// SPA 回退：所有非 API 路由返回 index.html
app.use((req, res, next) => {
  if (process.env.SERVE_FRONTEND === 'true' && !req.path.startsWith('/api')) {
    const frontendDir = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'dist');
    return res.sendFile(path.join(frontendDir, 'index.html'));
  }
  next();
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动
app.listen(PORT, () => {
  console.log(`[Server] SQLite backend running on port ${PORT}`);
  console.log(`[Server] API: http://localhost:${PORT}/api`);
  console.log(`[Server] DB: ${DB_PATH}`);
});
