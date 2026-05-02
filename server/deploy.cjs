/**
 * Deploy script - uploads server code to remote VPS via SSH/SFTP
 */
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

// Hardcode Git Bash Unix-style paths (tar on Windows can't handle D:/ paths)
// Tarball pre-created in project root
const TARBALL = path.join(__dirname, '..', 'deploy-server.tar.gz');

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
      sftp.fastPut(local, remote, {}, (err) => {
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

    // Tarball already created manually
    console.log('[DEPLOY] Tarball size:', fs.statSync(TARBALL).size, 'bytes');

    // Upload tarball
    console.log('[SFTP] Uploading...');
    await upload(TARBALL, '/tmp/server-deploy.tar.gz');
    console.log('[SFTP] Uploaded');

    // Extract and install
    console.log('[DEPLOY] Extracting + npm install...');
    const result = await run(`
      mkdir -p /root/app
      cd /root/app
      rm -rf server
      tar xzf /tmp/server-deploy.tar.gz
      cd server
      npm install --production
    `);
    console.log('[DEPLOY] Done, exit code:', result.code);

    // Configure .env (preserve JWT_SECRET)
    console.log('[DEPLOY] Setting up .env...');
    await run(`
      cd /root/app/server
      EXISTING_SECRET=""
      if [ -f .env ]; then
        EXISTING_SECRET=$(grep '^JWT_SECRET=' .env | cut -d= -f2)
      fi
      cat > .env << ENV
PORT=4000
JWT_SECRET=\${EXISTING_SECRET:-$(openssl rand -hex 32)}
NODE_ENV=production
ENV
    `);

    // Start server
    console.log('[DEPLOY] Starting server...');
    await run(`
      cd /root/app/server
      pkill -f 'node index.js' || true
      sleep 1
      nohup node index.js > /var/log/journal-server.log 2>&1 &
      sleep 2
      cat /var/log/journal-server.log
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
