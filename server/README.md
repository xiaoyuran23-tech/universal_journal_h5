# 万物手札后端 API 服务

## 本地开发

### 前置要求
- Node.js >= 18
- MongoDB (本地或 Atlas)

### 快速启动
```bash
cd server
cp .env.example .env   # 编辑 .env 配置 MongoDB 连接
npm install
npm run dev
```

服务启动在 `http://localhost:4000`

### API 文档

#### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 `{ email, password, nickname }` |
| POST | `/api/auth/login` | 登录 `{ email, password }` |
| GET | `/api/auth/me` | 获取当前用户 (Bearer Token) |
| PUT | `/api/auth/profile` | 更新用户信息 |
| POST | `/api/auth/register-device` | 注册设备 |

#### 记录
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/records` | 获取记录列表 (分页/筛选) |
| GET | `/api/records/:id` | 获取单条记录 |
| POST | `/api/records` | 创建记录 |
| PUT | `/api/records/:id` | 更新记录 |
| DELETE | `/api/records/:id` | 删除记录 |
| GET | `/api/records/on-this-day` | 那年今日 |
| GET | `/api/records/stats` | 统计信息 |

#### 同步
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sync/pull` | 拉取服务端变更 |
| POST | `/api/sync/push` | 推送本地变更 |
| POST | `/api/sync/full` | 完整双向同步 |
| GET | `/api/sync/status` | 同步状态 |

## 生产部署 (Vercel)

### 1. 创建 Vercel 项目
```bash
cd server
vercel --prod
```

### 2. 配置环境变量
在 Vercel Dashboard 设置：
- `MONGODB_URI` - MongoDB Atlas 连接字符串
- `JWT_SECRET` - 随机生成的强密钥
- `FRONTEND_URL` - 前端域名 (GitHub Pages URL)

### 3. MongoDB Atlas
1. 创建免费集群
2. 创建数据库用户
3. 允许所有 IP 访问 (0.0.0.0/0)
4. 获取连接字符串填入 `MONGODB_URI`
