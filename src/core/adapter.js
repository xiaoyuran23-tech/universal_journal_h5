/**
 * MigrationAdapter - 迁移适配器
 * 负责在新旧系统之间同步数据和事件，确保迁移期体验一致
 * @version 6.0.0
 */

class MigrationAdapter {
  constructor(kernel, oldApp) {
    this._kernel = kernel;
    this._oldApp = oldApp;
    this._store = window.Store;
    this._isSyncing = false;
  }

  /**
   * 启动适配器
   */
  async start() {
    console.log('[MigrationAdapter] Starting synchronization...');

    // 1. 单向同步：旧 -> 新
    // 监听旧 App 的数据变化，更新到新 Store
    this._bindOldToNew();

    // 2. 单向同步：新 -> 旧
    // 监听新 Store 的变化，触发旧 App 刷新
    this._bindNewToOld();

    // 3. 初始数据同步
    await this._initialSync();

    console.log('[MigrationAdapter] Synchronization established');
  }

  /**
   * 绑定旧 -> 新
   * @private
   */
  _bindOldToNew() {
    if (!this._oldApp) return;

    // 假设旧 App 暴露了 EventBus 或特定方法
    // 这里通过 EventBus 监听（如果旧 App 支持）
    // 或者直接劫持旧 App 的方法
    
    // 方案 A: 劫持旧 App 的方法 (更可靠)
    const originalSave = this._oldApp.saveItem?.bind(this._oldApp);
    if (originalSave) {
      this._oldApp.saveItem = async (...args) => {
        const result = await originalSave(...args);
        // 同步到新 Store
        const item = args[0];
        if (item && item.id) {
          window.StorageService?.put(item).catch(e => console.error(e));
          this._store.dispatch({ type: 'records/add', payload: item });
        }
        return result;
      };
    }

    const originalDelete = this._oldApp.deleteItem?.bind(this._oldApp);
    if (originalDelete) {
      this._oldApp.deleteItem = async (...args) => {
        const result = await originalDelete(...args);
        const id = args[0];
        if (id) {
          window.StorageService?.delete(id).catch(e => console.error(e));
          this._store.dispatch({ type: 'records/delete', payload: id });
        }
        return result;
      };
    }
  }

  /**
   * 绑定新 -> 旧
   * @private
   */
  _bindNewToOld() {
    // 订阅 Store 变化
    this._store.subscribe((newState, prevState) => {
      // 检测 records 是否变化
      const recordsChanged = newState.records !== prevState.records;
      if (recordsChanged && this._oldApp) {
        // 触发旧 App 重新渲染
        // 假设旧 App 有 renderItems 方法
        if (typeof this._oldApp.renderItems === 'function') {
          // 将新 Store 的数据注入旧 App
          this._oldApp.items = newState.records.list;
          this._oldApp.filteredItems = newState.records.filtered;
          this._oldApp.renderItems();
        }
      }
    });
  }

  /**
   * 初始数据同步
   * @private
   */
  async _initialSync() {
    try {
      console.log('[MigrationAdapter] Initial sync starting...');
      
      // 从旧存储加载数据 (兼容逻辑)
      let oldData = [];
      if (window.StorageBackend) {
        oldData = await window.StorageBackend.getAll();
      }

      // 导入到新 Store
      if (oldData && oldData.length > 0) {
        this._store.dispatch({
          type: 'SET_STATE',
          payload: {
            records: {
              list: oldData,
              filtered: oldData,
              loading: false
            }
          }
        });
        console.log(`[MigrationAdapter] Synced ${oldData.length} items from legacy`);
      }
    } catch (error) {
      console.error('[MigrationAdapter] Initial sync failed:', error);
    }
  }
}

window.MigrationAdapter = MigrationAdapter;
console.log('[MigrationAdapter] 迁移适配器已定义');
