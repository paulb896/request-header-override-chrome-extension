/**
 * Used to provide request header data to the injected http interceptor.
 */
const updateRequestHeadersInDOM = (requestHeaders) => {
  document.body.setAttribute('header-overrides', requestHeaders);
}

const getAndUpdateRequestHeaders = () => chrome.storage.local.get(["requestHeaders"]).then((result) =>
  updateRequestHeadersInDOM(result.requestHeaders)
);

// Sync page headers to DOM on page load.
getAndUpdateRequestHeaders()

// Sync page headers to DOM when a request header is added/updated/removed.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.requestHeaders && changes.requestHeaders.newValue) {
    updateRequestHeadersInDOM(changes.requestHeaders.newValue)
  }
});

