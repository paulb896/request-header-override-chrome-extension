import saveHeadersToStorage from './saveHeadersToStorage';
import updateChromeRules from './updateChromeRules';
import { CONSTANTS } from './constants';

jest.mock('./updateChromeRules');

describe('saveHeadersToStorage', () => {
  beforeEach(() => {
    global.chrome = {
      storage: {
        local: {
          set: jest.fn((_, cb) => {
            if (cb) cb();
          }),
        },
      },
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('should stringify headers and save them to storage', () => {
    const headers = [{ id: 1 }];
    const removeIds = [2];

    saveHeadersToStorage(headers, removeIds);

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { [CONSTANTS.STORAGE_KEY]: JSON.stringify(headers) },
      expect.any(Function)
    );
    expect(updateChromeRules).toHaveBeenCalledWith(headers, removeIds);
  });

  it('should use empty array for removeRuleIds by default', () => {
    const headers = [{ id: 1 }];

    saveHeadersToStorage(headers);

    expect(updateChromeRules).toHaveBeenCalledWith(headers, []);
  });
});
