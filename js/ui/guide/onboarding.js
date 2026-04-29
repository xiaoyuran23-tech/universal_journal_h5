/**
 * Onboarding - 新手引导系统
 * 提供分步引导，帮助首次用户快速了解核心功能
 * @version 6.1.0
 */
class Onboarding {
  constructor() {
    this._steps = [];
    this._currentStep = 0;
    this._overlay = null;
    this._tooltip = null;
    this._isRunning = false;
  }

  /**
   * 初始化引导步骤
   * @param {Array} steps - 引导步骤数组
   */
  init(steps) {
    this._steps = steps;
    this._currentStep = 0;
  }

  /**
   * 检查是否需要显示引导
   * @returns {boolean}
   */
  static shouldShow() {
    return !localStorage.getItem('onboarding_completed');
  }

  /**
   * 开始引导
   */
  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._currentStep = 0;

    // 触发引导开始事件
    if (window.EventBus) {
      window.EventBus.emit(window.EVENTS.ONBOARDING_STARTED);
    }

    this._createOverlay();
    this._showStep();
  }

  /**
   * 跳过引导
   */
  skip() {
    this._cleanup();
    localStorage.setItem('onboarding_completed', 'true');
    
    if (window.EventBus) {
      window.EventBus.emit(window.EVENTS.ONBOARDING_COMPLETED);
    }
  }

  /**
   * 下一步
   */
  next() {
    this._currentStep++;
    if (this._currentStep >= this._steps.length) {
      this.skip();
      return;
    }
    this._showStep();
  }

  /**
   * 上一步
   */
  prev() {
    if (this._currentStep > 0) {
      this._currentStep--;
      this._showStep();
    }
  }

  /**
   * 创建遮罩层
   * @private
   */
  _createOverlay() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'onboarding-overlay';
    document.body.appendChild(this._overlay);

    this._tooltip = document.createElement('div');
    this._tooltip.className = 'onboarding-tooltip';
    document.body.appendChild(this._tooltip);

    // 点击遮罩关闭
    this._overlay.addEventListener('click', () => this.skip());
  }

  /**
   * 显示当前步骤
   * @private
   */
  _showStep() {
    const step = this._steps[this._currentStep];
    if (!step) return;

    // 高亮目标元素
    this._unhighlightAll();
    if (step.target) {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.classList.add('onboarding-highlight');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // 更新提示框内容
    const progress = `${this._currentStep + 1} / ${this._steps.length}`;
    
    this._tooltip.innerHTML = `
      <div class="onboarding-tooltip-progress">${progress}</div>
      <h3 class="onboarding-tooltip-title">${step.title}</h3>
      <p class="onboarding-tooltip-description">${step.description}</p>
      <div class="onboarding-tooltip-actions">
        <button class="onboarding-btn onboarding-btn-skip" data-action="skip">跳过</button>
        <div class="onboarding-tooltip-dots">
          ${this._steps.map((_, i) => `
            <span class="onboarding-dot ${i === this._currentStep ? 'active' : ''}"></span>
          `).join('')}
        </div>
        <button class="onboarding-btn onboarding-btn-next" data-action="next">
          ${this._currentStep === this._steps.length - 1 ? '完成' : '下一步'}
        </button>
      </div>
    `;

    // 定位提示框
    this._positionTooltip(step);

    // 绑定按钮事件
    this._tooltip.querySelector('[data-action="skip"]').addEventListener('click', () => this.skip());
    this._tooltip.querySelector('[data-action="next"]').addEventListener('click', () => this.next());
  }

  /**
   * 定位提示框
   * @private
   */
  _positionTooltip(step) {
    if (!step.target) {
      // 居中显示
      this._tooltip.style.top = '50%';
      this._tooltip.style.left = '50%';
      this._tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const targetEl = document.querySelector(step.target);
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const tooltipRect = this._tooltip.getBoundingClientRect();
    
    let top = rect.bottom + 10;
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

    // 边界检查
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = rect.top - tooltipRect.height - 10;
    }

    this._tooltip.style.top = `${top + window.scrollY}px`;
    this._tooltip.style.left = `${left}px`;
    this._tooltip.style.transform = 'none';
  }

  /**
   * 取消所有高亮
   * @private
   */
  _unhighlightAll() {
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
      el.classList.remove('onboarding-highlight');
    });
  }

  /**
   * 清理
   * @private
   */
  _cleanup() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    if (this._tooltip) {
      this._tooltip.remove();
      this._tooltip = null;
    }
    this._unhighlightAll();
    this._isRunning = false;
  }
}

// 预定义引导步骤
Onboarding.DEFAULT_STEPS = [
  {
    target: null,
    title: '欢迎来到万物手札 🎉',
    description: '这是一个属于你的个人记录工具，可以记录物品、事件、心情等世间万物。'
  },
  {
    target: '.tab-item[data-page="home"]',
    title: '首页 - 记录列表',
    description: '这里显示你创建的所有记录。点击底部"+"按钮可以快速创建新记录。'
  },
  {
    target: '.fab-btn, [data-action="add"]',
    title: '创建新记录',
    description: '点击这个按钮开始创建你的第一条记录。可以添加名称、标签、备注和图片。'
  },
  {
    target: '.tab-item[data-page="calendar"]',
    title: '日历视图',
    description: '按日期查看你的记录，点击日期可以快速筛选当天的记录。'
  },
  {
    target: '.tab-item[data-page="profile"]',
    title: '设置与同步',
    description: '在这里可以设置昵称、导入导出数据、配置云同步，保护你的数据安全。'
  }
];

// 全局暴露
window.Onboarding = new Onboarding();

console.log('[Onboarding] 新手引导系统已初始化');
