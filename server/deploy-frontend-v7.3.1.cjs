/**
 * Deploy frontend v7.3.1 - upload and deploy to server
 */
const { Client } = require('ssh2');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOST = '47.236.199.100';
const PORT = 22;
const USER = 'root';
const PASS = 'Bkadmin@2023#';

const VERSION = 'v7.3.1';
const FRONTEND_TAR = `deploy-frontend-${VERSION}.tar.gz`;
const FRONTEND_DIR = '/var/www/journal';

function run(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => { out += d.toString(); process.stdout.write(d.toString()); });
      stream.stderr.on('data', d => { out += d.toString(); process.stdout.write(d.toString()); });
      stream.on('close', code => resolve({ code, out }));
    });
  });
}

function upload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(localPath, remotePath, {}, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

async function main() {
  // 0. Create tarball
  console.log(`[0/4] Creating ${FRONTEND_TAR}...`);
  const tarCmd = `tar czf ${FRONTEND_TAR} --exclude='node_modules' --exclude='.claude' --exclude='.git' --exclude='test-results' --exclude='deploy-*.tar.gz' --exclude='*.md' --exclude='server' --exclude='.vs' --exclude='.github' --exclude='playwright*' --exclude='graph_state.json' --exclude='full-test-v7.mjs' index.html style.css animations.css manifest.json sw.js src/`;
  const projectRoot = path.join(__dirname, '..');
  execSync(tarCmd, { stdio: 'inherit', cwd: projectRoot });
  const tarPath = path.join(projectRoot, FRONTEND_TAR);
  const size = (fs.statSync(tarPath).size / 1024).toFixed(1);
  console.log(`  Created ${FRONTEND_TAR} (${size} KB)`);

  const conn = new Client();

  conn.on('error', err => { console.error('[SSH Error]', err); process.exit(1); });
  conn.on('ready', async () => {
    console.log('[SSH] Connected to', HOST);
    try {
      // 1. Upload
      console.log('\n[1/4] Uploading frontend...');
      await upload(conn, tarPath, `/tmp/${FRONTEND_TAR}`);
      console.log('  Frontend uploaded');

      // 2. Deploy frontend
      console.log('\n[2/4] Deploying frontend...');
      const result = await run(conn, `
        cd ${FRONTEND_DIR}
        echo "  Backing up old files..."
        [ -f index.html ] && cp index.html index.html.bak.$(date +%Y%m%d_%H%M%S)
        [ -f style.css ] && cp style.css style.css.bak.$(date +%Y%m%d_%H%M%S)
        [ -f animations.css ] && cp animations.css animations.css.bak.$(date +%Y%m%d_%H%M%S)
        [ -d src ] && cp -r src src.bak.$(date +%Y%m%d_%H%M%S) || true

        echo "  Extracting new files..."
        tar xzf /tmp/${FRONTEND_TAR}

        echo "  Cleaning up..."
        rm -f /tmp/${FRONTEND_TAR}
      `);
      console.log('  Frontend deployed, exit code:', result.code);

      // 3. Verify on server
      console.log('\n[3/4] Verifying on server...');
      await run(conn, `
        echo "  Checking files..."
        [ -f ${FRONTEND_DIR}/index.html ] && echo "  index.html: OK" || echo "  index.html: MISSING"
        [ -f ${FRONTEND_DIR}/style.css ] && echo "  style.css: OK" || echo "  style.css: MISSING"
        [ -f ${FRONTEND_DIR}/animations.css ] && echo "  animations.css: OK" || echo "  animations.css: MISSING"
        grep -o 'v7.3.1' ${FRONTEND_DIR}/index.html | head -1 && echo "  Version: v7.3.1 confirmed" || echo "  Version: not found"
      `);

      // 4. HTTP check
      console.log('\n[4/4] HTTP check...');
      try {
        await run(conn, 'sleep 1 && curl -s --max-time 5 https://wanwushouzha.online/ | head -c 200 || echo "  HTTP check timed out"');
      } catch (e) {
        console.log('  HTTP check skipped');
      }

      conn.end();
      console.log('\n=========================================');
      console.log('Frontend Deployment Completed!');
      console.log(`Version: ${VERSION}`);
      console.log('=========================================');
    } catch (e) {
      console.error('[ERROR]', e.message);
      conn.end();
      process.exit(1);
    }
  });

  console.log('[SSH] Connecting to', HOST + '...');
  conn.connect({ host: HOST, port: PORT, username: USER, password: PASS, readyTimeout: 30000 });
}

main();
