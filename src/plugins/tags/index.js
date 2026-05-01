/**
 * Tags Plugin - 标签管理
 * 替代 js/tag-manager.js
 * @version 6.1.0
 */

if (!window.TagsPlugin) {
const TagsPlugin = {
  name: 'tags',
  version: '1.0.0',
  dependencies: ['records'],

  currentTags: [],
  _eventsBound: false,

  async init() {
    console.log('[TagsPlugin] Initializing...');
  },

  async start() {
    console.log('[TagsPlugin] Starting...');
    this._bindEvents();
  },

  stop() {
    this._eventsBound = false;
  },

  async getAllTags() {
    const records = window.Store ? window.Store.getState('records.list') : [];
    const tagMap = {};
    records.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(tagMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },

  renderTagChips(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.getAllTags().then(tags => {
      if (tags.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.innerHTML = tags.map(tag => `
        <span class="tag-chip" data-tag="${this._escapeHtml(tag.name)}">
          ${this._escapeHtml(tag.name)}
        </span>
      `).join('');
    });
  },

  toggleTag(tag) {
    const index = this.currentTags.indexOf(tag);
    if (index > -1) {
      this.currentTags.splice(index, 1);
    } else {
      this.currentTags.push(tag);
    }

    document.querySelectorAll('.tag-chip').forEach(chip => {
      if (this.currentTags.includes(chip.dataset.tag)) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    // 触发筛选
    if (window.RecordsPlugin) {
      RecordsPlugin.filterByTags(this.currentTags);
    }
  },

  getSelectedTags() {
    return [...this.currentTags];
  },

  initTagChipInput() {
    const input = document.getElementById('create-tags');
    const wrapper = document.getElementById('tag-input-wrapper');
    if (!input || !wrapper) return;

    // 清理旧节点
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    let tags = [];

    const renderChips = () => {
      wrapper.querySelectorAll('.tag-chip-input').forEach(c => c.remove());
      tags.forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-input';
        chip.textContent = tag;

        const removeBtn = document.createElement('span');
        removeBtn.className = 'tag-chip-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          tags.splice(index, 1);
          renderChips();
        };

        chip.appendChild(removeBtn);
        wrapper.insertBefore(chip, newInput);
      });

      this.currentTags = [...tags];
    };

    newInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
        e.preventDefault();
        const val = newInput.value.trim().replace(/,/g, '').replace(/ /g, '');
        if (val && !tags.includes(val)) {
          tags.push(val);
          newInput.value = '';
          renderChips();
        }
      }
    });

    this.clearInput = () => {
      tags = [];
      newInput.value = '';
      renderChips();
    };
  },

  clearSelectedTags() {
    this.currentTags = [];
    if (typeof this.clearInput === 'function') {
      this.clearInput();
    }
    document.querySelectorAll('.tag-chip.active').forEach(chip => {
      chip.classList.remove('active');
    });
  },

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    this.initTagChipInput();

    // 标签筛选入口
    const tagFilter = document.getElementById('tag-filter');
    if (tagFilter) {
      this.renderTagChips('tag-filter');
      tagFilter.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (chip) this.toggleTag(chip.dataset.tag);
      });
    }
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.TagsPlugin = TagsPlugin;
console.log('[TagsPlugin] 标签管理插件已定义');
}
