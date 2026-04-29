/**
 * EventBus 单元测试
 * 测试事件注册、触发、移除、通配符
 */

// 内联 EventBus 实现用于测试
class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, handler) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);
    return this;
  }

  off(event, handler) {
    if (!handler) {
      delete this._listeners[event];
      return this;
    }
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(h => h !== handler);
    }
    return this;
  }

  emit(event, data) {
    // 精确匹配
    if (this._listeners[event]) {
      [...this._listeners[event]].forEach(handler => {
        try { handler(data); } catch (e) { console.error('[EventBus] Handler error:', e); }
      });
    }
    
    // 通配符匹配
    Object.keys(this._listeners).forEach(pattern => {
      if (pattern === '*') {
        this._listeners['*'].forEach(handler => {
          try { handler(data); } catch (e) { console.error('[EventBus] Handler error:', e); }
        });
      } else if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (event.startsWith(prefix)) {
          this._listeners[pattern].forEach(handler => {
            try { handler(data, event); } catch (e) { console.error('[EventBus] Handler error:', e); }
          });
        }
      }
    });
  }

  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  hasListeners(event) {
    return !!(this._listeners[event] && this._listeners[event].length > 0);
  }

  listenerCount(event) {
    return this._listeners[event] ? this._listeners[event].length : 0;
  }

  clear() {
    this._listeners = {};
  }
}

let bus;

beforeEach(() => {
  bus = new EventBus();
});

describe('EventBus - 基本操作', () => {
  test('on 注册监听器', () => {
    const handler = jest.fn();
    bus.on('test', handler);
    expect(bus.listenerCount('test')).toBe(1);
  });

  test('emit 触发监听器', () => {
    const handler = jest.fn();
    bus.on('test', handler);
    bus.emit('test', { data: 'hello' });
    expect(handler).toHaveBeenCalledWith({ data: 'hello' });
  });

  test('emit 无监听器不报错', () => {
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  test('off 移除监听器', () => {
    const handler = jest.fn();
    bus.on('test', handler);
    bus.off('test', handler);
    bus.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  test('off 无参数移除该事件所有监听器', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.on('test', h1);
    bus.on('test', h2);
    bus.off('test');
    bus.emit('test');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });
});

describe('EventBus - 一次性监听', () => {
  test('once 只触发一次', () => {
    const handler = jest.fn();
    bus.once('test', handler);
    bus.emit('test');
    bus.emit('test');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('EventBus - 通配符', () => {
  test('on 使用 * 匹配任意事件', () => {
    const allHandler = jest.fn();
    bus.on('*', allHandler);
    bus.emit('event.a', { type: 'a' });
    bus.emit('event.b', { type: 'b' });
    expect(allHandler).toHaveBeenCalledTimes(2);
  });

  test('on 使用命名空间前缀匹配', () => {
    const recordHandler = jest.fn();
    bus.on('record.*', recordHandler);
    bus.emit('record.add', { id: 1 });
    bus.emit('record.delete', { id: 2 });
    bus.emit('other.event');
    expect(recordHandler).toHaveBeenCalledTimes(2);
  });
});

describe('EventBus - 工具方法', () => {
  test('hasListeners 检查是否有监听器', () => {
    expect(bus.hasListeners('test')).toBe(false);
    bus.on('test', jest.fn());
    expect(bus.hasListeners('test')).toBe(true);
  });

  test('listenerCount 返回监听器数量', () => {
    expect(bus.listenerCount('test')).toBe(0);
    bus.on('test', jest.fn());
    bus.on('test', jest.fn());
    expect(bus.listenerCount('test')).toBe(2);
  });

  test('clear 清空所有监听器', () => {
    bus.on('a', jest.fn());
    bus.on('b', jest.fn());
    bus.on('c', jest.fn());
    bus.clear();
    expect(bus.listenerCount('a')).toBe(0);
    expect(bus.listenerCount('b')).toBe(0);
    expect(bus.listenerCount('c')).toBe(0);
  });
});

describe('EventBus - 错误处理', () => {
  test('单个监听器错误不影响其他', () => {
    const badHandler = jest.fn(() => { throw new Error('oops'); });
    const goodHandler = jest.fn();
    bus.on('test', badHandler);
    bus.on('test', goodHandler);
    expect(() => bus.emit('test')).not.toThrow();
    expect(goodHandler).toHaveBeenCalled();
  });
});
