/**
 * GitSyncService - 基于 isomorphic-git 的完整 Git 同步
 * 替代 Gist 同步，提供版本控制能力
 * @version 6.2.0
 *
 * 注意: isomorphic-git 通过 CDN 动态加载，不增加首屏体积
 */

class GitSyncService {
  static CONFIG_KEY = 'journal_git_config';
  static _git = null;
  static _fs = null;
  static _status = 'idle'; // idle | cloning | pulling | pushing | merging | success | error
  static _listeners = [];

  /**
   * 加载 isomorphic-git (动态 import)
   * @returns {Promise<Object>}
   */
  static async _loadGit() {
    if (this._git) return this._git;

    // 从 CDN 加载 isomorphic-git
    if (!window.git) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/isomorphic-git@1.24.5/browser/index.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('isomorphic-git 加载失败'));
        document.head.appendChild(script);
      });
    }

    this._git = window.git;
    this._fs = window.fs; // 如果使用 browserfs

    return this._git;
  }

  /**
   * 获取配置
   */
  static getConfig() {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * 保存配置
   */
  static saveConfig(config) {
    const existing = this.getConfig() || {};
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify({ ...existing, ...config }));
  }

  /**
   * 检查是否已配置
   */
  static isConfigured() {
    const config = this.getConfig();
    return !!(config && config.repoUrl);
  }

  /**
   * 初始化仓库 (clone 或 init)
   * @param {Object} options
   * @param {string} options.repoUrl - Git 远程仓库 URL
   * @param {string} options.username - Git 用户名
   * @param {string} options.token - Personal Access Token
   * @param {string} options.branch - 分支名 (默认 main)
   */
  static async initRepo(options) {
    const { repoUrl, username, token, branch = 'main' } = options;

    this.saveConfig({ repoUrl, username, token, branch });

    try {
      this._setStatus('cloning');

      const git = await this._loadGit();
      const dir = '/journal-repo';

      // 创建虚拟文件系统 (使用 IndexedDB 作为后端)
      const fs = this._createFs();

      // 尝试 clone，如果已存在则 fetch
      try {
        await git.clone({
          fs,
          dir,
          url: repoUrl,
          username,
          password: token,
          ref: branch,
          singleBranch: true
        });
        console.log('[GitSyncService] Repository cloned');
      } catch (e) {
        // 已存在，执行 fetch
        await git.fetch({
          fs,
          dir,
          url: repoUrl,
          username,
          password: token,
          ref: branch
        });
        console.log('[GitSyncService] Fetched updates');
      }

      this._setStatus('success');
      return { success: true };
    } catch (error) {
      this._setStatus('error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 推送本地数据到远程
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async push() {
    if (!this.isConfigured()) {
      return { success: false, error: '请先配置 Git 仓库' };
    }

    try {
      this._setStatus('pushing');

      const git = await this._loadGit();
      const fs = this._createFs();
      const dir = '/journal-repo';
      const config = this.getConfig();

      // 导出当前数据为 JSON
      const records = await this._getAllRecords();
      const payload = {
        version: '6.2.0',
        timestamp: Date.now(),
        count: records.length,
        data: records
      };

      // 写入文件
      await fs.promises.writeFile(
        `${dir}/journal_backup.json`,
        JSON.stringify(payload, null, 2)
      );

      // git add
      await git.add({ fs, dir, filepath: 'journal_backup.json' });

      // git commit
      await git.commit({
        fs,
        dir,
        message: `Auto backup: ${records.length} records at ${new Date().toISOString()}`,
        author: {
          name: config.username || 'Journal User',
          email: 'user@journal.local',
          timestamp: Date.now()
        }
      });

      // git push
      await git.push({
        fs,
        dir,
        url: config.repoUrl,
        username: config.username,
        password: config.token,
        ref: config.branch || 'main'
      });

      this._setStatus('success');
      return { success: true };
    } catch (error) {
      this._setStatus('error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 从远程拉取并合并数据
   * @param {Object} options
   * @param {string} [options.mergeStrategy] - 'lww' | 'remote_wins' | 'local_wins'
   */
  static async pull(options = {}) {
    const { mergeStrategy = 'lww' } = options;

    if (!this.isConfigured()) {
      return { success: false, error: '请先配置 Git 仓库' };
    }

    try {
      this._setStatus('pulling');

      const git = await this._loadGit();
      const fs = this._createFs();
      const dir = '/journal-repo';
      const config = this.getConfig();

      // git pull
      await git.pull({
        fs,
        dir,
        url: config.repoUrl,
        username: config.username,
        password: config.token,
        ref: config.branch || 'main',
        author: {
          name: config.username || 'Journal User',
          email: 'user@journal.local'
        }
      });

      // 读取并解析备份文件
      const content = await fs.promises.readFile(`${dir}/journal_backup.json`, 'utf8');
      const payload = JSON.parse(content);

      // 合并数据
      this._setStatus('merging');
      const result = await this._mergeRecords(payload.data || [], mergeStrategy);

      this._setStatus('success');
      return { success: true, merged: result.merged };
    } catch (error) {
      this._setStatus('error');
      return { success: false, error: error.message };
    }
  }

  /**
   * 查看提交历史
   * @param {number} limit - 返回条数
   * @returns {Promise<Array>}
   */
  static async log(limit = 20) {
    try {
      const git = await this._loadGit();
      const fs = this._createFs();
      const dir = '/journal-repo';

      const commits = await git.log({ fs, dir, depth: limit });
      return commits.map(c => ({
        oid: c.oid,
        message: c.commit.message,
        author: c.commit.author.name,
        timestamp: c.commit.author.timestamp * 1000
      }));
    } catch (error) {
      console.error('[GitSyncService] Log failed:', error);
      return [];
    }
  }

  /**
   * 状态订阅
   */
  static subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  /**
   * 设置状态
   * @private
   */
  static _setStatus(status) {
    this._status = status;
    this._listeners.forEach(cb => cb(status));
  }

  /**
   * 创建虚拟文件系统 (基于 IndexedDB)
   * @private
   */
  static _createFs() {
    // 简易实现：使用 idb-keyval 或直接操作 IndexedDB
    // isomorphic-git 需要 node-style fs interface
    // 这里使用 isomorphic-git 自带的 browserfs 适配器

    if (!window.BrowserFS) {
      // 如果没有 BrowserFS，使用简易内存文件系统
      return this._createMemFs();
    }

    // 使用 BrowserFS IndexedDB 后端
    return window.BrowserFS.BFSRequire('fs');
  }

  /**
   * 简易内存文件系统 (isomorphic-git 兼容接口)
   * @private
   */
  static _createMemFs() {
    const store = {};

    return {
      promises: {
        readFile: async (path, encoding) => {
          const content = store[path];
          if (!content) throw new Error(`File not found: ${path}`);
          return encoding === 'utf8' ? content : new TextEncoder().encode(content);
        },
        writeFile: async (path, content) => {
          store[path] = content;
        },
        mkdir: async (path, options) => {
          store[path] = store[path] || {};
        },
        readdir: async (path) => {
          const prefix = path.endsWith('/') ? path : path + '/';
          return Object.keys(store)
            .filter(k => k.startsWith(prefix))
            .map(k => k.slice(prefix.length).split('/')[0]);
        },
        stat: async (path) => {
          const content = store[path];
          if (!content && content !== '') throw new Error(`File not found: ${path}`);
          return {
            isFile: () => typeof content === 'string',
            isDirectory: () => typeof content === 'object',
            size: typeof content === 'string' ? content.length : 0
          };
        },
        unlink: async (path) => {
          delete store[path];
        },
        rmdir: async (path) => {
          delete store[path];
        }
      },
      readFile: (path, encoding, callback) => {
        this._createFs().promises.readFile(path, encoding)
          .then(data => callback(null, data))
          .catch(err => callback(err));
      },
      writeFile: (path, content, options, callback) => {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }
        this._createFs().promises.writeFile(path, content)
          .then(() => callback(null))
          .catch(err => callback(err));
      },
      mkdir: (path, mode, callback) => {
        if (typeof mode === 'function') callback = mode;
        this._createFs().promises.mkdir(path)
          .then(() => callback(null))
          .catch(err => callback(err));
      },
      readdir: (path, options, callback) => {
        if (typeof options === 'function') callback = options;
        this._createFs().promises.readdir(path)
          .then(files => callback(null, files))
          .catch(err => callback(err));
      },
      stat: (path, callback) => {
        this._createFs().promises.stat(path)
          .then(stat => callback(null, stat))
          .catch(err => callback(err));
      },
      unlink: (path, callback) => {
        this._createFs().promises.unlink(path)
          .then(() => callback(null))
          .catch(err => callback(err));
      },
      rmdir: (path, callback) => {
        this._createFs().promises.rmdir(path)
          .then(() => callback(null))
          .catch(err => callback(err));
      }
    };
  }

  /**
   * 获取所有记录
   * @private
   */
  static async _getAllRecords() {
    if (window.StorageService && StorageService.getAll) {
      return await StorageService.getAll();
    }
    if (window.Store) {
      return window.Store.getState('records.list') || [];
    }
    return [];
  }

  /**
   * 合并记录
   * @private
   */
  static async _mergeRecords(remoteRecords, strategy) {
    const localRecords = await this._getAllRecords();
    const localMap = new Map(localRecords.map(r => [r.id, r]));
    let mergedCount = 0;

    for (const remote of remoteRecords) {
      const local = localMap.get(remote.id);

      if (!local) {
        await this._saveRecord(remote);
        mergedCount++;
      } else {
        const remoteTime = new Date(remote.updatedAt || 0).getTime();
        const localTime = new Date(local.updatedAt || 0).getTime();

        let winner;
        switch (strategy) {
          case 'remote_wins': winner = remote; break;
          case 'local_wins': winner = local; break;
          case 'lww':
          default: winner = remoteTime > localTime ? remote : local; break;
        }

        if (winner !== local) {
          await this._saveRecord(winner);
          mergedCount++;
        }
      }
    }

    return { merged: mergedCount };
  }

  /**
   * 保存单条记录
   * @private
   */
  static async _saveRecord(record) {
    if (window.StorageService && StorageService.put) {
      await StorageService.put(record);
    } else if (window.Store) {
      window.Store.dispatch({ type: 'records/update', id: record.id, payload: record });
    }
  }
}

window.GitSyncService = GitSyncService;
console.log('[GitSyncService] Git 同步服务已定义');
