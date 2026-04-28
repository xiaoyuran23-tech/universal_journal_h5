// 修复 app.js 的脚本
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'js', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. 修复容器 ID
content = content.replace(/getElementById\('item-list'\)/g, "getElementById('items-container')");
content = content.replace(/getElementById\('favorites-list'\)/g, "getElementById('favorites-container')");

// 2. 修复 item._id → item.id
content = content.replace(/item\._id/g, 'item.id');

// 3. 修复 isFavorite → favorite
content = content.replace(/isFavorite/g, 'favorite');

// 4. 修复 ThemeManager
content = content.replace(/const ThemeManager = \{[\s\S]*?renderOptions\(\) \{[\s\S]*?\}\s*\};/, `const ThemeManager = {
  currentTheme: 'light',
  themes: [
    { id: 'light', name: '明亮' },
    { id: 'dark', name: '暗黑' },
    { id: 'warm', name: '暖光' },
    { id: 'ink', name: '墨影' }
  ],
  
  init() {
    const saved = localStorage.getItem('universal_journal_theme');
    if (saved && this.themes.find(t => t.id === saved)) {
      this.currentTheme = saved;
    }
    document.documentElement.setAttribute('data-theme', this.currentTheme);
  },
  
  apply(themeId) {
    const theme = this.themes.find(t => t.id === themeId);
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('universal_journal_theme', themeId);
    this.currentTheme = themeId;
    const themeNameEl = document.getElementById('current-theme-name');
    if (themeNameEl) themeNameEl.textContent = theme.name;
  },
  
  renderOptions() {
    const container = document.getElementById('theme-options');
    if (!container) return;
    container.innerHTML = this.themes.map(theme => \`
      <div class="theme-option" data-theme="\${theme.id}">
        <div class="theme-preview" style="background: var(--bg); border-color: var(--primary)"></div>
        <span class="theme-name">\${theme.name}</span>
      </div>
    \`).join('');
    container.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        this.apply(option.dataset.theme);
        document.getElementById('theme-panel').classList.remove('show');
      });
    });
  }
};`);

// 5. 修复 switchPage 添加 FAB 控制
content = content.replace(/(this\.currentPage = page;\s*\n\s*)(if \(page === 'favorites'\))/, `$1// 控制 FAB 显示/隐藏 - 只在首页显示
    const fab = document.getElementById('fab-add');
    if (fab) {
      fab.style.display = (page === 'home') ? 'flex' : 'none';
    }
    
    $2`);

// 6. 在 init() 末尾添加 switchPage('home')
content = content.replace(/(this\.renderItems\(\);\s*\n\s*\}\s*\n\s*\n\s*)(console\.log)/, `$1// 确保初始页面和 FAB 状态正确
    this.switchPage('home');
    
    $2`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('修复完成！');
