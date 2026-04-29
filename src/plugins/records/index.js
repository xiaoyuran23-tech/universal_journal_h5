/**
 * Records Plugin - 记录管理插件
 * 负责记录的 CRUD 操作、列表渲染、筛选
 * @version 6.0.0
 */
const RecordsPlugin = {
  name: 'records',
  version: '1.0.0',
  
  /**
   * 初始化插件
   */
  async init() {
    console.log('[RecordsPlugin] Initializing...');
    
    // 注册 Store 初始状态
    if (window.Store) {
      Store.dispatch({
        type: 'SET_STATE',
        payload: {
          records: {
            list: [],
            filtered: [],
            loading: false,
            error: null,
            filters: {
              tag: '',
              date: null,
              search: ''
            }
          }
        }
      });
    }
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[RecordsPlugin] Starting...');
    
    // 加载记录数据
    await this.loadRecords();
    
    // 绑定事件
    this._bindEvents();
  },

  /**
   * 停止插件
   */
  stop() {
    console.log('[RecordsPlugin] Stopping...');
  },

  /**
   * 路由定义
   */
  routes: [
    {
      path: 'home',
      title: '记录',
      component: 'records-list'
    },
    {
      path: 'editor',
      title: '编辑记录',
      component: 'record-editor'
    }
  ],

  /**
   * 视图定义 (v6.1 UX 迁移新增)
   */
  views: {
    'home-ux': {
      container: '#page-home',
      component: HomePage,
      theme: 'warm'
    }
  },

  /**
   * Actions (状态变更)
   */
  actions: {
    'records/add': (state, record) => {
      const newList = [record, ...state.records.list];
      return {
        ...state,
        records: {
          ...state.records,
          list: newList,
          filtered: newList
        }
      };
    },
    'records/update': (state, { id, updates }) => {
      const newList = state.records.list.map(item =>
        item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
      );
      return {
        ...state,
        records: { ...state.records, list: newList }
      };
    },
    'records/delete': (state, id) => {
      const newList = state.records.list.filter(item => item.id !== id);
      return {
        ...state,
        records: { ...state.records, list: newList }
      };
    },
    'records/filter': (state, filters) => {
      let filtered = [...state.records.list];
      
      // 标签筛选
      if (filters.tag) {
        filtered = filtered.filter(item => 
          item.tags && item.tags.includes(filters.tag)
        );
      }
      
      // 日期筛选
      if (filters.date) {
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.createdAt).toDateString();
          return itemDate === new Date(filters.date).toDateString();
        });
      }
      
      // 搜索
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(item =>
          (item.name && item.name.toLowerCase().includes(search)) ||
          (item.notes && item.notes.toLowerCase().includes(search)) ||
          (item.tags && item.tags.some(t => t.toLowerCase().includes(search)))
        );
      }
      
      return {
        ...state,
        records: {
          ...state.records,
          filtered,
          filters
        }
      };
    }
  },

  /**
   * 加载记录数据
   */
  async loadRecords() {
    try {
      Store.dispatch({
        type: 'SET_STATE',
        payload: { records: { ...Store.getState('records'), loading: true } }
      });

      // 从存储加载
      let records = [];
      if (window.StorageBackend) {
        records = await StorageBackend.getAll();
      } else if (window.IDBModule) {
        records = await IDBModule.getAll();
      } else {
        // 从 localStorage 加载
        const saved = localStorage.getItem('journal_records');
        records = saved ? JSON.parse(saved) : [];
      }

      // 数据标准化
      records = records.map(this._normalizeRecord);

      Store.dispatch({
        type: 'SET_STATE',
        payload: {
          records: {
            list: records,
            filtered: records,
            loading: false
          }
        }
      });

      console.log(`[RecordsPlugin] Loaded ${records.length} records`);
      
      // 触发加载完成事件
      if (window.EventBus) {
        EventBus.emit('records:loaded', { count: records.length });
      }

    } catch (error) {
      console.error('[RecordsPlugin] Failed to load records:', error);
      Store.dispatch({
        type: 'SET_STATE',
        payload: {
          records: {
            ...Store.getState('records'),
            loading: false,
            error: error.message
          }
        }
      });
    }
  },

  /**
   * 创建记录
   * @param {Object} recordData
   * @returns {Object} 创建的记录
   */
  async createRecord(recordData) {
    const record = {
      id: this._generateId(),
      name: recordData.name || '未命名',
      tags: recordData.tags || [],
      notes: recordData.notes || '',
      photos: recordData.photos || [],
      location: recordData.location || null,
      favorite: false,
      status: recordData.status || 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      _dataVersion: '6.0.0'
    };

    // 保存到存储
    if (window.StorageBackend) {
      await StorageBackend.put(record);
    } else if (window.IDBModule) {
      await IDBModule.put(record);
    }

    // 更新状态
    Store.dispatch({
      type: 'records/add',
      payload: record
    });

    // 触发事件
    if (window.EventBus) {
      EventBus.emit('records:created', record);
    }

    console.log('[RecordsPlugin] Record created:', record.id);
    return record;
  },

  /**
   * 更新记录
   * @param {string} id
   * @param {Object} updates
   */
  async updateRecord(id, updates) {
    // 保存到存储
    if (window.StorageBackend) {
      const existing = await StorageBackend.get(id);
      if (existing) {
        await StorageBackend.put({ ...existing, ...updates, updatedAt: Date.now() });
      }
    } else if (window.IDBModule) {
      const existing = await IDBModule.get(id);
      if (existing) {
        await IDBModule.put({ ...existing, ...updates, updatedAt: Date.now() });
      }
    }

    // 更新状态
    Store.dispatch({
      type: 'records/update',
      payload: { id, updates: { ...updates, updatedAt: Date.now() } }
    });

    // 触发事件
    if (window.EventBus) {
      EventBus.emit('records:updated', { id, updates });
    }
  },

  /**
   * 删除记录 (移至回收站)
   * @param {string} id
   */
  async deleteRecord(id) {
    // 从存储删除
    if (window.StorageBackend) {
      await StorageBackend.delete(id);
    } else if (window.IDBModule) {
      await IDBModule.delete(id);
    }

    // 更新状态
    Store.dispatch({
      type: 'records/delete',
      payload: id
    });

    // 触发事件
    if (window.EventBus) {
      EventBus.emit('records:deleted', { id });
    }
  },

  /**
   * 筛选记录
   * @param {Object} filters
   */
  filterRecords(filters) {
    Store.dispatch({
      type: 'records/filter',
      payload: filters
    });
  },

  /**
   * 标准化记录数据
   * @private
   */
  _normalizeRecord(record) {
    // 确保必要字段存在
    return {
      id: record.id || this._generateId(),
      name: record.name || '未命名',
      tags: Array.isArray(record.tags) ? record.tags : [],
      notes: record.notes || '',
      photos: Array.isArray(record.photos) ? record.photos : [],
      location: record.location || null,
      favorite: !!record.favorite,
      status: record.status || 'active',
      createdAt: record.createdAt || Date.now(),
      updatedAt: record.updatedAt || Date.now(),
      _dataVersion: record._dataVersion || '6.0.0'
    };
  },

  /**
   * 生成唯一 ID
   * @private
   */
  _generateId() {
    return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    // 监听存储变化
    if (window.EventBus) {
      EventBus.on('storage:changed', () => {
        this.loadRecords();
      });
    }
  }
};

// 全局暴露
window.RecordsPlugin = RecordsPlugin;

console.log('[RecordsPlugin] 记录管理插件已定义');
