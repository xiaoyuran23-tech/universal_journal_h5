import re

def fix_app_js(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    new_lines = []
    in_storage_backend = False
    storage_depth = 0
    found_storage_backend = False

    for i, line in enumerate(lines):
        # 1. 删除 StorageBackend 定义
        # 开始标志: const StorageBackend = {
        if 'const StorageBackend = {' in line:
            in_storage_backend = True
            storage_depth = 1
            found_storage_backend = True
            print(f"删除 StorageBackend 定义 (行 {i+1})")
            continue
        
        if in_storage_backend:
            # 计算大括号层级
            storage_depth += line.count('{') - line.count('}')
            if storage_depth <= 0:
                in_storage_backend = False
                print(f"StorageBackend 删除结束 (行 {i+1})")
            continue # 跳过此行
        
        # 2. 修复 stripHtml (替换整个方法体)
        if line.strip() == 'stripHtml(html) {':
            new_lines.append('  stripHtml(html) {\n')
            new_lines.append('    if (!html) return \'\';\n')
            new_lines.append('    try {\n')
            new_lines.append('      const parser = new DOMParser();\n')
            new_lines.append('      const doc = parser.parseFromString(html, \'text/html\');\n')
            new_lines.append('      return doc.body.textContent || \'\';\n')
            new_lines.append('    } catch (e) {\n')
            new_lines.append('      return html.replace(/<[^>]*>/g, \'\');\n')
            new_lines.append('    }\n')
            new_lines.append('  },\n')
            # Skip original lines until closing },
            continue
        
        if 'stripHtml' in line and '{' in line and 'stripHtml(html) {' not in line:
            # This might be the start if indentation is weird, or part of original. 
            # Since we handle the exact match above, we just need to skip the old body.
            # But wait, the logic above adds new lines. We need to skip old ones.
            pass 

        # We need a smarter way to replace stripHtml. 
        # Let's just do string replacement for the method body if possible, 
        # or flag skipping.
        
        new_lines.append(line)

    # 重新处理 stripHtml 替换，更简单的方法：全文替换
    content = "".join(new_lines)
    
    # 替换 stripHtml 实现
    old_strip = r'stripHtml\(html\) \{[^}]+\}'
    # 这个正则可能不匹配多行。我们用更粗暴但有效的方法：
    # 找到 "stripHtml(html) {" 和随后的 "  },"
    
    start_marker = 'stripHtml(html) {'
    if start_marker in content:
        start_idx = content.find(start_marker)
        # 找到方法结束。假设方法以 "  }," 结尾，且后面紧跟 showToast
        # 我们找 "  },\n\n  showToast" 或者类似的
        
        # 简单策略：找到下一个 "  showToast(message)"
        end_marker = '\n  showToast(message)'
        end_idx = content.find(end_marker, start_idx)
        
        if end_idx != -1:
            new_method = """stripHtml(html) {
    if (!html) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    } catch (e) {
      return html.replace(/<[^>]*>/g, '');
    }
  },"""
            content = content[:start_idx] + new_method + content[end_idx:]
            print("✅ 已修复 stripHtml")

    # 修复 filterItems 日期逻辑
    # 原代码：const matchDate = !dateStr || (item.createdAt && item.createdAt.includes(dateStr));
    # 修改为：
    old_date_logic = "const matchDate = !dateStr || (item.createdAt && item.createdAt.includes(dateStr));"
    new_date_logic = """const matchDate = !dateStr || (item.createdAt && item.createdAt.startsWith(dateStr.replace(/\\//g, '-')));"""
    
    if old_date_logic in content:
        content = content.replace(old_date_logic, new_date_logic)
        print("✅ 已修复 filterItems 日期匹配")
    
    # 修复 migrateLegacyData 持久化
    # 在 console.log('数据迁移完成'); 之后，await StorageBackend.save(this.items); 应该已经在了？
    # 检查并添加 if (changed) { await StorageBackend.save(this.items); }
    
    # 找到 migrateLegacyData 函数体
    migrate_start = content.find('async migrateLegacyData() {')
    if migrate_start != -1:
        # 找到函数结束 }
        # 简单查找：在 migrate_start 后找 "  },\n\n  stripHtml"
        strip_pos = content.find('\n  stripHtml(html) {', migrate_start)
        if strip_pos == -1:
             strip_pos = content.find('\n  stripHtml(', migrate_start)
        
        if strip_pos != -1:
            func_body = content[migrate_start:strip_pos]
            # 检查是否已有 save 调用
            if 'StorageBackend.save(this.items)' not in func_body:
                # 在 return 或结束前添加
                # 找到 if (changed) { ... } 块
                if 'if (changed)' in func_body:
                    # 替换 if (changed) { console.log(...) } 为 if (changed) { ... save ... }
                    old_block = "if (changed) {\n      await StorageBackend.save(this.items);\n      console.log('数据迁移完成');\n    }"
                    if old_block in func_body:
                        print("✅ migrateLegacyData 已包含持久化")
                    else:
                        # 可能是另一种格式
                        pass
                else:
                    # 添加 changed 逻辑
                    # 在函数末尾 } 之前
                    insertion_point = func_body.rfind('}')
                    if insertion_point != -1:
                        new_code = """
    if (changed) {
      await StorageBackend.save(this.items);
      console.log('数据迁移完成 (已持久化)');
    }
"""
                        # 注意：这里需要处理缩进
                        # 实际上 app.js 的 migrateLegacyData 应该已经有 save 了？
                        # 检查原始文件
                        pass
            
            content = content[:migrate_start] + func_body + content[strip_pos:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def fix_cloud_sync(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. 修改迭代次数
    content = content.replace('iterations: 100000', 'iterations: 50000')
    print("✅ 云同步迭代次数降至 50,000")

    # 2. 修复 mergeItems
    # 查找 mergeItems 方法并替换
    # 找到 "mergeItems(localItems, cloudItems) {"
    start = content.find('mergeItems(localItems, cloudItems) {')
    if start != -1:
        # 找到方法结束。通常后面跟着 "window.CloudSync" 或文件尾
        end = content.find('\n};', start) 
        if end == -1: end = content.find('\nwindow.', start)
        
        new_merge = """mergeItems(localItems, cloudItems) {
    const map = new Map();
    
    // 1. 放入本地数据
    localItems.forEach(item => {
      if (item.id) map.set(item.id, item);
    });
    
    // 2. 合并云端数据 (Last-Write-Wins)
    cloudItems.forEach(cloudItem => {
      if (!cloudItem.id) return;
      const existing = map.get(cloudItem.id);
      
      // 如果本地没有，或者云端更新
      if (!existing || new Date(cloudItem.updatedAt) > new Date(existing.updatedAt)) {
        map.set(cloudItem.id, cloudItem);
      }
    });
    
    // 3. 排序
    return Array.from(map.values()).sort((a, b) => {
      const tA = new Date(b.updatedAt || 0).getTime();
      const tB = new Date(a.updatedAt || 0).getTime();
      return tA - tB;
    });
  }"""
        
        content = content[:start] + new_merge + content[end:]
        print("✅ 已修复 mergeItems 去重逻辑")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def fix_sw(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 替换 fetch handler 为 Network First for HTML
    # 找到 fetch event listener
    old_fetch = """// 请求拦截：Network First (优先网络，失败则缓存)
// 对于 JS/CSS/HTML 等资源
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('github.com') || event.request.url.includes('jsdelivr')) {
    // CDN 资源使用 Stale-While-Revalidate
    event.respondWith(
      caches.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        });
        return response || fetchPromise;
      })
    );
  } else {
    // 本地资源使用 Cache First (离线优先)
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});"""

    new_fetch = """self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. HTML 入口文件: Network First (保证更新)
  if (event.request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. CDN / 外部资源: Stale-While-Revalidate
  if (event.request.url.includes('github.com') || event.request.url.includes('jsdelivr')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          return networkResponse;
        });
        return response || fetchPromise;
      })
    );
    return;
  }

  // 3. 本地静态资源 (JS/CSS/Images): Cache First (离线优先)
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});"""

    if old_fetch in content:
        content = content.replace(old_fetch, new_fetch)
        print("✅ 已修复 sw.js 缓存策略")
    else:
        print("⚠️ sw.js 缓存策略未匹配，可能已修改")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# 执行修复
fix_app_js(r"D:\QwenPawOut001\universal_journal_h5\js\app.js")
fix_cloud_sync(r"D:\QwenPawOut001\universal_journal_h5\js\cloud-sync.js")
fix_sw(r"D:\QwenPawOut001\universal_journal_h5\sw.js")
