/**
 * ImageService - 图片处理服务
 * 提供压缩、Base64 转换、缩略图生成、缓存管理
 * @version 6.1.0
 */

class ImageService {
  static CACHE_KEY_PREFIX = 'img_cache_';
  static DEFAULT_QUALITY = 0.7;
  static MAX_WIDTH = 1200;
  static MAX_HEIGHT = 1200;
  static THUMBNAIL_SIZE = 200;

  /**
   * 压缩图片
   * @param {File|Blob|HTMLImageElement} source
   * @param {Object} options
   * @param {number} [options.quality=0.7] - JPEG 质量 (0-1)
   * @param {number} [options.maxWidth=1200] - 最大宽度
   * @param {number} [options.maxHeight=1200] - 最大高度
   * @returns {Promise<string>} - Base64 Data URL
   */
  static async compress(source, options = {}) {
    const {
      quality = this.DEFAULT_QUALITY,
      maxWidth = this.MAX_WIDTH,
      maxHeight = this.MAX_HEIGHT,
      format = 'image/jpeg'
    } = options;

    const image = await this._loadImage(source);
    const { width, height } = this._calculateSize(image.width, image.height, maxWidth, maxHeight);

    // 创建 Canvas 并绘制
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    // 导出为 Base64
    return canvas.toDataURL(format, quality);
  }

  /**
   * 生成缩略图
   * @param {File|Blob|HTMLImageElement} source
   * @param {number} [size=200] - 缩略图尺寸
   * @returns {Promise<string>} - Base64 Data URL
   */
  static async generateThumbnail(source, size = this.THUMBNAIL_SIZE) {
    const image = await this._loadImage(source);
    const { width, height } = this._calculateSize(image.width, image.height, size, size);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  /**
   * 将 File/Blob 转换为 Base64
   * @param {File|Blob} file
   * @returns {Promise<string>}
   */
  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 将 Base64 转换为 Blob
   * @param {string} base64
   * @returns {Promise<Blob>}
   */
  static base64ToBlob(base64) {
    const [header, data] = base64.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(data);
    const array = new Uint8Array(bytes.length);
    
    for (let i = 0; i < bytes.length; i++) {
      array[i] = bytes.charCodeAt(i);
    }
    
    return new Blob([array], { type: mime });
  }

  /**
   * 图片旋转 (修复 EXIF 方向)
   * @param {File} file
   * @param {number} orientation - EXIF 方向 (1-8)
   * @param {Object} options
   * @returns {Promise<string>}
   */
  static async rotateImage(file, orientation, options = {}) {
    const image = await this._loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 根据方向设置 Canvas 尺寸
    const swap = orientation > 4;
    canvas.width = swap ? image.height : image.width;
    canvas.height = swap ? image.width : image.height;

    // 应用旋转
    const transforms = {
      2: () => { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); },
      3: () => { ctx.translate(canvas.width, canvas.height); ctx.rotate(Math.PI); },
      4: () => { ctx.translate(0, canvas.height); ctx.scale(1, -1); },
      5: () => { ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1); },
      6: () => { ctx.rotate(0.5 * Math.PI); ctx.translate(0, -canvas.width); },
      7: () => { ctx.rotate(0.5 * Math.PI); ctx.translate(canvas.height, -canvas.width); ctx.scale(-1, 1); },
      8: () => { ctx.rotate(-0.5 * Math.PI); ctx.translate(-canvas.height, 0); }
    };

    if (transforms[orientation]) {
      transforms[orientation]();
    }

    ctx.drawImage(image, 0, 0);

    const { quality = this.DEFAULT_QUALITY } = options;
    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * 获取图片 EXIF 方向
   * @param {File|Blob} file
   * @returns {Promise<number>} - 方向值 (1-8)
   */
  static async getExifOrientation(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const view = new DataView(e.target.result);
        
        // 检查 JPEG SOI marker
        if (view.getUint16(0, false) !== 0xFFD8) {
          return resolve(1);
        }

        let offset = 2;
        while (offset < view.byteLength) {
          const marker = view.getUint16(offset, false);
          offset += 2;

          // APP1 marker
          if (marker === 0xFFE1) {
            if (view.getUint32(offset + 2, false) !== 0x45786966) {
              return resolve(1);
            }

            const littleEndian = view.getUint16(offset + 10, false) === 0x4949;
            const ifdOffset = view.getUint32(offset + 14, littleEndian);
            const entries = view.getUint16(offset + ifdOffset, littleEndian);

            for (let i = 0; i < entries; i++) {
              const entryOffset = offset + ifdOffset + 2 + (i * 12);
              const tag = view.getUint16(entryOffset, littleEndian);
              
              // Orientation tag (0x0112)
              if (tag === 0x0112) {
                return resolve(view.getUint16(entryOffset + 8, littleEndian));
              }
            }
          }

          offset += view.getUint16(offset, false);
        }

        resolve(1);
      };
      reader.readAsArrayBuffer(file.slice(0, 64 * 1024)); // 只读取前 64KB
    });
  }

  /**
   * 计算缩放后的尺寸
   * @private
   */
  static _calculateSize(width, height, maxWidth, maxHeight) {
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }

    const ratio = Math.min(maxWidth / width, maxHeight / height);
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio)
    };
  }

  /**
   * 加载图片
   * @private
   */
  static _loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片加载失败'));

      if (source instanceof File || source instanceof Blob) {
        image.src = URL.createObjectURL(source);
        image.onload = () => {
          URL.revokeObjectURL(image.src);
          resolve(image);
        };
      } else if (source instanceof HTMLImageElement) {
        if (source.complete) {
          resolve(source);
        } else {
          source.onload = () => resolve(source);
          source.onerror = reject;
        }
      } else if (typeof source === 'string') {
        image.src = source;
      } else {
        reject(new Error('不支持的图片源'));
      }
    });
  }

  /**
   * 估算 Base64 图片大小 (字节)
   */
  static estimateSize(base64) {
    const base64Str = base64.includes(',') ? base64.split(',')[1] : base64;
    return Math.round((base64Str.length * 3) / 4);
  }

  /**
   * 格式化大小
   */
  static formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

// 全局暴露
window.ImageService = ImageService;

console.log('[ImageService] 图片处理服务已加载');
