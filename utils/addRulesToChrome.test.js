import addRulesToChrome from './addRulesToChrome';
import createRuleFromHeader from './createRuleFromHeader';

jest.mock('./createRuleFromHeader');

describe('addRulesToChrome', () => {
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

  it('should not call updateDynamicRules if enabledHeaders is empty', () => {
    addRulesToChrome([]);
    expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
  });

  it('should call updateDynamicRules with mapped rules', () => {
    const headers = [{ id: 1, urlMatch: 'example.com' }];
    const mockRule = { id: 1, action: { type: 'modifyHeaders' } };
    createRuleFromHeader.mockReturnValue(mockRule);

    addRulesToChrome(headers);

    expect(createRuleFromHeader).toHaveBeenCalledWith(headers[0], 0, headers);
    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith(
      { addRules: [mockRule] },
      expect.any(Function)
    );
  });
});
