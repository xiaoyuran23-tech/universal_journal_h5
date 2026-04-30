/**
 * MigrationAdapter - 迁移适配器
 * 负责在新旧系统之间同步数据和事件，确保迁移期体验一致
 * @version 6.2.0
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

    // 1. 拦截 StorageBackend 方法，实现旧 → 新的数据同步
    this._interceptStorageBackend();

    // 2. 订阅 Store 变化，触发旧 App 刷新
    this._bindNewToOld();

    // 3. 初始数据同步
    await this._initialSync();

    console.log('[MigrationAdapter] Synchronization established');
  }

  /**
   * 拦截 StorageBackend 的 put/delete/save 方法
   * 所有数据变更都经过这里，确保同步到 v6 Store
   * @private
   */
  _interceptStorageBackend() {
    if (!window.StorageBackend) {
      console.warn('[MigrationAdapter] StorageBackend not found, skipping interception');
      return;
    }

    // 拦截 put (create/update)
    const originalPut = StorageBackend.put?.bind(StorageBackend);
    if (originalPut) {
      StorageBackend.put = async (item) => {
        const result = await originalPut(item);
        if (item && item.id) {
          this._syncItemToStore(item);
        }
        return result;
      };
    }

    // 拦截 delete
    const originalDelete = StorageBackend.delete?.bind(StorageBackend);
    if (originalDelete) {
      StorageBackend.delete = async (id) => {
        const result = await originalDelete(id);
        if (id) {
          this._store.dispatch({ type: 'records/delete', payload: id });
        }
        return result;
      };
    }

    // 拦截 save (批量保存，用于导入/同步)
    const originalSave = StorageBackend.save?.bind(StorageBackend);
    if (originalSave) {
      StorageBackend.save = async (items) => {
        const result = await originalSave(items);
        if (items && Array.isArray(items)) {
          this._store.dispatch({ type: 'SET_STATE', payload: {
            records: { list: [...items], filtered: [...items], loading: false }
          }});
        }
        return result;
      };
    }
  }

  /**
   * 将单条记录同步到 v6 Store
   * @private
   */
  _syncItemToStore(item) {
    const currentList = this._store.getState('records.list') || [];
    const existingIndex = currentList.findIndex(r => r.id === item.id);

    if (existingIndex >= 0) {
      // 更新：替换现有项
      const newList = [...currentList];
      newList[existingIndex] = { ...item };
      this._store.dispatch({
        type: 'SET_STATE',
        payload: { records: { list: newList, filtered: [...newList], loading: false } }
      });
    } else {
      // 新增：添加到列表
      const newList = [...currentList, { ...item }];
      this._store.dispatch({
        type: 'SET_STATE',
        payload: { records: { list: newList, filtered: [...newList], loading: false } }
      });
    }
  }

  /**
   * 绑定新 → 旧
   * 订阅 Store 变化，将数据注入旧 App 并触发重新渲染
   * @private
   */
  _bindNewToOld() {
    this._store.subscribe((newState, prevState) => {
      const recordsChanged = newState.records !== prevState.records;
      if (recordsChanged && this._oldApp) {
        this._oldApp.items = newState.records.list;
        this._oldApp.filteredItems = newState.records.filtered;
        if (typeof this._oldApp.renderItems === 'function') {
          this._oldApp.renderItems();
        }
      }
    });
  }

  /**
   * 初始数据同步
   * 优先使用 StorageBackend (IndexedDB)，降级到 localStorage
   * @private
   */
  async _initialSync() {
    try {
      console.log('[MigrationAdapter] Initial sync starting...');

      let data = [];
      if (window.StorageBackend) {
        data = await StorageBackend.getAll();
      }

      if (data && data.length > 0) {
        this._store.dispatch({
          type: 'SET_STATE',
          payload: {
            records: {
              list: [...data],
              filtered: [...data],
              loading: false
            }
          }
        });
        console.log(`[MigrationAdapter] Synced ${data.length} items from storage`);
      }
    } catch (error) {
      console.error('[MigrationAdapter] Initial sync failed:', error);
    }
  }
}

window.MigrationAdapter = MigrationAdapter;
console.log('[MigrationAdapter] 迁移适配器已定义');
