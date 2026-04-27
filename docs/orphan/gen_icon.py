#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成「单色墨影」风格空状态图标 - 非对称构图
"""
import os, zlib, struct

def create_ink_empty_icon(filename, size=80):
    width, height = size, size
    
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'
        for x in range(width):
            # 纯白背景
            base = [255, 255, 255, 255]
            
            # 主墨点 - 偏左
            dx1 = x - int(width * 0.4)
            dy1 = y - int(height * 0.5)
            dist1 = (dx1*dx1 + dy1*dy1) ** 0.5
            
            # 次要墨点 - 右上
            dx2 = x - int(width * 0.7)
            dy2 = y - int(height * 0.3)
            dist2 = (dx2*dx2 + dy2*dy2) ** 0.5
            
            if dist1 < 18:
                alpha = int(255 * (1 - dist1/18))
                raw_data += bytes([30, 30, 30, alpha])
            elif dist2 < 8:
                alpha = int(255 * (1 - dist2 / 8))
                raw_data += bytes([50, 50, 50, max(0, alpha)])
            elif y > int(height * 0.75) and abs(x - int(width*0.5)) < 20:
                raw_data += bytes([80, 80, 80, 60])
            else:
                raw_data += bytes(base)
    
    compressed = zlib.compress(raw_data)
    
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = zlib.crc32(c) & 0xffffffff
        return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)
    
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', compressed)
    png += chunk(b'IEND', b'')
    
    with open(filename, 'wb') as f:
        f.write(png)
    print(f'✅ 生成「单色墨影」图标：{filename}')

if __name__ == '__main__':
    create_ink_empty_icon('assets/empty.png', 80)
