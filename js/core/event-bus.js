/**
 * EventBus - 全局事件总线 (js compat version)
 * 实现发布/订阅模式，解耦模块间通信
 * @version 6.1.0
 */

// 幂等加载：防止 src/core/event-bus.js 已定义时重复声明
if (!window.EventBus) {
class EventBus {
  constructor() {
    this._events = new Map();
  }

  /**
   * 注册事件监听器
   * @param {string} event - 事件名称
   * @param {Function} handler - 处理函数
   * @returns {Function} 取消订阅函数
   */
  on(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} handler - 处理函数
   */
  off(event, handler) {
    if (this._events.has(event)) {
      this._events.get(event).delete(handler);
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    if (this._events.has(event)) {
      const handlers = this._events.get(event);
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[EventBus] Error in handler for "${event}":`, error);
        }
      });
    }
  }

  /**
   * 注册一次性事件监听器
   * @param {string} event - 事件名称
   * @param {Function} handler - 处理函数
   */
  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * 清空所有事件监听器
   */
  clear() {
    this._events.clear();
  }

  /**
   * 获取事件监听器数量
   * @param {string} event - 事件名称
   * @returns {number}
   */
  listenerCount(event) {
    if (!this._events.has(event)) return 0;
    return this._events.get(event).size;
  }
}

// 全局单例
window.EventBus = new EventBus();

// 预定义事件常量
window.EVENTS = {
  // 数据事件
  ITEM_CREATED: 'item:created',
  ITEM_UPDATED: 'item:updated',
  ITEM_DELETED: 'item:deleted',
  ITEMS_LOADED: 'items:loaded',
  
  // 同步事件
  SYNC_STARTED: 'sync:started',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_ERROR: 'sync:error',
  
  // UI 事件
  PAGE_SWITCHED: 'page:switched',
  THEME_CHANGED: 'theme:changed',
  TOAST_SHOW: 'toast:show',
  
  // 引导事件
  ONBOARDING_STARTED: 'onboarding:started',
  ONBOARDING_COMPLETED: 'onboarding:completed'
};

console.log('[EventBus] 全局事件总线已初始化');
} else {
  console.log('[EventBus] 已存在，跳过重复加载');
}
