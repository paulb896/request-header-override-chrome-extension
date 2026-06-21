import loadHeadersFromStorage from './loadHeadersFromStorage';
import { CONSTANTS } from './constants';

describe('loadHeadersFromStorage', () => {
  beforeEach(() => {
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
        },
      },
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('should return empty array if no storage data exists', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    const result = await loadHeadersFromStorage();
    expect(result).toEqual([]);
  });

  it('should return parsed headers if data exists', async () => {
    const mockData = [{ id: 1, name: 'Test' }];
    chrome.storage.local.get.mockResolvedValue({
      [CONSTANTS.STORAGE_KEY]: JSON.stringify(mockData),
    });
    
    const result = await loadHeadersFromStorage();
    expect(result).toEqual(mockData);
  });

  it('should return empty array if JSON parse fails', async () => {
    chrome.storage.local.get.mockResolvedValue({
      [CONSTANTS.STORAGE_KEY]: 'invalid json',
    });
    
    const result = await loadHeadersFromStorage();
    expect(result).toEqual([]);
  });

  it('should return empty array if chrome.storage.local.get throws', async () => {
    chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
    
    const result = await loadHeadersFromStorage();
    expect(result).toEqual([]);
  });
});
