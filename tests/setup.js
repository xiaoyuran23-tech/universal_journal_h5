/**
 * Jest 测试设置
 * 模拟浏览器环境，注入全局对象
 */

// 模拟 IndexedDB
global.indexedDB = {
  open: jest.fn(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {
      objectStoreNames: { contains: jest.fn(() => true) },
      createObjectStore: jest.fn(),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          get: jest.fn(() => ({ result: null, onsuccess: null })),
          getAll: jest.fn(() => ({ result: [], onsuccess: null })),
          put: jest.fn(() => ({ onsuccess: null })),
          delete: jest.fn(() => ({ onsuccess: null })),
          clear: jest.fn(() => ({ onsuccess: null })),
          count: jest.fn(() => ({ result: 0, onsuccess: null })),
          index: jest.fn(() => ({
            getAll: jest.fn(() => ({ result: [], onsuccess: null }))
          }))
        })),
        oncomplete: null,
        onerror: null
      })),
      close: jest.fn()
    }
  }))
};

// 模拟 localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    _getStore: () => store,
    _setStore: (s) => { store = s; }
  };
})();
global.localStorage = localStorageMock;

// 模拟 window 对象
global.window = global;

// 模拟 crypto
global.crypto = {
  subtle: {
    encrypt: jest.fn(async () => new ArrayBuffer(32)),
    decrypt: jest.fn(async () => new TextEncoder().encode('decrypted').buffer),
    digest: jest.fn(async () => new ArrayBuffer(32)),
    generateKey: jest.fn(async () => ({})),
    exportKey: jest.fn(async () => new ArrayBuffer(32)),
    importKey: jest.fn(async () => ({})),
    deriveKey: jest.fn(async () => ({}))
  },
  getRandomValues: jest.fn(arr => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

// 模拟 TextEncoder / TextDecoder
global.TextEncoder = class TextEncoder {
  encode(str) {
    return new Uint8Array([...str].map(c => c.charCodeAt(0)));
  }
};

global.TextDecoder = class TextDecoder {
  decode(buffer) {
    return String.fromCharCode(...new Uint8Array(buffer));
  }
};

// 模拟 document
global.document = {
  createElement: jest.fn(() => ({
    textContent: '',
    innerHTML: '',
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    click: jest.fn(),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    closest: jest.fn(() => null),
    toggle: jest.fn(),
    style: {},
    dataset: {}
  })),
  getElementById: jest.fn(() => null),
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  addEventListener: jest.fn(),
  createElementNS: jest.fn(() => ({}))
};

console.log('[Test Setup] 浏览器环境已模拟');
