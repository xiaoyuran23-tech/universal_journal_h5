/**
 * Controller Plugin - 应用控制器
 * 替代 js/app.js 的页面协调和事件中枢功能
 * @version 6.1.0
 */

if (!window.ControllerPlugin) {
const ControllerPlugin = {
  name: 'controller',
  version: '1.0.0',
  dependencies: ['records', 'calendar', 'timeline', 'editor', 'favorites', 'templates', 'sync', 'settings', 'security', 'trash', 'batch', 'draft', 'tags', 'visuals', 'theme', 'search'],

  _eventsBound: false,
  currentPhotos: [],
  totalSavedBytes: 0,

  async init() {
    console.log('[ControllerPlugin] Initializing...');
  },

  async start() {
    console.log('[ControllerPlugin] Starting...');
    this._bindNavigation();
    this._bindFAB();
    this._bindSearch();
    this._bindProfile();
    this._bindDataOperations();
    this._bindTemplateBottomSheet();
    this._bindFormButtons();
    this._bindDetailButtons();
    this._bindSettingsButtons();
    this._bindMarkdownButtons();
    this._bindSyncButtons();
    this._bindThemeToggle();
    this._bindVisuals();
    this._bindTemplateManager();
    this._bindCalendarBack();

    // 启动草稿恢复
    if (window.DraftPlugin) {
      const draft = DraftPlugin.getDraft();
      if (draft) {
        DraftPlugin.showRestorePrompt(() => {
          if (window.Router) Router.navigate('form');
        });
      }
    }

    // 初始化回收站
    if (window.TrashPlugin) {
      TrashPlugin.start();
    }

    // 重新绑定搜索输入框（HomePage 可能已渲染并创建了 #search-input）
    if (window.SearchPlugin && SearchPlugin.rebind) {
      SearchPlugin.rebind();
    }
  },

  stop() {
    this._eventsBound = false;
  },

  /**
   * 绑定 Tab 导航
   * @private
   */
  _bindNavigation() {
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        if (!page) return;

        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (window.Router) {
          Router.navigate(page);
        }

        // 退出批量模式
        if (window.BatchPlugin && BatchPlugin.isBatchMode) {
          BatchPlugin.exitBatchMode();
        }
      });
    });
  },

  /**
   * 绑定 FAB 按钮
   * @private
   */
  _bindFAB() {
    const fab = document.getElementById('fab-add');
    if (fab) {
      fab.addEventListener('click', () => {
        if (window.Router) Router.navigate('form');
      });
    }
  },

  /**
   * 绑定搜索
   * @private
   */
  _bindSearch() {
    // 搜索功能已委托给 SearchPlugin，此处不再重复绑定
    // SearchPlugin 在 start() 中自行绑定输入框事件
  },

  /**
   * 绑定个人资料
   * @private
   */
  _bindProfile() {
    const editBtn = document.getElementById('profile-edit-btn');
    const saveBtn = document.getElementById('profile-save-btn');
    const nameInput = document.getElementById('profile-name-input');
    const displayName = document.getElementById('profile-display-name');

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (displayName) displayName.style.display = 'none';
        if (nameInput) {
          nameInput.style.display = 'block';
          nameInput.value = displayName?.textContent || '';
          nameInput.focus();
        }
        if (saveBtn) saveBtn.style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const newName = nameInput?.value?.trim();
        if (newName) {
          localStorage.setItem('universal_journal_username', newName);
          if (displayName) displayName.textContent = newName;
        }
        if (displayName) displayName.style.display = 'block';
        if (nameInput) nameInput.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (editBtn) editBtn.style.display = 'block';
        this._showToast('昵称已更新');
      });
    }
  },

  /**
   * 绑定数据操作（导入/导出/清空）
   * @private
   */
  _bindDataOperations() {
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const clearBtn = document.getElementById('clear-all-data-btn');
    const aboutBtn = document.getElementById('settings-about');

    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const records = window.Store ? window.Store.getState('records.list') : [];
        const data = {
          version: '6.1.0',
          exportDate: new Date().toISOString(),
          count: records.length,
          records
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._showToast('导出成功');
      });
    }

    if (importBtn) {
      importBtn.addEventListener('click', () => {
        const input = document.getElementById('import-file-input');
        if (input) input.click();
      });

      const fileInput = document.getElementById('import-file-input');
      if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const text = await file.text();
          try {
            const data = JSON.parse(text);
            if (data.records && Array.isArray(data.records)) {
              for (const record of data.records) {
                if (window.StorageService) {
                  await StorageService.put(record);
                }
              }
              this._showToast(`已导入 ${data.records.length} 条记录`);
              if (window.Router) Router.navigate('home');
            }
          } catch (err) {
            this._showToast('导入失败：无效的文件格式');
          }
          fileInput.value = '';
        });
      }
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
        if (window.StorageService) {
          await StorageService.clear();
        }
        this._showToast('数据已清空');
        if (window.Router) Router.navigate('home');
      });
    }

    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        alert('万物手札 v6.1.0\n记录世间万物，收藏生活点滴');
      });
    }
  },

  /**
   * 绑定模板底部抽屉
   * @private
   */
  _bindTemplateBottomSheet() {
    const openBtn = document.getElementById('btn-use-template');
    const closeBtn = document.getElementById('close-template-sheet');
    const overlay = document.getElementById('template-bottom-sheet');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (overlay) overlay.style.display = 'flex';
        // 渲染模板列表
        if (window.TemplatesPlugin && TemplatesPlugin._renderBottomSheet) {
          TemplatesPlugin._renderBottomSheet();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (overlay) overlay.style.display = 'none';
      });
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      });
    }
  },

  /**
   * 绑定表单按钮（返回/保存模板）
   * @private
   */
  _bindFormButtons() {
    const backBtn = document.getElementById('create-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        // 明确返回首页，不依赖 back() 的历史栈行为
        if (window.Router) Router.navigate('home');
      });
    }

    const saveTemplateBtn = document.getElementById('btn-save-template');
    if (saveTemplateBtn) {
      saveTemplateBtn.addEventListener('click', () => {
        const name = document.getElementById('create-name')?.value?.trim();
        const notes = document.getElementById('create-rich-content')?.innerHTML || '';
        if (!name) {
          this._showToast('请先填写名称');
          return;
        }
        if (window.TemplatesPlugin) {
          TemplatesPlugin.saveTemplate({ name, notes });
          this._showToast('模板已保存');
        }
      });
    }
  },

  /**
   * 绑定详情页按钮
   * @private
   */
  _bindDetailButtons() {
    const backBtn = document.getElementById('detail-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.Router) Router.navigate('home');
      });
    }

    const favoriteBtn = document.getElementById('detail-favorite-btn');
    if (favoriteBtn) {
      favoriteBtn.addEventListener('click', async () => {
        const record = this._getCurrentRecord();
        if (!record) return;
        record.favorite = !record.favorite;
        if (window.StorageService) {
          await StorageService.put(record);
        }
        if (window.Store) {
          Store.dispatch({ type: 'records/update', payload: { id: record.id, updates: { favorite: record.favorite } } });
        }
        this._showToast(record.favorite ? '已收藏' : '已取消收藏');
        favoriteBtn.classList.toggle('active', record.favorite);
      });
    }

    const editBtn = document.getElementById('detail-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const record = this._getCurrentRecord();
        if (!record) return;
        if (window.Router) Router.navigate('editor', { id: record.id });
      });
    }

    const deleteBtn = document.getElementById('detail-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const record = this._getCurrentRecord();
        if (!record) return;
        if (!confirm('确定要删除这条记录吗？')) return;

        // 软删除：移至回收站
        if (window.TrashPlugin) {
          TrashPlugin.moveToTrash(record);
          this._showToast('已移至回收站');
        } else {
          // 硬删除
          if (window.RecordsPlugin) {
            await RecordsPlugin.deleteRecord(record.id);
          }
          this._showToast('记录已删除');
        }
        if (window.Router) Router.navigate('home');
      });
    }
  },

  /**
   * 绑定设置页按钮
   * @private
   */
  _bindSettingsButtons() {
    const lockBtn = document.getElementById('settings-lock');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        if (window.SecurityPlugin) {
          SecurityPlugin.lock();
        }
      });
    }

    const statsBtn = document.getElementById('settings-stats');
    if (statsBtn) {
      statsBtn.addEventListener('click', () => {
        if (window.Router) Router.navigate('stats');
      });
    }

    const trashBtn = document.getElementById('settings-trash');
    if (trashBtn) {
      trashBtn.addEventListener('click', () => {
        if (window.Router) Router.navigate('trash');
        if (window.TrashManager) {
          TrashManager.renderTrashList('trash-container');
        }
      });
    }
  },

  /**
   * 绑定 Markdown 导入/导出
   * MarkdownPlugin 已在 start() 中自行绑定，此处不重复
   * @private
   */
  _bindMarkdownButtons() {
    // MarkdownPlugin 已处理 export-markdown-btn 和 import-markdown-btn
  },

  /**
   * 绑定云端同步按钮
   * @private
   */
  _bindSyncButtons() {
    const cloudBtn = document.getElementById('settings-cloud-config');
    if (cloudBtn) {
      cloudBtn.addEventListener('click', () => {
        const modal = document.getElementById('cloud-modal');
        if (modal) modal.style.display = 'flex';
      });
    }

    const uploadBtn = document.getElementById('sync-upload');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', async () => {
        const statusEl = document.getElementById('sync-status');
        if (statusEl) statusEl.textContent = '上传中...';
        try {
          if (window.SyncPlugin) {
            await SyncPlugin.upload();
            if (statusEl) statusEl.textContent = '上传成功';
          }
        } catch (e) {
          if (statusEl) statusEl.textContent = '上传失败: ' + e.message;
        }
      });
    }

    const downloadBtn = document.getElementById('sync-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const statusEl = document.getElementById('sync-status');
        if (statusEl) statusEl.textContent = '下载中...';
        try {
          if (window.SyncPlugin) {
            await SyncPlugin.download();
            if (statusEl) statusEl.textContent = '下载成功';
          }
        } catch (e) {
          if (statusEl) statusEl.textContent = '下载失败: ' + e.message;
        }
      });
    }

    const syncSaveBtn = document.getElementById('sync-save-config');
    if (syncSaveBtn) {
      syncSaveBtn.addEventListener('click', () => {
        const gistId = document.getElementById('sync-gist-id')?.value;
        const token = document.getElementById('sync-token')?.value;
        const key = document.getElementById('sync-key')?.value;
        if (window.SyncPlugin) {
          SyncPlugin.saveConfig({ gistId, token, key });
          this._showToast('配置已保存');
        }
      });
    }

    // 关闭弹窗
    const closeBtn = document.getElementById('cloud-modal-close');
    const modal = document.getElementById('cloud-modal');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }
  },

  /**
   * 绑定主题切换
   * @private
   */
  _bindThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    const panel = document.getElementById('theme-panel');
    const overlay = document.getElementById('theme-overlay');
    const selectorPanel = document.getElementById('theme-selector-panel');

    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel) {
          const isVisible = panel.style.display === 'flex';
          panel.style.display = isVisible ? 'none' : 'flex';
        }
      });
    }

    if (overlay && selectorPanel) {
      overlay.addEventListener('click', () => {
        overlay.style.display = 'none';
        selectorPanel.style.display = 'none';
      });
    }

    // 主题选项
    const themeOptions = document.getElementById('theme-options');
    if (themeOptions) {
      themeOptions.addEventListener('click', (e) => {
        const option = e.target.closest('[data-theme]');
        if (option) {
          const theme = option.dataset.theme;
          document.documentElement.setAttribute('data-theme', theme);
          document.body.setAttribute('data-theme', theme);
          localStorage.setItem('app_theme', theme);
          if (panel) panel.style.display = 'none';
          this._showToast('主题已切换');
        }
      });
    }
  },

  /**
   * 绑定可视化图表
   * @private
   */
  _bindVisuals() {
    const container = document.getElementById('visuals-container');
    if (container && window.VisualsPlugin) {
      VisualsPlugin.render(container);
    }
  },

  /**
   * 绑定模板管理器
   * @private
   */
  _bindTemplateManager() {
    const manageBtn = document.getElementById('manage-templates-btn');
    const backBtn = document.getElementById('tm-back-btn');

    if (manageBtn) {
      manageBtn.addEventListener('click', () => {
        if (window.Router) Router.navigate('template-manager');
        if (window.TemplatesPlugin) {
          TemplatesPlugin.renderTemplateManager('template-manager-container');
        }
      });
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.Router) Router.navigate('profile');
      });
    }
  },

  /**
   * 绑定日历返回按钮
   * @private
   */
  _bindCalendarBack() {
    const backBtn = document.getElementById('cal-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        // 切换回日历月视图
        if (window.CalendarPlugin && CalendarPlugin._renderMonth) {
          CalendarPlugin._renderMonth();
        }
        if (window.Router) Router.back();
      });
    }
  },

  /**
   * 获取当前详情记录
   * @private
   */
  _getCurrentRecord() {
    // 从 DOM 中获取 record ID
    const body = document.getElementById('detail-body');
    if (body) return body._record || null;
    return null;
  },

  _showToast(message) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 2000 });
    } else {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
      }
    }
  }
};

window.ControllerPlugin = ControllerPlugin;
console.log('[ControllerPlugin] 应用控制器已定义');
}
