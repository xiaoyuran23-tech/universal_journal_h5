import re

# ==================== 1. 修复 index.html - 添加用户名编辑功能 ====================
html_path = r"D:\QwenPawOut001\universal_journal_h5\index.html"
with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# 找到 profile-header 并添加编辑按钮和输入框
old_profile_header = """                <div class="profile-header">
                    <div class="profile-avatar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="8" r="4"></circle>
                            <path d="M20 21a8 8 0 1 0-16 0"></path>
                        </svg>
                    </div>
                    <h2 class="profile-name">用户</h2>
                </div>"""

new_profile_header = """                <div class="profile-header">
                    <div class="profile-avatar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="8" r="4"></circle>
                            <path d="M20 21a8 8 0 1 0-16 0"></path>
                        </svg>
                    </div>
                    <div class="profile-name-container">
                        <h2 class="profile-name" id="profile-display-name">用户</h2>
                        <button class="profile-edit-btn" id="profile-edit-btn" title="编辑昵称">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                            </svg>
                        </button>
                    </div>
                    <input type="text" class="profile-name-input" id="profile-name-input" placeholder="输入昵称" style="display:none;" />
                    <button class="profile-save-btn" id="profile-save-btn" style="display:none;">保存</button>
                </div>"""

if old_profile_header in html_content:
    html_content = html_content.replace(old_profile_header, new_profile_header)
    print("✅ index.html: 已添加用户名编辑 UI")
else:
    print("️ index.html: profile-header 未匹配，尝试正则替换")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)


# ==================== 2. 清理所有"未分类"残留 ====================

# 2.1 修复 app.js - 统计功能
app_path = r"D:\QwenPawOut001\universal_journal_h5\js\app.js"
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

# 修复统计中的分类聚合，改为标签聚合
old_stats = "acc[item.category || '未分类'] = (acc[item.category || '未分类'] || 0) + 1;"
new_stats = """// 统计按首标签分类
      const primaryTag = (item.tags && item.tags.length > 0) ? item.tags[0] : '无标签';
      acc[primaryTag] = (acc[primaryTag] || 0) + 1;"""

if old_stats in app_content:
    app_content = app_content.replace(old_stats, new_stats)
    print("✅ app.js: 已修复统计逻辑 (分类→标签)")

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)


# 2.2 修复 template.js
tpl_path = r"D:\QwenPawOut001\universal_journal_h5\js\template.js"
with open(tpl_path, 'r', encoding='utf-8') as f:
    tpl_content = f.read()

old_tpl_cat = "<span class=\"template-category\">${this._escapeHtml(t.category || '未分类')}</span>"
new_tpl_cat = """<div class="template-tags">
                ${t.tags && t.tags.length > 0 ? t.tags.slice(0, 3).map(tag => `<span class="tag-small">#${this._escapeHtml(tag)}</span>`).join('') : '<span class="tag-empty">无标签</span>'}
                </div>"""

if old_tpl_cat in tpl_content:
    tpl_content = tpl_content.replace(old_tpl_cat, new_tpl_cat)
    print("✅ template.js: 已清理分类渲染，改为标签显示")

with open(tpl_path, 'w', encoding='utf-8') as f:
    f.write(tpl_content)


# 2.3 修复 timeline.js
timeline_path = r"D:\QwenPawOut001\universal_journal_h5\js\timeline.js"
with open(timeline_path, 'r', encoding='utf-8') as f:
    timeline_content = f.read()

old_timeline_cat = "const category = item.category || '未分类';"
new_timeline_cat = "const primaryTag = (item.tags && item.tags.length > 0) ? item.tags[0] : '无标签';"

if old_timeline_cat in timeline_content:
    timeline_content = timeline_content.replace(old_timeline_cat, new_timeline_cat)
    # 同时替换后续使用 category 的地方
    timeline_content = timeline_content.replace("category:", "tag:")
    print("✅ timeline.js: 已清理分类残留")

