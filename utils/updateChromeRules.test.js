import updateChromeRules from './updateChromeRules';
import createRuleFromHeader from './createRuleFromHeader';

jest.mock('./createRuleFromHeader');

describe('updateChromeRules', () => {
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

  it('filters out disabled headers and updates chrome rules', () => {
    const mockRule = { id: 10 };
    createRuleFromHeader.mockReturnValue(mockRule);

    const headers = [
      { id: 1, enabled: true },
      { id: 2, enabled: false }
    ];
    
    updateChromeRules(headers, [20]);

    expect(createRuleFromHeader).toHaveBeenCalledTimes(1);
    expect(createRuleFromHeader).toHaveBeenCalledWith(headers[0], 0, expect.any(Array));

    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith(
      {
        addRules: [mockRule],
        removeRuleIds: [20, 10]
      },
      expect.any(Function)
    );
  });

  it('uses default empty array for removeRuleIds', () => {
    updateChromeRules([]);
    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith(
      {
        addRules: [],
        removeRuleIds: []
      },
      expect.any(Function)
    );
  });
});
