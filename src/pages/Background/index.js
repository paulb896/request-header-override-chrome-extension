let requestCollectingEnabled = false;

// Initialize setting from storage
try {
  chrome.storage.local.get(['requestCollectingEnabled'], (result) => {
    if (result.requestCollectingEnabled !== undefined) {
      requestCollectingEnabled = result.requestCollectingEnabled;
    } else {
      requestCollectingEnabled = false;
    }
  });
} catch (e) {}

// Watch for changes to the setting
try {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.requestCollectingEnabled) {
      requestCollectingEnabled = changes.requestCollectingEnabled.newValue === true;
    }
  });
} catch (e) {}

const pendingLogs = [];
let isProcessingQueue = false;

// Pending webRequest fallback entries waiting to be committed.
// Keyed by "url|method|tabId". Each value is { requestData, timerId }.
// If a page-level LOG_RESPONSE arrives for the same key within the delay window,
// the webRequest fallback is cancelled (it has no response body anyway).
const pendingWebRequests = new Map();
const WEB_REQUEST_DELAY_MS = 2000;

function makeWebRequestKey(url, method, tabId) {
  return `${url}|${method}|${tabId}`;
}

function processQueue() {
  if (isProcessingQueue || pendingLogs.length === 0) return;
  isProcessingQueue = true;

  const next = () => {
    if (pendingLogs.length === 0) {
      isProcessingQueue = false;
      return;
    }

    const { requestData, sendResponse } = pendingLogs.shift();

    chrome.storage.local.get(['recentRequests'], (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        if (sendResponse) sendResponse({ success: false, error: err.message });
        next();
        return;
      }

      const list = result.recentRequests || [];

      if (requestData.webRequestCaptured) {
        // webRequest capture fallback: check if identical request was logged recently (e.g. by page context)
        const exists = list.some(
          (r) =>
            r.url === requestData.url &&
            r.method === requestData.method &&
            (r.tabId === requestData.tabId ||
              r.tabId === -1 ||
              requestData.tabId === -1) &&
            Math.abs(r.timestamp - requestData.timestamp) < 5000
        );
        if (exists) {
          // Skip logging since we already captured it
          if (sendResponse) sendResponse({ success: true });
          next();
          return;
        } else {
          list.unshift(requestData);
        }
      } else {
        // Page-level capture: find matching webRequest-captured fallback entry and replace it
        const index = list.findIndex(
          (r) =>
            r.webRequestCaptured &&
            r.url === requestData.url &&
            r.method === requestData.method &&
            (r.tabId === requestData.tabId ||
              r.tabId === -1 ||
              requestData.tabId === -1) &&
            Math.abs(r.timestamp - requestData.timestamp) < 5000
        );
        if (index !== -1) {
          list[index] = {
            ...requestData,
            timestamp: list[index].timestamp, // retain first timestamp
          };
        } else {
          list.unshift(requestData);
        }
      }

      if (list.length > 1000) {
        list.pop();
      }

      chrome.storage.local.set({ recentRequests: list }, () => {
        const setErr = chrome.runtime.lastError;
        if (setErr) {
          if (sendResponse)
            sendResponse({ success: false, error: setErr.message });
        } else {
          if (sendResponse) sendResponse({ success: true });
        }
        next();
      });
    });
  };

  next();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG_RESPONSE') {
    if (!requestCollectingEnabled) {
      if (sendResponse) sendResponse({ success: false, error: 'Request collecting is disabled' });
      return;
    }
    const tabId = sender.tab ? sender.tab.id : -1;
    let initiator = '';
    try {
      if (sender.tab && sender.tab.url) {
        initiator = new URL(sender.tab.url).origin;
      }
    } catch (e) {}

    const requestData = {
      ...message.request,
      tabId,
      initiator,
      timestamp: Date.now(),
    };

    // Cancel any pending webRequest fallback for this same request
    // since we now have the real response body from the page context.
    const key = makeWebRequestKey(requestData.url, requestData.method, tabId);
    if (pendingWebRequests.has(key)) {
      clearTimeout(pendingWebRequests.get(key).timerId);
      pendingWebRequests.delete(key);
    }
    // Also check with wildcard tabId=-1 (worker-originated requests)
    const keyWild = makeWebRequestKey(requestData.url, requestData.method, -1);
    if (pendingWebRequests.has(keyWild)) {
      clearTimeout(pendingWebRequests.get(keyWild).timerId);
      pendingWebRequests.delete(keyWild);
    }

    pendingLogs.push({ requestData, sendResponse });
    processQueue();
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_RECENT_REQUESTS') {
    const tabIdFilter = message.tabId;
    const originFilter = message.origin;
    chrome.storage.local.get(['recentRequests'], (result) => {
      const list = result.recentRequests || [];
      const filtered = list.filter((r) => {
        if (tabIdFilter && r.tabId === tabIdFilter) return true;
        if (originFilter && r.initiator && r.initiator === originFilter)
          return true;
        if (!tabIdFilter && !originFilter) return true;
        return false;
      });
      sendResponse({ requests: filtered });
    });
    return true; // Keep channel open for async response
  }
});

