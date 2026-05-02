const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// v7.0.3: 使用环境变量，不再硬编码凭据
const HOST = process.env.SERVER_HOST;
const PORT = parseInt(process.env.SERVER_PORT || '22');
const USER = process.env.SERVER_USER || 'root';
const PASS = process.env.SERVER_PASSWORD;

if (!HOST || !PASS) {
  console.error('[ERROR] 请设置环境变量 SERVER_HOST 和 SERVER_PASSWORD');
  process.exit(1);
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => { process.stdout.write(d.toString()); out += d.toString(); });
      stream.stderr.on('data', d => { process.stdout.write(d.toString()); out += d.toString(); });
      stream.on('close', code => resolve({ code, out }));
    });
  });
}

function upload(local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(local, remote, {}, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

const conn = new Client();
conn.on('ready', async () => {
  try {
    console.log('[SSH] Connected');
    console.log('[SFTP] Uploading bundle (166KB)...');
    await upload(path.join(__dirname, '..', 'deploy-bundle.tar.gz'), '/tmp/deploy-bundle.tar.gz');
    console.log('[SFTP] Uploaded');

    console.log('[DEPLOY] Extracting + installing...');
    await run(`
      cd /root/app
      rm -rf dist server
      tar xzf /tmp/deploy-bundle.tar.gz
      cd server
      rm -rf node_modules
      npm install --omit=dev
      # 同步前端到 Nginx 目录
      rm -rf /var/www/journal
      cp -r /root/app/dist /var/www/journal
      chown -R www-data:www-data /var/www/journal
      chmod -R 755 /var/www/journal
    `);

    console.log('[DEPLOY] Configuring .env...');
    await run(`
      cd /root/app/server
      # 保留已有的 JWT_SECRET（不覆盖，避免用户全部掉线）
      EXISTING_SECRET=""
      if [ -f .env ]; then
        EXISTING_SECRET=$(grep '^JWT_SECRET=' .env | cut -d= -f2)
      fi
      cat > .env << ENV
PORT=4000
JWT_SECRET=\${EXISTING_SECRET:-$(openssl rand -hex 32)}
NODE_ENV=production
SERVE_FRONTEND=true
FRONTEND_DIR=/root/app/dist
ENV
    `);

    console.log('[DEPLOY] Restarting server...');
    await run(`
      cd /root/app/server
      pkill -f 'node index.js' || true
      sleep 1
      nohup node index.js > /var/log/journal-server.log 2>&1 &
      sleep 3
      echo "=== Log ==="
      cat /var/log/journal-server.log
      echo ""
      echo "=== Health ==="
      curl -sf http://localhost:4000/health
      echo ""
      echo "=== Frontend ==="
      curl -sf http://localhost:4000/ | grep -o '<title>.*</title>'
      echo "=== Listening ==="
      ss -tlnp | grep 4000
    `);

    conn.end();
    console.log('[DEPLOY] All done!');
  } catch (e) {
    console.error('[DEPLOY] Error:', e.message);
    conn.end();
    process.exit(1);
  }
});
conn.connect({ host: HOST, port: PORT, username: USER, password: PASS, readyTimeout: 30000 });
