/**
 * Graph Plugin - 关系图谱可视化
 * 使用 ECharts 渲染记录之间的双向链接关系
 * @version 6.3.0
 */

// 幂等加载保护
if (!window.GraphPlugin) {
const GraphPlugin = {
  name: 'graph',
  version: '1.0.0',
  dependencies: ['records'],

  _chart: null,
  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[GraphPlugin] Initializing...');
    this.routes = [
      { path: 'graph', title: '关系图谱', component: 'graph-view', guard: () => true }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[GraphPlugin] Starting...');
    if (!this._eventsBound) {
      this._bindEvents();
      this._eventsBound = true;
    }
  },

  stop() {
    if (this._chart) {
      this._chart.dispose();
      this._chart = null;
    }
    this._eventsBound = false;
  },

  routes: [],
  actions: {},

  /**
   * 渲染关系图
   */
  async render(containerId) {
    const container = document.getElementById(containerId || 'graph-container');
    if (!container) return;

    // 检查 ECharts 是否可用
    if (!window.echarts) {
      container.innerHTML = `
        <div class="graph-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          <p>ECharts 未加载，请检查网络连接后刷新页面</p>
        </div>
      `;
      return;
    }

    // 初始化/重置 chart
    if (this._chart) {
      this._chart.dispose();
    }
    this._chart = echarts.init(container);

    // 获取所有记录
    const records = window.Store ? (Store.getState('records.list') || []) : [];

    if (records.length === 0) {
      container.innerHTML = `
        <div class="graph-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/>
            <path d="M7.5 10.5L16.5 6.5M7.5 13.5L16.5 17.5"/>
          </svg>
          <h3>暂无记录</h3>
          <p>快去创建你的第一条记录吧！</p>
        </div>
      `;
      return;
    }

    // 收集所有有 links 的记录
    const recordsWithLinks = records.filter(r => r.links && r.links.length > 0);

    if (recordsWithLinks.length === 0) {
      // 没有链接关系，显示孤立节点 + 提示
      this._renderIsolatedNodes(records, container);
      return;
    }

    // 构建图数据
    const { nodes, edges } = this._buildGraphData(records);

    if (edges.length === 0) {
      this._renderIsolatedNodes(records, container);
      return;
    }

    const option = {
      title: {
        text: '记录关系图谱',
        left: 'center',
        top: 10,
        textStyle: { fontSize: 16, fontWeight: 500 }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.dataType === 'node') {
            const r = params.data;
            return `<strong>${r.name}</strong><br/>
              <span style="color:#999">创建于: ${new Date(r.createdAt).toLocaleDateString()}</span><br/>
              <span style="color:#999">${r.wordCount || 0} 字</span><br/>
              ${r.tags && r.tags.length ? `标签: ${r.tags.join(', ')}` : ''}`;
          }
          return '';
        }
      },
      legend: [{
        data: this._getUniqueTags(records),
        orient: 'vertical',
        left: 10,
        top: 40
      }],
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: edges,
        roam: true,
        draggable: true,
        focusNodeAdjacency: true,
        force: {
          repulsion: 300,
          edgeLength: [80, 200],
          gravity: 0.1,
          layoutAnimation: true
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          fontSize: 11
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3,
          width: 2
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 4 }
        },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 8
      }]
    };

    this._chart.setOption(option);

    // 点击节点导航到记录详情
    this._chart.on('click', (params) => {
      if (params.dataType === 'node' && params.data.recordId) {
        this._navigateToRecord(params.data.recordId);
      }
    });

    // 响应窗口大小变化
    window.addEventListener('resize', () => {
      if (this._chart) this._chart.resize();
    });
  },

  /**
   * 渲染孤立节点 (无链接关系时)
   * @private
   */
  _renderIsolatedNodes(records, container) {
    // 显示所有记录作为孤立节点
    const nodes = records.map(r => ({
      id: r.id,
      name: r.name || '未命名',
      value: (r.metadata && r.metadata.wordCount) || 0,
      symbolSize: Math.max(20, Math.min(60, ((r.metadata && r.metadata.wordCount) || 0) / 10)),
      category: (r.tags && r.tags.length > 0) ? r.tags[0] : '无标签',
      itemStyle: { color: this._colorForTag((r.tags && r.tags[0]) || '') },
      recordId: r.id,
      wordCount: (r.metadata && r.metadata.wordCount) || 0,
      createdAt: r.createdAt,
      tags: r.tags || []
    }));

    const option = {
      title: {
        text: '记录关系图谱',
        subtext: '暂无链接关系。在笔记中使用 [[记录名称]] 来创建链接',
        left: 'center',
        top: 10,
        textStyle: { fontSize: 16, fontWeight: 500 }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.dataType === 'node') {
            return `<strong>${params.name}</strong><br/>
              <span style="color:#999">字数: ${params.data.wordCount || 0}</span>`;
          }
          return '';
        }
      },
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: [],
        roam: true,
        draggable: true,
        force: {
          repulsion: 150,
          edgeLength: 100,
          gravity: 0.05
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          fontSize: 10
        },
        emphasis: {
          focus: 'adjacency'
        }
      }]
    };

    this._chart.setOption(option);

    this._chart.on('click', (params) => {
      if (params.dataType === 'node' && params.data.recordId) {
        this._navigateToRecord(params.data.recordId);
      }
    });

    window.addEventListener('resize', () => {
      if (this._chart) this._chart.resize();
    });
  },

  /**
   * 构建图数据 (nodes + edges)
   * @private
   */
  _buildGraphData(records) {
    const recordMap = {};
    records.forEach(r => { recordMap[r.id] = r; });

    // 收集所有涉及到的记录 ID (有链接的)
    const involvedIds = new Set();
    records.forEach(r => {
      if (r.links && r.links.length > 0) {
        involvedIds.add(r.id);
        r.links.forEach(l => involvedIds.add(l.targetId));
      }
    });

    const nodes = [];
    const edges = [];

    // 为涉及到的记录创建节点
    involvedIds.forEach(id => {
      const r = recordMap[id];
      if (!r) return;
      const primaryTag = (r.tags && r.tags.length > 0) ? r.tags[0] : '无标签';
      const wordCount = (r.metadata && r.metadata.wordCount) || 0;

      nodes.push({
        id: r.id,
        name: r.name || '未命名',
        value: wordCount,
        symbolSize: Math.max(20, Math.min(60, wordCount / 10 + 20)),
        category: primaryTag,
        itemStyle: { color: this._colorForTag(primaryTag) },
        recordId: r.id,
        wordCount,
        createdAt: r.createdAt,
        tags: r.tags || []
      });
    });

    // 创建边
    records.forEach(r => {
      if (!r.links || r.links.length === 0) return;
      r.links.forEach(link => {
        if (involvedIds.has(link.targetId)) {
          edges.push({
            source: r.id,
            target: link.targetId,
            value: 1,
            lineStyle: { width: 2 }
          });
        }
      });
    });

    return { nodes, edges };
  },

  /**
   * 获取所有唯一的标签
   * @private
   */
  _getUniqueTags(records) {
    const tags = new Set();
    records.forEach(r => {
      if (r.tags && r.tags.length > 0) {
        r.tags.forEach(t => tags.add(t));
      }
    });
    if (tags.size === 0) tags.add('无标签');
    return Array.from(tags);
  },

  /**
   * 根据标签名生成颜色
   * @private
   */
  _colorForTag(tag) {
    if (!tag || tag === '无标签') return '#999';
    const colors = [
      '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
      '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6',
      '#d48265', '#c23531', '#61a0a8', '#91c7ae', '#749f83'
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  },

  /**
   * 导航到记录详情
   * @private
   */
  _navigateToRecord(recordId) {
    // 关闭 graph 页面，显示详情页
    if (window.Router) {
      Router.navigate('home');
    }

    // 触发记录点击
    setTimeout(() => {
      if (window.HomePage && window.homePageInstance) {
        window.homePageInstance._handleRecordClick(recordId);
      }
    }, 100);
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    // 导航到 graph 页面时渲染
    if (window.Router) {
      Router.subscribe(route => {
        if (route && route.path === 'graph') {
          setTimeout(() => this.render('graph-container'), 100);
        }
      });
    }
  }
};

window.GraphPlugin = GraphPlugin;
console.log('[GraphPlugin] 关系图谱插件已定义');
} else {
  console.log('[GraphPlugin] 已存在，跳过加载');
}
