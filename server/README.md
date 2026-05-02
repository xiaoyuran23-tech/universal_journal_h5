# 万物手札后端 API 服务

## 本地开发

### 前置要求
- Node.js >= 18

### 快速启动
```bash
cd server
cp .env.example .env   # 编辑 .env 配置 JWT 密钥
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
| GET | `/api/auth/me` | 获取当前用户 (httpOnly cookie) |
| PUT | `/api/auth/profile` | 更新昵称 `{ nickname }` |
| PUT | `/api/auth/change-password` | 修改密码 `{ currentPassword, newPassword }` |
| DELETE | `/api/auth/account` | 删除账号 `{ password }` |
| POST | `/api/auth/logout` | 登出 (清除 httpOnly cookie) |

#### 记录
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/records` | 获取记录列表 (支持 usn/since/deleted 参数) |
| POST | `/api/records` | 创建记录 |
| PUT | `/api/records/:id` | 更新记录 |
| DELETE | `/api/records/:id` | 删除记录 (软删除) |

#### 同步
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sync/pull` | 拉取服务端变更 `{ lastSyncUsn }` |
| POST | `/api/sync/push` | 推送本地变更 `{ changes }` |
| GET | `/api/sync/status` | 同步状态 |

### 认证说明
- 所有 `/api/records/*` 和 `/api/sync/*` 端点需要认证
- 认证方式：httpOnly cookie (`journal_token`)，兼容 `Authorization: Bearer` header
- Token 有效期：30 天

## 生产部署

### 环境变量
- `JWT_SECRET` — 随机生成的强密钥（必配）
- `PORT` — 服务端口 (默认 4000)
- `FRONTEND_URL` — 前端域名 (CORS)
- `SERVE_FRONTEND` — 是否提供静态文件 (默认 true)
- `FRONTEND_DIR` — 前端文件目录

### 安全建议
1. 使用强随机字符串配置 `JWT_SECRET`，不要使用示例值
2. 生产环境启用 HTTPS，cookie 会自动添加 `Secure` 标志
3. 定期轮换 JWT 密钥
