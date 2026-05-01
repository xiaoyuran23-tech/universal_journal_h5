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

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = '30d';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
}

// 中间件
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

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

app.post('/api/auth/register', (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码必填' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: '邮箱已被注册' });

    const hash = hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)'
    ).run(email, hash, nickname || '手札用户');

    const user = db.prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    res.status(201).json({ user, token });
  } catch (e) {
    console.error('[Auth] Register error:', e);
    res.status(500).json({ error: '注册失败' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码必填' });

  try {
    const user = db.prepare('SELECT id, email, nickname, password_hash, created_at FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);
    res.json({ user: safeUser, token });
  } catch (e) {
    console.error('[Auth] Login error:', e);
    res.status(500).json({ error: '登录失败' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});

app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const { nickname } = req.body;
  db.prepare('UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nickname, req.userId);
  const user = db.prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?').get(req.userId);
  res.json({ user });
});

// ========== Records ==========

app.get('/api/records', authMiddleware, (req, res) => {
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

  // 解析 JSON 字段
  records.forEach(r => {
    r.tags = JSON.parse(r.tags || '[]');
    r.photos = JSON.parse(r.photos || '[]');
    r.links = JSON.parse(r.links || '[]');
    r.metadata = JSON.parse(r.metadata || '{}');
    r.blocks = JSON.parse(r.blocks || '[]');
  });

  res.json({ records });
});

app.post('/api/records', authMiddleware, (req, res) => {
  const record = req.body;
  const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
  const usn = user.max_usn + 1;

  db.prepare('UPDATE users SET max_usn = ? WHERE id = ?').run(usn, req.userId);

  const stmt = db.prepare(`
    INSERT INTO records (id, user_id, name, notes, tags, mood, status, favorite, photos, location, links, metadata, blocks, usn, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  stmt.run(
    record.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    req.userId,
    record.name || '',
    record.notes || '',
    JSON.stringify(record.tags || []),
    record.mood || null,
    record.status || 'in-use',
    record.favorite ? 1 : 0,
    JSON.stringify(record.photos || []),
    record.location || null,
    JSON.stringify(record.links || []),
    JSON.stringify(record.metadata || {}),
    JSON.stringify(record.blocks || []),
    usn
  );

  res.status(201).json({ record: { ...record, usn } });
});

app.put('/api/records/:id', authMiddleware, (req, res) => {
  const record = db.prepare('SELECT * FROM records WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!record) return res.status(404).json({ error: '记录不存在' });

  const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
  const usn = user.max_usn + 1;
  db.prepare('UPDATE users SET max_usn = ? WHERE id = ?').run(usn, req.userId);

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

  res.json({ usn });
});

app.delete('/api/records/:id', authMiddleware, (req, res) => {
  const record = db.prepare('SELECT * FROM records WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!record) return res.status(404).json({ error: '记录不存在' });

  const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
  const usn = user.max_usn + 1;
  db.prepare('UPDATE users SET max_usn = ? WHERE id = ?').run(usn, req.userId);
  db.prepare('UPDATE records SET deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, usn = ? WHERE id = ? AND user_id = ?').run(usn, req.params.id, req.userId);

  res.json({ usn });
});

// ========== Sync ==========

app.post('/api/sync/pull', authMiddleware, (req, res) => {
  const { lastSyncUsn } = req.body;
  const usn = lastSyncUsn || 0;

  const records = db.prepare(
    'SELECT * FROM records WHERE user_id = ? AND usn > ? AND deleted = 0 ORDER BY usn ASC'
  ).all(req.userId, usn);

  records.forEach(r => {
    r.tags = JSON.parse(r.tags || '[]');
    r.photos = JSON.parse(r.photos || '[]');
    r.links = JSON.parse(r.links || '[]');
    r.metadata = JSON.parse(r.metadata || '{}');
    r.blocks = JSON.parse(r.blocks || '[]');
  });

  const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
  res.json({ records, serverMaxUsn: user.max_usn });
});

app.post('/api/sync/push', authMiddleware, (req, res) => {
  const { changes } = req.body;
  const results = [];

  for (const change of changes) {
    const existing = db.prepare('SELECT usn FROM records WHERE id = ? AND user_id = ?').get(change.id, req.userId);
    const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
    const newUsn = user.max_usn + 1;

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

  res.json({ results, serverMaxUsn: db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId).max_usn });
});

app.post('/api/sync/full', authMiddleware, async (req, res) => {
  // 先 push
  const { changes, lastSyncUsn } = req.body;
  const pushReq = { body: { changes }, userId: req.userId };
  const pushRes = { json: (data) => { pushReq.pushResult = data; } };

  // 内联 push 逻辑
  if (changes && changes.length > 0) {
    for (const change of changes) {
      const existing = db.prepare('SELECT usn FROM records WHERE id = ? AND user_id = ?').get(change.id, req.userId);
      const user = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId);
      const newUsn = user.max_usn + 1;

      if (!existing) {
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
    }
  }

  // 再 pull
  const usn = lastSyncUsn || 0;
  const records = db.prepare(
    'SELECT * FROM records WHERE user_id = ? AND usn > ? AND deleted = 0 ORDER BY usn ASC'
  ).all(req.userId, usn);

  records.forEach(r => {
    r.tags = JSON.parse(r.tags || '[]');
    r.photos = JSON.parse(r.photos || '[]');
    r.links = JSON.parse(r.links || '[]');
    r.metadata = JSON.parse(r.metadata || '{}');
    r.blocks = JSON.parse(r.blocks || '[]');
  });

  const serverMaxUsn = db.prepare('SELECT max_usn FROM users WHERE id = ?').get(req.userId).max_usn;
  res.json({ records, serverMaxUsn });
});

app.get('/api/sync/status', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT max_usn, created_at FROM users WHERE id = ?').get(req.userId);
  const recordCount = db.prepare('SELECT COUNT(*) as count FROM records WHERE user_id = ? AND deleted = 0').get(req.userId);
  res.json({ maxUsn: user.max_usn, recordCount: recordCount.count, connectedAt: user.created_at });
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
