/**
 * Theme Plugin - 主题管理
 * 替代 js/theme.js 的 ThemeManager 部分
 * @version 6.1.0
 */

if (!window.ThemePlugin) {
const ThemePlugin = {
  name: 'theme',
  version: '1.0.0',
  dependencies: [],

  currentTheme: 'light',
  themes: [
    { id: 'light', name: '明亮' },
    { id: 'dark', name: '暗黑' },
    { id: 'warm', name: '暖光' },
    { id: 'ink', name: '墨影' },
    { id: 'cyan-mountain', name: '青绿' },
    { id: 'plum-blossom', name: '梅花' },
    { id: 'bamboo-rain', name: '竹青' },
    { id: 'distant-water', name: '淡彩' }
  ],

  _eventsBound: false,

  async init() {
    console.log('[ThemePlugin] Initializing...');
    const saved = localStorage.getItem('universal_journal_theme');
    if (saved && this.themes.find(t => t.id === saved)) {
      this.currentTheme = saved;
    }
    document.documentElement.setAttribute('data-theme', this.currentTheme);
  },

  async start() {
    console.log('[ThemePlugin] Starting...');
    this._bindEvents();
  },

  stop() {
    this._eventsBound = false;
  },

  apply(themeId) {
    const theme = this.themes.find(t => t.id === themeId);
    if (!theme) return;

    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('universal_journal_theme', themeId);
    this.currentTheme = themeId;
  },

  /**
   * 循环切换主题（供设置页按钮使用）
   */
  toggleTheme() {
    const idx = this.themes.findIndex(t => t.id === this.currentTheme);
    const next = this.themes[(idx + 1) % this.themes.length];
    this.apply(next.id);
  },

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // 头部主题切换按钮
    const toggle = document.getElementById('theme-toggle');
    const panel = document.getElementById('theme-panel');
    const options = document.getElementById('theme-options');

    if (toggle) {
      toggle.addEventListener('click', () => {
        if (panel) {
          panel.classList.toggle('show');
          if (panel.classList.contains('show')) {
            this._renderThemeOptions();
          }
        }
      });
    }

    // 设置页主题入口
    const settingsThemeBtn = document.getElementById('settings-theme');
    if (settingsThemeBtn) {
      settingsThemeBtn.addEventListener('click', () => {
        if (panel) {
          panel.classList.add('show');
          this._renderThemeOptions();
        }
      });
    }

    // 关闭面板
    if (panel) {
      document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== toggle && !toggle?.contains(e.target)) {
          panel.classList.remove('show');
        }
      });
    }
  },

  _renderThemeOptions() {
    const container = document.getElementById('theme-options');
    if (!container) return;

    container.innerHTML = this.themes.map(theme => `
      <div class="theme-option ${theme.id === this.currentTheme ? 'active' : ''}" data-theme="${theme.id}">
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

window.ThemePlugin = ThemePlugin;
console.log('[ThemePlugin] 主题管理插件已定义');
}
