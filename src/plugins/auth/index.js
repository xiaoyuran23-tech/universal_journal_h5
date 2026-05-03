/**
 * Auth Plugin v7.4.0 - 用户认证系统
 * 登录/注册/登出/密码重置/JWT续期，Auth 状态接入 Store
 */

if (!window.AuthPlugin) {
const AuthPlugin = {
  name: 'auth',
  version: '7.4.0',
  dependencies: [],

  _eventsBound: false,
  _apiBase: '',
  _user: null,
  _refreshTimer: null,

  configure(apiBase) {
    let value;
    if (apiBase && typeof apiBase === 'string') {
      value = apiBase;
    } else if (window.JOURNAL_API_URL && typeof window.JOURNAL_API_URL === 'string') {
      value = window.JOURNAL_API_URL;
    } else {
      value = 'http://localhost:4000/api';
    }
    this._apiBase = value;
    if (window.AuthPlugin) window.AuthPlugin._apiBase = value;
  },

  async init() {
    this.configure();
    this.routes = [];
  },

  async start() {
    this.configure();
    const lastUser = localStorage.getItem('journal_user');
    if (lastUser) {
      try {
        const user = await this._fetch('/auth/me');
        this._setUser(user.user);
        this._scheduleTokenRefresh();
        this._updateUI(true);
      } catch (e) {
        try {
          await new Promise(r => setTimeout(r, 1000));
          const user = await this._fetch('/auth/me');
          this._setUser(user.user);
          this._scheduleTokenRefresh();
          this._updateUI(true);
        } catch {
          localStorage.removeItem('journal_user');
          this._setUser(null);
          this._updateUI(false);
        }
      }
    } else {
      this._setUser(null);
      this._updateUI(false);
    }
    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
  },

  stop() {
    this._eventsBound = false;
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  routes: [],
  actions: {},

  // ==================== 公开 API ====================

  get currentUser() { return this._user; },
  get isLoggedIn() { return !!this._user; },

  /**
   * 统一设置用户状态，同步到 Store 和 localStorage
   */
  _setUser(user) {
    this._user = user || null;
    if (window.AuthPlugin) window.AuthPlugin._user = user || null;
    if (window.Store) {
      window.Store.dispatch({ type: 'auth.setUser', payload: user });
    }
    if (user) {
      localStorage.setItem('journal_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('journal_user');
    }
  },

  /**
   * JWT 静默续期（过期前 5 分钟自动刷新）
   */
  _scheduleTokenRefresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    // JWT 30 天过期，提前 5 分钟刷新
    const refreshIn = Math.max(1000, 30 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000);
    this._refreshTimer = setTimeout(async () => {
      try {
        await this._fetch('/auth/refresh', { method: 'POST' });
        console.log('[AuthPlugin] Token refreshed');
        this._scheduleTokenRefresh();
      } catch (e) {
        console.warn('[AuthPlugin] Token refresh failed');
      }
    }, refreshIn);
  },

  async register(email, password, nickname) {
    const res = await this._fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname })
    });
    this._setUser(res.user);
    this._scheduleTokenRefresh();
    this._updateUI(true);
    document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: res.user, isNewUser: true } }));
    return res;
  },

  async login(email, password) {
    const res = await this._fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this._setUser(res.user);
    this._scheduleTokenRefresh();
    this._updateUI(true);
    document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: res.user, isNewUser: false } }));
    return res;
  },

  async logout() {
    if (this._refreshTimer) { clearTimeout(this._refreshTimer); this._refreshTimer = null; }
    try { await this._fetch('/auth/logout', { method: 'POST' }); } catch {}
    this._setUser(null);
    localStorage.removeItem('journal_last_sync_usn');
    localStorage.removeItem('journal_pending_changes');
    if (window.AutoSyncPlugin) {
      window.AutoSyncPlugin._stopAutoSync?.();
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

  async updateProfile(data) {
    const res = await this._fetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    this._setUser(res.user);
    this._updateUI(true);
    return res;
  },

  async changePassword(currentPassword, newPassword) {
    if (!currentPassword || !newPassword) throw new Error('当前密码和新密码必填');
    if (newPassword.length < 6) throw new Error('新密码至少 6 位');
    const res = await this._fetch('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    this._setUser(res.user);
    return res;
  },

  /**
   * 请求密码重置（发送重置码）
   */
  async requestPasswordReset(email) {
    const normalized = email.toLowerCase().trim();
    if (!normalized) throw new Error('邮箱必填');
    const res = await this._fetch('/auth/request-reset', {
      method: 'POST',
      body: JSON.stringify({ email: normalized })
    });
    return res;
  },

  /**
   * 使用重置码修改密码
   */
  async resetPassword(email, resetToken, newPassword) {
    const normalized = email.toLowerCase().trim();
    if (!normalized || !resetToken || !newPassword) throw new Error('邮箱、重置码和新密码必填');
    if (newPassword.length < 6) throw new Error('新密码至少 6 位');
    const res = await this._fetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: normalized, resetToken, newPassword })
    });
    return res;
  },

  async deleteAccount(password) {
    if (!password) throw new Error('密码必填');
    const res = await this._fetch('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });
    try { await this.logout(); } catch (e) {
      console.error('[AuthPlugin] Local cleanup after account deletion failed:', e);
    }
    return res;
  },

  async fetchAuthenticated(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
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

  showLoginModal() {
    this._showLoginModal();
  },

  // ==================== 内部方法 ====================

  async _fetch(path, options = {}) {
    const url = `${this._apiBase}${path}`;
    let res;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        const err = new Error('请求超时，请检查网络');
        err._httpStatus = 0;
        throw err;
      }
      const err = new Error('网络连接失败，请检查网络');
      err._httpStatus = 0;
      throw err;
    }
    clearTimeout(timeout);
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
    modal.querySelector('[data-auth-tab-reset]')?.addEventListener('click', () => this._switchAuthTab('reset'));
    modal.querySelector('[data-auth-submit]')?.addEventListener('click', () => this._handleAuthSubmit());
    modal.querySelector('[data-auth-toggle]')?.addEventListener('click', () => this._toggleAuthForm());
  },

  _switchAuthTab(tab) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    const tabs = ['login', 'register', 'reset'];
    tabs.forEach(t => {
      const tabBtn = modal.querySelector(`.auth-${t}-tab`);
      const formEl = modal.querySelector(`.auth-${t}-form`);
      if (tabBtn) tabBtn.classList.toggle('active', t === tab);
      if (formEl) formEl.style.display = t === tab ? 'block' : 'none';
    });
    const submitBtn = modal.querySelector('[data-auth-submit]');
    if (submitBtn) {
      const labels = { login: '登录', register: '注册', reset: '发送重置码' };
      submitBtn.textContent = labels[tab] || '提交';
    }
  },

  _toggleAuthForm() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    const visible = modal.querySelector('.auth-login-form').style.display !== 'none'
      || modal.querySelector('.auth-reset-form').style.display !== 'none';
    this._switchAuthTab(visible ? 'register' : 'login');
  },

  async _handleAuthSubmit() {
    const modal = document.getElementById('auth-modal');
    const statusEl = modal.querySelector('.auth-status');
    const submitBtn = modal.querySelector('[data-auth-submit]');
    if (submitBtn && submitBtn.disabled) return;

    const isLogin = modal.querySelector('.auth-login-form').style.display !== 'none';
    const isReset = modal.querySelector('.auth-reset-form') && modal.querySelector('.auth-reset-form').style.display !== 'none';

    try {
      if (isReset) {
        const email = modal.querySelector('.auth-reset-email').value.trim();
        const emailErr = this._validateEmail(email);
        if (emailErr) { this._showAuthError(emailErr); return; }
        submitBtn.disabled = true;
        submitBtn.textContent = '发送中...';
        submitBtn.style.opacity = '0.6';
        statusEl.textContent = '';
        await this.requestPasswordReset(email);
        this._showAuthSuccess('重置码已生成（开发模式请查看服务器日志）');
        setTimeout(() => this._switchAuthTab('login'), 2000);
      } else if (isLogin) {
        const email = modal.querySelector('.auth-login-email').value.trim();
        const password = modal.querySelector('.auth-login-password').value;
        const emailErr = this._validateEmail(email);
        if (emailErr) { this._showAuthError(emailErr); return; }
        const pwdErr = this._validatePassword(password);
        if (pwdErr) { this._showAuthError(pwdErr); return; }
        submitBtn.disabled = true;
        submitBtn.textContent = '登录中...';
        submitBtn.style.opacity = '0.6';
        statusEl.textContent = '';
        await this.login(email, password);
        const name = (this._user?.nickname || '手札用户').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
        this._showToast('欢迎回来，' + name);
        modal.remove();
      } else {
        const email = modal.querySelector('.auth-register-email').value.trim();
        const password = modal.querySelector('.auth-register-password').value;
        const nickname = modal.querySelector('.auth-register-nickname').value.trim();
        const emailErr = this._validateEmail(email);
        if (emailErr) { this._showAuthError(emailErr); return; }
        const pwdErr = this._validatePassword(password);
        if (pwdErr) { this._showAuthError(pwdErr); return; }
        submitBtn.disabled = true;
        submitBtn.textContent = '注册中...';
        submitBtn.style.opacity = '0.6';
        statusEl.textContent = '';
        await this.register(email, password, nickname || '手札用户');
        this._showToast('注册成功，欢迎使用万物手札');
        modal.remove();
      }
    } catch (e) {
      this._showAuthError(e.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isReset ? '发送重置码' : (isLogin ? '登录' : '注册');
        submitBtn.style.opacity = '1';
      }
    } finally {
      statusEl.textContent = '';
    }
  },

  _validateEmail(email) {
    if (!email) return '请填写邮箱';
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!re.test(email)) return '邮箱格式不正确';
    return null;
  },

  _validatePassword(password) {
    if (!password) return '请填写密码';
    if (password.length < 6) return '密码至少 6 位';
    if (password.length > 128) return '密码过长（最多 128 位）';
    return null;
  },

  _showAuthError(msg) {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      const el = modal.querySelector('.auth-status');
      if (el) { el.textContent = msg; el.style.color = '#ff4d4f'; el.style.display = 'block'; }
    }
  },

  _showAuthSuccess(msg) {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      const el = modal.querySelector('.auth-status');
      if (el) { el.textContent = msg; el.style.color = '#52c41a'; el.style.display = 'block'; }
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
          <button class="auth-tab auth-reset-tab" data-auth-tab-reset>忘记密码</button>
        </div>
        <div class="auth-body">
          <div class="auth-login-form">
            <div class="auth-field">
              <label>邮箱</label>
              <input type="email" class="auth-login-email" placeholder="your@email.com" autocomplete="email">
            </div>
            <div class="auth-field">
              <label>密码</label>
              <input type="password" class="auth-login-password" placeholder="输入密码" autocomplete="current-password" maxlength="128">
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
              <input type="password" class="auth-register-password" placeholder="至少 6 位，最多 128 位" autocomplete="new-password" maxlength="128">
            </div>
          </div>
          <div class="auth-reset-form" style="display:none;">
            <div class="auth-field">
              <label>注册邮箱</label>
              <input type="email" class="auth-reset-email" placeholder="your@email.com" autocomplete="email">
            </div>
          </div>
          <div class="auth-status" style="margin-top:12px;text-align:center;font-size:13px;min-height:20px;display:none;"></div>
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
}