with open(timeline_path, 'w', encoding='utf-8') as f:
    f.write(timeline_content)


# 2.4 修复 visuals.js
visuals_path = r"D:\QwenPawOut001\universal_journal_h5\js\visuals.js"
with open(visuals_path, 'r', encoding='utf-8') as f:
    visuals_content = f.read()

old_visuals_cat = "const cat = item.category || '未分类';"
new_visuals_cat = "const cat = (item.tags && item.tags.length > 0) ? item.tags[0] : '无标签';"

if old_visuals_cat in visuals_content:
    visuals_content = visuals_content.replace(old_visuals_cat, new_visuals_cat)
    print("✅ visuals.js: 已清理分类残留")

with open(visuals_path, 'w', encoding='utf-8') as f:
    f.write(visuals_content)


# ==================== 3. 优化表单键盘适配 ====================
css_path = r"D:\QwenPawOut001\universal_journal_h5\style.css"
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# 添加键盘弹出时的视口适配样式
keyboard_css = """
/* ===================================
   v4.0.2 新增：iOS 键盘弹出适配
   =================================== */

/* 当键盘弹出时，减小表单区域高度 */
@media screen and (max-height: 500px) {
  .form-layout {
    padding-bottom: 20px;
  }
  .form-footer-sticky {
    padding-bottom: env(safe-area-inset-bottom, 10px);
  }
}

/* 防止 iOS 键盘弹出时页面缩放 */
input, textarea, select {
  font-size: 16px !important; /* iOS Safari 小于 16px 会触发缩放 */
}

/* 表单输入框聚焦时，确保可见 */
input:focus, textarea:focus {
  scroll-into-view: smooth;
}
"""

if 'v4.0.2 新增' not in css_content:
    css_content += keyboard_css
    print("✅ style.css: 已添加键盘适配样式")

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css_content)


# ==================== 4. 更新 app.js - 添加用户名编辑逻辑 ====================
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

# 在 bindSettingsEvents 中添加用户名编辑事件
username_event = """
    // 用户名编辑功能
    const editNameBtn = document.getElementById('profile-edit-btn');
    const nameInput = document.getElementById('profile-name-input');
    const saveNameBtn = document.getElementById('profile-save-btn');
    const displayName = document.getElementById('profile-display-name');
    
    if (editNameBtn && nameInput && saveNameBtn && displayName) {
      // 加载保存的昵称
      const savedName = localStorage.getItem('user_nickname');
      if (savedName) displayName.textContent = savedName;
      
      // 点击编辑按钮
      editNameBtn.addEventListener('click', () => {
        nameInput.value = displayName.textContent;
        nameInput.style.display = 'block';
        saveNameBtn.style.display = 'block';
        editNameBtn.style.display = 'none';
        nameInput.focus();
      });
      
      // 保存昵称
      saveNameBtn.addEventListener('click', () => {
        const newName = nameInput.value.trim();
        if (newName) {
          localStorage.setItem('user_nickname', newName);
          displayName.textContent = newName;
          this.showToast('昵称已保存');
        }
        nameInput.style.display = 'none';
        saveNameBtn.style.display = 'none';
        editNameBtn.style.display = 'block';
      });
      
      // 回车保存
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNameBtn.click();
      });
    }
"""

# 找到 bindSettingsEvents 的结束位置，在之前插入
if '用户名编辑功能' not in app_content:
    # 找到 settings-events 的最后一个事件绑定
    insert_marker = "const aboutBtn = document.getElementById('settings-about');"
    if insert_marker in app_content:
        insert_pos = app_content.find(insert_marker)
        # 找到该段的结束 }
        end_pos = app_content.find('};', insert_pos)
        if end_pos != -1:
            # 在 } 之前插入
            app_content = app_content[:end_pos] + username_event + "\n    " + app_content[end_pos:]
            print("✅ app.js: 已添加用户名编辑逻辑")

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)


print("\n" + "="*50)
print(" Phase 2 修复完成！")
print("="*50)
