/**
 * Hooks - 插件钩子系统
 * 允许插件拦截和修改生命周期事件 (beforeSave, afterSave 等)
 * @version 6.3.0
 */
class HooksManager {
  constructor() {
    this._hooks = new Map();
    this._registerBuiltins();
  }

  _registerBuiltins() {
    const builtins = [
      'record:beforeSave',
      'record:afterSave',
      'record:beforeDelete',
      'record:afterDelete'
    ];
    builtins.forEach(name => this._hooks.set(name, []));
  }

  register(hookName, callback) {
    if (typeof callback !== 'function') {
      throw new Error('[Hooks] 钩子回调必须是函数');
    }
    if (!this._hooks.has(hookName)) {
      this._hooks.set(hookName, []);
    }
    const handlers = this._hooks.get(hookName);
    handlers.push(callback);
    return () => {
      const idx = handlers.indexOf(callback);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }

  run(hookName, data) {
    const handlers = this._hooks.get(hookName);
    if (!handlers || handlers.length === 0) {
      return data;
    }
    let result = data;
    for (const handler of handlers) {
      try {
        const returned = handler(result);
        if (returned !== undefined) {
          result = returned;
        }
      } catch (error) {
        throw new Error('[Hooks] 钩子 "' + hookName + '" 执行失败: ' + error.message);
      }
    }
    return result;
  }

  has(hookName) {
    return this._hooks.has(hookName);
  }

  count(hookName) {
    const handlers = this._hooks.get(hookName);
    return handlers ? handlers.length : 0;
  }

  list() {
    return Array.from(this._hooks.keys());
  }

  clear(hookName) {
    if (this._hooks.has(hookName)) {
      this._hooks.set(hookName, []);
    }
  }

  clearAll() {
    this._hooks.clear();
    this._registerBuiltins();
  }
}

// 全局单例 — 注意：类名和实例名不能相同，否则 Hooks.run() 会调用类而非实例
window.Hooks = new HooksManager();

console.log('[Hooks] 钩子系统已初始化 (v6.3.0)');
