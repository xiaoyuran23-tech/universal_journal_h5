#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
万物手札 H5 - 项目检查脚本
"""
import os
import json

PROJECT_ROOT = r'D:\QwenPawOut001\universal_journal_h5'

def check_file(path, desc):
    full_path = os.path.join(PROJECT_ROOT, path)
    if os.path.exists(full_path):
        size = os.path.getsize(full_path)
        print(f"✅ {desc}: {path} ({size:,} bytes)")
        return True
    else:
        print(f"❌ {desc}缺失：{path}")
        return False

def check_dir(path, desc):
    full_path = os.path.join(PROJECT_ROOT, path)
    if os.path.isdir(full_path):
        print(f"✅ {desc}存在：{path}")
        return True
    else:
        print(f"❌ {desc}缺失：{path}")
        return False

def main():
    print("=" * 60)
    print("🔍 万物手札 H5 - 项目检查")
    print("=" * 60)
    print()
    
    print("📁 根目录文件:")
    check_file('index.html', '主页面')
    check_file('README.md', '说明文档')
    check_file('start.bat', 'Windows 启动脚本')
    check_file('start.sh', 'Linux/Mac 启动脚本')
    print()
    
    print("📂 目录结构:")
    check_dir('css', '样式目录')
    check_dir('js', '脚本目录')
    check_dir('assets', '资源目录')
    print()
    
    print("🎨 样式文件:")
    check_file('css/style.css', '主样式')
    print()
    
    print("📜 脚本文件:")
    check_file('js/app.js', '主应用逻辑')
    check_file('js/charts.js', '图表模块')
    print()
    
    print("🖼️ 资源文件:")
    check_file('assets/empty.png', '空状态图标')
    print()
    
    # 检查 HTML 内容
    print("🔍 HTML 结构检查:")
    html_path = os.path.join(PROJECT_ROOT, 'index.html')
    if os.path.exists(html_path):
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        checks = [
            ('<!DOCTYPE html>', 'DOCTYPE 声明'),
            ('<meta name="viewport"', 'Viewport 配置'),
            ('echarts.min.js', 'ECharts 引入'),
            ('js/app.js', '主脚本引入'),
            ('js/charts.js', '图表脚本引入'),
            ('id="app"', '应用容器'),
            ('class="tab-bar"', 'TabBar'),
            ('class="fab"', '悬浮按钮'),
        ]
        
        for check, desc in checks:
            if check in content:
                print(f"   ✅ {desc}")
            else:
                print(f"   ❌ {desc}缺失")
    print()
    
    print("=" * 60)
    print("✅ 检查完成！")
    print("=" * 60)
    print()
    print("📌 启动方式:")
    print("1. Windows: 双击 start.bat")
    print("2. macOS/Linux: ./start.sh")
    print("3. 直接打开 index.html (部分功能受限)")
    print()
    print("🌐 访问地址：http://localhost:8080")
    print()

if __name__ == '__main__':
    main()
