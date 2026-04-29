/**
 * UI Components - 基础组件库
 * 提供可复用的 UI 组件，统一交互体验
 * @version 6.1.0
 */

// ===================================
// Button Component
// ===================================
class Button {
  /**
   * 渲染按钮
   * @param {Object} config - 配置
   * @param {string} config.text - 按钮文本
   * @param {string} [config.type] - 类型：primary, secondary, danger, ghost
   * @param {string} [config.size] - 尺寸：small, medium, large
   * @param {boolean} [config.disabled] - 是否禁用
   * @param {Function} [config.onClick] - 点击回调
   * @returns {HTMLElement}
   */
  static render(config) {
    const {
      text = '按钮',
      type = 'secondary',
      size = 'medium',
      disabled = false,
      onClick
    } = config;

    const btn = document.createElement('button');
    btn.className = `btn btn-${type} btn-${size}${disabled ? ' disabled' : ''}`;
    btn.textContent = text;
    btn.disabled = disabled;

    if (onClick) {
      btn.addEventListener('click', onClick);
    }

    return btn;
  }
}

// ===================================
// Input Component
// ===================================
class Input {
  /**
   * 渲染输入框
   * @param {Object} config
   * @param {string} [config.type] - 类型：text, password, number, email
   * @param {string} [config.placeholder] - 占位符
   * @param {string} [config.value] - 初始值
   * @param {string} [config.label] - 标签文本
   * @param {boolean} [config.required] - 是否必填
   * @param {Function} [config.onChange] - 变化回调
   * @returns {HTMLElement}
   */
  static render(config) {
    const {
      type = 'text',
      placeholder = '',
      value = '',
      label,
      required = false,
      onChange
    } = config;

    const wrapper = document.createElement('div');
    wrapper.className = 'input-wrapper';

    if (label) {
      const labelEl = document.createElement('label');
      labelEl.className = 'input-label';
      labelEl.textContent = label;
      if (required) labelEl.classList.add('required');
      wrapper.appendChild(labelEl);
    }

    const input = document.createElement('input');
    input.type = type;
    input.className = 'input-field';
    input.placeholder = placeholder;
    input.value = value;
    input.required = required;

    if (onChange) {
      input.addEventListener('input', (e) => onChange(e.target.value));
    }

    wrapper.appendChild(input);
    return wrapper;
  }

  /**
   * 渲染文本域
   */
  static renderTextarea(config) {
    const {
      placeholder = '',
      value = '',
      rows = 4,
      label,
      required = false,
      onChange
    } = config;

    const wrapper = document.createElement('div');
    wrapper.className = 'input-wrapper';

    if (label) {
      const labelEl = document.createElement('label');
      labelEl.className = 'input-label';
      labelEl.textContent = label;
      if (required) labelEl.classList.add('required');
      wrapper.appendChild(labelEl);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'textarea-field';
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.rows = rows;
    textarea.required = required;

    if (onChange) {
      textarea.addEventListener('input', (e) => onChange(e.target.value));
    }

    wrapper.appendChild(textarea);
    return wrapper;
  }
}

// ===================================
// Modal Component
// ===================================
class Modal {
  constructor(config = {}) {
    this._config = config;
    this._element = null;
    this._isOpen = false;
  }

  /**
   * 打开模态框
   */
  open() {
    if (this._isOpen) return;

    this._element = this._render();
    document.body.appendChild(this._element);

    // 触发动画
    requestAnimationFrame(() => {
      this._element.classList.add('active');
    });

    this._isOpen = true;

    if (this._config.onOpen) {
      this._config.onOpen();
    }
  }

  /**
   * 关闭模态框
   */
  close() {
    if (!this._isOpen || !this._element) return;

    this._element.classList.remove('active');

    setTimeout(() => {
      if (this._element && this._element.parentNode) {
        this._element.parentNode.removeChild(this._element);
      }
      this._element = null;
      this._isOpen = false;

      if (this._config.onClose) {
        this._config.onClose();
      }
    }, 300);
  }

  /**
   * 渲染模态框
   * @private
   */
  _render() {
    const {
      title = '',
      content = '',
      footer,
      showClose = true,
      size = 'medium' // small, medium, large
    } = this._config;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = `modal modal-${size}`;

    // Header
    if (title || showClose) {
      const header = document.createElement('div');
      header.className = 'modal-header';

      if (title) {
        const titleEl = document.createElement('h3');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);
      }

      if (showClose) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => this.close());
        header.appendChild(closeBtn);
      }

      modal.appendChild(header);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }
    modal.appendChild(body);

    // Footer
    if (footer) {
      const footerEl = document.createElement('div');
      footerEl.className = 'modal-footer';
      if (typeof footer === 'string') {
        footerEl.innerHTML = footer;
      } else {
        footerEl.appendChild(footer);
      }
      modal.appendChild(footerEl);
    }

    overlay.appendChild(modal);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && this._config.closeOnOverlay) {
        this.close();
      }
    });

    return overlay;
  }
}

// ===================================
// Toast Component
// ===================================
class Toast {
  static _container = null;
  static _toasts = [];

  /**
   * 显示 Toast
   * @param {string} message - 消息内容
   * @param {Object} [options] - 选项
   * @param {string} [options.type] - 类型：info, success, warning, error
   * @param {number} [options.duration] - 持续时间 (ms)
   */
  static show(message, options = {}) {
    const {
      type = 'info',
      duration = 3000
    } = options;

    // 创建容器
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }

    // 创建 Toast 元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${this._getIcon(type)}</span>
      <span class="toast-message">${message}</span>
    `;

    this._container.appendChild(toast);
    this._toasts.push(toast);

    // 触发动画
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        this._remove(toast);
      }, duration);
    }

    return toast;
  }

  /**
   * 移除 Toast
   * @private
   */
  static _remove(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this._toasts = this._toasts.filter(t => t !== toast);
    }, 300);
  }

  /**
   * 获取图标
   * @private
   */
  static _getIcon(type) {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type] || icons.info;
  }

  /**
   * 快捷方法
   */
  static success(message, duration) {
    return this.show(message, { type: 'success', duration });
  }

  static warning(message, duration) {
    return this.show(message, { type: 'warning', duration });
  }

  static error(message, duration) {
    return this.show(message, { type: 'error', duration });
  }
}

// 全局暴露
window.UIComponents = {
  Button,
  Input,
  Modal,
  Toast
};

console.log('[UIComponents] 基础组件库已加载');
