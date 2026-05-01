/**
 * Hotkeys Plugin - 键盘快捷键
 * 提供全局键盘快捷键支持
 * @version 6.2.0
 */

if (!window.HotkeysPlugin) {
const HotkeysPlugin = {
  name: 'hotkeys',
  version: '1.0.0',
  dependencies: [],

  _bound: false,
  _handlers: new Map(),

  // 快捷键映射
  SHORTCUTS: {
    // 全局
    'ctrl+n': { label: '新建记录', action: 'newRecord', os: 'all' },
    'ctrl+f': { label: '搜索', action: 'focusSearch', os: 'all' },
    'ctrl+s': { label: '保存记录', action: 'saveRecord', os: 'all' },
    'ctrl+z': { label: '撤销', action: 'undo', os: 'all' },
    'ctrl+shift+z': { label: '重做', action: 'redo', os: 'all' },
    'Escape': { label: '返回/关闭', action: 'goBack', os: 'all' },

    // 编辑器内
    'ctrl+b': { label: '加粗', action: 'bold', scope: 'editor' },
    'ctrl+i': { label: '斜体', action: 'italic', scope: 'editor' },
    'ctrl+u': { label: '下划线', action: 'underline', scope: 'editor' },
    'ctrl+k': { label: '清除格式', action: 'removeFormat', scope: 'editor' },

    // 导航
    'alt+1': { label: '首页', action: 'goHome' },
    'alt+2': { label: '日历', action: 'goCalendar' },
    'alt+3': { label: '故事', action: 'goTimeline' },
    'alt+4': { label: '收藏', action: 'goFavorites' },
    'alt+5': { label: '我的', action: 'goProfile' },
  },

  async init() {
    console.log('[HotkeysPlugin] Initializing...');
    this.routes = [];
  },

  async start() {
    console.log('[HotkeysPlugin] Starting...');
    this._bindGlobal();
    this._showHelpIfRequested();
  },

  stop() {
    this._bound = false;
  },

  routes: [],
  actions: {},

  /**
   * 绑定全局键盘事件
   * @private
   */
  _bindGlobal() {
    if (this._bound) return;
    this._bound = true;

    document.addEventListener('keydown', (e) => {
      // 忽略输入框内的非快捷键按键
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.contentEditable === 'true';

      const key = this._normalizeKey(e);
      const shortcut = this.SHORTCUTS[key];

      if (!shortcut) return;

      // 编辑器快捷键：只在编辑器内生效
      if (shortcut.scope === 'editor' && !this._isInEditor()) return;

      // 非输入状态下：跳过需要 Ctrl 的快捷键（避免与浏览器冲突）
      if (!e.ctrlKey && !e.altKey && !e.metaKey) return;

      // 阻止默认行为并执行
      e.preventDefault();
      this._execute(shortcut.action);
    });
  },

  /**
   * 标准化快捷键键名
   * @private
   */
  _normalizeKey(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    const key = e.key.toLowerCase();
    // 特殊键名处理
    if (key === 'control' || key === 'shift' || key === 'alt' || key === 'meta') return '';
    parts.push(key === ' ' ? 'space' : key);

    return parts.join('+');
  },

  /**
   * 执行快捷键动作
   * @private
   */
  _execute(action) {
    let el;
    switch (action) {
      case 'newRecord':
        if (window.Router) Router.navigate('editor', { mode: 'create' });
        break;

      case 'focusSearch':
        el = document.getElementById('search-input');
        if (el) {
          el.focus();
          el.select();
        }
        break;

      case 'saveRecord':
        if (window.EditorPlugin && EditorPlugin._saveRecord) {
          EditorPlugin._saveRecord();
        }
        break;

      case 'undo':
        if (window.Store) Store.undo();
        break;

      case 'redo':
        if (window.Store) Store.redo();
        break;

      case 'goBack':
        if (window.Router) {
          const current = Router.current();
          if (current && current.path !== 'home') {
            Router.navigate('home');
          }
        }
        el = document.getElementById('search-input');
        if (el && document.activeElement === el) {
          el.blur();
        }
        break;

      case 'bold':
        document.execCommand('bold', false);
        break;

      case 'italic':
        document.execCommand('italic', false);
        break;

      case 'underline':
        document.execCommand('underline', false);
        break;

      case 'removeFormat':
        document.execCommand('removeFormat', false);
        break;

      case 'goHome':
        if (window.Router) Router.navigate('home');
        break;

      case 'goCalendar':
        if (window.Router) Router.navigate('calendar');
        break;

      case 'goTimeline':
        if (window.Router) Router.navigate('timeline');
        break;

      case 'goFavorites':
        if (window.Router) Router.navigate('favorites');
        break;

      case 'goProfile':
        if (window.Router) Router.navigate('profile');
        break;
    }
  },

  /**
   * 检查是否在编辑器页面
   * @private
   */
  _isInEditor() {
    const formPage = document.getElementById('page-form');
    return formPage && formPage.classList.contains('active');
  },

  /**
   * 显示快捷键帮助 (Ctrl+/)
   * @private
   */
  _showHelpIfRequested() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        this._showHelpModal();
      }
    });
  },

  /**
   * 显示快捷键帮助弹窗
   * @private
   */
  _showHelpModal() {
    const existing = document.getElementById('hotkeys-modal');
    if (existing) {
      existing.remove();
      return;
    }

    const groups = {
      '全局': this._getShortcutsByScope(null),
      '编辑器': this._getShortcutsByScope('editor'),
      '导航': this._getShortcutsByCategory('alt')
    };

    const modal = document.createElement('div');
    modal.id = 'hotkeys-modal';
    modal.className = 'hotkeys-modal';
    modal.innerHTML = `
      <div class="hotkeys-modal-overlay" data-close></div>
      <div class="hotkeys-modal-content">
        <div class="hotkeys-header">
          <h3>键盘快捷键</h3>
          <button class="hotkeys-close" data-close>×</button>
        </div>
        <div class="hotkeys-body">
          ${Object.entries(groups).map(([title, items]) => `
            <div class="hotkeys-group">
              <h4>${title}</h4>
              ${items.map(s => `
                <div class="hotkeys-item">
                  <span class="hotkeys-label">${s.label}</span>
                  <kbd>${s.key}</kbd>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 绑定关闭
    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => modal.remove());
    });
  },

  /**
   * 获取指定范围的快捷键
   * @private
   */
  _getShortcutsByScope(scope) {
    return Object.entries(this.SHORTCUTS)
      .filter(([, v]) => v.scope === scope)
      .map(([key, v]) => ({ label: v.label, key: this._formatKey(key) }));
  },

  /**
   * 按类别获取快捷键
   * @private
   */
  _getShortcutsByCategory(prefix) {
    return Object.entries(this.SHORTCUTS)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, v]) => ({ label: v.label, key: this._formatKey(key) }));
  },

  /**
   * 格式化快捷键显示
   * @private
   */
  _formatKey(key) {
    return key
      .replace(/ctrl/g, 'Ctrl')
      .replace(/shift/g, 'Shift')
      .replace(/alt/g, 'Alt')
      .replace(/\+/g, ' + ');
  }
};

window.HotkeysPlugin = HotkeysPlugin;
console.log('[HotkeysPlugin] 键盘快捷键插件已定义');
}
