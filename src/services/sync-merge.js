/**
 * SyncMerge - 共享同步合并模块
 * 提供 Vector Clock 冲突检测和字段级合并
 * @version 6.4.0
 */

if (!window.SyncMerge) {
const SyncMerge = {

  /**
   * 获取所有记录（统一数据源）
   */
  async _getAllRecords() {
    if (window.StorageService && StorageService.getAll) {
      return await StorageService.getAll();
    }
    if (window.Store) {
      return window.Store.getState('records.list') || [];
    }
    return [];
  },

  /**
   * 保存单条记录
   */
  async _saveRecord(record) {
    if (window.StorageService && StorageService.put) {
      await StorageService.put(record);
    } else if (window.Store) {
      window.Store.dispatch({ type: 'records/update', id: record.id, payload: record });
    }
  },

  /**
   * 为记录分配 Vector Clock
   * 调用时机：每次本地创建或更新记录时
   * @param {Object} record
   * @param {string} deviceId - 设备唯一标识（从 localStorage 读取）
   */
  assignVectorClock(record, deviceId) {
    const clock = record._vectorClock || {};
    clock[deviceId] = (clock[deviceId] || 0) + 1;
    record._vectorClock = clock;
    record._deviceId = deviceId;
    return record;
  },

  /**
   * 获取或创建设备 ID
   * @returns {string}
   */
  getDeviceId() {
    let id = localStorage.getItem('_uj_device_id');
    if (!id) {
      id = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('_uj_device_id', id);
    }
    return id;
  },

  /**
   * 比较两个 Vector Clock
   * @returns {'ahead' | 'behind' | 'concurrent' | 'equal'}
   *   - ahead: local 更新，remote 落后
   *   - behind: remote 更新，local 落后
   *   - concurrent: 两个设备各自有对方不知道的更新（冲突）
   *   - equal: 完全同步
   */
  compareClocks(localClock, remoteClock) {
    const allDevices = new Set([...Object.keys(localClock || {}), ...Object.keys(remoteClock || {})]);

    let localAhead = false;
    let remoteAhead = false;

    for (const device of allDevices) {
      const localCount = (localClock || {})[device] || 0;
      const remoteCount = (remoteClock || {})[device] || 0;

      if (localCount > remoteCount) localAhead = true;
      if (remoteCount > localCount) remoteAhead = true;
    }

    if (localAhead && remoteAhead) return 'concurrent';
    if (localAhead) return 'ahead';
    if (remoteAhead) return 'behind';
    return 'equal';
  },

  /**
   * 字段级合并（并发冲突时使用）
   * 只对冲突的字段使用 LWW，非冲突字段保留各自值
   * @param {Object} local
   * @param {Object} remote
   * @returns {Object} 合并后的记录
   */
  _fieldLevelMerge(local, remote) {
    const merged = { ...local }; // 以本地为基准
    const mergeableFields = ['notes', 'tags', 'mood', 'status', 'photos', 'title'];

    for (const field of mergeableFields) {
      const localVal = JSON.stringify(local[field]);
      const remoteVal = JSON.stringify(remote[field]);

      if (localVal !== remoteVal) {
        // 字段冲突：用 updatedAt 决定
        const remoteTime = new Date(remote.updatedAt || 0).getTime();
        const localTime = new Date(local.updatedAt || 0).getTime();
        merged[field] = remoteTime > localTime ? remote[field] : local[field];
      }
      // 字段相同，保留本地值（无需合并）
    }

    return merged;
  },

  /**
   * 合并记录（主入口）
   * 使用 Vector Clock 代替纯 wall-clock 比较
   * @param {Array} remoteRecords
   * @param {string} strategy - 'lww' | 'remote_wins' | 'local_wins' | 'field_merge'
   * @returns {Promise<{merged: number, conflicts: number}>}
   */
  async mergeRecords(remoteRecords, strategy = 'field_merge') {
    const localRecords = await this._getAllRecords();
    const localMap = new Map(localRecords.map(r => [r.id, r]));
    let mergedCount = 0;
    let conflictCount = 0;

    for (const remote of remoteRecords) {
      const local = localMap.get(remote.id);

      if (!local) {
        // 本地不存在，直接添加
        await this._saveRecord(remote);
        mergedCount++;
        continue;
      }

      // 记录相同，检查版本
      const localClock = local._vectorClock || {};
      const remoteClock = remote._vectorClock || {};
      const comparison = this.compareClocks(localClock, remoteClock);

      if (comparison === 'equal') {
        // 版本一致，跳过
        continue;
      }

      if (comparison === 'behind') {
        // 本地落后，使用远程
        await this._saveRecord(remote);
        mergedCount++;
        continue;
      }

      if (comparison === 'ahead') {
        // 本地领先，保留本地
        continue;
      }

      // concurrent — 冲突！根据策略处理
      conflictCount++;

      switch (strategy) {
        case 'remote_wins':
          await this._saveRecord(remote);
          mergedCount++;
          break;

        case 'local_wins':
          // 保留本地，不操作
          break;

        case 'lww':
          const remoteTime = new Date(remote.updatedAt || 0).getTime();
          const localTime = new Date(local.updatedAt || 0).getTime();
          if (remoteTime > localTime) {
            await this._saveRecord(remote);
            mergedCount++;
          }
          break;

        case 'field_merge':
        default:
          const merged = this._fieldLevelMerge(local, remote);
          merged._vectorClock = this._mergeClocks(localClock, remoteClock);
          await this._saveRecord(merged);
          mergedCount++;
          break;
      }
    }

    return { merged: mergedCount, conflicts: conflictCount };
  },

  /**
   * 合并两个 Vector Clock（取每个设备的最大值）
   * @private
   */
  _mergeClocks(a, b) {
    const merged = { ...a };
    for (const [device, count] of Object.entries(b || {})) {
      merged[device] = Math.max(merged[device] || 0, count);
    }
    return merged;
  }
};

window.SyncMerge = SyncMerge;
console.log('[SyncMerge] 共享同步合并模块已加载');
}
