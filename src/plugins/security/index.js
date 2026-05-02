/**
 * Security Plugin - 密码锁与加密
 * 使用 Web Crypto API (AES-GCM + PBKDF2) 替代旧版 XOR 弱加密
 * @version 7.1.0
 */

if (!window.SecurityPlugin) {
const SecurityPlugin = {
  name: 'security',
  version: '1.0.0',
  dependencies: [],

  _eventsBound: false,
  _isLocked: false,
  _maxAttempts: 5,
  _attemptCount: 0,
  _lockoutMs: 30 * 60 * 1000, // 连续失败 5 次锁定 30 分钟

  async init() {
    console.log('[SecurityPlugin] Initializing...');
    this._isLocked = localStorage.getItem('_uj_locked') === 'true';

    this.routes = [
      { path: 'security', title: '密码锁', component: 'security-view' }
    ];
  },

  async start() {
    console.log('[SecurityPlugin] Starting...');
    if (this._isLocked) {
      this._showLockScreen();
    }
    this._bindEvents();
  },

  stop() {
    this._eventsBound = false;
  },

  /**
   * 检查是否已设置密码
   */
  hasPassword() {
    // 兼容旧格式（无盐哈希）和新格式（PBKDF2 + 盐）
    return !!(localStorage.getItem('_uj_password_salt') || localStorage.getItem('_uj_password_hash'));
  },

  /**
   * 使用 PBKDF2 派生密码哈希（带盐）
   * @param {string} password
   * @returns {Promise<{salt: string, hash: string}>}
   */
  async _derivePassword(password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const hashBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return {
      salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
      hash: Array.from(new Uint8Array(hashBits)).map(b => b.toString(16).padStart(2, '0')).join('')
    };
  },

  /**
   * 使用存储的盐重新派生哈希进行比较
   * @param {string} password
   * @param {string} saltHex
   * @returns {Promise<string>} hash hex
   */
  async _rederiveHash(password, saltHex) {
    try {
      const encoder = new TextEncoder();
      const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
      if (salt.some(b => isNaN(b))) throw new Error('Invalid salt hex');
      const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
      );
      const hashBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
      );
      return Array.from(new Uint8Array(hashBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('[SecurityPlugin] _rederiveHash error:', e);
      return '';
    }
  },

  /**
   * 设置密码 (使用 PBKDF2 + 盐存储)
   * @param {string} password
   */
  async setPassword(password) {
    const validation = CryptoService.validatePassword(password);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const { salt, hash } = await this._derivePassword(password);
    localStorage.setItem('_uj_password_salt', salt);
    localStorage.setItem('_uj_password_hash', hash);
    localStorage.removeItem('_uj_failed_attempts');
    localStorage.removeItem('_uj_lockout_until');
  },

  /**
   * 验证密码 (带防爆破限制，使用 PBKDF2 + 盐)
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password) {
    // 检查是否在锁定期间
    const lockoutUntil = localStorage.getItem('_uj_lockout_until');
    if (lockoutUntil && Date.now() < parseInt(lockoutUntil)) {
      const remaining = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 60000);
      this._showToast(`账户已锁定，请 ${remaining} 分钟后重试`);
      return false;
    }

    let derivedHash;
    const storedSalt = localStorage.getItem('_uj_password_salt');
    const storedHash = localStorage.getItem('_uj_password_hash');
    if (!storedHash) return false;

    // 新格式：PBKDF2 + 盐
    if (storedSalt) {
      derivedHash = await this._rederiveHash(password, storedSalt);
    } else {
      // 旧格式：无盐 SHA-256（兼容迁移）
      derivedHash = await CryptoService.hash(password);
    }

    if (derivedHash === storedHash) {
      // 验证成功，重置失败计数
      localStorage.removeItem('_uj_failed_attempts');
      localStorage.removeItem('_uj_lockout_until');
      this._attemptCount = 0;
      return true;
    } else {
      // 验证失败，增加计数
      this._attemptCount = (parseInt(localStorage.getItem('_uj_failed_attempts') || '0')) + 1;
      localStorage.setItem('_uj_failed_attempts', this._attemptCount.toString());

      if (this._attemptCount >= this._maxAttempts) {
        localStorage.setItem('_uj_lockout_until', (Date.now() + this._lockoutMs).toString());
        this._showToast('密码错误次数过多，账户已锁定 30 分钟');
      }

      return false;
    }
  },

  /**
   * 锁定
   */
  lock() {
    this._isLocked = true;
    localStorage.setItem('_uj_locked', 'true');
    this._showLockScreen();
  },

  /**
   * 解锁
   */
  unlock() {
    this._isLocked = false;
    localStorage.setItem('_uj_locked', 'false');
    const overlay = document.getElementById('lock-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  isLocked() {
    return this._isLocked;
  },

  /**
   * 移除密码
   */
  removePassword() {
    localStorage.removeItem('_uj_password_hash');
    localStorage.removeItem('_uj_password_salt');
    this._isLocked = false;
    localStorage.removeItem('_uj_locked');
    localStorage.removeItem('_uj_failed_attempts');
    localStorage.removeItem('_uj_lockout_until');
    localStorage.removeItem('_uj_data_encrypted');
  },

  /**
   * 使用密码加密数据 (AES-GCM)
   * @param {Array} items - 要加密的数据
   * @param {string} password
   * @returns {Promise<void>}
   */
  async encryptData(items, password) {
    const validation = CryptoService.validatePassword(password);
    if (!validation.valid) throw new Error(validation.error);

    const json = JSON.stringify(items);
    const encrypted = await CryptoService.encrypt(json, password);
    localStorage.setItem('_uj_data_encrypted', encrypted);
  },

  /**
   * 使用密码解密数据 (AES-GCM)
   * @param {string} password
   * @returns {Promise<Array|null>}
   */
  async decryptData(password) {
    const encrypted = localStorage.getItem('_uj_data_encrypted');
    if (!encrypted) return null;

    try {
      const decrypted = await CryptoService.decrypt(encrypted, password);
      return JSON.parse(decrypted);
    } catch (e) {
      console.warn('[SecurityPlugin] Decrypt failed:', e);
      return null;
    }
  },

  /**
   * 显示锁屏界面
   * @private
   */
  _showLockScreen() {
    let overlay = document.getElementById('lock-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lock-overlay';
      overlay.className = 'lock-overlay';
      overlay.innerHTML = `
        <div class="lock-container">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <h2>已锁定</h2>
          <p class="lock-hint" id="lock-hint"></p>
          <input type="password" id="lock-password" placeholder="请输入密码" autocomplete="off" />
          <button class="lock-btn" id="lock-unlock-btn">解锁</button>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';

    // 显示剩余尝试次数
    const attempts = parseInt(localStorage.getItem('_uj_failed_attempts') || '0');
    const remaining = this._maxAttempts - attempts;
    const hint = document.getElementById('lock-hint');
    if (hint && remaining < this._maxAttempts) {
      hint.textContent = `剩余 ${remaining} 次尝试`;
      hint.className = 'lock-hint error';
    }

    setTimeout(() => {
      const input = document.getElementById('lock-password');
      if (input) input.focus();
    }, 100);
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // 锁屏解锁按钮
    const unlockBtn = document.getElementById('lock-unlock-btn');
    const lockInput = document.getElementById('lock-password');

    if (unlockBtn) {
      unlockBtn.addEventListener('click', async () => {
        const password = lockInput?.value;
        if (!password) return;
        const valid = await this.verifyPassword(password);
        if (valid) {
          this.unlock();
          this._showToast('已解锁');
        } else {
          // 更新提示
          this._showLockScreen();
        }
      });
    }

    if (lockInput) {
      lockInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') unlockBtn?.click();
      });
    }

    // 设置页密码锁入口
    const lockSettingsBtn = document.getElementById('settings-lock');
    if (lockSettingsBtn) {
      lockSettingsBtn.addEventListener('click', () => {
        this._showPasswordSettingsModal();
      });
    }
  },

  /**
   * 显示密码设置弹窗
   * @private
   */
  _showPasswordSettingsModal() {
    const hasPwd = this.hasPassword();
    if (hasPwd) {
      this._showToast('密码已设置，如需修改请先移除后重新设置');
    } else {
      const password = prompt('请设置密码（至少 6 位）：');
      if (password && password.length >= 6) {
        this.setPassword(password).then(() => {
          this._showToast('密码已设置');
        }).catch(e => {
          this._showToast(e.message);
        });
      } else if (password) {
        this._showToast('密码至少 6 位');
      }
    }
  },

  _showToast(message) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 2000 });
    } else if (window.App) {
      App.showToast(message);
    } else {
      console.log('[Toast]', message);
    }
  }
};

window.SecurityPlugin = SecurityPlugin;
console.log('[SecurityPlugin] 安全插件已定义');
}
