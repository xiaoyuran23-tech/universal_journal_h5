/**
 * Mood Plugin - 心情追踪插件
 * 提供心情选择、心情趋势展示、首页心情卡片
 * @version 7.0.0
 */

if (!window.MoodPlugin) {
const MoodPlugin = {
  name: 'mood',
  version: '1.0.0',
  dependencies: ['records'],

  _eventsBound: false,

  async init() {
    this.routes = [];
  },

  async start() {
    this._bindMoodPickers();
    this._renderTodayMood();
  },

  stop() { this._eventsBound = false; },
  routes: [],
  actions: {},

  /**
   * 绑定心情选择器
   * @private
   */
  _bindMoodPickers() {
    document.addEventListener('click', (e) => {
      // 心情选项点击
      const moodOption = e.target.closest('[data-mood]');
      if (moodOption) {
        const mood = moodOption.dataset.mood;
        if (!mood) return;

        // 更新选中状态
        const picker = moodOption.closest('[data-mood-picker]');
        if (picker) {
          picker.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
          moodOption.classList.add('selected');
        }

        // 触发事件（编辑器可以监听）
        const event = new CustomEvent('mood:select', { detail: { mood } });
        document.dispatchEvent(event);

        // 记录今天的心情
        window.MoodService?.recordMood(mood);
        this._renderTodayMood();
      }

      // 心情打卡入口点击
      const moodCheckin = e.target.closest('[data-mood-checkin]');
      if (moodCheckin) {
        this._showMoodPickerModal();
      }
    });
  },

  /**
   * 渲染今日心情卡片
   * @private
   */
  _renderTodayMood() {
    const container = document.getElementById('today-mood-container');
    if (!container) return;

    const today = window.MoodService?.getTodayMood();
    if (!today) {
      container.innerHTML = `
        <div class="today-mood-card" style="text-align:center;padding:12px;">
          <span style="font-size:12px;color:#999;">今天的心情如何？</span>
          ${window.MoodService ? MoodService.renderPicker() : ''}
        </div>
      `;
      return;
    }

    const mood = window.MoodService.getMoodByKey(today.mood);
    container.innerHTML = `
      <div class="today-mood-card" style="text-align:center;padding:12px;background:#f8f8f8;border-radius:12px;">
        <span style="font-size:32px;">${mood.emoji}</span>
        <div style="font-size:13px;color:#666;margin-top:4px;">
          今天心情：${mood.label}
        </div>
      </div>
    `;
  },

  /**
   * 显示心情选择弹窗
   * @private
   */
  _showMoodPickerModal() {
    const existing = document.getElementById('mood-modal');
    if (existing) existing.remove();

    const todayMood = window.MoodService?.getTodayMood();
    const selectedKey = todayMood?.mood || '';

    const modal = document.createElement('div');
    modal.id = 'mood-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:360px;padding:24px;">
        <h3 style="margin:0 0 8px;font-size:18px;">今天的心情</h3>
        <p style="margin:0 0 16px;font-size:13px;color:#999;">选择你现在的感觉</p>
        ${window.MoodService ? MoodService.renderPicker(selectedKey) : ''}
        <div style="margin-top:16px;">
          <input type="text" id="mood-note-input" placeholder="可选：写一句话..."
                 style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;box-sizing:border-box;">
        </div>
        <button id="mood-modal-save" style="width:100%;padding:12px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer;margin-top:12px;">保存</button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('.modal-close, #mood-modal-save')?.addEventListener('click', () => modal.remove());

    const saveBtn = modal.querySelector('#mood-modal-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const selected = modal.querySelector('.mood-option.selected');
        if (selected) {
          const mood = selected.dataset.mood;
          const note = modal.querySelector('#mood-note-input')?.value || '';
          window.MoodService?.recordMood(mood, note);
          modal.remove();
        }
      });
    }
  },

  /**
   * 渲染心情趋势图表（在个人页面）
   */
  renderMoodTrend(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const trend = window.MoodService?.getTrend(30) || [];
    if (trend.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#999;padding:24px;">还没有心情记录，点击心情打卡开始吧</p>';
      return;
    }

    const moodValues = { great: 5, good: 4, neutral: 3, bad: 2, awful: 1 };
    const emojis = { great: '😄', good: '😊', neutral: '😐', bad: '😟', awful: '😫' };

    // 渲染心情日历热力图
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const entry = trend.find(t => t.date === key);
      days.push({ date: key.slice(5), emoji: entry ? emojis[entry.mood] : '·', mood: entry?.mood });
    }

    container.innerHTML = `
      <div style="padding:16px;">
        <h4 style="margin:0 0 12px;font-size:15px;">近 30 天心情</h4>
        <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;">
          ${days.map(d => `
            <div style="text-align:center;font-size:16px;padding:4px 0;border-radius:4px;
              ${d.mood ? 'background:#f0f0f0;' : 'color:#ddd;'}">
              ${d.emoji}
              <div style="font-size:9px;color:#bbb;margin-top:2px;">${d.date.slice(2)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};

window.MoodPlugin = MoodPlugin;
console.log('[MoodPlugin] 心情追踪插件已加载');
}
