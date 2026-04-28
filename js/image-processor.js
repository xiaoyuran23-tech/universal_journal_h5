/**
 * 万物手札 - 图片处理模块
 * 提供图片压缩、格式转换、缩略图生成等功能
 * 版本：v3.2.0
 */

const ImageProcessor = {
  // 默认配置
  DEFAULT_QUALITY: 0.7,
  MAX_WIDTH: 1200,
  MAX_HEIGHT: 1200,
  THUMBNAIL_SIZE: 300,
  
  /**
   * 压缩单张图片（带进度回调）
   * @param {File|Blob} file - 原始图片文件
   * @param {Object} options - 压缩选项
   * @param {Function} onProgress - 进度回调 (percent, originalSize, compressedSize)
   * @returns {Promise<Object>} - { dataUrl, originalSize, compressedSize, ratio }
   */
  async compress(file, options = {}, onProgress = null) {
    const {
      quality = this.DEFAULT_QUALITY,
      maxWidth = this.MAX_WIDTH,
      maxHeight = this.MAX_HEIGHT,
      outputFormat = this.supportsWebP() ? 'image/webp' : 'image/jpeg'
    } = options;
    
    const originalSize = file.size;
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(20, originalSize, 0); // 读取进度 20%
        }
      };
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          // 计算压缩后的尺寸
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          // 创建 Canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // 导出为 Base64
          const dataUrl = canvas.toDataURL(outputFormat, quality);
          const compressedSize = this.getImageSize(dataUrl);
          
          // 计算压缩比
          const ratio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : 0;
          
          if (onProgress) onProgress(100, originalSize, compressedSize);
          
          resolve({
            dataUrl,
            originalSize,
            compressedSize,
            ratio: parseFloat(ratio),
            width,
            height
          });
        };
        
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target.result;
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  },
  
  /**
   * 批量压缩图片（带进度回调）
   * @param {File[]} files - 图片文件数组
   * @param {Object} options - 压缩选项
   * @param {Function} onProgress - 进度回调 (current, total, fileIndex, result)
   * @returns {Promise<Array>} - 压缩结果数组
   */
  async compressMultiple(files, options = {}, onProgress = null) {
    const results = [];
    const total = files.length;
    
    for (let i = 0; i < total; i++) {
      const file = files[i];
      try {
        const result = await this.compress(file, options, (percent, origSize, compSize) => {
          if (onProgress) {
            const overallProgress = ((i + percent / 100) / total) * 100;
            onProgress(overallProgress, i, total, {
              fileName: file.name,
              percent,
              originalSize: origSize,
              compressedSize: compSize
            });
          }
        });
        results.push(result);
      } catch (e) {
        console.error('压缩失败:', file.name, e);
        results.push({
          error: e.message,
          fileName: file.name,
          originalSize: file.size
        });
      }
    }
    
    return results;
  },
  
  /**
   * 生成缩略图
   * @param {string} dataUrl - 原始图片 Base64
   * @param {number} size - 缩略图尺寸
   * @returns {Promise<string>} - 缩略图 Base64
   */
  async generateThumbnail(dataUrl, size = this.THUMBNAIL_SIZE) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // 计算缩略图尺寸（保持比例，填充正方形）
        let thumbWidth = size;
        let thumbHeight = size;
        let offsetX = 0;
        let offsetY = 0;
        
        const ratio = Math.max(size / img.width, size / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;
        
        if (newWidth > size) {
          thumbWidth = size;
          thumbHeight = newHeight;
          offsetY = (size - thumbHeight) / 2;
        } else {
          thumbHeight = size;
          thumbWidth = newWidth;
          offsetX = (size - thumbWidth) / 2;
        }
        
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, offsetX, offsetY, thumbWidth, thumbHeight);
        
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  },
  
  /**
   * 计算图片大小（字节）
   * @param {string} dataUrl - Base64 图片
   * @returns {number} - 字节数
   */
  getImageSize(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return 0;
    return Math.round((base64.length * 3) / 4);
  },
  
  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} - 格式化后的大小
   */
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },
  
  /**
   * 检查是否支持 WebP 格式
   * @returns {boolean}
   */
  supportsWebP() {
    const canvas = document.createElement('canvas');
    if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
      return true;
    }
    return false;
  }
};

// 全局导出
window.ImageProcessor = ImageProcessor;
