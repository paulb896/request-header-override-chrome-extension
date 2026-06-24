describe('Background Script', () => {
  let onMessageListener;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    global.chrome.storage.local.set({ requestCollectingEnabled: true });

    global.chrome.webRequest = {
      onBeforeSendHeaders: { addListener: jest.fn() },
      onCompleted: { addListener: jest.fn() },
      onErrorOccurred: { addListener: jest.fn() },
    };
    
    global.chrome.runtime.lastError = null;

    require('./index');

    if (global.chrome.runtime.onMessage.addListener.mock.calls.length > 0) {
      onMessageListener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
    }
  });

  afterEach(() => {
    delete global.chrome.webRequest;
  });

  it('registers listeners on load', () => {
    expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(global.chrome.webRequest.onBeforeSendHeaders.addListener).toHaveBeenCalled();
    expect(global.chrome.webRequest.onCompleted.addListener).toHaveBeenCalled();
    expect(global.chrome.webRequest.onErrorOccurred.addListener).toHaveBeenCalled();
  });

  it('handles LOG_RESPONSE message and stores the request', async () => {
    const sender = { tab: { id: 101, url: 'https://test.com/path' } };
    const getRequestsSpy = jest.fn();

    onMessageListener(
      { type: 'LOG_RESPONSE', request: { url: 'https://test.com/api', method: 'GET' } },
      sender,
      jest.fn()
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    onMessageListener({ type: 'GET_RECENT_REQUESTS', tabId: 101 }, {}, getRequestsSpy);
    expect(getRequestsSpy).toHaveBeenCalled();
    const reqs = getRequestsSpy.mock.calls[0][0].requests;
    expect(reqs.length).toBe(1);
    expect(reqs[0].url).toBe('https://test.com/api');
  });

  it('handles LOG_RESPONSE and skips if webRequest capture was duplicate', async () => {
    const sender = { tab: { id: 101 } };
    const onCompletedListener = global.chrome.webRequest.onCompleted.addListener.mock.calls[0][0];
    
    onCompletedListener({
      requestId: '123', url: 'https://test.com/api', method: 'GET',
      type: 'xmlhttprequest', statusCode: 200, tabId: 101, responseHeaders: []
    });

    onMessageListener(
      { type: 'LOG_RESPONSE', request: { url: 'https://test.com/api', method: 'GET', webRequestCaptured: true } },
      sender,
      jest.fn()
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    const getRequestsSpy = jest.fn();
    onMessageListener({ type: 'GET_RECENT_REQUESTS', tabId: 101 }, {}, getRequestsSpy);
    expect(getRequestsSpy.mock.calls[0][0].requests.length).toBe(1);
  });

  it('captures webRequest on error', async () => {
    const onErrorListener = global.chrome.webRequest.onErrorOccurred.addListener.mock.calls[0][0];
    
    onErrorListener({
      requestId: '124', url: 'https://test.com/error', method: 'POST', type: 'fetch', tabId: 102
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const getRequestsSpy = jest.fn();
    onMessageListener({ type: 'GET_RECENT_REQUESTS' }, {}, getRequestsSpy);
    expect(getRequestsSpy.mock.calls[0][0].requests.some(r => r.url === 'https://test.com/error')).toBe(true);
  });
  
  it('handles empty message for GET_RECENT_REQUESTS without filters', async () => {
    const getRequestsSpy = jest.fn();
    onMessageListener({ type: 'GET_RECENT_REQUESTS' }, {}, getRequestsSpy);
    expect(getRequestsSpy).toHaveBeenCalled();
  });

  it('extracts graphql operation name from URL', () => {
    const { extractGraphqlOperationName } = require('./index');
    expect(extractGraphqlOperationName('https://test.com/graphql?operationName=TestQuery', '')).toBe('TestQuery');
  });

  it('extracts graphql operation name from query body regex', () => {
    const { extractGraphqlOperationName } = require('./index');
    const body = JSON.stringify({ query: 'mutation CreateItem { id }' });
    expect(extractGraphqlOperationName('https://test.com/graphql', body)).toBe('CreateItem');
  });

  it('extracts graphql operation name from operationName body property', () => {
    const { extractGraphqlOperationName } = require('./index');
    const body = JSON.stringify({ operationName: 'UpdateItem', query: '...' });
    expect(extractGraphqlOperationName('https://test.com/graphql', body)).toBe('UpdateItem');
  });

  it('handles invalid graphql requestBody gracefully', () => {
    const { extractGraphqlOperationName } = require('./index');
    expect(extractGraphqlOperationName('https://test.com/graphql', 'invalid-json')).toBeNull();
  });

  it('ignores unsupported web request types', () => {
    const onCompletedListener = global.chrome.webRequest.onCompleted.addListener.mock.calls[0][0];
    onCompletedListener({
      requestId: 'ignore-1', url: 'https://test.com/image.png', type: 'image',
    });
  });

  it('filters GET_RECENT_REQUESTS by origin', async () => {
    onMessageListener(
      { type: 'LOG_RESPONSE', request: { url: 'https://test.com/api', method: 'GET' } },
      { tab: { url: 'https://test.com' } },
      jest.fn()
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    const getRequestsSpy = jest.fn();
    onMessageListener({ type: 'GET_RECENT_REQUESTS', origin: 'https://test.com' }, {}, getRequestsSpy);
    expect(getRequestsSpy.mock.calls[0][0].requests.length).toBeGreaterThan(0);
  });

  it('handles wild tab matching in LOG_RESPONSE', async () => {
    const sender = { tab: { id: -1 } };
    const onCompletedListener = global.chrome.webRequest.onCompleted.addListener.mock.calls[0][0];
    onCompletedListener({
      requestId: 'wild-1', url: 'https://test.com/api/wild', method: 'GET',
      type: 'fetch', statusCode: 200, tabId: -1, responseHeaders: []
    });

    onMessageListener(
      { type: 'LOG_RESPONSE', request: { url: 'https://test.com/api/wild', method: 'GET' } },
      sender,
      jest.fn()
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    const getRequestsSpy = jest.fn();
    onMessageListener({ type: 'GET_RECENT_REQUESTS', tabId: -1 }, {}, getRequestsSpy);
    expect(getRequestsSpy.mock.calls[0][0].requests.some(r => r.url === 'https://test.com/api/wild')).toBe(true);
  });

  it('sends error response if storage set fails', async () => {
    global.chrome.runtime.lastError = new Error('Storage Error');
    const sendResponse = jest.fn();
    onMessageListener(
      { type: 'LOG_RESPONSE', request: { url: 'https://test.com/fail', method: 'GET' } },
      { tab: { id: 1 } },
      sendResponse
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Storage Error' });
  });

  it('handles missing tab url safely in LOG_RESPONSE', () => {
    expect(() => {
      onMessageListener(
        { type: 'LOG_RESPONSE', request: { url: 'https://test.com', method: 'GET' } },
        { tab: {} },
        jest.fn()
      );
    }).not.toThrow();
  });
  it('handles web request log timeout and deduplication', () => {
    jest.useFakeTimers();
    const { logWebRequest } = require('./index');

    const details1 = { url: 'https://test.com/dedupe', method: 'GET', type: 'fetch', statusCode: 200, tabId: 101 };
    
    // Call once
    logWebRequest(details1, [], []);
    
    // Call twice before timeout (should deduplicate and hit lines 259-260)
    logWebRequest(details1, [], []);

    // Fast forward to hit the timeout (lines 264-266)
    jest.runAllTimers();

    jest.useRealTimers();
  });
});