// webRequest active requests map to temporarily store request headers by requestId
const activeRequests = new Map();

// Passive observation of network requests in the background
if (typeof chrome !== 'undefined' && chrome.webRequest) {
  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        const requestHeaders = (details.requestHeaders || []).map((h) => ({
          name: h.name,
          value: h.value || '',
        }));
        activeRequests.set(details.requestId, { requestHeaders });
      },
      { urls: ['<all_urls>'] },
      ['requestHeaders', 'extraHeaders']
    );

    chrome.webRequest.onCompleted.addListener(
      (details) => {
        const cached = activeRequests.get(details.requestId) || {};
        activeRequests.delete(details.requestId);

        const responseHeaders = (details.responseHeaders || []).map((h) => ({
          name: h.name,
          value: h.value || '',
        }));

        logWebRequest(details, cached.requestHeaders || [], responseHeaders);
      },
      { urls: ['<all_urls>'] },
      ['responseHeaders', 'extraHeaders']
    );

    chrome.webRequest.onErrorOccurred.addListener(
      (details) => {
        const cached = activeRequests.get(details.requestId) || {};
        activeRequests.delete(details.requestId);

        logWebRequest(details, cached.requestHeaders || [], [], true);
      },
      { urls: ['<all_urls>'] }
    );
  } catch (e) {}
}

function logWebRequest(
  details,
  requestHeaders,
  responseHeaders,
  isError = false
) {
  if (!requestCollectingEnabled) {
    return;
  }
  // We only capture fetch and XHR requests
  if (
    details.type !== 'xmlhttprequest' &&
    details.type !== 'other' &&
    details.type !== 'fetch'
  ) {
    return;
  }

  let contentType = 'text/plain';
  if (responseHeaders) {
    const ctHeader = responseHeaders.find(
      (h) => h.name.toLowerCase() === 'content-type'
    );
    if (ctHeader) {
      contentType = ctHeader.value;
    }
  }

  const opName = extractGraphqlOperationName(details.url, '');
  const tabId = details.tabId !== undefined ? details.tabId : -1;
  const initiator = details.initiator || '';

  const requestData = {
    url: details.url,
    method: details.method || 'GET',
    response: isError
      ? '[Network Error or Request Cancelled]'
      : '[Response body captured via network stack (no body available)]',
    contentType,
    statusCode: isError ? 0 : details.statusCode || 200,
    requestHeaders,
    responseHeaders,
    requestBody: '',
    operationName: opName || '',
    tabId,
    initiator,
    timestamp: Date.now(),
    webRequestCaptured: true,
  };

  // For error requests, log immediately (no page-level capture will follow)
  if (isError) {
    pendingLogs.push({ requestData });
    processQueue();
    return;
  }

  // Delay webRequest fallback logging to give the page-level interceptor
  // time to send the full response body via LOG_RESPONSE. If a page-level
  // log arrives within the delay window, this entry is cancelled entirely.
  const key = makeWebRequestKey(requestData.url, requestData.method, tabId);

  // If there's already a pending entry for the same key, cancel it
  if (pendingWebRequests.has(key)) {
    clearTimeout(pendingWebRequests.get(key).timerId);
    pendingWebRequests.delete(key);
  }

  const timerId = setTimeout(() => {
    pendingWebRequests.delete(key);
    pendingLogs.push({ requestData });
    processQueue();
  }, WEB_REQUEST_DELAY_MS);

  pendingWebRequests.set(key, { requestData, timerId });
}

function extractGraphqlOperationName(url, requestBody) {
  try {
    const parsedUrl = new URL(url);
    const op = parsedUrl.searchParams.get('operationName');
    if (op) return op;
  } catch (e) {}

  if (requestBody && typeof requestBody === 'string') {
    try {
      const parsed = JSON.parse(requestBody);
      if (parsed && parsed.operationName) {
        return parsed.operationName;
      }
      if (parsed && parsed.query && typeof parsed.query === 'string') {
        const match = parsed.query.match(/(query|mutation)\s+([a-zA-Z0-9_]+)/);
        if (match && match[2]) {
          return match[2];
        }
      }
    } catch (e) {}
  }
  return null;
}

export { extractGraphqlOperationName, logWebRequest };
