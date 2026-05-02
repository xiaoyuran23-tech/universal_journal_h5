/**
 * Auth Plugin - 用户认证系统
 * 提供登录/注册/登出 UI，与后端 API 交互
 * @version 7.1.0
 */

if (!window.AuthPlugin) {
const AuthPlugin = {
  name: 'auth',
  version: '1.0.0',
  dependencies: [],

  _eventsBound: false,
  _apiBase: '',
  _user: null,

  /**
   * 配置 API 地址
   */
  configure(apiBase = '') {
    this._apiBase = apiBase || window.JOURNAL_API_URL || 'http://localhost:4000/api';
    console.log(`[AuthPlugin] API configured: ${this._apiBase}`);
  },

  async init() {
    this.configure();
    this.routes = [];
  },

  async start() {
    // 自动登录 — 浏览器自动发送 httpOnly cookie
    const lastUser = localStorage.getItem('journal_user');
    if (lastUser) {
      try {
        const user = await this._fetch('/auth/me');
        this._user = user.user;
        this._updateUI(true);
        console.log('[AuthPlugin] Auto-login successful');
      } catch (e) {
        console.log('[AuthPlugin] Auto-login failed, cookie expired');
        localStorage.removeItem('journal_user');
        this._updateUI(false);
      }
    } else {
      this._updateUI(false);
    }

    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
  },

  stop() { this._eventsBound = false; },
  routes: [],
  actions: {},

  // ==================== 公开 API ====================

  get currentUser() { return this._user; },
  get isLoggedIn() { return !!this._user; },

  /**
   * 注册
   */
  async register(email, password, nickname) {
    const res = await this._fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname })
    });
    this._saveSession(res);
    this._updateUI(true);
    document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: res.user, isNewUser: true } }));
    return res;
  },

  /**
   * 登录
   */
  async login(email, password) {
    const res = await this._fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this._saveSession(res);
    this._updateUI(true);
    document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: res.user, isNewUser: false } }));
    return res;
  },

  /**
   * 登出
   */
  async logout() {
    try {
      await this._fetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      // 忽略网络错误，继续本地清理
    }
    this._user = null;
    localStorage.removeItem('journal_user');
    localStorage.removeItem('journal_last_sync_usn');
    localStorage.removeItem('journal_pending_changes');
    if (window.AutoSyncPlugin) {
      window.AutoSyncPlugin._stopAutoSync();
      window.AutoSyncPlugin._lastSyncUsn = 0;
      window.AutoSyncPlugin._pendingChanges = [];
      window.AutoSyncPlugin._consecutiveFailures = 0;
    }
    if (window.StorageBackend) {
      window.StorageBackend.clear().catch(() => {});
    } else if (window.StorageService) {
      window.StorageService.clear().catch(() => {});
    }
    if (window.Store) {
      window.Store.dispatch({
        type: 'SET_STATE',
        payload: { records: { list: [], filtered: [], loading: false } }
      });
    }
    this._updateUI(false);
    document.dispatchEvent(new CustomEvent('auth:logout'));
    this._showToast('已退出登录');
  },

  /**
   * 更新用户信息
   */
  async updateProfile(data) {
    const res = await this._fetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    this._user = res.user;
    localStorage.setItem('journal_user', JSON.stringify(this._user));
    this._updateUI(true);
    return res;
  },

  /**
   * 修改密码 (v7.1.0)
   */
  async changePassword(currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new Error('当前密码和新密码必填');
    }
    if (newPassword.length < 6) {
      throw new Error('新密码至少 6 位');
    }
    const res = await this._fetch('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return res;
  },

  /**
   * 删除账号 (v7.1.0)
   */
  async deleteAccount(password) {
    if (!password) {
      throw new Error('密码必填');
    }
    const res = await this._fetch('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });
    // 删除成功后执行完整的本地清理（与 logout 一致）
    try {
      await this.logout();
    } catch (e) {
      console.error('[AuthPlugin] Local cleanup after account deletion failed:', e);
    }
    return res;
  },

  /**
   * 带认证的请求（使用 httpOnly cookie，自动附加）
   */
  async fetchAuthenticated(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      return await this._fetch(path, { ...options, headers });
    } catch (e) {
      if (e._httpStatus === 401) {
        this.logout();
        this.showLoginModal();
      }
      throw e;
    }
  },

  /**
   * 显示登录弹窗（公开方法）
   */
  showLoginModal() {
    this._showLoginModal();
  },

  // ==================== 内部方法 ====================

  _saveSession(res) {
    if (!res || !res.user) {
      throw new Error('服务器响应异常，请稍后重试');
    }
    this._user = res.user;
    localStorage.setItem('journal_user', JSON.stringify(this._user));
  },

  async _fetch(path, options = {}) {
    const url = `${this._apiBase}${path}`;
    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      });
    } catch (e) {
      const err = new Error('网络连接失败，请检查网络');
      err._httpStatus = 0;
      throw err;
    }
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || '请求失败');
      err._httpStatus = res.status;
      throw err;
    }
    return data;
  },

  _updateUI(isLoggedIn) {
    const syncConfig = document.getElementById('settings-cloud-config');
    if (syncConfig) {
      const span = syncConfig.querySelector('span');
      if (span) span.textContent = isLoggedIn ? '云同步设置' : '登录以同步';
    }
  },

  _bindEvents() {
    // ProfilePlugin 已绑定 profile-login-btn 和 settings-cloud-config
  },

  // ==================== UI 渲染 ====================

  _showLoginModal() {
    const existing = document.getElementById('auth-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal active';
    modal.innerHTML = this._authModalHTML();
    document.body.appendChild(modal);

    modal.querySelector('[data-auth-close]')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('[data-auth-tab-login]')?.addEventListener('click', () => this._switchAuthTab('login'));
    modal.querySelector('[data-auth-tab-register]')?.addEventListener('click', () => this._switchAuthTab('register'));
    modal.querySelector('[data-auth-submit]')?.addEventListener('click', () => this._handleAuthSubmit());
    modal.querySelector('[data-auth-toggle]')?.addEventListener('click', () => this._toggleAuthForm());
  },

  _switchAuthTab(tab) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.querySelector('.auth-login-tab').classList.toggle('active', tab === 'login');
    modal.querySelector('.auth-register-tab').classList.toggle('active', tab === 'register');
    modal.querySelector('.auth-login-form').style.display = tab === 'login' ? 'block' : 'none';
    modal.querySelector('.auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
    const submitBtn = modal.querySelector('[data-auth-submit]');
    if (submitBtn) submitBtn.textContent = tab === 'login' ? '登录' : '注册';
  },

  _toggleAuthForm() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    const isLogin = modal.querySelector('.auth-login-form').style.display !== 'none';
    this._switchAuthTab(isLogin ? 'register' : 'login');
  },

  async _handleAuthSubmit() {
    const modal = document.getElementById('auth-modal');
    const isLogin = modal.querySelector('.auth-login-form').style.display !== 'none';
    const statusEl = modal.querySelector('.auth-status');

    try {
      if (isLogin) {
        const email = modal.querySelector('.auth-login-email').value.trim();
        const password = modal.querySelector('.auth-login-password').value;
        if (!email || !password) { this._showAuthError('请填写邮箱和密码'); return; }

        statusEl.textContent = '登录中...';
        await this.login(email, password);
        const name = (this._user?.nickname || '手札用户').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
        this._showToast('欢迎回来，' + name);
      } else {
        const email = modal.querySelector('.auth-register-email').value.trim();
        const password = modal.querySelector('.auth-register-password').value;
        const nickname = modal.querySelector('.auth-register-nickname').value.trim();
        if (!email || !password) { this._showAuthError('请填写邮箱和密码'); return; }
        if (password.length < 6) { this._showAuthError('密码至少 6 位'); return; }

        statusEl.textContent = '注册中...';
        await this.register(email, password, nickname || '手札用户');
        this._showToast('注册成功，欢迎使用万物手札');
      }

      modal.remove();
    } catch (e) {
      this._showAuthError(e.message);
    } finally {
      statusEl.textContent = '';
    }
  },

  _showAuthError(msg) {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      const el = modal.querySelector('.auth-status');
      if (el) { el.textContent = msg; el.style.color = '#ff4d4f'; }
    }
  },

  _authModalHTML() {
    return `
      <div class="modal-content auth-modal" style="max-width:400px;padding:0;overflow:hidden;">
        <div class="auth-header">
          <h2 style="margin:0;font-size:20px;text-align:center;">万物手札</h2>
          <p style="margin:4px 0 0;color:#999;font-size:13px;">登录以同步你的记录</p>
          <button class="auth-close" data-auth-close>×</button>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab auth-login-tab active" data-auth-tab-login>登录</button>
          <button class="auth-tab auth-register-tab" data-auth-tab-register>注册</button>
        </div>
        <div class="auth-body">
          <div class="auth-login-form">
            <div class="auth-field">
              <label>邮箱</label>
              <input type="email" class="auth-login-email" placeholder="your@email.com" autocomplete="email">
            </div>
            <div class="auth-field">
              <label>密码</label>
              <input type="password" class="auth-login-password" placeholder="输入密码" autocomplete="current-password">
            </div>
          </div>
          <div class="auth-register-form" style="display:none;">
            <div class="auth-field">
              <label>邮箱</label>
              <input type="email" class="auth-register-email" placeholder="your@email.com" autocomplete="email">
            </div>
            <div class="auth-field">
              <label>昵称</label>
              <input type="text" class="auth-register-nickname" placeholder="手札用户" maxlength="20">
            </div>
            <div class="auth-field">
              <label>密码</label>
              <input type="password" class="auth-register-password" placeholder="至少 6 位" autocomplete="new-password">
            </div>
          </div>
          <div class="auth-status" style="margin-top:12px;text-align:center;font-size:13px;min-height:20px;"></div>
          <button class="auth-submit-btn" data-auth-submit style="width:100%;padding:12px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer;margin-top:8px;">登录</button>
          <div class="auth-toggle" style="text-align:center;margin-top:12px;font-size:13px;color:#666;">
            <a href="#" data-auth-toggle style="color:#2563eb;text-decoration:none;">还没有账号？立即注册</a>
          </div>
        </div>
      </div>
    `;
  },

  _showToast(msg) {
    if (window.UIComponents && window.UIComponents.Toast) {
      window.UIComponents.Toast.show(msg, { duration: 2000 });
    } else {
      const toast = document.getElementById('toast');
      if (toast) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
    }
  }
};

window.AuthPlugin = AuthPlugin;
console.log('[AuthPlugin] 用户认证插件已加载 (v7.1.0)');
}
