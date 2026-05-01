/**
 * Transitions Plugin - 页面过渡动画
 * 使用 CSS View Transitions API 实现平滑页面切换
 * @version 7.0.0
 */

if (!window.TransitionsPlugin) {
const TransitionsPlugin = {
  name: 'transitions',
  version: '1.0.0',
  dependencies: [],

  _currentTransition: null,
  _transitionDuration: 300,

  async init() {
    this.routes = [];
  },

  async start() {
    console.log('[TransitionsPlugin] Starting...');

    // 拦截 Router.navigate 添加过渡动画
    this._wrapRouter();
  },

  stop() {},
  routes: [],
  actions: {},

  /**
   * 包装 Router.navigate 方法
   * @private
   */
  _wrapRouter() {
    if (!window.Router) return;

    const originalNavigate = Router.navigate.bind(Router);
    const self = this;

    Router.navigate = async function(...args) {
      const newPage = args[0];
      const currentPage = document.querySelector('.page.active');

      // 如果是同一个页面，直接跳转
      if (currentPage) {
        const currentId = currentPage.id.replace('page-', '');
        if (currentId === newPage) return originalNavigate(...args);
      }

      // 检查是否支持 View Transitions API
      if (document.startViewTransition) {
        const transition = document.startViewTransition(() => {
          originalNavigate(...args);
        });
        await transition.finished;
      } else {
        // Fallback: CSS 淡入淡出
        await self._cssTransition(currentPage, newPage);
        originalNavigate(...args);
      }
    };

    // 拦截 back 方法
    if (Router.back) {
      const originalBack = Router.back.bind(Router);
      Router.back = async function(...args) {
        if (document.startViewTransition) {
          const transition = document.startViewTransition(() => {
            originalBack(...args);
          });
          await transition.finished;
        } else {
          originalBack(...args);
        }
      };
    }

    console.log('[TransitionsPlugin] Router wrapped with transitions');
  },

  /**
   * CSS 淡入淡出过渡 (View Transitions API 不可用时的降级方案)
   * @private
   */
  async _cssTransition(fromPage, toPageName) {
    const toPage = document.getElementById(`page-${toPageName}`);

    if (fromPage) {
      fromPage.style.transition = `opacity ${this._transitionDuration}ms ease`;
      fromPage.style.opacity = '0';
      await this._wait(this._transitionDuration);
    }

    if (toPage) {
      toPage.style.opacity = '0';
      toPage.style.transition = `opacity ${this._transitionDuration}ms ease`;
      requestAnimationFrame(() => {
        toPage.style.opacity = '1';
      });
    }
  },

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

window.TransitionsPlugin = TransitionsPlugin;
console.log('[TransitionsPlugin] 页面过渡动画已加载');
}
