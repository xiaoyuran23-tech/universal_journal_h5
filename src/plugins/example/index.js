/**
 * Example Plugin - "每日灵感" 示例插件
 * 在每次新建记录时自动添加一句每日灵感语录到 notes 末尾。
 * 演示：插件生命周期、Store 访问、钩子注册、Toast 通知
 * @version 1.0.0
 */

if (!window.ExamplePlugin) {

// 每日灵感池
const INSPIRATIONS = [
  "每一个不曾起舞的日子，都是对生命的辜负。——尼采",
  "世界上只有一种英雄主义，那就是认清生活的真相后依然热爱生活。——罗曼·罗兰",
  "万物皆有裂痕，那是光照进来的地方。——莱昂纳德·科恩",
  "生活不是等待暴风雨过去，而是学会在雨中跳舞。——维维安·格林",
  "人生没有彩排，每天都是现场直播。",
  "种一棵树最好的时间是十年前，其次是现在。——非洲谚语",
  "你若盛开，清风自来。",
  "星光不问赶路人，时光不负有心人。",
  "把每一天都当作生命中最后一天来度过。——史蒂夫·乔布斯",
  "不是因为看到了希望才坚持，而是因为坚持才看到希望。",
  "世间所有的相遇，都是久别重逢。——白落梅",
  "愿你出走半生，归来仍是少年。",
  "不积跬步，无以至千里；不积小流，无以成江海。——荀子",
  "长风破浪会有时，直挂云帆济沧海。——李白",
  "路漫漫其修远兮，吾将上下而求索。——屈原"
];

// 根据日期获取当天的灵感 (保证同一天显示同一句)
function getDailyInspiration() {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  );
  return INSPIRATIONS[dayOfYear % INSPIRATIONS.length];
}

const ExamplePlugin = {
  name: 'example',
  version: '1.0.0',
  dependencies: ['records'],

  _api: null,
  _hookUnregister: null,
  _actionButton: null,

  /**
   * 初始化：接收 PluginAPI，注册钩子
   * @param {PluginAPI} api
   */
  async init(api) {
    console.log('[ExamplePlugin] Initializing...');
    this._api = api;

    // 注册 beforeSave 钩子：在新建记录时添加每日灵感
    this._hookUnregister = api.hooks.register('record:afterSave', (data) => {
      // 仅对新建记录生效 (通过判断 _justCreated 标记)
      if (data && data._justCreated) {
        const inspiration = getDailyInspiration();
        const record = data.record || data;
        // 在 notes 末尾追加灵感
        const separator = record.notes ? '\n\n' : '';
        record.notes = record.notes + separator + `> ${inspiration}`;
        record.updatedAt = Date.now();

        console.log('[ExamplePlugin] Added daily inspiration to record:', record.id);
      }
      return data;
    });
  },

  /**
   * 启动：监听创建事件、添加测试按钮
   * @param {PluginAPI} api
   */
  async start(api) {
    console.log('[ExamplePlugin] Starting...');

    // 监听 records:created 事件，弹出 toast
    api.events.on('records:created', (record) => {
      const inspiration = getDailyInspiration();
      api.ui.toast(`已添加今日灵感: "${inspiration.slice(0, 15)}..."`);
    });

    // 在页面底部添加"今日灵感"小工具
    this._renderWidget(api);
  },

  /**
   * 停止：清理事件和 DOM
   */
  stop() {
    console.log('[ExamplePlugin] Stopping...');

    // 取消钩子注册
    if (this._hookUnregister) {
      this._hookUnregister();
      this._hookUnregister = null;
    }

    // 移除 DOM 组件
    if (this._actionButton && this._actionButton.parentNode) {
      this._actionButton.parentNode.removeChild(this._actionButton);
    }
    const widget = document.getElementById('example-widget');
    if (widget) widget.remove();

    this._api = null;
  },

  /**
   * 渲染"今日灵感"小组件
   * @private
   */
  _renderWidget(api) {
    // 延迟渲染，确保 DOM 已就绪
    requestAnimationFrame(() => {
      const container = document.getElementById('page-home');
      if (!container) return;

      const widget = document.createElement('div');
      widget.id = 'example-widget';
      widget.style.cssText = `
        margin: 16px; padding: 16px; background: linear-gradient(135deg, #667eea, #764ba2);
        color: white; border-radius: 12px; font-size: 14px; line-height: 1.6;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      `;

      const inspiration = getDailyInspiration();

      widget.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div style="flex:1;">
            <div style="font-size:12px; opacity:0.8; margin-bottom:4px;">每日灵感</div>
            <div style="font-size:15px; font-weight:500;">${inspiration}</div>
          </div>
          <button id="example-refresh-btn" style="
            background:rgba(255,255,255,0.2); border:none; color:white;
            padding:4px 8px; border-radius:6px; cursor:pointer; font-size:16px;
          " title="换一句">&#x21bb;</button>
        </div>
      `;

      // 随机切换灵感按钮
      const refreshBtn = widget.querySelector('#example-refresh-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          const randomIdx = Math.floor(Math.random() * INSPIRATIONS.length);
          const textEl = widget.querySelector('div div:nth-child(2)');
          if (textEl) {
            textEl.textContent = INSPIRATIONS[randomIdx];
            api.ui.toast('已更换灵感');
          }
        });
      }

      container.appendChild(widget);
    });
  },

  actions: {},
  routes: []
};

// 全局暴露
window.ExamplePlugin = ExamplePlugin;

console.log('[ExamplePlugin] 示例插件已定义 (每日灵感)');

} else {
  console.log('[ExamplePlugin] 已存在，跳过加载');
}
