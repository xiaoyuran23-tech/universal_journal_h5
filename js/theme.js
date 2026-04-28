/**
 * 万物手札 - 主题管理模块 v3.3.0
 */

const ThemeManager = {
  currentTheme: 'light',
  themes: [
    { id: 'light', name: '明亮' },
    { id: 'dark', name: '暗黑' },
    { id: 'warm', name: '暖光' },
    { id: 'ink', name: '墨影' }
  ],
  
  init() {
    const saved = localStorage.getItem('universal_journal_theme');
    if (saved && this.themes.find(t => t.id === saved)) {
      this.currentTheme = saved;
    }
    document.documentElement.setAttribute('data-theme', this.currentTheme);
  },
  
  apply(themeId) {
    const theme = this.themes.find(t => t.id === themeId);
    if (!theme) return;
    
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('universal_journal_theme', themeId);
    this.currentTheme = themeId;
    
    const themeNameEl = document.getElementById('current-theme-name');
    if (themeNameEl) themeNameEl.textContent = theme.name;
  },
  
  renderOptions() {
    const container = document.getElementById('theme-options');
    if (!container) return;
    
    container.innerHTML = this.themes.map(theme => `
      <div class="theme-option" data-theme="${theme.id}">
        <div class="theme-preview" style="background: var(--bg); border-color: var(--primary)"></div>
        <span class="theme-name">${theme.name}</span>
      </div>
    `).join('');
    
    container.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        this.apply(option.dataset.theme);
        const panel = document.getElementById('theme-panel');
        if (panel) panel.classList.remove('show');
      });
    });
  }
};

// 密码 UI 组件
const PasswordUI = {
  currentAction: null,
  currentCallback: null,
  
  showModal(title, hint, placeholder, callback) {
    this.currentCallback = callback;
    
    const titleEl = document.getElementById('modal-title');
    const hintEl = document.getElementById('modal-hint');
    const input = document.getElementById('modal-password');
    const modal = document.getElementById('password-modal');
    
    if (titleEl) titleEl.textContent = title;
    if (hintEl) {
      hintEl.textContent = hint || '';
      hintEl.className = 'modal-hint';
    }
    if (input) {
      input.placeholder = placeholder || '请输入密码';
      input.value = '';
    }
    if (modal) modal.style.display = 'flex';
    
    setTimeout(() => { if (input) input.focus(); }, 100);
  },
  
  hideModal() {
    const modal = document.getElementById('password-modal');
    if (modal) modal.style.display = 'none';
    this.currentCallback = null;
  },
  
  showError(message) {
    const hint = document.getElementById('modal-hint');
    if (hint) {
      hint.textContent = message;
      hint.className = 'modal-hint error';
    }
  },
  
  showLockScreen() {
    const input = document.getElementById('lock-password');
    const hint = document.getElementById('lock-hint');
    const overlay = document.getElementById('lock-overlay');
    
    if (input) input.value = '';
    if (hint) {
      hint.textContent = '';
      hint.className = 'lock-hint';
    }
    if (overlay) overlay.style.display = 'flex';
    
    setTimeout(() => { if (input) input.focus(); }, 100);
  },
  
  hideLockScreen() {
    const overlay = document.getElementById('lock-overlay');
    if (overlay) overlay.style.display = 'none';
  }
};

window.ThemeManager = ThemeManager;
window.PasswordUI = PasswordUI;
