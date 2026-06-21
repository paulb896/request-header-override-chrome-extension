require('@testing-library/jest-dom');

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

let mockStore = {};

beforeEach(() => {
  mockStore = {};
});

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        let result = {};
        if (typeof keys === 'string') {
          result[keys] = mockStore[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach((k) => {
            result[k] = mockStore[k];
          });
        } else if (typeof keys === 'object' && keys !== null) {
          Object.keys(keys).forEach((k) => {
            result[k] = mockStore[k] !== undefined ? mockStore[k] : keys[k];
          });
        } else {
          result = { ...mockStore };
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((data, callback) => {
        Object.assign(mockStore, data);
        if (callback) callback();
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  declarativeNetRequest: {
    getDynamicRules: jest.fn((callback) => callback([])),
    updateDynamicRules: jest.fn((options, callback) => {
      if (callback) callback();
    }),
    MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 5000,
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    lastError: null,
  },
  tabs: {
    query: jest.fn((queryInfo, callback) => callback([{ id: 1 }])),
    onRemoved: {
      addListener: jest.fn(),
    },
  },
  debugger: {
    attach: jest.fn((target, requiredVersion, callback) => {
      if (callback) callback();
    }),
    detach: jest.fn((target, callback) => {
      if (callback) callback();
    }),
    sendCommand: jest.fn((target, method, commandParams, callback) => {
      if (callback) callback();
    }),
    onEvent: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};
