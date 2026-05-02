const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

    // Step 1: Build frontend
    console.log('\n[1/5] Building frontend...');
    const projectRoot = path.join(__dirname, '..');
    execSync('npx vite build', { cwd: projectRoot, stdio: 'inherit' });

    // Step 2: Create deploy tarball (dist + server)
    console.log('\n[2/5] Creating deploy bundle...');
    const tarball = path.join(projectRoot, 'deploy-bundle.tar.gz');
    execSync(`tar czf "${tarball}" -C "${projectRoot}" dist server --exclude='node_modules' --exclude='data' --exclude='deploy*' --exclude='e2e*' --exclude='test*'`, { stdio: 'inherit' });
    console.log('[DEPLOY] Bundle size:', (fs.statSync(tarball).size / 1024).toFixed(1), 'KB');

    // Step 3: Upload
    console.log('\n[3/5] Uploading to server...');
    await upload(tarball, '/tmp/deploy-bundle.tar.gz');
    console.log('[SFTP] Uploaded');

    // Step 4: Deploy on remote server
    console.log('\n[4/5] Deploying on remote...');
    await run(`
      cd /root/app
      rm -rf dist
      tar xzf /tmp/deploy-bundle.tar.gz
      cd server
      npm install --omit=dev
      # Update .env to serve frontend on same port (preserve JWT_SECRET)
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

    // Step 5: Restart server with frontend
    console.log('\n[5/5] Restarting server with frontend...');
    await run(`
      cd /root/app/server
      pkill -f 'node index.js' || true
      sleep 1
      nohup node index.js > /var/log/journal-server.log 2>&1 &
      sleep 2
      echo "=== Server Log ==="
      cat /var/log/journal-server.log
      echo "=== Health Check ==="
      curl -sf http://localhost:4000/health
      echo ""
      echo "=== Frontend Check ==="
      curl -sf http://localhost:4000/ | head -5
      echo ""
      echo "=== Listening ==="
      ss -tlnp | grep 4000
    `);

    conn.end();
    console.log('\n[DEPLOY] All done!');
  } catch (e) {
    console.error('[DEPLOY] Error:', e.message);
    conn.end();
    process.exit(1);
  }
});
conn.connect({ host: HOST, port: PORT, username: USER, password: PASS, readyTimeout: 60000 });
