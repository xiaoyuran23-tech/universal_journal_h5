/**
 * Markdown Plugin - Markdown 导入/导出
 * 提供 .md/.txt 文件的导入导出功能，含导入预览和冲突检测
 * @version 6.2.0
 */

if (!window.MarkdownPlugin) {
const MarkdownPlugin = {
  name: 'markdown',
  version: '1.0.0',
  dependencies: ['controller'],

  async init() {
    console.log('[MarkdownPlugin] Initializing...');
  },

  async start() {
    console.log('[MarkdownPlugin] Starting...');
    this._bindExportBtn();
    this._bindImportBtn();
    this._createHiddenFileInput();
  },

  stop() {},

  /**
   * 绑定导出按钮
   * @private
   */
  _bindExportBtn() {
    const btn = document.getElementById('export-markdown-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        btn.textContent = '导出中...';
        const mdContent = await StorageService.exportMarkdown();
        this._downloadFile(mdContent, `journal-export-${this._dateStr()}.md`, 'text/markdown');
        this._showToast('Markdown 导出成功');
      } catch (e) {
        console.error('[MarkdownPlugin] Export failed:', e);
        this._showToast('导出失败: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '导出为 Markdown';
      }
    });
  },

  /**
   * 绑定导入按钮
   * @private
   */
  _bindImportBtn() {
    const btn = document.getElementById('import-markdown-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const input = document.getElementById('import-markdown-input');
      if (input) input.click();
    });
  },

  /**
   * 创建隐藏的文件输入
   * @private
   */
  _createHiddenFileInput() {
    let input = document.getElementById('import-markdown-input');
    if (input) return;

    input = document.createElement('input');
    input.type = 'file';
    input.id = 'import-markdown-input';
    input.accept = '.md,.txt,.markdown';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        await this._showImportPreview(text, file.name);
      } catch (err) {
        this._showToast('读取文件失败');
      }
      input.value = '';
    });
  },

  /**
   * 显示导入预览
   * @private
   */
  async _showImportPreview(content, fileName) {
    // 先解析内容获取统计信息
    const sections = StorageService._splitMarkdownRecords(content);
    let validCount = 0;
    const names = [];

    for (const section of sections) {
      const parsed = StorageService._parseMarkdownRecord(section);
      if (parsed) {
        validCount++;
        if (parsed.frontmatter.name) {
          names.push(parsed.frontmatter.name);
        }
      }
    }

    // 构建预览 HTML
    const modal = this._buildPreviewModal(validCount, names, fileName);
    document.body.appendChild(modal);

    // 绑定确认导入
    const confirmBtn = modal.querySelector('#md-import-confirm');
    const cancelBtn = modal.querySelector('#md-import-cancel');
    const overlay = modal.querySelector('.md-import-overlay');

    const close = () => modal.remove();

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    modal.querySelector('.md-modal-close-btn').addEventListener('click', close);

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '导入中...';
      try {
        const result = await StorageService.importMarkdown(content);
        close();
        this._showImportSummary(result);
        if (window.Router) window.Router.navigate('home');
      } catch (e) {
        close();
        this._showToast('导入失败: ' + e.message);
      }
    });
  },

  /**
   * 构建预览模态框
   * @private
   */
  _buildPreviewModal(count, names, fileName) {
    const div = document.createElement('div');
    div.className = 'md-import-overlay';
    div.innerHTML = `
      <div class="md-import-modal">
        <div class="md-modal-header">
          <h3>Markdown 导入预览</h3>
          <button class="md-modal-close-btn">&times;</button>
        </div>
        <div class="md-modal-body">
          <div class="md-import-info">
            <p><strong>文件:</strong> ${this._escapeHtml(fileName)}</p>
            <p><strong>检测到记录数:</strong> ${count} 条</p>
            ${names.length > 0 ? `
              <p><strong>记录名称:</strong></p>
              <ul class="md-record-names">
                ${names.slice(0, 10).map(n => '<li>' + this._escapeHtml(n) + '</li>').join('')}
                ${names.length > 10 ? '<li>... 等 ' + names.length + ' 条记录</li>' : ''}
              </ul>
            ` : ''}
            <p class="md-import-hint">导入将跳过与现有记录（名称+日期相同）重复的条目。</p>
          </div>
        </div>
        <div class="md-modal-footer">
          <button class="md-btn md-btn-cancel" id="md-import-cancel">取消</button>
          <button class="md-btn md-btn-confirm" id="md-import-confirm">确认导入 (${count} 条)</button>
        </div>
      </div>
    `;
    return div;
  },

  /**
   * 显示导入结果摘要
   * @private
   */
  _showImportSummary(result) {
    let msg = '导入完成';
    const details = [];
    if (result.success > 0) details.push('成功 ' + result.success + ' 条');
    if (result.conflicts.length > 0) details.push('跳过冲突 ' + result.conflicts.length + ' 条');
    if (result.failed > 0) details.push('失败 ' + result.failed + ' 条');
    if (details.length > 0) msg += ' (' + details.join(', ') + ')';
    this._showToast(msg);

    // 如果有冲突，显示详细信息
    if (result.conflicts.length > 0) {
      const conflictNames = result.conflicts.slice(0, 5).map(c => c.name).join(', ');
      console.log('[MarkdownPlugin] Conflicts skipped:', conflictNames);
    }
  },

  /**
   * 触发文件下载
   * @private
   */
  _downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * 获取当前日期字符串 YYYY-MM-DD
   * @private
   */
  _dateStr() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * HTML 转义
   * @private
   */
  _escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  },

  /**
   * 显示 Toast 提示
   * @private
   */
  _showToast(message) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 3000 });
    } else {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      }
    }
  }
};

window.MarkdownPlugin = MarkdownPlugin;
console.log('[MarkdownPlugin] Markdown 导入/导出插件已定义');
}
