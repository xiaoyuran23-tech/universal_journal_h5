/**
 * 万物手札 v4.0 - 图片处理器 V2
 * 核心功能：
 * 1. 图片压缩（Canvas 重绘，降低分辨率和质量）
 * 2. 上传至 GitHub Releases (或指定图床)
 * 3. 返回图片 URL
 * 4. 本地缓存管理
 */

const ImageProcessorV2 = {
  // 配置
  config: {
    maxFileSize: 2 * 1024 * 1024, // 2MB 限制
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    uploadTarget: 'github', // 'github' | 'smms' | 'local'
    github: {
      owner: '',
      repo: '',
      token: ''
    }
  },

  /**
   * 处理图片文件（主入口）
   * @param {File} file - 用户选择的文件
   * @returns {Promise<string>} - 图片 URL
   */
  async process(file) {
    // 1. 压缩
    const compressedBlob = await this.compress(file);
    
    // 2. 上传
    const url = await this.upload(compressedBlob, file.name);
    
    return url;
  },

  /**
   * 压缩图片
   */
  compress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 计算缩放比例
          if (width > this.config.maxWidth) {
            height = height * (this.config.maxWidth / width);
            width = this.config.maxWidth;
          }
          if (height > this.config.maxHeight) {
            width = width * (this.config.maxHeight / height);
            height = this.config.maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // 转换为 Blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('压缩失败'));
            }
          }, 'image/jpeg', this.config.quality);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  },

  /**
   * 上传图片
   */
  async upload(blob, filename) {
    if (this.config.uploadTarget === 'github') {
      return this.uploadToGitHub(blob, filename);
    } else {
      // 默认回退：转 Base64 存本地
      return this.blobToBase64(blob);
    }
  },

  /**
   * 上传到 GitHub (通过 Issues 附件或 Releases)
   * 这里使用一个简单的方案：上传到指定仓库的 `images` 目录
   */
  async uploadToGitHub(blob, filename) {
    if (!this.config.github.token) {
      throw new Error('未配置 GitHub Token');
    }

    // 读取 Blob 为 Base64
    const base64 = await this.blobToBase64(blob);
    const content = base64.split(',')[1]; // 去掉 data:image/jpeg;base64, 前缀

    const owner = this.config.github.owner;
    const repo = this.config.github.repo;
    const path = `images/${Date.now()}-${filename}`;

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${this.config.github.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `Upload image: ${filename}`,
        content: content
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub 上传失败: ${response.status}`);
    }

    const result = await response.json();
    // 返回 raw URL
    return result.content.download_url;
  },

  /**
   * Blob 转 Base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
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
