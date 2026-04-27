/**
 * 万物手札 H5 - ECharts 图表模块
 */

const Charts = {
  categoryChart: null,
  statusChart: null,
  
  init() {
    // 图表会在 render 时自动初始化
  },
  
  renderCategoryChart(data) {
    const chartDom = document.getElementById('category-chart');
    if (!chartDom) return;
    
    if (this.categoryChart) {
      this.categoryChart.dispose();
    }
    
    if (!data || data.length === 0) {
      chartDom.innerHTML = '<p style="text-align:center;color:#999;padding:100rpx 0;">暂无数据</p>';
      return;
    }
    
    this.categoryChart = echarts.init(chartDom);
    
    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        top: '5%',
        left: 'center',
        textStyle: {
          fontSize: 12
        }
      },
      series: [
        {
          name: '品类分布',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: data.map(item => ({
            name: item.name,
            value: item.value
          }))
        }
      ]
    };
    
    this.categoryChart.setOption(option);
    
    // 响应式
    window.addEventListener('resize', () => {
      this.categoryChart.resize();
    });
  },
  
  renderStatusChart(data) {
    const chartDom = document.getElementById('status-chart');
    if (!chartDom) return;
    
    if (this.statusChart) {
      this.statusChart.dispose();
    }
    
    if (!data || data.length === 0) {
      chartDom.innerHTML = '<p style="text-align:center;color:#999;padding:100rpx 0;">暂无数据</p>';
      return;
    }
    
    this.statusChart = echarts.init(chartDom);
    
    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map(item => item.name),
        axisTick: {
          alignWithLabel: true
        },
        axisLabel: {
          fontSize: 12,
          rotate: 0
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 12
        }
      },
      series: [
        {
          name: '数量',
          type: 'bar',
          barWidth: '60%',
          data: data.map(item => item.value),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#83bff6' },
              { offset: 0.5, color: '#188df0' },
              { offset: 1, color: '#188df0' }
            ])
          },
          showBackground: true,
          backgroundStyle: {
            color: 'rgba(180, 190, 218, 0.15)'
          }
        }
      ]
    };
    
    this.statusChart.setOption(option);
    
    // 响应式
    window.addEventListener('resize', () => {
      this.statusChart.resize();
    });
  }
};

// 暴露给全局
window.Charts = Charts;
