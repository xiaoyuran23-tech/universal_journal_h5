/**
 * Remote deploy - upload deploy packages and execute deployment on server
 */
const { Client } = require('ssh2');

const HOST = '47.236.199.100';
const PORT = 22;
const USER = 'root';
const PASS = 'Bkadmin@2023#';

const FRONTEND_TAR = 'deploy-frontend-v7.1.tar.gz';
const SERVER_TAR = 'deploy-server-v7.1.tar.gz';
const SERVER_APP = '/root/app';
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
  const conn = new Client();

  conn.on('error', err => { console.error('[SSH Error]', err); process.exit(1); });
  conn.on('ready', async () => {
    console.log('[SSH] Connected to', HOST);
    try {
      // 1. Upload tarballs
      console.log('\n[1/4] Uploading files...');
      await upload(conn, FRONTEND_TAR, `/tmp/${FRONTEND_TAR}`);
      console.log('  Frontend uploaded');
      await upload(conn, SERVER_TAR, `/tmp/${SERVER_TAR}`);
      console.log('  Server uploaded');

      // 2. Deploy backend
      console.log('\n[2/4] Deploying backend...');
      const backendResult = await run(conn, `
        cd ${SERVER_APP}
        echo "  Backing up old files..."
        [ -f index.js ] && cp index.js index.js.bak.$(date +%Y%m%d_%H%M%S)

        echo "  Extracting new files..."
        mkdir -p ${SERVER_APP}
        cd ${SERVER_APP}
        tar xzf /tmp/${SERVER_TAR}

        echo "  Checking JWT_SECRET..."
        if [ -f .env ] && grep -q "your-super-secret-jwt-key-change-in-production" .env; then
          echo "  WARNING: .env using default JWT_SECRET, generating random key..."
          NEW_SECRET=$(node -e "require('crypto').randomBytes(32).toString('hex')")
          sed -i "s/your-super-secret-jwt-key-change-in-production/$NEW_SECRET/" .env
          echo "  JWT_SECRET updated"
        fi

        echo "  Restarting service..."
        # Check if pm2 is available, otherwise use nohup
        if command -v pm2 &> /dev/null; then
          pm2 restart journal 2>/dev/null || pm2 restart index.js 2>/dev/null || true
        else
          echo "  pm2 not found, using nohup..."
          pkill -f "node server/index.js" 2>/dev/null || true
          sleep 2
          cd /root/app && nohup node server/index.js > /var/log/journal-backend.log 2>&1 &
        fi
        sleep 2

        echo "  Checking health..."
        curl -s http://127.0.0.1:4000/health || echo "  WARNING: Health check failed"
      `);
      console.log('  Backend deployed, exit code:', backendResult.code);

      // 3. Deploy frontend
      console.log('\n[3/4] Deploying frontend...');
      const frontendResult = await run(conn, `
        cd ${FRONTEND_DIR}
        echo "  Backing up old files..."
        [ -f index.html ] && cp index.html index.html.bak.$(date +%Y%m%d_%H%M%S)
        [ -f style.css ] && cp style.css style.css.bak.$(date +%Y%m%d_%H%M%S)
        [ -d src ] && cp -r src src.bak.$(date +%Y%m%d_%H%M%S)

        echo "  Extracting new files..."
        tar xzf /tmp/${FRONTEND_TAR}

        echo "  Cleaning up..."
        rm -f /tmp/${FRONTEND_TAR} /tmp/${SERVER_TAR}
      `);
      console.log('  Frontend deployed, exit code:', frontendResult.code);

      // 4. Verify
      console.log('\n[4/4] Verifying deployment...');
      await run(conn, `sleep 2 && curl -s https://wanwushouzha.online/health || echo "  Frontend health check"`);

      conn.end();
      console.log('\n=========================================');
      console.log('Deployment completed!');
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
