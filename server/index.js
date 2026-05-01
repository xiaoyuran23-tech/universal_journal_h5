/**
 * 万物手札后端 API 服务
 * Express + MongoDB + JWT 认证
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import recordRoutes from './routes/records.js';
import syncRoutes from './routes/sync.js';

const app = express();
const PORT = process.env.PORT || 4000;

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/sync', syncRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动
async function start() {
  try {
    // 连接 MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Server] MongoDB connected');

    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log(`[Server] API: http://localhost:${PORT}/api`);
      console.log(`[Server] Health: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
