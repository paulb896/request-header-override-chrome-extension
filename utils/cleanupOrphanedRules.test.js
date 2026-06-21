import cleanupOrphanedRules from './cleanupOrphanedRules';
import removeRulesFromChrome from './removeRulesFromChrome';

jest.mock('./removeRulesFromChrome');

describe('cleanupOrphanedRules', () => {
  beforeEach(() => {
    global.chrome = {
      declarativeNetRequest: {
        getDynamicRules: jest.fn(),
      },
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('should remove rules that are not in requestOverrides', () => {
    chrome.declarativeNetRequest.getDynamicRules.mockImplementation((cb) => {
      cb([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    const overrides = [{ id: 1 }, { id: 3 }];
    cleanupOrphanedRules(overrides);

    expect(removeRulesFromChrome).toHaveBeenCalledWith([2]);
  });

  it('should not call removeRulesFromChrome if no orphaned rules', () => {
    chrome.declarativeNetRequest.getDynamicRules.mockImplementation((cb) => {
      cb([{ id: 1 }, { id: 3 }]);
    });

    const overrides = [{ id: 1 }, { id: 3 }];
    cleanupOrphanedRules(overrides);

    expect(removeRulesFromChrome).not.toHaveBeenCalled();
  });
});
