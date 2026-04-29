/**
 * UI Components - 列表组件
 * 提供高性能列表渲染，支持虚拟滚动
 * @version 6.0.0
 */

// ===================================
// ItemCard Component - 记录卡片
// ===================================
class ItemCard {
  /**
   * 渲染记录卡片
   * @param {Object} item - 记录对象
   * @param {Object} [options] - 选项
   * @param {boolean} [options.showPhoto] - 是否显示照片
   * @param {Function} [options.onClick] - 点击回调
   * @param {Function} [options.onFavorite] - 收藏回调
   * @returns {HTMLElement}
   */
  static render(item, options = {}) {
    const {
      showPhoto = true,
      onClick,
      onFavorite
    } = options;

    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.id = item.id;

    // 照片区域
    if (showPhoto && item.photos && item.photos.length > 0) {
      const photoDiv = document.createElement('div');
      photoDiv.className = 'item-card-photo';
      
      const img = document.createElement('img');
      img.src = item.photos[0];
      img.alt = item.name || '记录照片';
      img.loading = 'lazy'; // 懒加载
      
      photoDiv.appendChild(img);
      card.appendChild(photoDiv);
    }

    // 内容区域
    const content = document.createElement('div');
    content.className = 'item-card-content';

    // 标题行
    const header = document.createElement('div');
    header.className = 'item-card-header';

    const title = document.createElement('h3');
    title.className = 'item-card-title';
    title.textContent = item.name || '未命名';
    header.appendChild(title);

    // 收藏按钮
    const favBtn = document.createElement('button');
    favBtn.className = `item-card-favorite ${item.favorite ? 'active' : ''}`;
    favBtn.innerHTML = item.favorite ? '⭐' : '☆';
    if (onFavorite) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onFavorite(item.id, !item.favorite);
      });
    }
    header.appendChild(favBtn);

    content.appendChild(header);

    // 标签
    if (item.tags && item.tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'item-card-tags';
      
      item.tags.slice(0, 3).forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag-chip';
        tagSpan.textContent = `#${tag}`;
        tagsDiv.appendChild(tagSpan);
      });
      
      if (item.tags.length > 3) {
        const more = document.createElement('span');
        more.className = 'tag-more';
        more.textContent = `+${item.tags.length - 3}`;
        tagsDiv.appendChild(more);
      }
      
      content.appendChild(tagsDiv);
    }

    // 备注
    if (item.notes) {
      const notes = document.createElement('p');
      notes.className = 'item-card-notes';
      notes.textContent = ItemCard._stripHtml(item.notes).substring(0, 100);
      if (item.notes.length > 100) notes.textContent += '...';
      content.appendChild(notes);
    }

    // 元信息
    const meta = document.createElement('div');
    meta.className = 'item-card-meta';
    
    const date = document.createElement('span');
    date.className = 'item-card-date';
    const createdAt = new Date(item.createdAt || item.date || 0);
    date.textContent = isNaN(createdAt.getTime()) ? '未知日期' : createdAt.toLocaleDateString('zh-CN');
    meta.appendChild(date);

    content.appendChild(meta);
    card.appendChild(content);

    // 点击事件
    if (onClick) {
      card.addEventListener('click', () => onClick(item));
    }

    return card;
  }

  /**
   * 渲染批量选择卡片
   */
  static renderWithSelection(item, isSelected, onToggle) {
    const card = ItemCard.render(item);
    card.classList.toggle('selected', isSelected);
    
    // 添加选择指示器
    const indicator = document.createElement('div');
    indicator.className = 'selection-indicator';
    indicator.innerHTML = isSelected ? '✓' : '';
    card.appendChild(indicator);

    // 点击切换选择
    card.addEventListener('click', () => {
      onToggle(item.id);
    });

    return card;
  }

  /**
   * 去除 HTML 标签
   * @private
   */
  static _stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
}

