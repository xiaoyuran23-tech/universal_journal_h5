/**
 * ImageService 单元测试
 * 测试工具方法 (压缩、Base64、大小计算)
 */

let ImageService;

beforeAll(() => {
  delete global.window.ImageService;
  
  const fs = require('fs');
  const path = require('path');
  const serviceCode = fs.readFileSync(path.resolve(__dirname, '../../src/services/image.js'), 'utf-8');
  
  eval(serviceCode);
  ImageService = global.window.ImageService;
});

describe('ImageService - 工具方法', () => {
  test('estimateSize 计算 Base64 大小', () => {
    const base64 = btoa('Hello World');
    const size = ImageService.estimateSize(base64);
    // Base64 编码后大小 ≈ 原始大小的 4/3
    expect(size).toBeGreaterThan(0);
  });

  test('estimateSize 处理带 header 的 Data URL', () => {
    const base64 = 'data:image/png;base64,' + btoa('Hello World');
    const size = ImageService.estimateSize(base64);
    expect(size).toBeGreaterThan(0);
  });

  test('formatSize 格式化字节', () => {
    expect(ImageService.formatSize(100)).toBe('100 B');
    expect(ImageService.formatSize(1024)).toBe('1.0 KB');
    expect(ImageService.formatSize(1024 * 1024)).toBe('1.00 MB');
  });

  test('_calculateSize 保持宽高比', () => {
    const result = ImageService._calculateSize(800, 600, 400, 300);
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  test('_calculateSize 不放大', () => {
    const result = ImageService._calculateSize(200, 150, 400, 300);
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
  });

  test('_calculateSize 等比缩放', () => {
    const result = ImageService._calculateSize(1920, 1080, 400, 300);
    // 按限制等比缩放: min(400/1920, 300/1080)
    const ratio = Math.min(400 / 1920, 300 / 1080);
    expect(result.width).toBe(Math.round(1920 * ratio));
    expect(result.height).toBe(Math.round(1080 * ratio));
    expect(result.width).toBeLessThanOrEqual(400);
    expect(result.height).toBeLessThanOrEqual(300);
  });
});

describe('ImageService - Base64 转换', () => {
  test('fileToBase64 转换 Blob', async () => {
    const blob = new Blob(['test content'], { type: 'text/plain' });
    const result = await ImageService.fileToBase64(blob);
    expect(result.startsWith('data:')).toBe(true);
    expect(result).toContain('text/plain');
  });

  test('base64ToBlob 转回 Blob', async () => {
    const base64 = 'data:text/plain;base64,' + btoa('Hello World');
    const blob = await ImageService.base64ToBlob(base64);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/plain');
  });
});
