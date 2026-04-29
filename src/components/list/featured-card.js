/**
 * FeaturedCard - 精选卡片组件
 * 展示置顶/精选记录的大图卡片
 * @version 6.0.0
 */

class FeaturedCard {
  /**
   * 渲染精选卡片
   * @param {Object} record - 记录数据
   * @param {Function} onClick - 点击回调
   * @returns {HTMLElement}
   */
  static render(record, onClick) {
    if (!record) return this._renderEmpty();

    const card = document.createElement('div');
    card.className = 'featured-card';
    card.setAttribute('data-id', record.id);

    card.innerHTML = `
      <div class="featured-card-cover">
        <img src="${record.cover || record.photos?.[0] || ''}" alt="${this._escape(record.title)}" loading="lazy" />
        <div class="featured-card-badge">精选</div>
      </div>
      <div class="featured-card-content">
        <h3 class="featured-card-title">${this._escape(record.title || record.name || '未命名')}</h3>
        <p class="featured-card-summary">${this._escape(record.summary || record.notes || '')}</p>
        <div class="featured-card-meta">
          <span class="featured-card-date">${record.date || this._formatDate(record.createdAt)}</span>
          <span class="featured-card-city">${record.city || ''}</span>
          <span class="featured-card-likes">♥ ${record.likes || 0}</span>
        </div>
      </div>
    `;

    if (onClick) {
      card.addEventListener('click', () => onClick(record.id));
    }

    return card;
  }

  /**
   * 渲染空状态
   * @private
   */
  static _renderEmpty() {
    const card = document.createElement('div');
    card.className = 'featured-card featured-card-empty';
    card.innerHTML = `
      <div class="featured-card-cover">
        <div class="featured-card-placeholder">
          <span>暂无精选</span>
        </div>
      </div>
      <div class="featured-card-content">
        <h3 class="featured-card-title">探索你的记录</h3>
        <p class="featured-card-summary">创建第一条记录，让它成为精选</p>
      </div>
    `;
    return card;
  }

  /**
   * HTML 转义
   * @private
   */
  static _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 格式化日期
   * @private
   */
  static _formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
}

window.FeaturedCard = FeaturedCard;
console.log('[FeaturedCard] 精选卡片组件已加载');