// ===================================
// VirtualList Component - 虚拟列表
// ===================================
class VirtualList {
  constructor(config) {
    this._container = config.container;
    this._itemHeight = config.itemHeight || 120;
    this._overscan = config.overscan || 5;
    this._items = [];
    this._renderItem = config.renderItem;
    this._scrollTop = 0;
    this._visibleRange = { start: 0, end: 0 };
    this._isInitialized = false;
  }

  /**
   * 设置数据
   * @param {Array} items
   */
  setItems(items) {
    this._items = items || [];
    this._updateContainerHeight();
    this._render();
  }

  /**
   * 初始化
   */
  init() {
    if (this._isInitialized) return;

    // 创建滚动容器
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'virtual-list-scroll';
    scrollContainer.style.height = '100%';
    scrollContainer.style.overflowY = 'auto';
    scrollContainer.style.position = 'relative';

    // 创建占位容器 (用于撑开高度)
    this._phantom = document.createElement('div');
    this._phantom.className = 'virtual-list-phantom';
    this._phantom.style.position = 'absolute';
    this._phantom.style.left = '0';
    this._phantom.style.top = '0';
    this._phantom.style.right = '0';
    this._phantom.style.zIndex = '-1';

    // 创建可见区域容器
    this._viewport = document.createElement('div');
    this._viewport.className = 'virtual-list-viewport';
    this._viewport.style.position = 'relative';
    this._viewport.style.width = '100%';

    scrollContainer.appendChild(this._phantom);
    scrollContainer.appendChild(this._viewport);
    this._container.appendChild(scrollContainer);

    // 监听滚动
    scrollContainer.addEventListener('scroll', (e) => {
      this._scrollTop = e.target.scrollTop;
      this._render();
    });

    this._scrollContainer = scrollContainer;
    this._isInitialized = true;
  }

  /**
   * 更新容器高度
   * @private
   */
  _updateContainerHeight() {
    if (this._phantom) {
      this._phantom.style.height = `${this._items.length * this._itemHeight}px`;
    }
  }

  /**
   * 渲染可见区域
   * @private
   */
  _render() {
    if (!this._isInitialized || !this._renderItem) return;

    const containerHeight = this._container.clientHeight || window.innerHeight;
    const startIndex = Math.max(0, Math.floor(this._scrollTop / this._itemHeight) - this._overscan);
    const endIndex = Math.min(
      this._items.length,
      Math.ceil((this._scrollTop + containerHeight) / this._itemHeight) + this._overscan
    );

    // 如果范围没有变化，跳过渲染
    if (this._visibleRange.start === startIndex && this._visibleRange.end === endIndex) {
      return;
    }

    this._visibleRange = { start: startIndex, end: endIndex };

    // 清空并重新渲染
    this._viewport.innerHTML = '';
    this._viewport.style.transform = `translateY(${startIndex * this._itemHeight}px)`;

    for (let i = startIndex; i < endIndex; i++) {
      const item = this._items[i];
      if (!item) continue;

      const element = this._renderItem(item, i);
      element.style.height = `${this._itemHeight}px`;
      element.style.position = 'absolute';
      element.style.top = '0';
      element.style.left = '0';
      element.style.right = '0';
      this._viewport.appendChild(element);
    }
  }

  /**
   * 滚动到指定位置
   * @param {number} index
   */
  scrollTo(index) {
    if (this._scrollContainer) {
      this._scrollContainer.scrollTop = index * this._itemHeight;
    }
  }

  /**
   * 滚动到顶部
   */
  scrollToTop() {
    this.scrollTo(0);
  }

  /**
   * 销毁
   */
  destroy() {
    if (this._container && this._scrollContainer) {
      this._container.removeChild(this._scrollContainer);
    }
    this._isInitialized = false;
  }
}

// 全局暴露
window.ListComponents = {
  ItemCard,
  VirtualList
};

console.log('[ListComponents] 列表组件库已加载');
