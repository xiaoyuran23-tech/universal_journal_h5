/**
 * CryptoService - 基于 Web Crypto API 的加密服务
 * 提供 AES-GCM 加密/解密、PBKDF2 密钥派生、Hash 计算
 * @version 6.1.0
 */

class CryptoService {
  // AES-GCM 配置
  static ALGORITHM = 'AES-GCM';
  static KEY_LENGTH = 256;
  static IV_LENGTH = 12;
  static SALT_LENGTH = 16;

  /**
   * 从密码派生加密密钥 (PBKDF2)
   * @param {string} password
   * @param {Uint8Array} salt
   * @returns {Promise<CryptoKey>}
   */
  static async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密数据
   * @param {string|Object} data - 要加密的数据
   * @param {string} password - 密码
   * @returns {Promise<string>} - Base64 编码的密文
   */
  static async encrypt(data, password) {
    try {
      const encoder = new TextEncoder();
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

      // 生成随机盐和 IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // 派生密钥
      const key = await this.deriveKey(password, salt);

      // 加密
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext)
      );

      // 组合: salt (16) + iv (12) + ciphertext
      const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
      result.set(salt, 0);
      result.set(iv, salt.length);
      result.set(new Uint8Array(ciphertext), salt.length + iv.length);

      return this._arrayBufferToBase64(result.buffer);
    } catch (error) {
      console.error('[CryptoService] Encrypt failed:', error);
      throw new Error('加密失败: ' + error.message);
    }
  }

  /**
   * 解密数据
   * @param {string} base64Cipher - Base64 编码的密文
   * @param {string} password - 密码
   * @returns {Promise<string>} - 解密后的明文
   */
  static async decrypt(base64Cipher, password) {
    try {
      const decoder = new TextDecoder();
      const data = this._base64ToArrayBuffer(base64Cipher);
      const result = new Uint8Array(data);

      // 提取 salt, iv, ciphertext
      const salt = result.slice(0, this.SALT_LENGTH);
      const iv = result.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const ciphertext = result.slice(this.SALT_LENGTH + this.IV_LENGTH);

      // 派生密钥
      const key = await this.deriveKey(password, salt);

      // 解密
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      return decoder.decode(plaintext);
    } catch (error) {
      console.error('[CryptoService] Decrypt failed:', error);
      throw new Error('解密失败 (密码可能不正确): ' + error.message);
    }
  }

  /**
   * 加密对象并返回结构化数据
   * @param {Object} data
   * @param {string} password
   * @returns {Promise<Object>} - { salt, iv, ciphertext } (Base64)
   */
  static async encryptObject(data, password) {
    const plaintext = JSON.stringify(data);
    const encoder = new TextEncoder();

    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

    const key = await this.deriveKey(password, salt);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plaintext)
    );

    return {
      salt: this._arrayBufferToBase64(salt.buffer),
      iv: this._arrayBufferToBase64(iv.buffer),
      ciphertext: this._arrayBufferToBase64(ciphertext)
    };
  }

  /**
   * 解密结构化数据
   * @param {Object} encrypted - { salt, iv, ciphertext }
   * @param {string} password
   * @returns {Promise<Object>}
   */
  static async decryptObject(encrypted, password) {
    const salt = this._base64ToArrayBuffer(encrypted.salt);
    const iv = this._base64ToArrayBuffer(encrypted.iv);
    const ciphertext = this._base64ToArrayBuffer(encrypted.ciphertext);

    const key = await this.deriveKey(password, new Uint8Array(salt));

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(plaintext));
  }

  /**
   * 计算 SHA-256 哈希
   * @param {string|ArrayBuffer} data
   * @returns {Promise<string>} - 十六进制哈希
   */
  static async hash(data) {
    const encoder = new TextEncoder();
    const input = typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);

    const hashBuffer = await crypto.subtle.digest('SHA-256', input);
    return this._arrayBufferToHex(hashBuffer);
  }

  /**
   * 生成随机密钥
   * @returns {Promise<string>} - Base64 编码的密钥
   */
  static async generateKey() {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const exported = await crypto.subtle.exportKey('raw', key);
    return this._arrayBufferToBase64(exported);
  }

  /**
   * 验证密码强度
   * @param {string} password
   * @returns {{valid: boolean, error?: string}}
   */
  static validatePassword(password) {
    if (!password || password.length < 6) {
      return { valid: false, error: '密码至少 6 位' };
    }
    if (password.length > 128) {
      return { valid: false, error: '密码不能超过 128 位' };
    }
    return { valid: true };
  }


  /**
   * 工具: ArrayBuffer -> Base64
   */
  static _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  /**
   * 工具: Base64 -> ArrayBuffer
   */
  static _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * 工具: ArrayBuffer -> Hex
   */
  static _arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// 全局暴露
window.CryptoService = CryptoService;

console.log('[CryptoService] 加密服务已加载');
