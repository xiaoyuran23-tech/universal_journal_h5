/**
 * UI Effects Plugin - 统一 Toast / Sheet / 按钮动效
 * 整合原型中的交互动效，提供全局可调用的 UI 反馈
 * @version 1.0.0
 */

if (!window.UIEffectsPlugin) {
const UIEffectsPlugin = {
  name: 'ui-effects',
  version: '1.0.0',
  dependencies: [],

  _sheetOpen: false,
  _eventsBound: false,

  async init() {
    this._ensureToastElement();
    this._ensureSheetElements();
  },

  async start() {
    this._bindSheetEvents();
    this._enhanceButtons();
  },

  stop() {
    this._eventsBound = false;
  },

  /**
   * 显示 Toast 提示
   * @param {string} message - 提示文案
   * @param {Object} opts - { duration, type }
   */
  showToast(message, opts = {}) {
    const { duration = 2000, type = '' } = opts;
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast show' + (type ? ` toast-${type}` : '');

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  },

  /**
   * 打开底部抽屉
   * @param {string} html - 抽屉内容 HTML
   */
  openSheet(html) {
    const sheet = document.getElementById('ui-sheet');
    const mask = document.getElementById('ui-sheet-mask');
    if (!sheet || !mask) return;

    sheet.innerHTML = `<div class="sheet-grabber"></div>${html}`;
    mask.classList.add('show');
    sheet.classList.add('show');
    this._sheetOpen = true;
  },

  /**
   * 关闭底部抽屉
   */
  closeSheet() {
    const sheet = document.getElementById('ui-sheet');
    const mask = document.getElementById('ui-sheet-mask');
    if (!sheet || !mask) return;

    sheet.classList.remove('show');
    mask.classList.remove('show');
    this._sheetOpen = false;
  },

  /**
   * 确保 Toast DOM 元素存在
   * @private
   */
  _ensureToastElement() {
    if (document.getElementById('toast')) return;
    const el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  },

  /**
   * 确保 Sheet DOM 元素存在
   * @private
   */
  _ensureSheetElements() {
    if (document.getElementById('ui-sheet')) return;

    const mask = document.createElement('div');
    mask.id = 'ui-sheet-mask';
    mask.className = 'sheet-mask';
    document.body.appendChild(mask);

    const sheet = document.createElement('section');
    sheet.id = 'ui-sheet';
    sheet.className = 'botanical-sheet';
    document.body.appendChild(sheet);
  },

  /**
   * 绑定 Sheet 交互事件（遮罩关闭、拖拽手势）
   * @private
   */
  _bindSheetEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const mask = document.getElementById('ui-sheet-mask');
    if (mask) {
      mask.addEventListener('click', () => this.closeSheet());
    }

    // 触摸下滑关闭
    let startY = 0;
    const sheet = document.getElementById('ui-sheet');
    if (sheet) {
      sheet.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
      }, { passive: true });

      sheet.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - startY;
        if (dy > 80) this.closeSheet();
      }, { passive: true });
    }
  },

  /**
   * 增强按钮按压动效（原型风格）
   * @private
   */
  _enhanceButtons() {
    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-ghost, .fab').forEach(btn => {
      if (btn.dataset.uiEnhanced) return;
      btn.dataset.uiEnhanced = '1';
      btn.style.transition = 'transform 0.1s ease-out, box-shadow 0.2s ease';
      btn.addEventListener('mousedown', () => {
        btn.style.transform = 'scale(0.96)';
      });
      btn.addEventListener('mouseup', () => {
        btn.style.transform = 'scale(1)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
      });
    });
  }
};

window.UIEffectsPlugin = UIEffectsPlugin;
}
