// This script is injected into the web page's execution context.
// It monkey-patches `window.fetch` and `XMLHttpRequest` so we can intercept and mock responses.

if (window.__REQUEST_HEADER_OVERRIDE_PATCHED__) {
  // Already patched, do not patch again
} else {
  try {
    document.documentElement.setAttribute('data-rho-patched', 'true');
  } catch (e) {}
  window.__REQUEST_HEADER_OVERRIDE_PATCHED__ = true;

  // Save pristine native references BEFORE any page script (New Relic, GTM)
  // can wrap them. This runs at document_start, before any page JS.
  const _nativePostMessage = window.postMessage.bind(window);
  const _nativeCreateElement = document.createElement.bind(document);

  let responseOverrides = [];
  let requestCollectingEnabled = false;
  let responseOverridesEnabled = false;

  // Listen for updates from the content script
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'REQUEST_HEADER_OVERRIDE_RESPONSE_MOCKS') {
      responseOverrides = event.data.overrides || [];
      requestCollectingEnabled = event.data.requestCollectingEnabled === true;
      responseOverridesEnabled = event.data.responseOverridesEnabled === true;
      updateActiveWorkersMocks(window, responseOverrides);
    }
  });

  // Helper to convert any URL (including relative ones and URL objects) into an absolute URL string
  function getAbsoluteUrl(url) {
    if (!url) return '';
    let urlStr = typeof url === 'string' ? url : String(url);
    try {
      return new URL(urlStr, window.location.href).href;
    } catch (e) {
      return urlStr;
    }
  }

  // Helper to check if a URL matches our overrides
  function getMatchedOverride(url, method, requestBody) {
    if (!responseOverridesEnabled) return null;
    if (!url || typeof url !== 'string') return null;
    return responseOverrides.find((override) => {
      if (!override.active) return false;
      let urlMatches = override.matchUrl ? url.includes(override.matchUrl) : true;
      let bodyMatches = true;
      if (override.matchRequestBody && method && method.toUpperCase() !== 'GET') {
        bodyMatches = requestBody && typeof requestBody === 'string' && requestBody.includes(override.matchRequestBody);
      }
      return urlMatches && bodyMatches;
    });
  }

  // Helper to parse/extract the GraphQL operation name from the URL or query/mutation JSON body
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
          const match = parsed.query.match(
            /(query|mutation)\s+([a-zA-Z0-9_]+)/
          );
          if (match && match[2]) {
            return match[2];
          }
        }
      } catch (e) {}
    }
    return null;
  }

  // Helper to push mock updates to active workers
  function updateActiveWorkersMocks(win, overrides) {
    if (win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__) {
      const active = [];
      win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__.forEach((ref) => {
        const worker = ref.deref();
        if (worker) {
          active.push(ref);
          try {
            worker.postMessage({
              type: 'REQUEST_HEADER_OVERRIDE_UPDATE_MOCKS',
              overrides: overrides,
            });
          } catch (e) {}
        }
      });
      win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__ = active;
    }
  }

  // Intercept Responses for Logging - uses DOM-based channel to bypass
  // page-script wrappers (e.g. New Relic, GTM) that may interfere with postMessage.
  const LOG_CONTAINER_ID = '__rho_log_container__';

  function getOrCreateLogContainer() {
    let container = document.getElementById(LOG_CONTAINER_ID);
    if (!container) {
      container = _nativeCreateElement('div');
      container.id = LOG_CONTAINER_ID;
      container.style.display = 'none';
      (document.documentElement || document.body || document.head).appendChild(
        container
      );
    }
    return container;
  }

  function logResponse(
    url,
    method,
    responseText,
    contentType,
    statusCode,
    requestHeaders,
    responseHeaders,
    requestBody,
    operationName
  ) {
    if (!requestCollectingEnabled) return;
    try {
      let loggedResponse = responseText || '';
      if (loggedResponse.length > 200000) {
        loggedResponse =
          loggedResponse.substring(0, 100000) +
          '\n\n... [Response body truncated because it exceeds 200KB limit]';
      }

      const opName =
        operationName || extractGraphqlOperationName(url, requestBody);

      const logMsg = {
        type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
        request: {
          url,
          method: method || 'GET',
          response: loggedResponse,
          contentType: contentType || 'text/plain',
          statusCode: statusCode || 200,
          requestHeaders: requestHeaders || [],
          responseHeaders: responseHeaders || [],
          requestBody: requestBody || '',
          operationName: opName || '',
        },
      };

      // Channel 1: DOM-based - content script's MutationObserver picks this up
      try {
        const container = getOrCreateLogContainer();
        const node = _nativeCreateElement('span');
        node.setAttribute('data-log', JSON.stringify(logMsg));
        container.appendChild(node);
      } catch (domErr) {}

      // Channel 2: Native postMessage (saved before New Relic could wrap it)
      try {
        _nativePostMessage(logMsg, '*');
      } catch (pmErr) {}
    } catch (e) {}
  }

  // Helper to patch a specific window object (main page or iframes)
  function patchWindow(win) {
    if (!win) return;

    let isAlreadyPatched = false;
    try {
      // Accessing document property throws a SecurityError on cross-origin frames
      if (!win.document) return;
      isAlreadyPatched = !!win.__REQUEST_HEADER_OVERRIDE_MAIN_PATCHED__;
    } catch (e) {
      return;
    }

    if (!isAlreadyPatched) {
      try {
        win.__REQUEST_HEADER_OVERRIDE_MAIN_PATCHED__ = true;
      } catch (e) {
        return;
      }

      // ----------------------------------------------------------------------------
      // Monkey-patch win.navigator.serviceWorker.register
      // ----------------------------------------------------------------------------
      try {
        if (win.navigator && win.navigator.serviceWorker) {
          // Unregister any active service worker registrations immediately
          win.navigator.serviceWorker
            .getRegistrations()
            .then((registrations) => {
              for (const registration of registrations) {
                registration.unregister().catch(() => {});
              }
            })
            .catch(() => {
              // Silently ignore - document may be in an invalid state (e.g. cross-origin iframe)
            });

          // Wrap the register method to prevent new registrations
          win.navigator.serviceWorker.register = function (scriptURL, options) {
            // Return a dummy resolved registration promise so page logic doesn't crash
            let scope = '';
            try {
              scope = new URL(scriptURL, win.location.href).href;
            } catch (e) {
              scope = String(scriptURL);
            }
            return Promise.resolve({
              scope,
              active: null,
              installing: null,
              waiting: null,
              unregister: () => Promise.resolve(true),
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => true,
            });
          };
        }
      } catch (e) {}

      // ----------------------------------------------------------------------------
      // Monkey-patch win.Blob
      // ----------------------------------------------------------------------------
      try {
        if (win.Blob) {
          const OriginalBlob = win.Blob;
          const patchedBlob = function (parts, options) {
            const isJS =
              options &&
              options.type &&
              (options.type.toLowerCase().includes('javascript') ||
                options.type
                  .toLowerCase()
                  .includes('application/x-javascript') ||
                options.type.toLowerCase().includes('text/js'));

            if (isJS && Array.isArray(parts)) {
              const serializedOverrides = JSON.stringify(responseOverrides);
              const patchCode = `
              (function() {
                let responseOverrides = ${serializedOverrides};
                
                function logResponse(url, method, responseText, contentType, statusCode, requestHeaders, responseHeaders, requestBody, operationName) {
                  self.postMessage({
                    type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                    request: {
                      url,
                      method: method || 'GET',
                      response: responseText || '',
                      contentType: contentType || 'text/plain',
                      statusCode: statusCode || 200,
                      requestHeaders: requestHeaders || [],
                      responseHeaders: responseHeaders || [],
                      requestBody: requestBody || '',
                      operationName: operationName || ''
                    }
                  });
                }

                function getAbsoluteUrl(url) {
                  if (!url) return '';
                  let urlStr = typeof url === 'string' ? url : String(url);
                  try {
                    return new URL(urlStr, self.location.href).href;
                  } catch (e) {
                    return urlStr;
                  }
                }

                function getMatchedOverride(url, method, requestBody) {
    if (!url || typeof url !== 'string') return null;
    return responseOverrides.find((override) => {
      if (!override.active) return false;
      let urlMatches = override.matchUrl ? url.includes(override.matchUrl) : true;
      let bodyMatches = true;
      if (override.matchRequestBody && method && method.toUpperCase() !== 'GET') {
        bodyMatches = requestBody && typeof requestBody === 'string' && requestBody.includes(override.matchRequestBody);
      }
      return urlMatches && bodyMatches;
    });
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
                        const match = parsed.query.match(/(query|mutation)\\s+([a-zA-Z0-9_]+)/);
                        if (match && match[2]) {
                          return match[2];
                        }
                      }
                    } catch (e) {}
                  }
                  return null;
                }

                if (self.fetch) {
                  const originalFetch = self.fetch;
                  self.fetch = function(...args) {
                    const resource = args[0];
                    const rawUrl = typeof resource === 'string'
                      ? resource
                      : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                      ? resource.url
                      : resource
                      ? String(resource)
                      : '';
                    const url = getAbsoluteUrl(rawUrl);
                    const method = args[1] && args[1].method
                      ? args[1].method
                      : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                      ? resource.method
                      : 'GET';
                                        let requestBody = '';
                    if (args[1] && args[1].body) {
                      const body = args[1].body;
                      if (typeof body === 'string') {
                        requestBody = body;
                      } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                        requestBody = body.toString();
                      } else if ((self.FormData && body instanceof self.FormData)) {
                        const obj = {};
                        body.forEach((val, k) => { obj[k] = val; });
                        requestBody = JSON.stringify(obj);
                      } else {
                        requestBody = String(body);
                      }
                    }
                    const override = getMatchedOverride(url, method, requestBody);

                    if (override) {
                      try {
                        let responseBody = override.mockResponse;
                        try {
                          responseBody = JSON.stringify(JSON.parse(override.mockResponse));
                        } catch (e) {}

                        const mockResponse = new self.Response(responseBody, {
                          status: override.status || 200,
                          statusText: override.statusText || 'OK',
                          headers: new self.Headers({
                            'Content-Type': override.contentType || 'application/json',
                          }),
                        });
                        return Promise.resolve(mockResponse);
                      } catch (error) {
                        
                      }
                    }

                    let requestHeaders = [];
                    if (args[1] && args[1].headers) {
                      const headers = args[1].headers;
                      if ((self.Headers && headers instanceof self.Headers)) {
                        headers.forEach((value, name) => requestHeaders.push({ name, value }));
                      } else if (Array.isArray(headers)) {
                        requestHeaders = headers.map(([name, value]) => ({ name, value }));
                      } else {
                        Object.keys(headers).forEach((name) => requestHeaders.push({ name, value: String(headers[name]) }));
                      }
                    } else if (resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))) {
                      resource.headers.forEach((value, name) => requestHeaders.push({ name, value }));
                    }



                    return originalFetch.apply(this, args).then((response) => {
                      try {
                        const clone = response.clone();
                        const contentType = response.headers.get('content-type') || '';
                        const statusCode = response.status;
                        const responseHeaders = [];
                        response.headers.forEach((value, name) => responseHeaders.push({ name, value }));

                        clone.text().then((text) => {
                          let loggedResponse = text || '';
                          if (loggedResponse.length > 200000) {
                            loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                          }
                          const opName = extractGraphqlOperationName(url, requestBody);
                          logResponse(url, method, loggedResponse, contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                        }).catch((e) => {
                          const opName = extractGraphqlOperationName(url, requestBody);
                          logResponse(url, method, '[Unable to read response body: ' + (e.message || e) + ']', contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                        });
                      } catch (e) {
                        logResponse(
                          url,
                          method,
                          '[Unable to clone response: ' + (e.message || e) + ']',
                          response.headers.get('content-type') || '',
                          response.status,
                          requestHeaders,
                          [],
                          requestBody,
                          extractGraphqlOperationName(url, requestBody)
                        );
                      }
                      return response;
                    });
                  };
                }

                if (self.XMLHttpRequest) {
                  const originalXhrOpen = self.XMLHttpRequest.prototype.open;
                  const originalXhrSend = self.XMLHttpRequest.prototype.send;
                  const originalXhrSetRequestHeader = self.XMLHttpRequest.prototype.setRequestHeader;

                  self.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
                    if (!this._requestHeaders) this._requestHeaders = [];
                    this._requestHeaders.push({ name, value });
                    return originalXhrSetRequestHeader.apply(this, arguments);
                  };

                  self.XMLHttpRequest.prototype.open = function (...args) {
                    this._requestMethod = args[0];
                    this._requestUrl = getAbsoluteUrl(args[1]);
                    this._requestHeaders = [];
                    this._requestBody = '';
                    return originalXhrOpen.apply(this, args);
                  };

                  self.XMLHttpRequest.prototype.send = function (...args) {
                    const body = args[0];
                    if (body) {
                      if (typeof body === 'string') {
                        this._requestBody = body;
                      } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                        this._requestBody = body.toString();
                      } else if ((self.FormData && body instanceof self.FormData)) {
                        const obj = {};
                        body.forEach((val, k) => { obj[k] = val; });
                        this._requestBody = JSON.stringify(obj);
                      } else {
                        this._requestBody = String(body);
                      }
                    }

                    const override = getMatchedOverride(this._requestUrl, this._requestMethod, this._requestBody);
                    if (override) {
                      Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                      Object.defineProperty(this, 'status', { value: override.status || 200, writable: false });
                      Object.defineProperty(this, 'statusText', { value: override.statusText || 'OK', writable: false });
                      let responseText = override.mockResponse;
                      Object.defineProperty(this, 'response', { value: responseText, writable: false });
                      Object.defineProperty(this, 'responseText', { value: responseText, writable: false });

                      setTimeout(() => {
                        if (this.onreadystatechange) this.onreadystatechange(new self.Event('readystatechange'));
                        if (this.onload) this.onload(new self.Event('load'));
                        this.dispatchEvent(new self.Event('load'));
                        this.dispatchEvent(new self.Event('readystatechange'));
                      }, 10);
                      return;
                    }

                    this.addEventListener('load', function () {
                      try {
                        let responseText = '';
                        if (this.responseType === '' || this.responseType === 'text') {
                          responseText = this.responseText;
                        } else if (this.responseType === 'json') {
                          responseText = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
                        }
                        const contentType = this.getResponseHeader('content-type') || '';
                        const statusCode = this.status;
                        const rawHeaders = this.getAllResponseHeaders();
                        const responseHeaders = rawHeaders
                          ? rawHeaders.trim().split(/[\\r\\n]+/).map((line) => {
                              const parts = line.split(': ');
                              const name = parts.shift();
                              const value = parts.join(': ');
                              return { name, value };
                            }).filter((h) => h.name)
                          : [];
                        const requestHeaders = this._requestHeaders || [];
                        const requestBody = this._requestBody || '';
                        
                        let loggedResponse = responseText || '';
                        if (loggedResponse.length > 200000) {
                          loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                        }
                        const opName = extractGraphqlOperationName(this._requestUrl, requestBody);
                        logResponse(this._requestUrl, this._requestMethod, loggedResponse, contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                      } catch (e) {}
                    });
                    return originalXhrSend.apply(this, args);
                  };
                }

                self.addEventListener('message', (event) => {
                  if (event.data && event.data.type === 'REQUEST_HEADER_OVERRIDE_UPDATE_MOCKS') {
                    responseOverrides = event.data.overrides || [];
                  }
                });
              })();
              \n
            `;
              const newParts = [patchCode, ...parts];
              return new OriginalBlob(newParts, options);
            }

            return new OriginalBlob(parts, options);
          };

          patchedBlob.prototype = OriginalBlob.prototype;
          win.Blob = patchedBlob;
        }
      } catch (e) {}

      // ----------------------------------------------------------------------------
      // Monkey-patch win.Worker
      // ----------------------------------------------------------------------------
      try {
        if (win.Worker) {
          const OriginalWorker = win.Worker;
          const patchedWorker = function (scriptURL, options) {
            const absoluteURL = getAbsoluteUrl(scriptURL);
            let workerURL = absoluteURL;

            const serializedOverrides = JSON.stringify(responseOverrides);
            const workerCode = `
            (function() {
              let responseOverrides = ${serializedOverrides};
              
              function logResponse(url, method, responseText, contentType, statusCode, requestHeaders, responseHeaders, requestBody, operationName) {
                self.postMessage({
                    type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                    request: {
                      url,
                      method: method || 'GET',
                      response: responseText || '',
                      contentType: contentType || 'text/plain',
                      statusCode: statusCode || 200,
                      requestHeaders: requestHeaders || [],
                      responseHeaders: responseHeaders || [],
                      requestBody: requestBody || '',
                      operationName: operationName || ''
                    }
                  });
                }

                function getAbsoluteUrl(url) {
                  if (!url) return '';
                  let urlStr = typeof url === 'string' ? url : String(url);
                  try {
                    return new URL(urlStr, self.location.href).href;
                  } catch (e) {
                    return urlStr;
                  }
                }

                function getMatchedOverride(url, method, requestBody) {
    if (!url || typeof url !== 'string') return null;
    return responseOverrides.find((override) => {
      if (!override.active) return false;
      let urlMatches = override.matchUrl ? url.includes(override.matchUrl) : true;
      let bodyMatches = true;
      if (override.matchRequestBody && method && method.toUpperCase() !== 'GET') {
        bodyMatches = requestBody && typeof requestBody === 'string' && requestBody.includes(override.matchRequestBody);
      }
      return urlMatches && bodyMatches;
    });
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
                        const match = parsed.query.match(/(query|mutation)\\s+([a-zA-Z0-9_]+)/);
                        if (match && match[2]) {
                          return match[2];
                        }
                      }
                    } catch (e) {}
                  }
                  return null;
                }

                if (self.fetch) {
                  const originalFetch = self.fetch;
                  self.fetch = function(...args) {
                    const resource = args[0];
                    const rawUrl = typeof resource === 'string'
                      ? resource
                      : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                      ? resource.url
                      : resource
                      ? String(resource)
                      : '';
                    const url = getAbsoluteUrl(rawUrl);
                    const method = args[1] && args[1].method
                      ? args[1].method
                      : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                      ? resource.method
                      : 'GET';
                                        let requestBody = '';
                    if (args[1] && args[1].body) {
                      const body = args[1].body;
                      if (typeof body === 'string') {
                        requestBody = body;
                      } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                        requestBody = body.toString();
                      } else if ((self.FormData && body instanceof self.FormData)) {
                        const obj = {};
                        body.forEach((val, k) => { obj[k] = val; });
                        requestBody = JSON.stringify(obj);
                      } else {
                        requestBody = String(body);
                      }
                    }
                    const override = getMatchedOverride(url, method, requestBody);

                    if (override) {
                      try {
                        let responseBody = override.mockResponse;
                        try {
                          responseBody = JSON.stringify(JSON.parse(override.mockResponse));
                        } catch (e) {}

                        const mockResponse = new self.Response(responseBody, {
                          status: override.status || 200,
                          statusText: override.statusText || 'OK',
                          headers: new self.Headers({
                            'Content-Type': override.contentType || 'application/json',
                          }),
                        });
                        return Promise.resolve(mockResponse);
                      } catch (error) {
                        
                      }
                    }

                    let requestHeaders = [];
                    if (args[1] && args[1].headers) {
                      const headers = args[1].headers;
                      if ((self.Headers && headers instanceof self.Headers)) {
                        headers.forEach((value, name) => requestHeaders.push({ name, value }));
                      } else if (Array.isArray(headers)) {
                        requestHeaders = headers.map(([name, value]) => ({ name, value }));
                      } else {
                        Object.keys(headers).forEach((name) => requestHeaders.push({ name, value: String(headers[name]) }));
                      }
                    } else if (resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))) {
                      resource.headers.forEach((value, name) => requestHeaders.push({ name, value }));
                    }



                    return originalFetch.apply(this, args).then((response) => {
                      try {
                        const clone = response.clone();
                        const contentType = response.headers.get('content-type') || '';
                        const statusCode = response.status;
                        const responseHeaders = [];
                        response.headers.forEach((value, name) => responseHeaders.push({ name, value }));

                        clone.text().then((text) => {
                          let loggedResponse = text || '';
                          if (loggedResponse.length > 200000) {
                            loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                          }
                          const opName = extractGraphqlOperationName(url, requestBody);
                          logResponse(url, method, loggedResponse, contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                        }).catch((e) => {
                          const opName = extractGraphqlOperationName(url, requestBody);
                          logResponse(url, method, '[Unable to read response body: ' + (e.message || e) + ']', contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                        });
                      } catch (e) {
                        // Failed to clone, log request without response body
                        logResponse(
                          url,
                          method,
                          '[Unable to clone response: ' + (e.message || e) + ']',
                          response.headers.get('content-type') || '',
                          response.status,
                          requestHeaders,
                          [],
                          requestBody,
                          extractGraphqlOperationName(url, requestBody)
                        );
                      }
                      return response;
                    });
                  };
                }

                if (self.XMLHttpRequest) {
                  const originalXhrOpen = self.XMLHttpRequest.prototype.open;
                  const originalXhrSend = self.XMLHttpRequest.prototype.send;
                  const originalXhrSetRequestHeader = self.XMLHttpRequest.prototype.setRequestHeader;

                  self.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
                    if (!this._requestHeaders) this._requestHeaders = [];
                    this._requestHeaders.push({ name, value });
                    return originalXhrSetRequestHeader.apply(this, arguments);
                  };

                  self.XMLHttpRequest.prototype.open = function (...args) {
                    this._requestMethod = args[0];
                    this._requestUrl = getAbsoluteUrl(args[1]);
                    this._requestHeaders = [];
                    this._requestBody = '';
                    return originalXhrOpen.apply(this, args);
                  };

                  self.XMLHttpRequest.prototype.send = function (...args) {
                    const body = args[0];
                    if (body) {
                      if (typeof body === 'string') {
                        this._requestBody = body;
                      } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                        this._requestBody = body.toString();
                      } else if ((self.FormData && body instanceof self.FormData)) {
                        const obj = {};
                        body.forEach((val, k) => { obj[k] = val; });
                        this._requestBody = JSON.stringify(obj);
                      } else {
                        this._requestBody = String(body);
                      }
                    }

                    const override = getMatchedOverride(this._requestUrl, this._requestMethod, this._requestBody);
                    if (override) {
                      Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                      Object.defineProperty(this, 'status', { value: override.status || 200, writable: false });
                      Object.defineProperty(this, 'statusText', { value: override.statusText || 'OK', writable: false });
                      let responseText = override.mockResponse;
                      Object.defineProperty(this, 'response', { value: responseText, writable: false });
                      Object.defineProperty(this, 'responseText', { value: responseText, writable: false });

                      setTimeout(() => {
                        if (this.onreadystatechange) this.onreadystatechange(new self.Event('readystatechange'));
                        if (this.onload) this.onload(new self.Event('load'));
                        this.dispatchEvent(new self.Event('load'));
                        this.dispatchEvent(new self.Event('readystatechange'));
                      }, 10);
                      return;
                    }

                    this.addEventListener('load', function () {
                      try {
                        let responseText = '';
                        if (this.responseType === '' || this.responseType === 'text') {
                          responseText = this.responseText;
                        } else if (this.responseType === 'json') {
                          responseText = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
                        }
                        const contentType = this.getResponseHeader('content-type') || '';
                        const statusCode = this.status;
                        const rawHeaders = this.getAllResponseHeaders();
                        const responseHeaders = rawHeaders
                          ? rawHeaders.trim().split(/[\\r\\n]+/).map((line) => {
                              const parts = line.split(': ');
                              const name = parts.shift();
                              const value = parts.join(': ');
                              return { name, value };
                            }).filter((h) => h.name)
                          : [];
                        const requestHeaders = this._requestHeaders || [];
                        const requestBody = this._requestBody || '';
                        
                        let loggedResponse = responseText || '';
                        if (loggedResponse.length > 200000) {
                          loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                        }
                        const opName = extractGraphqlOperationName(this._requestUrl, requestBody);
                        logResponse(this._requestUrl, this._requestMethod, loggedResponse, contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                      } catch (e) {}
                    });
                    return originalXhrSend.apply(this, args);
                  };
                }

                self.addEventListener('message', (event) => {
                  if (event.data && event.data.type === 'REQUEST_HEADER_OVERRIDE_UPDATE_MOCKS') {
                    responseOverrides = event.data.overrides || [];
                  }
                });

                const originalImportScripts = self.importScripts;
                if (originalImportScripts) {
                  self.importScripts = function(...urls) {
                    const absoluteUrls = urls.map(url => {
                      try {
                        return new URL(url, "${absoluteURL}").href;
                      } catch(e) {
                        return url;
                      }
                    });
                    return originalImportScripts.apply(self, absoluteUrls);
                  };
                }
              if (originalImportScripts) {
                try {
                  originalImportScripts("${absoluteURL}");
                } catch(e) {
                  // Fallback if importScripts fails
                }
              }
            })();
          `;

            try {
              const blob = new Blob([workerCode], {
                type: 'application/javascript',
              });
              workerURL = URL.createObjectURL(blob);
            } catch (e) {}

            let workerInstance;
            try {
              workerInstance = new OriginalWorker(workerURL, options);
            } catch (err) {
              if (workerURL !== absoluteURL) {
                workerInstance = new OriginalWorker(absoluteURL, options);
              } else {
                throw err;
              }
            }

            if (!win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__) {
              win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__ = [];
            }
            win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__.push(
              new win.WeakRef(workerInstance)
            );

            workerInstance.addEventListener('message', (event) => {
              if (
                event.data &&
                event.data.type === 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST'
              ) {
                event.stopImmediatePropagation();

                const req = event.data.request;
                logResponse(
                  req.url,
                  req.method,
                  req.response,
                  req.contentType,
                  req.statusCode,
                  req.requestHeaders,
                  req.responseHeaders,
                  req.requestBody,
                  req.operationName
                );
              }
            });

            return workerInstance;
          };

          patchedWorker.prototype = OriginalWorker.prototype;
          win.Worker = patchedWorker;
        }
      } catch (e) {}

      // ----------------------------------------------------------------------------
      // Monkey-patch win.SharedWorker
      // ----------------------------------------------------------------------------
      try {
        if (win.SharedWorker) {
          const OriginalSharedWorker = win.SharedWorker;
          const patchedSharedWorker = function (scriptURL, options) {
            const absoluteURL = getAbsoluteUrl(scriptURL);
            let workerURL = absoluteURL;

            const isBlob = absoluteURL.startsWith('blob:');
            const isData = absoluteURL.startsWith('data:');

            const serializedOverrides = JSON.stringify(responseOverrides);

            if (isBlob || isData) {
              let originalCode = null;
              try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', absoluteURL, false);
                xhr.send();
                originalCode = xhr.responseText;
              } catch (e) {}

              if (originalCode !== null) {
                const patchCode = `
                (function() {
                  let responseOverrides = ${serializedOverrides};
                  
                  function logResponse(url, method, responseText, contentType, statusCode, requestHeaders, responseHeaders, requestBody, operationName) {
                    broadcastLog({
                      type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                      request: {
                        url,
                        method: method || 'GET',
                        response: responseText || '',
                        contentType: contentType || 'text/plain',
                        statusCode: statusCode || 200,
                        requestHeaders: requestHeaders || [],
                        responseHeaders: responseHeaders || [],
                        requestBody: requestBody || '',
                        operationName: operationName || ''
                      }
                    });
                  }

                  function getAbsoluteUrl(url) {
                    if (!url) return '';
                    let urlStr = typeof url === 'string' ? url : String(url);
                    try {
                      return new URL(urlStr, self.location.href).href;
                    } catch (e) {
                      return urlStr;
                    }
                  }

                  let ports = [];
                  self.addEventListener('connect', (e) => {
                    const port = e.ports[0];
                    ports.push(port);
                    
                    port.addEventListener('message', (event) => {
                      if (event.data && event.data.type === 'REQUEST_HEADER_OVERRIDE_UPDATE_MOCKS') {
                        responseOverrides = event.data.overrides || [];
                      }
                    });
                    port.start();
                  });

                  function broadcastLog(logData) {
                    ports.forEach((port) => {
                      try {
                        port.postMessage(logData);
                      } catch (err) {}
                    });
                  }

                  function getMatchedOverride(url, method, requestBody) {
    if (!url || typeof url !== 'string') return null;
    return responseOverrides.find((override) => {
      if (!override.active) return false;
      let urlMatches = override.matchUrl ? url.includes(override.matchUrl) : true;
      let bodyMatches = true;
      if (override.matchRequestBody && method && method.toUpperCase() !== 'GET') {
        bodyMatches = requestBody && typeof requestBody === 'string' && requestBody.includes(override.matchRequestBody);
      }
      return urlMatches && bodyMatches;
    });
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
                          const match = parsed.query.match(/(query|mutation)\\s+([a-zA-Z0-9_]+)/);
                          if (match && match[2]) {
                            return match[2];
                          }
                        }
                      } catch (e) {}
                    }
                    return null;
                  }

                  if (self.fetch) {
                    const originalFetch = self.fetch;
                    self.fetch = function(...args) {
                      const resource = args[0];
                      const rawUrl = typeof resource === 'string'
                        ? resource
                        : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                        ? resource.url
                        : resource
                        ? String(resource)
                        : '';
                      const url = getAbsoluteUrl(rawUrl);
                      const method = args[1] && args[1].method
                        ? args[1].method
                        : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                        ? resource.method
                        : 'GET';
                                            let requestBody = '';
                      if (args[1] && args[1].body) {
                        const body = args[1].body;
                        if (typeof body === 'string') {
                          requestBody = body;
                        } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                          requestBody = body.toString();
                        } else if ((self.FormData && body instanceof self.FormData)) {
                          const obj = {};
                          body.forEach((val, k) => { obj[k] = val; });
                          requestBody = JSON.stringify(obj);
                        } else {
                          requestBody = String(body);
                        }
                      }
                      const override = getMatchedOverride(url, method, requestBody);

                      if (override) {
                        try {
                          let responseBody = override.mockResponse;
                          try {
                            responseBody = JSON.stringify(JSON.parse(override.mockResponse));
                          } catch (e) {}

                          const mockResponse = new self.Response(responseBody, {
                            status: override.status || 200,
                            statusText: override.statusText || 'OK',
                            headers: new self.Headers({
                              'Content-Type': override.contentType || 'application/json',
                            }),
                          });
                          return Promise.resolve(mockResponse);
                        } catch (error) {
                          
                        }
                      }

                      let requestHeaders = [];
                      if (args[1] && args[1].headers) {
                        const headers = args[1].headers;
                        if ((self.Headers && headers instanceof self.Headers)) {
                          headers.forEach((value, name) => requestHeaders.push({ name, value }));
                        } else if (Array.isArray(headers)) {
                          requestHeaders = headers.map(([name, value]) => ({ name, value }));
                        } else {
                          Object.keys(headers).forEach((name) => requestHeaders.push({ name, value: String(headers[name]) }));
                        }
                      } else if (resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))) {
                        resource.headers.forEach((value, name) => requestHeaders.push({ name, value }));
                      }



                      return originalFetch.apply(this, args).then((response) => {
                        try {
                          const clone = response.clone();
                          const contentType = response.headers.get('content-type') || '';
                          const statusCode = response.status;
                          const responseHeaders = [];
                          response.headers.forEach((value, name) => responseHeaders.push({ name, value }));

                          clone.text().then((text) => {
                            let loggedResponse = text || '';
                            if (loggedResponse.length > 200000) {
                              loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                            }
                            const opName = extractGraphqlOperationName(url, requestBody);
                            broadcastLog({
                              type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                              request: {
                                url,
                                method,
                                response: loggedResponse,
                                contentType,
                                statusCode,
                                requestHeaders,
                                responseHeaders,
                                requestBody,
                                operationName: opName || ''
                              }
                            });
                          }).catch((e) => {
                            const opName = extractGraphqlOperationName(url, requestBody);
                            broadcastLog({
                              type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                              request: {
                                url,
                                method,
                                response: '[Unable to read response body: ' + (e.message || e) + ']',
                                contentType,
                                statusCode,
                                requestHeaders,
                                responseHeaders,
                                requestBody,
                                operationName: opName || ''
                              }
                            });
                          });
                        } catch (e) {
                          broadcastLog({
                            type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                            request: {
                              url,
                              method,
                              response: '[Unable to clone response: ' + (e.message || e) + ']',
                              contentType: response.headers.get('content-type') || '',
                              statusCode: response.status,
                              requestHeaders,
                              responseHeaders: [],
                              requestBody,
                              operationName: extractGraphqlOperationName(url, requestBody) || ''
                            }
                          });
                        }
                        return response;
                      });
                    };
                  }

                  if (self.XMLHttpRequest) {
                    const originalXhrOpen = self.XMLHttpRequest.prototype.open;
                    const originalXhrSend = self.XMLHttpRequest.prototype.send;
                    const originalXhrSetRequestHeader = self.XMLHttpRequest.prototype.setRequestHeader;

                    self.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
                      if (!this._requestHeaders) this._requestHeaders = [];
                      this._requestHeaders.push({ name, value });
                      return originalXhrSetRequestHeader.apply(this, arguments);
                    };

                    self.XMLHttpRequest.prototype.open = function (...args) {
                      this._requestMethod = args[0];
                      this._requestUrl = getAbsoluteUrl(args[1]);
                      this._requestHeaders = [];
                      this._requestBody = '';
                      return originalXhrOpen.apply(this, args);
                    };

                    self.XMLHttpRequest.prototype.send = function (...args) {
                      const body = args[0];
                      if (body) {
                        if (typeof body === 'string') {
                          this._requestBody = body;
                        } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                          this._requestBody = body.toString();
                        } else if ((self.FormData && body instanceof self.FormData)) {
                          const obj = {};
                          body.forEach((val, k) => { obj[k] = val; });
                          this._requestBody = JSON.stringify(obj);
                        } else {
                          this._requestBody = String(body);
                        }
                      }

                      const override = getMatchedOverride(this._requestUrl, this._requestMethod, this._requestBody);
                      if (override) {
                        Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                        Object.defineProperty(this, 'status', { value: override.status || 200, writable: false });
                        Object.defineProperty(this, 'statusText', { value: override.statusText || 'OK', writable: false });
                        let responseText = override.mockResponse;
                        Object.defineProperty(this, 'response', { value: responseText, writable: false });
                        Object.defineProperty(this, 'responseText', { value: responseText, writable: false });

                        setTimeout(() => {
                          if (this.onreadystatechange) this.onreadystatechange(new self.Event('readystatechange'));
                          if (this.onload) this.onload(new self.Event('load'));
                          this.dispatchEvent(new self.Event('load'));
                          this.dispatchEvent(new self.Event('readystatechange'));
                        }, 10);
                        return;
                      }

                      this.addEventListener('load', function () {
                        try {
                          let responseText = '';
                          if (this.responseType === '' || this.responseType === 'text') {
                            responseText = this.responseText;
                          } else if (this.responseType === 'json') {
                            responseText = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
                          }
                          const contentType = this.getResponseHeader('content-type') || '';
                          const statusCode = this.status;
                          const rawHeaders = this.getAllResponseHeaders();
                          const responseHeaders = rawHeaders
                            ? rawHeaders.trim().split(/[\\r\\n]+/).map((line) => {
                                const parts = line.split(': ');
                                const name = parts.shift();
                                const value = parts.join(': ');
                                return { name, value };
                              }).filter((h) => h.name)
                            : [];
                          const requestHeaders = this._requestHeaders || [];
                          const requestBody = this._requestBody || '';
                          
                          let loggedResponse = responseText || '';
                          if (loggedResponse.length > 200000) {
                            loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                          }
                          const opName = extractGraphqlOperationName(this._requestUrl, requestBody);
                          broadcastLog({
                            type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                            request: {
                              url: this._requestUrl,
                              method: this._requestMethod,
                              response: loggedResponse,
                              contentType,
                              statusCode,
                              requestHeaders,
                              responseHeaders,
                              requestBody,
                              operationName: opName || ''
                            }
                          });
                        } catch (e) {}
                      });
                      return originalXhrSend.apply(this, args);
                    };
                  }
                })();
              `;

                const workerCode = patchCode + '\n' + originalCode;
                try {
                  const blob = new Blob([workerCode], {
                    type: 'application/javascript',
                  });
                  workerURL = URL.createObjectURL(blob);
                } catch (e) {}
              }
            } else {
              const isModuleWorker = options && options.type === 'module';
              let workerCode;

              if (isModuleWorker) {
                workerCode = `
                let __req_override_mocks__ = ${serializedOverrides};
                
                function __req_override_log__(url, method, responseText, contentType, statusCode, requestHeaders, responseHeaders, requestBody, operationName) {
                  broadcastLog({
                    type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                    request: {
                      url,
                      method: method || 'GET',
                      response: responseText || '',
                      contentType: contentType || 'text/plain',
                      statusCode: statusCode || 200,
                      requestHeaders: requestHeaders || [],
                      responseHeaders: responseHeaders || [],
                      requestBody: requestBody || '',
                      operationName: operationName || ''
                    }
                  });
                }

                function __req_override_get_abs__(url) {
                  if (!url) return '';
                  let urlStr = typeof url === 'string' ? url : String(url);
                  try {
                    return new URL(urlStr, self.location.href).href;
                  } catch (e) {
                    return urlStr;
                  }
                }

                // Connect to main thread port in SharedWorker to send messages
                let ports = [];
                self.addEventListener('connect', (e) => {
                  const port = e.ports[0];
                  ports.push(port);
                  
                  port.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'REQUEST_HEADER_OVERRIDE_UPDATE_MOCKS') {
                      __req_override_mocks__ = event.data.overrides || [];
                    }
                  });
                  port.start();
                });

                // Override self.postMessage to send request logs to all connected ports
                function broadcastLog(logData) {
                  ports.forEach((port) => {
                    try {
                      port.postMessage(logData);
                    } catch (err) {}
                  });
                }

                function __req_override_match__(url) {
                  if (!url || typeof url !== 'string') return null;
                  return __req_override_mocks__.find((override) => {
                    return override.active && override.matchUrl && url.includes(override.matchUrl);
                  });
                }

                function __req_override_extract__(url, requestBody) {
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
                        const match = parsed.query.match(/(query|mutation)\\s+([a-zA-Z0-9_]+)/);
                        if (match && match[2]) {
                          return match[2];
                        }
                      }
                    } catch (e) {}
                  }
                  return null;
                }

                if (self.fetch) {
                  const originalFetch = self.fetch;
                  self.fetch = function(...args) {
                    const resource = args[0];
                    const rawUrl = typeof resource === 'string'
                      ? resource
                      : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                      ? resource.url
                      : resource
                      ? String(resource)
                      : '';
                    const url = __req_override_get_abs__(rawUrl);
                    const method = args[1] && args[1].method
                      ? args[1].method
                      : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                      ? resource.method
                      : 'GET';
                    const override = __req_override_match__(url);

                    if (override) {
                      try {
                        let responseBody = override.mockResponse;
                        try {
                          responseBody = JSON.stringify(JSON.parse(override.mockResponse));
                        } catch (e) {}

                        const mockResponse = new self.Response(responseBody, {
                          status: override.status || 200,
                          statusText: override.statusText || 'OK',
                          headers: new self.Headers({
                            'Content-Type': override.contentType || 'application/json',
                          }),
                        });
                        return Promise.resolve(mockResponse);
                      } catch (error) {
                        
                      }
                    }

                    let requestHeaders = [];
                    if (args[1] && args[1].headers) {
                      const headers = args[1].headers;
                      if ((self.Headers && headers instanceof self.Headers)) {
                        headers.forEach((value, name) => requestHeaders.push({ name, value }));
                      } else if (Array.isArray(headers)) {
                        requestHeaders = headers.map(([name, value]) => ({ name, value }));
                      } else {
                        Object.keys(headers).forEach((name) => requestHeaders.push({ name, value: String(headers[name]) }));
                      }
                    } else if (resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))) {
                      resource.headers.forEach((value, name) => requestHeaders.push({ name, value }));
                    }

                    let requestBody = '';
                    if (args[1] && args[1].body) {
                      const body = args[1].body;
                      if (typeof body === 'string') {
                        requestBody = body;
                      } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                        requestBody = body.toString();
                      } else if ((self.FormData && body instanceof self.FormData)) {
                        const obj = {};
                        body.forEach((val, k) => { obj[k] = val; });
                        requestBody = JSON.stringify(obj);
                      } else {
                        requestBody = String(body);
                      }
                    }

                    return originalFetch.apply(this, args).then((response) => {
                      try {
                        const clone = response.clone();
                        const contentType = response.headers.get('content-type') || '';
                        const statusCode = response.status;
                        const responseHeaders = [];
                        response.headers.forEach((value, name) => responseHeaders.push({ name, value }));

                        clone.text().then((text) => {
                          let loggedResponse = text || '';
                          if (loggedResponse.length > 200000) {
                            loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                          }
                          const opName = __req_override_extract__(url, requestBody);
                          __req_override_log__(url, method, loggedResponse, contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                        }).catch((e) => {
                          const opName = __req_override_extract__(url, requestBody);
                          __req_override_log__(url, method, '[Unable to read response body: ' + (e.message || e) + ']', contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                        });
                      } catch (e) {
                        __req_override_log__(
                          url,
                          method,
                          '[Unable to clone response: ' + (e.message || e) + ']',
                          response.headers.get('content-type') || '',
                          response.status,
                          requestHeaders,
                          [],
                          requestBody,
                          __req_override_extract__(url, requestBody)
                        );
                      }
                      return response;
                    });
                  };
                }

                if (self.XMLHttpRequest) {
                  const originalXhrOpen = self.XMLHttpRequest.prototype.open;
                  const originalXhrSend = self.XMLHttpRequest.prototype.send;
                  const originalXhrSetRequestHeader = self.XMLHttpRequest.prototype.setRequestHeader;

                  self.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
                    if (!this._requestHeaders) this._requestHeaders = [];
                    this._requestHeaders.push({ name, value });
                    return originalXhrSetRequestHeader.apply(this, arguments);
                  };

                  self.XMLHttpRequest.prototype.open = function (...args) {
                    this._requestMethod = args[0];
                    this._requestUrl = __req_override_get_abs__(args[1]);
                    this._requestHeaders = [];
                    this._requestBody = '';
                    return originalXhrOpen.apply(this, args);
                  };

                  self.XMLHttpRequest.prototype.send = function (...args) {
                    const body = args[0];
                    if (body) {
                      if (typeof body === 'string') {
                        this._requestBody = body;
                      } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                        this._requestBody = body.toString();
                      } else if ((self.FormData && body instanceof self.FormData)) {
                        const obj = {};
                        body.forEach((val, k) => { obj[k] = val; });
                        this._requestBody = JSON.stringify(obj);
                      } else {
                        this._requestBody = String(body);
                      }
                    }

                    const override = __req_override_match__(this._requestUrl);
                    if (override) {
                      Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                      Object.defineProperty(this, 'status', { value: override.status || 200, writable: false });
                      Object.defineProperty(this, 'statusText', { value: override.statusText || 'OK', writable: false });
                      let responseText = override.mockResponse;
                      Object.defineProperty(this, 'response', { value: responseText, writable: false });
                      Object.defineProperty(this, 'responseText', { value: responseText, writable: false });

                      setTimeout(() => {
                        if (this.onreadystatechange) this.onreadystatechange(new self.Event('readystatechange'));
                        if (this.onload) this.onload(new self.Event('load'));
                        this.dispatchEvent(new self.Event('load'));
                        this.dispatchEvent(new self.Event('readystatechange'));
                      }, 10);
                      return;
                    }

                    this.addEventListener('load', function () {
                      try {
                        let responseText = '';
                        if (this.responseType === '' || this.responseType === 'text') {
                          responseText = this.responseText;
                        } else if (this.responseType === 'json') {
                          responseText = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
                        }
                        const contentType = this.getResponseHeader('content-type') || '';
                        const statusCode = this.status;
                        const rawHeaders = this.getAllResponseHeaders();
                        const responseHeaders = rawHeaders
                          ? rawHeaders.trim().split(/[\\r\\n]+/).map((line) => {
                              const parts = line.split(': ');
                              const name = parts.shift();
                              const value = parts.join(': ');
                              return { name, value };
                            }).filter((h) => h.name)
                          : [];
                        const requestHeaders = this._requestHeaders || [];
                        const requestBody = this._requestBody || '';
                        
                        let loggedResponse = responseText || '';
                        if (loggedResponse.length > 200000) {
                          loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                        }
                        const opName = __req_override_extract__(this._requestUrl, requestBody);
                        __req_override_log__(this._requestUrl, this._requestMethod, loggedResponse, contentType, statusCode, requestHeaders, responseHeaders, requestBody, opName);
                      } catch (e) {}
                    });
                    return originalXhrSend.apply(this, args);
                  };
                }

                import "${absoluteURL}";
              `;
              } else {
                workerCode = `
                (function() {
                  let responseOverrides = ${serializedOverrides};
                  
                  function logResponse(url, method, responseText, contentType, statusCode, requestHeaders, responseHeaders, requestBody, operationName) {
                    broadcastLog({
                      type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                      request: {
                        url,
                        method: method || 'GET',
                        response: responseText || '',
                        contentType: contentType || 'text/plain',
                        statusCode: statusCode || 200,
                        requestHeaders: requestHeaders || [],
                        responseHeaders: responseHeaders || [],
                        requestBody: requestBody || '',
                        operationName: operationName || ''
                      }
                    });
                  }

                  function getAbsoluteUrl(url) {
                    if (!url) return '';
                    let urlStr = typeof url === 'string' ? url : String(url);
                    try {
                      return new URL(urlStr, self.location.href).href;
                    } catch (e) {
                      return urlStr;
                    }
                  }

                  // Connect to main thread port in SharedWorker to send messages
                  let ports = [];
                  self.addEventListener('connect', (e) => {
                    const port = e.ports[0];
                    ports.push(port);
                    
                    port.addEventListener('message', (event) => {
                      if (event.data && event.data.type === 'REQUEST_HEADER_OVERRIDE_UPDATE_MOCKS') {
                        responseOverrides = event.data.overrides || [];
                      }
                    });
                    port.start();
                  });

                  // Override self.postMessage to send request logs to all connected ports
                  function broadcastLog(logData) {
                    ports.forEach((port) => {
                      try {
                        port.postMessage(logData);
                      } catch (err) {}
                    });
                  }

                  function getMatchedOverride(url, method, requestBody) {
    if (!url || typeof url !== 'string') return null;
    return responseOverrides.find((override) => {
      if (!override.active) return false;
      let urlMatches = override.matchUrl ? url.includes(override.matchUrl) : true;
      let bodyMatches = true;
      if (override.matchRequestBody && method && method.toUpperCase() !== 'GET') {
        bodyMatches = requestBody && typeof requestBody === 'string' && requestBody.includes(override.matchRequestBody);
      }
      return urlMatches && bodyMatches;
    });
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
                          const match = parsed.query.match(/(query|mutation)\\s+([a-zA-Z0-9_]+)/);
                          if (match && match[2]) {
                            return match[2];
                          }
                        }
                      } catch (e) {}
                    }
                    return null;
                  }

                  if (self.fetch) {
                    const originalFetch = self.fetch;
                    self.fetch = function(...args) {
                      const resource = args[0];
                      const rawUrl = typeof resource === 'string'
                        ? resource
                        : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                        ? resource.url
                        : resource
                        ? String(resource)
                        : '';
                      const url = getAbsoluteUrl(rawUrl);
                      const method = args[1] && args[1].method
                        ? args[1].method
                        : resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))
                        ? resource.method
                        : 'GET';
                                            let requestBody = '';
                      if (args[1] && args[1].body) {
                        const body = args[1].body;
                        if (typeof body === 'string') {
                          requestBody = body;
                        } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                          requestBody = body.toString();
                        } else if ((self.FormData && body instanceof self.FormData)) {
                          const obj = {};
                          body.forEach((val, k) => { obj[k] = val; });
                          requestBody = JSON.stringify(obj);
                        } else {
                          requestBody = String(body);
                        }
                      }
                      const override = getMatchedOverride(url, method, requestBody);

                      if (override) {
                        try {
                          let responseBody = override.mockResponse;
                          try {
                            responseBody = JSON.stringify(JSON.parse(override.mockResponse));
                          } catch (e) {}

                          const mockResponse = new self.Response(responseBody, {
                            status: override.status || 200,
                            statusText: override.statusText || 'OK',
                            headers: new self.Headers({
                              'Content-Type': override.contentType || 'application/json',
                            }),
                          });
                          return Promise.resolve(mockResponse);
                        } catch (error) {
                          
                        }
                      }

                      let requestHeaders = [];
                      if (args[1] && args[1].headers) {
                        const headers = args[1].headers;
                        if ((self.Headers && headers instanceof self.Headers)) {
                          headers.forEach((value, name) => requestHeaders.push({ name, value }));
                        } else if (Array.isArray(headers)) {
                          requestHeaders = headers.map(([name, value]) => ({ name, value }));
                        } else {
                          Object.keys(headers).forEach((name) => requestHeaders.push({ name, value: String(headers[name]) }));
                        }
                      } else if (resource && ((self.Request && resource instanceof self.Request) || (resource.constructor && resource.constructor.name === 'Request'))) {
                        resource.headers.forEach((value, name) => requestHeaders.push({ name, value }));
                      }



                      return originalFetch.apply(this, args).then((response) => {
                        try {
                          const clone = response.clone();
                          const contentType = response.headers.get('content-type') || '';
                          const statusCode = response.status;
                          const responseHeaders = [];
                          response.headers.forEach((value, name) => responseHeaders.push({ name, value }));

                          clone.text().then((text) => {
                            let loggedResponse = text || '';
                            if (loggedResponse.length > 200000) {
                              loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                            }
                            const opName = extractGraphqlOperationName(url, requestBody);
                            broadcastLog({
                              type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                              request: {
                                url,
                                method,
                                response: loggedResponse,
                                contentType,
                                statusCode,
                                requestHeaders,
                                responseHeaders,
                                requestBody,
                                operationName: opName || ''
                              }
                            });
                          }).catch((e) => {
                            const opName = extractGraphqlOperationName(url, requestBody);
                            broadcastLog({
                              type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                              request: {
                                url,
                                method,
                                response: '[Unable to read response body: ' + (e.message || e) + ']',
                                contentType,
                                statusCode,
                                requestHeaders,
                                responseHeaders,
                                requestBody,
                                operationName: opName || ''
                              }
                            });
                          });
                        } catch (e) {
                          broadcastLog({
                            type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                            request: {
                              url,
                              method,
                              response: '[Unable to clone response: ' + (e.message || e) + ']',
                              contentType: response.headers.get('content-type') || '',
                              statusCode: response.status,
                              requestHeaders,
                              responseHeaders: [],
                              requestBody,
                              operationName: extractGraphqlOperationName(url, requestBody) || ''
                            }
                          });
                        }
                        return response;
                      });
                    };
                  }

                  if (self.XMLHttpRequest) {
                    const originalXhrOpen = self.XMLHttpRequest.prototype.open;
                    const originalXhrSend = self.XMLHttpRequest.prototype.send;
                    const originalXhrSetRequestHeader = self.XMLHttpRequest.prototype.setRequestHeader;

                    self.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
                      if (!this._requestHeaders) this._requestHeaders = [];
                      this._requestHeaders.push({ name, value });
                      return originalXhrSetRequestHeader.apply(this, arguments);
                    };

                    self.XMLHttpRequest.prototype.open = function (...args) {
                      this._requestMethod = args[0];
                      this._requestUrl = getAbsoluteUrl(args[1]);
                      this._requestHeaders = [];
                      this._requestBody = '';
                      return originalXhrOpen.apply(this, args);
                    };

                    self.XMLHttpRequest.prototype.send = function (...args) {
                      const body = args[0];
                      if (body) {
                        if (typeof body === 'string') {
                          this._requestBody = body;
                        } else if ((self.URLSearchParams && body instanceof self.URLSearchParams)) {
                          this._requestBody = body.toString();
                        } else if ((self.FormData && body instanceof self.FormData)) {
                          const obj = {};
                          body.forEach((val, k) => { obj[k] = val; });
                          this._requestBody = JSON.stringify(obj);
                        } else {
                          this._requestBody = String(body);
                        }
                      }

                      const override = getMatchedOverride(this._requestUrl, this._requestMethod, this._requestBody);
                      if (override) {
                        Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                        Object.defineProperty(this, 'status', { value: override.status || 200, writable: false });
                        Object.defineProperty(this, 'statusText', { value: override.statusText || 'OK', writable: false });
                        let responseText = override.mockResponse;
                        Object.defineProperty(this, 'response', { value: responseText, writable: false });
                        Object.defineProperty(this, 'responseText', { value: responseText, writable: false });

                        setTimeout(() => {
                          if (this.onreadystatechange) this.onreadystatechange(new self.Event('readystatechange'));
                          if (this.onload) this.onload(new self.Event('load'));
                          this.dispatchEvent(new self.Event('load'));
                          this.dispatchEvent(new self.Event('readystatechange'));
                        }, 10);
                        return;
                      }

                      this.addEventListener('load', function () {
                        try {
                          let responseText = '';
                          if (this.responseType === '' || this.responseType === 'text') {
                            responseText = this.responseText;
                          } else if (this.responseType === 'json') {
                            responseText = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
                          }
                          const contentType = this.getResponseHeader('content-type') || '';
                          const statusCode = this.status;
                          const rawHeaders = this.getAllResponseHeaders();
                          const responseHeaders = rawHeaders
                            ? rawHeaders.trim().split(/[\\r\\n]+/).map((line) => {
                                const parts = line.split(': ');
                                const name = parts.shift();
                                const value = parts.join(': ');
                                return { name, value };
                              }).filter((h) => h.name)
                            : [];
                          const requestHeaders = this._requestHeaders || [];
                          const requestBody = this._requestBody || '';
                          
                          let loggedResponse = responseText || '';
                          if (loggedResponse.length > 200000) {
                            loggedResponse = loggedResponse.substring(0, 100000) + '\\n\\n... [Response body truncated because it exceeds 200KB limit]';
                          }
                          const opName = extractGraphqlOperationName(this._requestUrl, requestBody);
                          broadcastLog({
                            type: 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST',
                            request: {
                              url: this._requestUrl,
                              method: this._requestMethod,
                              response: loggedResponse,
                              contentType,
                              statusCode,
                              requestHeaders,
                              responseHeaders,
                              requestBody,
                              operationName: opName || ''
                            }
                          });
                        } catch (e) {}
                      });
                      return originalXhrSend.apply(this, args);
                    };
                  }

                  const originalImportScripts = self.importScripts;
                  if (originalImportScripts) {
                    self.importScripts = function(...urls) {
                      const absoluteUrls = urls.map(url => {
                        try {
                          return new URL(url, "${absoluteURL}").href;
                        } catch(e) {
                          return url;
                        }
                      });
                      return originalImportScripts.apply(self, absoluteUrls);
                    };
                  }

                  if (originalImportScripts) {
                    originalImportScripts("${absoluteURL}");
                  }
                })();
              `;
              }

              try {
                const blob = new Blob([workerCode], {
                  type: 'application/javascript',
                });
                workerURL = URL.createObjectURL(blob);
              } catch (e) {}
            }

            let workerInstance;
            try {
              workerInstance = new OriginalSharedWorker(workerURL, options);
            } catch (err) {
              if (workerURL !== absoluteURL) {
                workerInstance = new OriginalSharedWorker(absoluteURL, options);
              } else {
                throw err;
              }
            }

            if (!win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__) {
              win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__ = [];
            }
            win.__REQUEST_HEADER_OVERRIDE_ACTIVE_WORKERS__.push(
              new win.WeakRef(workerInstance)
            );

            workerInstance.port.addEventListener('message', (event) => {
              if (
                event.data &&
                event.data.type === 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST'
              ) {
                event.stopImmediatePropagation();

                const req = event.data.request;
                logResponse(
                  req.url,
                  req.method,
                  req.response,
                  req.contentType,
                  req.statusCode,
                  req.requestHeaders,
                  req.responseHeaders,
                  req.requestBody,
                  req.operationName
                );
              }
            });
            workerInstance.port.start();

            return workerInstance;
          };

          patchedSharedWorker.prototype = OriginalSharedWorker.prototype;
          win.SharedWorker = patchedSharedWorker;
        }
      } catch (e) {}

      // Helper to patch fetch on a specific target
      function patchFetchOnTarget(target, originalFetch) {
        if (
          !target ||
          !originalFetch ||
          originalFetch.__REQUEST_HEADER_OVERRIDE_PATCHED__
        )
          return;

        const newFetch = function (...args) {
          const resource = args[0];
          const rawUrl =
            typeof resource === 'string'
              ? resource
              : resource &&
                ((win.Request && resource instanceof win.Request) ||
                  (resource.constructor &&
                    resource.constructor.name === 'Request'))
              ? resource.url
              : resource
              ? String(resource)
              : '';
          const url = getAbsoluteUrl(rawUrl);
          const method =
            args[1] && args[1].method
              ? args[1].method
              : resource &&
                ((win.Request && resource instanceof win.Request) ||
                  (resource.constructor &&
                    resource.constructor.name === 'Request'))
              ? resource.method
              : 'GET';

                    let requestBody = '';
          if (args[1] && args[1].body) {
            const body = args[1].body;
            if (typeof body === 'string') {
              requestBody = body;
            } else if ((win.URLSearchParams && body instanceof win.URLSearchParams)) {
              requestBody = body.toString();
            } else if ((win.FormData && body instanceof win.FormData)) {
              const obj = {};
              body.forEach((val, k) => {
                obj[k] = val;
              });
              requestBody = JSON.stringify(obj);
            } else {
              requestBody = String(body);
            }
          }
          const override = getMatchedOverride(url, method, requestBody);

          if (override) {
            try {
              let responseBody = override.mockResponse;
              try {
                responseBody = JSON.stringify(
                  JSON.parse(override.mockResponse)
                );
              } catch (e) {}

              const mockResponse = new win.Response(responseBody, {
                status: override.status || 200,
                statusText: override.statusText || 'OK',
                headers: new win.Headers({
                  'Content-Type': override.contentType || 'application/json',
                }),
              });

              return Promise.resolve(mockResponse);
            } catch (error) {}
          }

          let requestHeaders = [];
          if (args[1] && args[1].headers) {
            const headers = args[1].headers;
            if ((win.Headers && headers instanceof win.Headers)) {
              headers.forEach((value, name) =>
                requestHeaders.push({ name, value })
              );
            } else if (Array.isArray(headers)) {
              requestHeaders = headers.map(([name, value]) => ({
                name,
                value,
              }));
            } else {
              Object.keys(headers).forEach((name) =>
                requestHeaders.push({ name, value: String(headers[name]) })
              );
            }
          } else if (
            resource &&
            ((win.Request && resource instanceof win.Request) ||
              (resource.constructor && resource.constructor.name === 'Request'))
          ) {
            resource.headers.forEach((value, name) =>
              requestHeaders.push({ name, value })
            );
          }



          return originalFetch.apply(this, args).then((response) => {
            const contentType = response.headers.get('content-type') || '';
            const shouldReadBody =
              !contentType ||
              contentType.includes('json') ||
              contentType.includes('text') ||
              contentType.includes('xml') ||
              contentType.includes('graphql') ||
              contentType.includes('javascript') ||
              url.includes('_rsc=');

            const responseHeaders = [];
            try {
              response.headers.forEach((value, name) => {
                responseHeaders.push({ name, value });
              });
            } catch (hErr) {}

            if (!shouldReadBody) {
              // For binary/unsupported media types, log without body to save memory/CPU
              logResponse(
                url,
                method,
                `[Response body of type ${contentType} not captured]`,
                contentType,
                response.status,
                requestHeaders,
                responseHeaders,
                requestBody
              );
              return response;
            }

            try {
              const clone = response.clone();
              const statusCode = response.status;

              return clone
                .text()
                .then((text) => {
                  logResponse(
                    url,
                    method,
                    text,
                    contentType,
                    statusCode,
                    requestHeaders,
                    responseHeaders,
                    requestBody
                  );
                  return response;
                })
                .catch((e) => {
                  logResponse(
                    url,
                    method,
                    `[Unable to read response body: ${e.message || e}]`,
                    contentType,
                    statusCode,
                    requestHeaders,
                    responseHeaders,
                    requestBody
                  );
                  return response;
                });
            } catch (e) {
              logResponse(
                url,
                method,
                `[Unable to clone response: ${e.message || e}]`,
                contentType,
                response.status,
                requestHeaders,
                responseHeaders,
                requestBody
              );
              return response;
            }
          });
        };

        newFetch.__REQUEST_HEADER_OVERRIDE_PATCHED__ = true;

        try {
          Object.defineProperty(target, 'fetch', {
            value: newFetch,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } catch (e) {
          target.fetch = newFetch;
        }
      }

      // ----------------------------------------------------------------------------
      // Monkey-patch win.fetch
      // ----------------------------------------------------------------------------
      try {
        if (win.fetch) {
          patchFetchOnTarget(win, win.fetch);
        }
        if (win.Window && win.Window.prototype && win.Window.prototype.fetch) {
          patchFetchOnTarget(win.Window.prototype, win.Window.prototype.fetch);
        }
      } catch (e) {}

      // ----------------------------------------------------------------------------
      // Monkey-patch XMLHttpRequest
      // ----------------------------------------------------------------------------
      try {
        if (win.XMLHttpRequest) {
          const proto = win.XMLHttpRequest.prototype;
          if (!proto._patchedForRequestHeaderOverride) {
            proto._patchedForRequestHeaderOverride = true;

            const originalXhrOpen = proto.open;
            const originalXhrSend = proto.send;
            const originalXhrSetRequestHeader = proto.setRequestHeader;

            proto.setRequestHeader = function (name, value) {
              if (!this._requestHeaders) {
                this._requestHeaders = [];
              }
              this._requestHeaders.push({ name, value });
              return originalXhrSetRequestHeader.apply(this, arguments);
            };

            proto.open = function (...args) {
              this._requestMethod = args[0];
              this._requestUrl = getAbsoluteUrl(args[1]);
              this._requestHeaders = [];
              this._requestBody = '';
              return originalXhrOpen.apply(this, args);
            };

            proto.send = function (...args) {
              const body = args[0];
              if (body) {
                if (typeof body === 'string') {
                  this._requestBody = body;
                } else if ((win.URLSearchParams && body instanceof win.URLSearchParams)) {
                  this._requestBody = body.toString();
                } else if ((win.FormData && body instanceof win.FormData)) {
                  const obj = {};
                  body.forEach((val, k) => {
                    obj[k] = val;
                  });
                  this._requestBody = JSON.stringify(obj);
                } else {
                  this._requestBody = String(body);
                }
              }

              const override = getMatchedOverride(this._requestUrl, this._requestMethod, this._requestBody);

              if (override) {
                Object.defineProperty(this, 'readyState', {
                  value: 4,
                  writable: false,
                });
                Object.defineProperty(this, 'status', {
                  value: override.status || 200,
                  writable: false,
                });
                Object.defineProperty(this, 'statusText', {
                  value: override.statusText || 'OK',
                  writable: false,
                });

                let responseText = override.mockResponse;
                Object.defineProperty(this, 'response', {
                  value: responseText,
                  writable: false,
                });
                Object.defineProperty(this, 'responseText', {
                  value: responseText,
                  writable: false,
                });

                setTimeout(() => {
                  if (this.onreadystatechange) {
                    this.onreadystatechange(new win.Event('readystatechange'));
                  }
                  if (this.onload) {
                    this.onload(new win.Event('load'));
                  }
                  this.dispatchEvent(new win.Event('load'));
                  this.dispatchEvent(new win.Event('readystatechange'));
                }, 10);

                return;
              }

              this.addEventListener('load', function () {
                try {
                  let responseText = '';
                  if (
                    this.responseType === '' ||
                    this.responseType === 'text'
                  ) {
                    responseText = this.responseText;
                  } else if (this.responseType === 'json') {
                    responseText =
                      typeof this.response === 'string'
                        ? this.response
                        : JSON.stringify(this.response);
                  }
                  const contentType =
                    this.getResponseHeader('content-type') || '';
                  const statusCode = this.status;

                  const rawHeaders = this.getAllResponseHeaders();
                  const responseHeaders = rawHeaders
                    ? rawHeaders
                        .trim()
                        .split(/[\r\n]+/)
                        .map((line) => {
                          const parts = line.split(': ');
                          const name = parts.shift();
                          const value = parts.join(': ');
                          return { name, value };
                        })
                        .filter((h) => h.name)
                    : [];

                  const requestHeaders = this._requestHeaders || [];
                  const requestBody = this._requestBody || '';

                  logResponse(
                    this._requestUrl,
                    this._requestMethod,
                    responseText,
                    contentType,
                    statusCode,
                    requestHeaders,
                    responseHeaders,
                    requestBody
                  );
                } catch (e) {}
              });
              return originalXhrSend.apply(this, args);
            };
          }
        }
      } catch (e) {}
    }
  }

  // Patch the main window
  patchWindow(window);

  // Hook DOM insertion methods to patch dynamic iframes synchronously
  try {
    const patchInsertedNode = function (node) {
      if (!node) return;
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName === 'IFRAME') {
          try {
            if (node.contentDocument && node.contentWindow) {
              patchWindow(node.contentWindow);
            }
          } catch (e) {}
        } else if (node.querySelectorAll) {
          try {
            node.querySelectorAll('iframe').forEach((iframe) => {
              if (iframe.contentDocument && iframe.contentWindow) {
                patchWindow(iframe.contentWindow);
              }
            });
          } catch (e) {}
        }
      }
    };

    const origAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
      const res = origAppendChild.apply(this, arguments);
      patchInsertedNode(child);
      return res;
    };

    const origInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function (child, reference) {
      const res = origInsertBefore.apply(this, arguments);
      patchInsertedNode(child);
      return res;
    };

    const origReplaceChild = Node.prototype.replaceChild;
    Node.prototype.replaceChild = function (newChild, oldChild) {
      const res = origReplaceChild.apply(this, arguments);
      patchInsertedNode(newChild);
      return res;
    };

    if (Element.prototype.append) {
      const origAppend = Element.prototype.append;
      Element.prototype.append = function (...nodes) {
        const res = origAppend.apply(this, arguments);
        nodes.forEach(patchInsertedNode);
        return res;
      };
    }

    if (Element.prototype.prepend) {
      const origPrepend = Element.prototype.prepend;
      Element.prototype.prepend = function (...nodes) {
        const res = origPrepend.apply(this, arguments);
        nodes.forEach(patchInsertedNode);
        return res;
      };
    }
  } catch (e) {}

  // Hook iframe creation so dynamic sandboxed iframes also get patched on contentWindow / contentDocument access
  try {
    const descContentWindow = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      'contentWindow'
    );
    if (descContentWindow && descContentWindow.get) {
      const originalGetContentWindow = descContentWindow.get;
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function () {
          const win = originalGetContentWindow.call(this);
          if (win) {
            let isSameOrigin = false;
            try {
              isSameOrigin = !!this.contentDocument;
            } catch (e) {
              isSameOrigin = false;
            }
            if (isSameOrigin) {
              patchWindow(win);
            }
          }
          return win;
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch (e) {}

  try {
    const descContentDocument = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      'contentDocument'
    );
    if (descContentDocument && descContentDocument.get) {
      const originalGetContentDocument = descContentDocument.get;
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
        get: function () {
          const doc = originalGetContentDocument.call(this);
          if (doc) {
            let isSameOrigin = false;
            try {
              isSameOrigin = !!doc.defaultView;
            } catch (e) {
              isSameOrigin = false;
            }
            if (isSameOrigin && doc.defaultView) {
              patchWindow(doc.defaultView);
            }
          }
          return doc;
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch (e) {}
}
window.postMessage({ type: 'REQUEST_HEADER_OVERRIDE_INJECTED_READY' }, '*');
