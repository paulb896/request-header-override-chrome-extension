import removeRulesFromChrome from './removeRulesFromChrome';

describe('removeRulesFromChrome', () => {
  beforeEach(() => {
    global.chrome = {
      declarativeNetRequest: {
        updateDynamicRules: jest.fn((_, cb) => {
          if (cb) cb();
        }),
      },
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.chrome;
  });

  it('should not call updateDynamicRules if ruleIds is empty', () => {
    removeRulesFromChrome([]);
    expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
  });

  it('should call updateDynamicRules with removeRuleIds', () => {
    removeRulesFromChrome([1, 2, 3]);
    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith(
      { removeRuleIds: [1, 2, 3] },
      expect.any(Function)
    );
  });
});
