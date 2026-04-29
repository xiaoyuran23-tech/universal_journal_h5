filepath = r"D:\QwenPawOut001\universal_journal_h5\js\app.js"
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. 删除第一个 migrateLegacyData
# 找到 "async migrateLegacyData()" 第一次出现
start = -1
end = -1
count = 0
for i, line in enumerate(lines):
    if 'async migrateLegacyData()' in line:
        count += 1
        if count == 1:
            start = i
            # 找方法结束 },
            # 假设方法以 "    }," 结尾，且后面有空行
            for j in range(i+1, min(len(lines), i+30)):
                if lines[j].strip() == '},':
                    end = j + 1
                    break
            break

if start != -1 and end != -1:
    print(f"删除第一个 migrateLegacyData: 行 {start+1} 到 {end}")
    del lines[start:end]

# 2. 添加 stripHtml 方法
# 找到 showToast 方法，在它之前添加 stripHtml
for i, line in enumerate(lines):
    if 'showToast(message)' in line and 'async' not in line: # showToast is not async
        # 在它上面插入
        # 找到上一个方法的结尾 },
        # 我们在 showToast 所在的行之前插入
        indent = "  "
        new_method = f"""{indent}stripHtml(html) {{
{indent}  if (!html) return '';
{indent}  try {{
{indent}    const parser = new DOMParser();
{indent}    const doc = parser.parseFromString(html, 'text/html');
{indent}    return doc.body.textContent || '';
{indent}  }} catch (e) {{
{indent}    return html.replace(/<[^>]*>/g, '');
{indent}  }}
{indent}}},
"""
        lines.insert(i, new_method)
        print("✅ 已添加 stripHtml 方法")
        break

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("修复完成")
