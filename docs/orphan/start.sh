#!/bin/bash

echo "==================================="
echo "  万物手札 H5 - 本地启动"
echo "==================================="
echo ""

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未检测到 Python，请先安装 Python"
    echo "macOS: brew install python"
    echo "Linux: sudo apt install python3"
    exit 1
fi

echo "[✓] Python 已安装"
echo ""
echo "正在启动本地服务器..."
echo ""
echo "访问地址：http://localhost:8080"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""
echo "==================================="
echo ""

python3 -m http.server 8080
