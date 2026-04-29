/**
 * PluginLoader 单元测试
 * 测试插件注册、依赖排序、加载
 */

let PluginLoader;
let mockKernel;

beforeAll(() => {
  delete global.PluginLoader;
  
  const fs = require('fs');
  const path = require('path');
  const loaderCode = fs.readFileSync(path.resolve(__dirname, '../../src/core/plugin-loader.js'), 'utf-8');
  
  if (!global.window) global.window = global;
  eval(loaderCode);
  
  PluginLoader = global.PluginLoader || global.window.PluginLoader;
});

beforeEach(() => {
  mockKernel = {
    registerPlugin: jest.fn(),
    getPlugin: jest.fn(),
    status: 'booting'
  };
});

describe('PluginLoader - 注册', () => {
  test('register 添加插件', () => {
    const loader = new PluginLoader(mockKernel);
    const plugin = { name: 'test', init: jest.fn(), start: jest.fn() };
    
    loader.register('test', plugin);
    expect(loader._registry.get('test')).toBeDefined();
  });

  test('register 不设置 name 时使用键名', () => {
    const loader = new PluginLoader(mockKernel);
    const plugin = { init: jest.fn() };
    
    loader.register('my-plugin', plugin);
    expect(loader._registry.get('my-plugin').name).toBe('my-plugin');
  });

  test('register 提供默认值', () => {
    const loader = new PluginLoader(mockKernel);
    loader.register('minimal', {});
    
    const info = loader._registry.get('minimal');
    expect(info.version).toBe('1.0.0');
    expect(info.dependencies).toEqual([]);
    expect(typeof info.init).toBe('function');
    expect(typeof info.start).toBe('function');
  });
});

describe('PluginLoader - 拓扑排序', () => {
  test('_topologicalSort 按依赖顺序排序', () => {
    const loader = new PluginLoader(mockKernel);
    
    loader.register('base', { name: 'base', dependencies: [], init: jest.fn() });
    loader.register('ui', { name: 'ui', dependencies: ['base'], init: jest.fn() });
    loader.register('app', { name: 'app', dependencies: ['base', 'ui'], init: jest.fn() });
    
    const sorted = loader._topologicalSort(['app', 'ui', 'base']);
    
    const baseIndex = sorted.indexOf('base');
    const uiIndex = sorted.indexOf('ui');
    const appIndex = sorted.indexOf('app');
    
    expect(baseIndex).toBeLessThan(uiIndex);
    expect(uiIndex).toBeLessThan(appIndex);
  });

  test('_topologicalSort 无依赖保持原序', () => {
    const loader = new PluginLoader(mockKernel);
    
    loader.register('a', { name: 'a', dependencies: [], init: jest.fn() });
    loader.register('b', { name: 'b', dependencies: [], init: jest.fn() });
    loader.register('c', { name: 'c', dependencies: [], init: jest.fn() });
    
    const sorted = loader._topologicalSort(['c', 'a', 'b']);
    expect(sorted).toEqual(['c', 'a', 'b']);
  });
});

describe('PluginLoader - 依赖检查', () => {
  test('_checkDependencies 通过', async () => {
    const loader = new PluginLoader(mockKernel);
    
    loader.register('base', { name: 'base', dependencies: [], init: jest.fn() });
    loader.register('child', { name: 'child', dependencies: ['base'], init: jest.fn() });
    
    const child = loader._registry.get('child');
    await expect(loader._checkDependencies(child)).resolves.not.toThrow();
  });

  test('_checkDependencies 失败 - 缺失依赖', async () => {
    const loader = new PluginLoader(mockKernel);
    
    loader.register('child', { name: 'child', dependencies: ['missing'], init: jest.fn() });
    
    const child = loader._registry.get('child');
    await expect(loader._checkDependencies(child)).rejects.toThrow('missing');
  });
});

describe('PluginLoader - 加载', () => {
  test('loadToKernel 注册插件到 Kernel', async () => {
    const loader = new PluginLoader(mockKernel);
    
    loader.register('test', {
      name: 'test',
      dependencies: [],
      init: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    });
    
    await loader.loadToKernel('test');
    expect(mockKernel.registerPlugin).toHaveBeenCalledWith('test', expect.objectContaining({
      load: expect.any(Function),
      start: expect.any(Function),
      stop: expect.any(Function)
    }));
  });

  test('loadToKernel 不存在插件抛出错误', async () => {
    const loader = new PluginLoader(mockKernel);
    await expect(loader.loadToKernel('nonexistent')).rejects.toThrow('not found');
  });

  test('loadAll 加载所有插件', async () => {
    const loader = new PluginLoader(mockKernel);
    
    loader.register('a', { name: 'a', dependencies: [], init: jest.fn(), start: jest.fn() });
    loader.register('b', { name: 'b', dependencies: [], init: jest.fn(), start: jest.fn() });
    
    await loader.loadAll();
    expect(mockKernel.registerPlugin).toHaveBeenCalledTimes(2);
  });

  test('loadAll 指定插件列表', async () => {
    const loader = new PluginLoader(mockKernel);
    
    loader.register('a', { name: 'a', dependencies: [], init: jest.fn(), start: jest.fn() });
    loader.register('b', { name: 'b', dependencies: [], init: jest.fn(), start: jest.fn() });
    loader.register('c', { name: 'c', dependencies: [], init: jest.fn(), start: jest.fn() });
    
    await loader.loadAll(['a', 'c']);
    expect(mockKernel.registerPlugin).toHaveBeenCalledTimes(2);
  });

  test('loadAll 忽略未注册的插件', async () => {
    const loader = new PluginLoader(mockKernel);
    loader.register('a', { name: 'a', dependencies: [], init: jest.fn(), start: jest.fn() });
    
    await loader.loadAll(['a', 'nonexistent']);
    expect(mockKernel.registerPlugin).toHaveBeenCalledTimes(1);
  });
});

describe('PluginLoader - 工具方法', () => {
  test('getInfo 返回插件信息', () => {
    const loader = new PluginLoader(mockKernel);
    loader.register('test', { name: 'test', version: '2.0.0', dependencies: ['base'], init: jest.fn() });
    
    const info = loader.getInfo('test');
    expect(info.name).toBe('test');
    expect(info.version).toBe('2.0.0');
  });

  test('getInfo 不存在返回 null', () => {
    const loader = new PluginLoader(mockKernel);
    expect(loader.getInfo('nonexistent')).toBeNull();
  });

  test('list 返回所有插件', () => {
    const loader = new PluginLoader(mockKernel);
    loader.register('a', { name: 'a', version: '1.0.0', dependencies: [] });
    loader.register('b', { name: 'b', version: '2.0.0', dependencies: ['a'] });
    
    const list = loader.list();
    expect(list).toHaveLength(2);
    expect(list.find(p => p.name === 'a')).toBeDefined();
    expect(list.find(p => p.name === 'b').dependencies).toEqual(['a']);
  });
});
