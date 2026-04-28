/**
 * 万物手札 - 安全模块 v3.3.0
 * 包含：Security (加解密), Crypto (加密核心)
 */

const Crypto = {
  // 简单 XOR 加密
  encrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(unescape(encodeURIComponent(result)));
  },
  
  decrypt(encoded, key) {
    try {
      const text = decodeURIComponent(escape(atob(encoded)));
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch (e) {
      console.error('Decrypt failed:', e);
      return null;
    }
  }
};

const Security = {
  LOCK_KEY: '_uj_locked',
  DATA_KEY: '_uj_data_encrypted',
  HASH_KEY: '_uj_hash',
  
  isLocked() {
    return localStorage.getItem(this.LOCK_KEY) === 'true';
  },
  
  hasPassword() {
    return !!localStorage.getItem(this.HASH_KEY);
  },
  
  setPassword(password) {
    const hash = this.hashPassword(password);
    localStorage.setItem(this.HASH_KEY, hash);
    localStorage.setItem(this.LOCK_KEY, 'true');
  },
  
  verifyPassword(password) {
    const hash = this.hashPassword(password);
    return hash === localStorage.getItem(this.HASH_KEY);
  },
  
  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  },
  
  encryptData(items, password) {
    const json = JSON.stringify(items);
    const encrypted = Crypto.encrypt(json, password);
    localStorage.setItem(this.DATA_KEY, encrypted);
    StorageBackend.clear();
  },
  
  decryptData(password) {
    const encrypted = localStorage.getItem(this.DATA_KEY);
    if (!encrypted) return null;
    
    const decrypted = Crypto.decrypt(encrypted, password);
    if (!decrypted) return null;
    
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return null;
    }
  },
  
  removePassword() {
    localStorage.removeItem(this.HASH_KEY);
    localStorage.removeItem(this.LOCK_KEY);
    localStorage.removeItem(this.DATA_KEY);
  }
};

window.Crypto = Crypto;
window.Security = Security;
