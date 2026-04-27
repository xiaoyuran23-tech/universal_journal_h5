# 万物手札 H5 v2.2.1 - 修复设计文档

## 问题清单与修复方案

### P0-1: 主题面板定位错误
**根因**: `.theme-selector` 无 `position: relative`，导致 `.theme-panel` 的 `absolute` 定位参照物错误
**修复**: 
- 给 `.theme-selector` 添加 `position: relative`
- 调整 `.theme-panel` 的 `top` 和 `right` 值
- 添加 `z-index` 确保层级正确

### P0-2: 详情页编辑按钮无样式
**根因**: HTML 中使用了 `class="detail-action-btn"`，但 CSS 中未定义该选择器
**修复**:
- 在 `style.css` 中添加 `.detail-action-btn` 样式
- 确保与 `.detail-actions` 容器样式协调
- 添加 hover 和 active 状态

### P0-3: 表单返回逻辑错误
**根因**: `formBackBtn` 点击时使用 `this.currentPage`，但此时 `currentPage` 已经是 `'form'`
**修复**:
- 添加 `this.previousPage` 状态变量
- 打开表单时保存 `this.previousPage = this.currentPage`
- 返回时使用 `this.switchPage(this.previousPage || 'home')`

### P1-1: 搜索无防抖
**根因**: `input` 事件直接触发渲染，无延迟
**修复**:
- 添加 `debounce` 函数
- 搜索输入使用 300ms 防抖

### P1-2: 云同步假加密
**根因**: 使用 `btoa`/`atob` 声称加密，实际只是 Base64 编码
**修复**:
- 移除"加密"声称
- 改为"编码"或实现真正的 Web Crypto API 加密
- 添加警告提示用户数据安全

### P2-1: FAB 动画缺失
**根因**: `style.css` 中引用了 `animation: fabAppear`，但 `animations.css` 中未定义
**修复**:
- 在 `animations.css` 中添加 `@keyframes fabAppear`

### P2-2: 主题切换无过渡
**根因**: `body` 和 `:root` 无 `transition` 属性
**修复**:
- 在 `body` 添加 `transition: background-color 0.3s, color 0.3s`

## 样式清单

### 详情页
- `.detail-page` - 详情页容器
- `.page-header` - 页面头部（返回按钮 + 标题 + 操作按钮）
- `.back-btn` - 返回按钮
- `.detail-action-btn` - 操作按钮（编辑/删除/收藏）✅ 新增
- `.detail-content` - 详情内容区
- `.detail-field` - 字段容器
- `.detail-label` - 字段标签
- `.detail-value` - 字段值
- `.detail-actions` - 操作按钮组

### 主题面板
- `.theme-selector` - 主题选择器容器 ✅ 添加 position: relative
- `.theme-toggle` - 主题切换按钮
- `.theme-panel` - 主题面板 ✅ 修复定位
- `.theme-options` - 主题选项列表
- `.theme-option` - 单个主题选项
- `.theme-color` - 主题颜色预览

## 交互状态机

```
[home] --FAB 点击--> [form] (新建)
[home] --卡片点击--> [detail]
[detail] --编辑按钮--> [form] (编辑)
[detail] --返回按钮--> [previousPage]
[form] --返回按钮--> [previousPage]
[form] --保存按钮--> [home] (或 previousPage)
[favorites] --卡片点击--> [detail]
```

### 状态变量
- `currentPage`: 当前页面 ('home', 'favorites', 'detail', 'form', 'profile')
- `previousPage`: 上一个页面（用于返回）
- `editingItemId`: 正在编辑的项目 ID（null 表示新建）
- `currentItemId`: 当前查看的项目 ID（详情页使用）

## CSS 定位策略

### 固定定位 (Fixed)
- `.tab-bar` - 底部标签栏
- `.fab` - 悬浮按钮
- `.toast` - 提示消息
- `.theme-overlay` - 主题遮罩
- `.theme-selector-panel` - 主题选择面板（全屏居中）

### 绝对定位 (Absolute)
- `.theme-panel` - 主题下拉面板（相对于 `.theme-selector`）
  - `.theme-selector` 必须设置 `position: relative`

### 相对定位 (Relative)
- `.theme-selector` - 主题选择器容器
- `.header` - 顶部导航（作为子元素定位参照）

## 动画清单

### 页面切换
- `fadeIn` - 页面淡入

### 卡片动画
- `slideUp` - 卡片逐个上滑出现
- `deleteSlide` - 删除时左滑消失

### 按钮动画
- `fabAppear` - FAB 按钮出现（缩放 + 旋转）✅ 修复
- `focusPulse` - 输入框焦点脉冲

### 面板动画
- `themePanelIn` - 主题面板弹出
- `modalOverlayIn` - 模态框遮罩
- `modalContentIn` - 模态框内容

### 提示动画
- `toastIn` - 提示消息滑入

### 其他
- `spin` - 加载旋转
- `favoritePop` - 收藏心跳动画

## 性能优化

### 搜索防抖
- 防抖时间：300ms
- 实现：通用 `debounce` 函数

### 虚拟滚动
- 阈值：100 条记录
- 当前未实现（v2.2.1 暂不添加）

### 代码分割
- 当前所有 JS 同步加载
- v2.3.0 考虑按需加载

## 安全改进

### 云同步
- 移除"加密"声称
- 改为"编码传输"
- 添加用户警告："数据以 Base64 编码传输，请勿存储敏感信息"

### 数据导入
- 添加确认对话框
- 提供"合并"或"覆盖"选项
- 导入前自动备份

## 测试清单

### 功能测试
- [x] 新建记录
- [x] 编辑记录
- [x] 删除记录
- [x] 收藏/取消收藏
- [ ] 搜索记录（防抖已添加，需实机验证）
- [ ] 主题切换
- [ ] 导出数据
- [ ] 导入数据
- [ ] 页面切换（previousPage 已修复）
- [ ] 表单返回（previousPage 已修复）

### 交互测试
- [ ] FAB 按钮点击
- [ ] 主题面板打开/关闭
- [ ] 搜索输入防抖
- [ ] 详情页编辑按钮
- [ ] 表单自动聚焦
- [ ] 空状态显示

### 样式测试
- [ ] 明亮主题
- [ ] 暗黑主题
- [ ] 暖光主题
- [ ] 墨影主题
- [ ] 移动端响应式
- [ ] FAB 按钮动画
- [ ] 卡片悬停效果

### 兼容性测试
- [ ] Chrome 桌面
- [ ] Chrome 移动
- [ ] Safari iOS
- [ ] Edge 桌面
- [ ] Firefox 桌面
