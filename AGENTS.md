# 万物手札 H5 — Agent 开发规范

> 本文件由九子圆桌（v7.1.1）制定，2026-04-27 生效。
> 每次会话开始时读取，确保开发流程不走样。

---

## 🚨 铁律（不可违背）

### 1. 设计先行
- **任何超过 3 个文件的变更**必须先更新 `DESIGN.md`
- 无设计 → 不编码
- 设计文档模板见下方

### 2. 代码审查
- 写完代码后，**必须像审查别人的代码一样审查自己的代码**
- 重点检查：变量名与用途一致、分支覆盖完整、异步有错误处理
- **自己写的 bug 最危险** — 知道"应该怎么写"反而忽略"实际写了什么"

### 3. 真实环境验证
- `file://` 协议看"大概正常" ≠ 可以交付
- 必须：CSS 括号平衡检查 + JS 语法检查 + 完整交互路径走查
- 使用 `scripts\smoke-test.ps1 -FileMode` 快速验证

### 4. 循环检测
- 同一操作重复 3 次无进展 → 强制停止，重新思考
- 每次工具调用成功后标记状态，不重复做已完成的事
- 使用 `scripts\loop-detect.ps1` 检测文件是否被反复修改

### 5. 目录卫生
- **根目录只保留 6 类文件**：HTML 入口、CSS、JS 目录、DESIGN.md、README.md、scripts/、docs/
- 临时文档（报告、指南、总结）一律放 `docs/` 子目录
- 使用 `scripts\cleanup-root.ps1` 定期清理

---

## 📁 项目结构

```
universal_journal_h5/
├── index.html          # 入口（含版本号 ?v=）
├── style.css           # 样式
├── animations.css      # 动画
├── DESIGN.md           # 设计文档（唯一）
├── README.md           # 项目说明
├── .gitignore
├── js/
│   ├── app.js          # 主入口
│   ├── storage.js      # 数据层
│   ├── ui.js           # UI 层
│   └── sync.js         # 同步层
├── assets/             # 静态资源
├── scripts/            # 检查脚本
│   ├── quality-gate.ps1    # 狴犴 — 质量门禁
│   ├── css-check.ps1       # 睚眦 — CSS 语法检查
│   ├── smoke-test.ps1      # 嘲风 — 冒烟测试
│   ├── loop-detect.ps1     # 蒲牢 — 循环检测
│   ├── cleanup-root.ps1    # 霸下 — 根目录清理
│   └── run-all.ps1         # 一键全检
└── docs/               # 所有临时/过程文档
    ├── orphan/             # 根目录迁移来的临时文件
    ├── design-history/     # 历史设计文档
    └── notes/              # 过程笔记
```

---

## 🐉 开发流程（九道闸门）

```
需求 → [1] 囚牛: 设计闸门 → DESIGN.md
     → [2] 编码实施 → 写代码
     → [3] 狴犴: 质量门禁 → quality-gate.ps1
     → [4] 睚眦: CSS 检查 → css-check.ps1
     → [5] 嘲风: 冒烟测试 → smoke-test.ps1 -FileMode
     → [6] 狻猊: 体验验证 → 视觉检查清单
     → [7] 蒲牢: 循环检测 → loop-detect.ps1
     → [8] 负屃: 文档归档 → 更新 DESIGN.md
     → [9] 螭吻: 长期优化 → 工具链升级
     → ✅ 提交 + 推
```

### 闸门检查清单

| 闸门 | 检查项 | 通过标准 |
|------|--------|----------|
| 1. 囚牛 | DESIGN.md 是否存在 | 存在且有本次变更记录 |
| 2. 编码 | 代码逻辑正确 | 无变量混淆、分支完整 |
| 3. 狴犴 | 质量门禁 | quality-gate.ps1 全部通过 |
| 4. 睚眦 | CSS 语法 | css-check.ps1 无错误 |
| 5. 嘲风 | 冒烟测试 | smoke-test.ps1 全部通过 |
| 6. 狻猊 | 视觉体验 | 按钮有样式、布局正常、颜色可读 |
| 7. 蒲牢 | 循环检测 | 30 分钟内变更 < 5 次 |
| 8. 负屃 | 文档归档 | DESIGN.md 版本历史已更新 |
| 9. 螭吻 | 工具链 | 考虑是否引入新工具 |

---

## 📝 DESIGN.md 模板

```markdown
# DESIGN.md — 万物手札 H5

## 版本历史
| 版本 | 日期 | 变更 | 状态 |
|------|------|------|------|
|      |      |      |      |

## 当前迭代

### 问题
[描述当前要解决的问题]

### 根因分析
[为什么会出这个问题]

### 修改方案
[改哪些文件、改什么]

### 修改文件清单
| 文件 | 改动 |
|------|------|

### 验证结果
- [ ] 验证项 1
- [ ] 验证项 2
```

---

## ✅ 狻猊体验验证清单

### 首次加载
- [ ] 页面不闪烁、不跳动
- [ ] 所有按钮有样式（不是默认蓝色矩形）
- [ ] 文字不重叠、不溢出
- [ ] 颜色对比度可读

### 交互
- [ ] 所有按钮点击有反馈（:hover / :active）
- [ ] 表单提交有 loading 状态
- [ ] 操作后有反馈（toast / 页面跳转）
- [ ] 空状态有提示（不是白屏）

### 缓存
- [ ] 资源版本号已更新（`?v=` 参数）
- [ ] 清除浏览器缓存后页面正常加载

---

## ⚠️ 历史教训（踩过的坑）

| # | 问题 | 教训 |
|---|------|------|
| 1 | 表单返回用 `currentPage`（已是 form） | 状态变量命名要清晰，返回用 `previousPage` |
| 2 | 搜索无防抖 | 所有搜索/过滤/输入必须加 debounce |
| 3 | 假加密称安全 | 安全声明必须与实际实现一致 |
| 4 | CSS 大括号不匹配 | 每次修改后运行 css-check.ps1 |
| 5 | 循环写 DESIGN.md 20+ 次 | 操作后标记状态，3 次重复强制停止 |
| 6 | 30+ 临时文档堆积根目录 | 根目录只保留核心文件，其他进 docs/ |

---

## 🚀 快速命令

```powershell
# 提交前全检
powershell -ExecutionPolicy Bypass -File scripts\run-all.ps1

# 单独检查某项
powershell -ExecutionPolicy Bypass -File scripts\quality-gate.ps1
powershell -ExecutionPolicy Bypass -File scripts\css-check.ps1
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1 -FileMode
powershell -ExecutionPolicy Bypass -File scripts\loop-detect.ps1
powershell -ExecutionPolicy Bypass -File scripts\cleanup-root.ps1
```

---

*版本: AGENTS.md v1.0 | 2026-04-27 | 九子圆桌评议*
