/**
 * Profile Plugin - 个人页面统一插件
 * 整合认证展示、昵称编辑、个人统计、设置导航入口
 * @version 7.0.3
 */

if (!window.ProfilePlugin) {
const ProfilePlugin = {
  name: 'profile',
  version: '1.0.0',
  dependencies: [],

  _eventsBound: false,
  _isEditing: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[ProfilePlugin] Initializing...');
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[ProfilePlugin] Starting...');
    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
    this._updateUI();
  },

  /**
   * 停止插件
   */
  stop() {
    this._eventsBound = false;
  },

  /**
   * 绑定所有事件
   * @private
   */
  _bindEvents() {
    // === 昵称编辑 ===
    const editBtn = document.getElementById('profile-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this._startEditing());
    }

    const saveBtn = document.getElementById('profile-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this._saveNickname());
    }

    const nameInput = document.getElementById('profile-name-input');
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._saveNickname();
        if (e.key === 'Escape') this._cancelEditing();
      });
    }

    // === 登录按钮 ===
    const loginBtn = document.getElementById('profile-login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        if (window.AuthPlugin) AuthPlugin.showLoginModal();
      });
    }

    // === 登出事件监听 ===
    document.addEventListener('auth:logout', () => this._updateUI());
    document.addEventListener('auth:login', () => this._updateUI());

    // === 心情打卡 ===
    const moodBtn = document.querySelector('[data-mood-checkin]');
    if (moodBtn) {
      moodBtn.addEventListener('click', () => {
        if (window.MoodPlugin && typeof MoodPlugin._showMoodPickerModal === 'function') {
          MoodPlugin._showMoodPickerModal();
        }
      });
    }

    // === 数据操作 ===
    this._bindDataButtons();

    // === 设置导航 ===
    this._bindSettingsNavigation();
  },

  /**
   * 更新 UI 显示（登录状态、昵称等）
   */
  _updateUI() {
    const isLoggedIn = window.AuthPlugin?.isLoggedIn || false;
    const user = window.AuthPlugin?.currentUser || null;

    const displayName = document.getElementById('profile-display-name');
    const nameContainer = document.querySelector('.profile-name-container');
    const loginBtn = document.getElementById('profile-login-btn');
    const editBtn = document.getElementById('profile-edit-btn');
    const accountSection = document.getElementById('account-section');

    if (isLoggedIn && user) {
      if (displayName) displayName.textContent = user.nickname || '手札用户';
      if (nameContainer) nameContainer.style.display = 'flex';
      if (loginBtn) loginBtn.style.display = 'none';
      if (editBtn) editBtn.style.display = 'inline-flex';
      if (accountSection) accountSection.style.display = 'block';
    } else {
      if (displayName) displayName.textContent = '未登录';
      if (nameContainer) nameContainer.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'flex';
      if (editBtn) editBtn.style.display = 'none';
      if (accountSection) accountSection.style.display = 'none';
    }

    // 云同步按钮文案
    const syncConfig = document.getElementById('settings-cloud-config');
    if (syncConfig) {
      const span = syncConfig.querySelector('span');
      if (span) span.textContent = isLoggedIn ? '云同步设置' : '登录以同步';
    }
  },

  /**
   * 开始编辑昵称
   * @private
   */
  _startEditing() {
    const displayName = document.getElementById('profile-display-name');
    const nameInput = document.getElementById('profile-name-input');
    const saveBtn = document.getElementById('profile-save-btn');
    const editBtn = document.getElementById('profile-edit-btn');
    const nameContainer = document.querySelector('.profile-name-container');

    if (!displayName || !nameInput || !saveBtn || !editBtn) return;

    this._isEditing = true;
    nameInput.value = displayName.textContent || '';
    displayName.style.display = 'none';
    editBtn.style.display = 'none';
    nameInput.style.display = 'block';
    saveBtn.style.display = 'block';
    if (nameContainer) nameContainer.style.display = 'flex';
    nameInput.focus();
    nameInput.select();
  },

  /**
   * 保存昵称
   * @private
   */
  async _saveNickname() {
    const nameInput = document.getElementById('profile-name-input');
    const displayName = document.getElementById('profile-display-name');
    const saveBtn = document.getElementById('profile-save-btn');
    const editBtn = document.getElementById('profile-edit-btn');
    const nameContainer = document.querySelector('.profile-name-container');

    if (!nameInput || !displayName || !saveBtn || !editBtn) return;

    const newName = nameInput.value.trim() || '手札用户';

    // v7.0.3: 已登录时同步到服务器，失败则不更新本地状态
    if (window.AuthPlugin?.isLoggedIn) {
      try {
        await AuthPlugin.updateProfile({ nickname: newName });
      } catch (e) {
        console.warn('[ProfilePlugin] Failed to sync nickname to server:', e.message);
        this._showToast('昵称同步失败: ' + e.message);
        this._cancelEditing();
        return;
      }
    }

    // 更新本地显示（服务器确认成功后才执行）
    displayName.textContent = newName;

    this._isEditing = false;
    displayName.style.display = '';
    editBtn.style.display = 'inline-flex';
    nameInput.style.display = 'none';
    saveBtn.style.display = 'none';
    if (nameContainer) nameContainer.style.display = 'flex';

    // 同步更新 AuthPlugin 中的用户信息（updateProfile 已更新过，此处兜底）
    if (window.AuthPlugin && AuthPlugin._user) {
      AuthPlugin._user = { ...AuthPlugin._user, nickname: newName };
    }

    this._showToast('昵称已保存');
  },

  /**
   * 取消编辑
   * @private
   */
  _cancelEditing() {
    const displayName = document.getElementById('profile-display-name');
    const nameInput = document.getElementById('profile-name-input');
    const saveBtn = document.getElementById('profile-save-btn');
    const editBtn = document.getElementById('profile-edit-btn');
    const nameContainer = document.querySelector('.profile-name-container');

    if (!displayName || !nameInput || !saveBtn || !editBtn) return;

    this._isEditing = false;
    displayName.style.display = '';
    editBtn.style.display = 'inline-flex';
    nameInput.style.display = 'none';
    saveBtn.style.display = 'none';
    if (nameContainer) nameContainer.style.display = 'flex';
  },

  /**
   * 绑定数据操作按钮
   * @private
   */
  _bindDataButtons() {
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this._exportData('json'));
    }

    const importBtn = document.getElementById('import-data-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => this._importData('json'));
    }

    // Markdown 按钮由 MarkdownPlugin 自行绑定（含冲突检测预览），此处不重复绑定

    const clearBtn = document.getElementById('clear-all-data-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this._confirmClearData());
    }
  },

  /**
   * 导出数据
   * @param {string} format - 'json' | 'markdown'
   * @private
   */
  async _exportData(format) {
    try {
      let data, filename, mime;

      if (format === 'markdown' && window.MarkdownPlugin) {
        data = await MarkdownPlugin.exportAllAsMarkdown();
        filename = `万物手札_${this._dateStr()}.md`;
        mime = 'text/markdown';
      } else {
        const records = window.Store?.getState('records.list') || [];
        data = JSON.stringify(records, null, 2);
        filename = `万物手札_${this._dateStr()}.json`;
        mime = 'application/json';
      }

      const blob = new Blob([data], { type: `${mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      this._showToast('导出成功');
    } catch (e) {
      console.error('[ProfilePlugin] Export failed:', e);
      this._showToast('导出失败: ' + e.message);
    }
  },

  /**
   * 导入数据
   * @param {string} format - 'json' | 'markdown'
   * @private
   */
  async _importData(format) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = format === 'markdown' ? '.md,.markdown' : '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();

        if (format === 'markdown' && window.MarkdownPlugin) {
          await MarkdownPlugin.importFromMarkdown(text);
        } else {
          const records = JSON.parse(text);
          if (!Array.isArray(records)) throw new Error('无效的数据格式');

          if (window.StorageBackend) {
            for (const record of records) {
              await StorageBackend.put(record);
            }
          }
          if (window.RecordsPlugin) {
            await RecordsPlugin.loadRecords();
          }
        }

        this._showToast(`导入成功，共 ${records.length} 条记录`);
      } catch (err) {
        console.error('[ProfilePlugin] Import failed:', err);
        this._showToast('导入失败: ' + err.message);
      }
    };

    input.click();
  },

  /**
   * 确认清空数据
   * @private
   */
  async _confirmClearData() {
    if (!confirm('确定要清空所有数据吗？此操作不可撤销。')) return;
    if (!confirm('再次确认：清空后所有记录将永久丢失，是否继续？')) return;

    try {
      if (window.StorageBackend) {
        await StorageBackend.clear();
      }
      if (window.Store) {
        window.Store.dispatch({
          type: 'SET_STATE',
          payload: { records: { list: [], filtered: [], loading: false } }
        });
      }
      this._showToast('数据已清空');
    } catch (e) {
      console.error('[ProfilePlugin] Clear failed:', e);
      this._showToast('清空失败: ' + e.message);
    }
  },

  /**
   * 绑定设置导航按钮
   * @private
   */
  _bindSettingsNavigation() {
    // 回收站按钮已由 main.js initUI 绑定（含渲染逻辑），此处不重复

    const templateBtn = document.getElementById('manage-templates-btn');
    if (templateBtn) {
      templateBtn.addEventListener('click', () => {
        if (window.Router) Router.navigate('template-manager');
        if (window.TemplatesPlugin) {
          TemplatesPlugin.renderTemplateManager('template-manager-container');
        }
      });
    }

    const cloudBtn = document.getElementById('settings-cloud-config');
    if (cloudBtn) {
      cloudBtn.addEventListener('click', () => {
        if (window.AuthPlugin && !AuthPlugin.isLoggedIn) {
          AuthPlugin.showLoginModal();
          return;
        }
        const modal = document.getElementById('cloud-modal');
        if (modal) {
          if (window.AutoSyncPlugin) AutoSyncPlugin._updateSyncStatusUI();
          modal.style.display = 'flex';
        }
      });
    }

    const themeBtn = document.getElementById('settings-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        if (window.ThemePlugin) {
          ThemePlugin.toggleTheme();
        } else {
          const current = document.documentElement.getAttribute('data-theme') || 'warm';
          const next = current === 'warm' ? 'dark' : 'warm';
          document.documentElement.setAttribute('data-theme', next);
          document.body.setAttribute('data-theme', next);
          localStorage.setItem('app_theme', next);
          this._showToast(`已切换到${next === 'warm' ? '暖色' : '深色'}主题`);
        }
      });
    }

    const statsBtn = document.getElementById('settings-stats');
    if (statsBtn) {
      statsBtn.addEventListener('click', () => {
        const records = window.Store?.getState('records.list') || [];
        const total = records.length;
        const favorites = records.filter(r => r.favorite).length;
        const words = records.reduce((sum, r) => sum + (r.notes?.replace(/<[^>]*>/g, '').length || 0), 0);
        alert(`数据统计\n\n总记录数：${total}\n收藏记录：${favorites}\n总字数：${words.toLocaleString()}`);
      });
    }

    const aboutBtn = document.getElementById('settings-about');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        alert('万物手札 v7.1.0\n\n记录世间万物\n\n一个纯前端的 PWA 日记应用');
      });
    }

    // === 账号管理 (v7.1.0) ===
    const logoutBtn = document.getElementById('settings-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
          AuthPlugin.logout();
        }
      });
    }

    const changePwBtn = document.getElementById('settings-change-password');
    if (changePwBtn) {
      changePwBtn.addEventListener('click', () => this._showChangePasswordModal());
    }

    const deleteAcctBtn = document.getElementById('settings-delete-account');
    if (deleteAcctBtn) {
      deleteAcctBtn.addEventListener('click', () => this._showDeleteAccountModal());
    }
  },

  /**
   * 工具方法
   * @private
   */
  _dateStr() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  },

  _showToast(msg) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(msg, { duration: 2000 });
    } else {
      const toast = document.getElementById('toast');
      if (toast) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
    }
  },

  /**
   * 显示修改密码弹窗 (v7.1.0)
   * @private
   */
  _showChangePasswordModal() {
    if (!AuthPlugin.isLoggedIn) {
      this._showToast('请先登录');
      return;
    }
    const existing = document.getElementById('change-password-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'change-password-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:400px;padding:24px;">
        <h3 style="margin:0 0 16px;">修改密码</h3>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;font-size:14px;">当前密码</label>
          <input type="password" id="cp-current-password" placeholder="输入当前密码" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;font-size:14px;">新密码</label>
          <input type="password" id="cp-new-password" placeholder="至少 6 位" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;">
        </div>
        <div id="cp-status" style="margin-top:8px;font-size:13px;text-align:center;min-height:20px;"></div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button id="cp-cancel-btn" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;">取消</button>
          <button id="cp-submit-btn" style="flex:1;padding:10px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;">确认修改</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#cp-cancel-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#cp-submit-btn')?.addEventListener('click', async () => {
      const currentPw = modal.querySelector('#cp-current-password').value;
      const newPw = modal.querySelector('#cp-new-password').value;
      const statusEl = modal.querySelector('#cp-status');
      if (!currentPw || !newPw) { statusEl.textContent = '请填写所有字段'; statusEl.style.color = '#ff4d4f'; return; }
      if (newPw.length < 6) { statusEl.textContent = '新密码至少 6 位'; statusEl.style.color = '#ff4d4f'; return; }
      statusEl.textContent = '修改中...'; statusEl.style.color = '#666';
      try {
        await AuthPlugin.changePassword(currentPw, newPw);
        modal.remove();
        this._showToast('密码已修改成功');
      } catch (e) {
        statusEl.textContent = e.message; statusEl.style.color = '#ff4d4f';
      }
    });
  },

  /**
   * 显示删除账号弹窗 (v7.1.0)
   * @private
   */
  _showDeleteAccountModal() {
    if (!AuthPlugin.isLoggedIn) {
      this._showToast('请先登录');
      return;
    }
    const existing = document.getElementById('delete-account-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'delete-account-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:400px;padding:24px;">
        <h3 style="margin:0 0 8px;color:#ff4d4f;">删除账号</h3>
        <p style="margin:0 0 16px;color:#999;font-size:14px;">此操作不可撤销！所有数据和记录将被永久删除。</p>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:4px;font-size:14px;">输入密码确认身份</label>
          <input type="password" id="da-password" placeholder="输入你的登录密码" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;">
        </div>
        <div id="da-status" style="margin-top:8px;font-size:13px;text-align:center;min-height:20px;"></div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button id="da-cancel-btn" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;">取消</button>
          <button id="da-submit-btn" style="flex:1;padding:10px;border:none;border-radius:8px;background:#ff4d4f;color:#fff;cursor:pointer;">永久删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#da-cancel-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#da-submit-btn')?.addEventListener('click', async () => {
      const password = modal.querySelector('#da-password').value;
      const statusEl = modal.querySelector('#da-status');
      if (!password) { statusEl.textContent = '请输入密码'; statusEl.style.color = '#ff4d4f'; return; }
      if (!confirm('再次确认：删除后所有数据将永久丢失，无法恢复。是否继续？')) return;
      statusEl.textContent = '删除中...'; statusEl.style.color = '#666';
      try {
        await AuthPlugin.deleteAccount(password);
        modal.remove();
        this._showToast('账号已删除');
      } catch (e) {
        statusEl.textContent = e.message; statusEl.style.color = '#ff4d4f';
      }
    });
  },
};

window.ProfilePlugin = ProfilePlugin;
console.log('[ProfilePlugin] 个人页面插件已定义 (v7.0.3)');
} else {
  console.log('[ProfilePlugin] 已存在，跳过重复加载');
}
