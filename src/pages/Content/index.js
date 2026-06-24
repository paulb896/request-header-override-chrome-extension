let requestCollectingEnabled = false;

// Helper to push overrides to the injected script
const updateInjectedMocks = (overrides) => {
  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.storage.local.get(['requestCollectingEnabled', 'responseOverridesEnabled'], (result) => {
        try {
          if (!chrome.runtime || !chrome.runtime.id) return;
          const collecting = result.requestCollectingEnabled === true;
          const overridesEnabled = result.responseOverridesEnabled === true;
          requestCollectingEnabled = collecting;



          window.postMessage(
            {
              type: 'REQUEST_HEADER_OVERRIDE_RESPONSE_MOCKS',
              overrides: overridesEnabled ? (overrides || []) : [],
              requestCollectingEnabled: collecting,
              responseOverridesEnabled: overridesEnabled,
            },
            '*'
          );
        } catch (e) {}
      });
    }
  } catch (e) {}
};

// Listen for updates from settings
try {
  if (chrome && chrome.runtime && chrome.runtime.id) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) return;
        if (namespace === 'local') {
          if (changes.responseOverrides || changes.requestCollectingEnabled || changes.responseOverridesEnabled) {
            chrome.storage.local.get(['responseOverrides'], (result) => {
              updateInjectedMocks(result.responseOverrides || []);
            });
          }
        }
      } catch (e) {
        // Handle invalidated context
      }
    });

    chrome.runtime.sendMessage({
      type: 'REQUEST_HEADER_OVERRIDE_CONTENT_SCRIPT_PING',
    });
  }
} catch (e) {}

// De-duplicate logs that may arrive via both DOM and postMessage channels
const recentLogKeys = new Set();
const LOG_DEDUP_TTL = 3000; // ms

function makeLogKey(request) {
  return `${request.url}|${request.method}|${request.statusCode}`;
}

// Forward a log entry from the injected script to the background
function forwardLogToBackground(logData) {
  if (!requestCollectingEnabled) return;
  if (!logData || !logData.request) return;

  // De-duplicate: skip if we've already forwarded this exact request recently
  const key = makeLogKey(logData.request);
  if (recentLogKeys.has(key)) {
    return;
  }
  recentLogKeys.add(key);
  setTimeout(() => recentLogKeys.delete(key), LOG_DEDUP_TTL);

  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage(
        {
          type: 'LOG_RESPONSE',
          request: logData.request,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // Silently ignore - service worker may be temporarily unavailable
          }
        }
      );
    }
  } catch (e) {
    // Extension context invalidated
  }
}

// --------------------------------------------------------------------------
// Channel 1: DOM-based communication (MutationObserver)
// The inject script (MAIN world) writes log data as hidden DOM elements.
// We observe those mutations here in the ISOLATED world and forward to
// the background script. This bypasses page-script wrappers.
// --------------------------------------------------------------------------
const LOG_CONTAINER_ID = '__rho_log_container__';

function processLogNode(node) {
  const raw = node.getAttribute('data-log');
  if (!raw) return;
  try {
    const logData = JSON.parse(raw);
    if (logData && logData.type === 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST') {
      forwardLogToBackground(logData);
    }
  } catch (e) {
    // Invalid JSON, skip
  }
}

// Observe the log container for child additions
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.hasAttribute('data-log')
      ) {
        processLogNode(node);
        node.remove();
      }
    }
  }
});

function startObserving() {
  const container = document.getElementById(LOG_CONTAINER_ID);
  if (container) {
    container.querySelectorAll('[data-log]').forEach((node) => {
      processLogNode(node);
      node.remove();
    });
    observer.observe(container, { childList: true });
  } else {
    // Container doesn't exist yet - observe documentElement for it
    const docObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.id === LOG_CONTAINER_ID) {
              docObserver.disconnect();
              node.querySelectorAll('[data-log]').forEach((child) => {
                processLogNode(child);
                child.remove();
              });
              observer.observe(node, { childList: true });
              return;
            }
            const found =
              node.querySelector && node.querySelector('#' + LOG_CONTAINER_ID);
            if (found) {
              docObserver.disconnect();
              found.querySelectorAll('[data-log]').forEach((child) => {
                processLogNode(child);
                child.remove();
              });
              observer.observe(found, { childList: true });
              return;
            }
          }
        }
      }
    });
    docObserver.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }
}

startObserving();

// --------------------------------------------------------------------------
// Channel 2: postMessage listener (native postMessage from inject script,
// and also Worker-originated logs)
// --------------------------------------------------------------------------
const handleMessage = (event) => {
  if (!event.data) return;

  if (event.data.type === 'REQUEST_HEADER_OVERRIDE_LOG_REQUEST') {
    forwardLogToBackground(event.data);
  } else if (event.data.type === 'REQUEST_HEADER_OVERRIDE_INJECTED_READY') {
    try {
      if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.get(['responseOverrides'], (result) => {
          try {
            if (!chrome.runtime || !chrome.runtime.id) return;
            updateInjectedMocks(result.responseOverrides || []);
          } catch (e) {}
        });
      }
    } catch (e) {}
  }
};

window.addEventListener('message', handleMessage);

// Initial load - send overrides to injected script
try {
  if (chrome && chrome.runtime && chrome.runtime.id) {
    chrome.storage.local.get(['responseOverrides'], (result) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) return;
        updateInjectedMocks(result.responseOverrides || []);
      } catch (e) {
        // Handle invalidated context
      }
    });
  }
} catch (e) {
  // Handle invalidated context gracefully
}
