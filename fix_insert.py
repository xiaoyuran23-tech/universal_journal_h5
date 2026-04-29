filepath = r"D:\QwenPawOut001\universal_journal_h5\js\app.js"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 找到错误的插入位置并删除
# 错误代码在 getStatusText 方法中
error_start = content.find("    // 用户名编辑功能\n    const editNameBtn")
if error_start != -1:
    # 找到错误代码的结束位置（下一个方法或 })
    error_end = content.find("\n  },", error_start)
    if error_end != -1:
        error_end += 5  # 包含 },\n
        content = content[:error_start] + content[error_end:]
        print("✅ 已删除错误插入的用户名代码")

# 现在正确插入到 bindSettingsEvents 中
# 找到 bindSettingsEvents 方法
settings_start = content.find("bindSettingsEvents() {")
if settings_start != -1:
    # 找到该方法中最后一个事件绑定（aboutBtn）
    about_marker = "const aboutBtn = document.getElementById('settings-about');"
    about_pos = content.find(about_marker, settings_start)
    
    if about_pos != -1:
        # 找到 aboutBtn 事件绑定的结束 }
        about_end = content.find("});", about_pos)
        if about_end != -1:
            about_end += 4  # 包含 });
            
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
    }"""
            
            content = content[:about_end] + username_event + content[about_end:]
            print("✅ 已正确插入用户名编辑逻辑到 bindSettingsEvents")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
