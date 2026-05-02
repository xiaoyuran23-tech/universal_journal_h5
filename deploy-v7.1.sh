#!/bin/bash
set -e

echo "========================================="
echo "万物手札 v7.1.0 部署脚本"
echo "========================================="

SERVER="root@47.236.199.100"
SERVER_APP="/root/app"
FRONTEND_DIR="/var/www/journal"

# 1. 上传服务器文件
echo "[1/4] 上传服务器文件..."
scp deploy-server-v7.1.tar.gz $SERVER:$SERVER_APP/
scp deploy-frontend-v7.1.tar.gz $SERVER:$FRONTEND_DIR/

# 2. 部署后端
echo "[2/4] 部署后端..."
ssh $SERVER << 'EOF'
cd /root/app
echo "  备份旧文件..."
cp index.js index.js.bak.$(date +%Y%m%d_%H%M%S)

echo "  解压新文件..."
tar xzf deploy-server-v7.1.tar.gz

echo "  检查 JWT_SECRET..."
if grep -q "your-super-secret-jwt-key-change-in-production" .env; then
  echo "  WARNING: .env 使用默认 JWT_SECRET，正在生成随机密钥..."
  NEW_SECRET=$(node -e "require('crypto').randomBytes(32).toString('hex')")
  sed -i "s/your-super-secret-jwt-key-change-in-production/$NEW_SECRET/" .env
  echo "  JWT_SECRET 已更新"
fi

echo "  重启服务..."
if command -v pm2 &> /dev/null; then
  pm2 restart journal 2>/dev/null || pm2 restart index.js 2>/dev/null || true
else
  echo "  pm2 未找到，使用 nohup 启动..."
  pkill -f "node server/index.js" 2>/dev/null || true
  sleep 2
  cd /root/app && nohup node server/index.js > /var/log/journal-backend.log 2>&1 &
fi
sleep 2

echo "  检查健康状态..."
curl -s http://127.0.0.1:4000/health || echo "  WARNING: 健康检查失败"
EOF

# 3. 部署前端
echo "[3/4] 部署前端..."
ssh $SERVER << 'EOF'
cd /var/www/journal
echo "  备份旧文件..."
cp -r src src.bak.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
cp index.html index.html.bak.$(date +%Y%m%d_%H%M%S)
cp style.css style.css.bak.$(date +%Y%m%d_%H%M%S)

echo "  解压新文件..."
tar xzf deploy-frontend-v7.1.tar.gz
EOF

# 4. 验证
echo "[4/4] 验证部署..."
sleep 3
curl -s https://wanwushouzha.online/health || echo "  前端域名健康检查"

echo ""
echo "========================================="
echo "部署完成！"
echo "========================================="
