/**
 * 万物手札 - 标签管理模块 v3.3.0
 */

const TagManager = {
  // 当前已选标签（chip 模式）
  currentTags: [],
  
  async getAllTags() {
    if (window.IDBModule && IDBModule.db) {
      return await IDBModule.getAllTags();
    }
    const items = await StorageBackend.getAll();
    const tagMap = {};
    items.forEach(item => {
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
  
  renderTagCloud(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    this.getAllTags().then(tags => {
      if (tags.length === 0) {
        container.innerHTML = '<p class="empty-tags">暂无标签</p>';
        return;
      }
      
      const maxCount = tags[0].count;
      container.innerHTML = tags.map(tag => {
        const size = 0.8 + (tag.count / maxCount) * 0.8;
        return `<span class="tag-cloud-item" data-tag="${this.escapeHtml(tag.name)}" style="font-size: ${size}rem">${this.escapeHtml(tag.name)} (${tag.count})</span>`;
      }).join('');
      
      container.querySelectorAll('.tag-cloud-item').forEach(item => {
        item.addEventListener('click', () => {
          if (onSelect) onSelect(item.dataset.tag);
        });
      });
    });
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
        <span class="tag-chip" data-tag="${this.escapeHtml(tag.name)}">
          ${this.escapeHtml(tag.name)}
        </span>
      `).join('');
      
      container.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          this.toggleTag(chip.dataset.tag);
        });
      });
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
    
    if (window.App && typeof App.filterByTags === 'function') {
      App.filterByTags(this.currentTags);
    }
  },
  
  getSelectedTags() {
    return [...this.currentTags];
  },
  
  clearSelectedTags() {
    this.currentTags = [];
    document.querySelectorAll('.tag-chip.active').forEach(chip => {
      chip.classList.remove('active');
    });
  },
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.TagManager = TagManager;
