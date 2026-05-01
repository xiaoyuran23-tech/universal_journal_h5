import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import fs from 'fs';

// 递归复制目录
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: {
          vendor: ['idb']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/api': {
        target: 'http://47.236.199.100:4000',
        changeOrigin: true
      }
    },
    fs: {
      strict: false,
      allow: ['.']
    }
  },
  plugins: [
    // 构建后将 src/ 复制到 dist/src/
    {
      name: 'copy-src-to-dist',
      closeBundle() {
        const srcDir = resolve('.', 'src');
        const destDir = resolve('.', 'dist', 'src');
        console.log('[copy-src] Copying src to dist...');
        copyDir(srcDir, destDir);
      }
    },
    // dev server 中间件
    {
      name: 'serve-src-static',
      configureServer(server) {
        server.middlewares.use('/src/', (req, res, next) => {
          const cleanUrl = req.url.replace(/\?.*$/, '');
          const filePath = resolve('.', cleanUrl);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = filePath.split('.').pop();
            const mimeTypes = {
              'js': 'application/javascript',
              'css': 'text/css',
              'html': 'text/html',
              'json': 'application/json',
              'svg': 'image/svg+xml',
              'png': 'image/png',
              'jpg': 'image/jpeg',
              'ico': 'image/x-icon'
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
            res.end(fs.readFileSync(filePath));
            return;
          }
          next();
        });
      }
    }
  ]
});
