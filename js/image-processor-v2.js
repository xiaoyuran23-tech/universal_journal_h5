/**
 * 万物手札 v4.0 - 图片处理器 V2 (修复版)
 * 核心功能：
 * 1. 图片压缩（Canvas 重绘，降低分辨率和质量）
 * 2. 返回 Base64 URL (本地存储)
 * 3. 提供 formatSize 工具方法
 */

const ImageProcessorV2 = {
  // 配置
  config: {
    maxFileSize: 2 * 1024 * 1024, // 2MB 限制
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
  },

  /**
   * 压缩图片 (主入口)
   * @param {File} file - 用户选择的文件
   * @param {Object} options - 压缩选项
   * @returns {Promise<Object>} - { dataUrl, originalSize, compressedSize }
   */
  async compress(file, options = {}) {
    const maxWidth = options.maxWidth || this.config.maxWidth;
    const maxHeight = options.maxHeight || this.config.maxHeight;
    const quality = options.quality || this.config.quality;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const originalSize = file.size;
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 计算缩放比例
          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = width * (maxHeight / height);
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // 转换为 DataURL
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          // 计算压缩后大小 (Base64 长度约是实际大小的 4/3)
          const compressedSize = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);

          resolve({
            dataUrl: dataUrl,
            originalSize: originalSize,
            compressedSize: compressedSize
          });
        };
        img.onerror = () => reject(new Error('图片加载失败'));
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
    });
  },

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * 处理图片文件（完整流程：压缩 + 返回 DataURL）
   * @param {File} file - 用户选择的文件
   * @returns {Promise<string>} - DataURL
   */
  async process(file) {
    const result = await this.compress(file);
    return result.dataUrl;
  },

  /**
   * 从 URL 获取图片 Blob (用于下载/缓存)
   */
  async fetchImageBlob(url) {
    const response = await fetch(url);
    return response.blob();
  }
};

// 全局暴露
window.ImageProcessorV2 = ImageProcessorV2;
window.ImageProcessor = ImageProcessorV2; // 兼容别名
