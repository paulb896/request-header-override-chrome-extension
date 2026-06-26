import React, { useState, useEffect } from 'react';
import { generateRandomId } from '../../../../utils/index';
import JsonEditor from './JsonEditor';

const formatJsonString = (str) => {
  if (!str) return '';
  try {
    const trimmed = str.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    }
  } catch (e) {}
  return str;
};

function ResponseOverridesApp({
  hideRecentRequests = false,
  responseOverridesEnabled: propEnabled,
  setResponseOverridesEnabled: propSetEnabled,
}) {
  const [overrides, setOverrides] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [filterTerm, setFilterTerm] = useState('');
  const [methodFilters, setMethodFilters] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [typeFilters, setTypeFilters] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [matchUrl, setMatchUrl] = useState('');
  const [matchRequestBody, setMatchRequestBody] = useState('');
  const [mockResponse, setMockResponse] = useState('');

  const [localEnabled, setLocalEnabled] = useState(false);

  const isEnabled = propEnabled !== undefined ? propEnabled : localEnabled;
  const setIsEnabled = (val) => {
    if (propSetEnabled) {
      propSetEnabled(val);
    } else {
      setLocalEnabled(val);
      if (chrome.storage) {
        chrome.storage.local.set({ responseOverridesEnabled: val });
      }
    }
  };

  useEffect(() => {
    if (propEnabled === undefined && chrome.storage) {
      chrome.storage.local.get(['responseOverridesEnabled'], (result) => {
        if (result.responseOverridesEnabled !== undefined) {
          setLocalEnabled(result.responseOverridesEnabled);
        }
      });
      const listener = (changes, namespace) => {
        if (namespace === 'local' && changes.responseOverridesEnabled) {
          setLocalEnabled(changes.responseOverridesEnabled.newValue || false);
        }
      };
      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
      }
    }
  }, [propEnabled]);

  const filteredRequests = recentRequests.filter((req) => {
    const term = filterTerm.toLowerCase();
    const matchesTerm = (
      (req.url && req.url.toLowerCase().includes(term)) ||
      (req.method && req.method.toLowerCase().includes(term)) ||
      (req.operationName && req.operationName.toLowerCase().includes(term)) ||
      (req.response && req.response.toLowerCase().includes(term))
    );

    const matchesMethod = methodFilters.length === 0 || methodFilters.includes(req.method);
    
    let matchesStatus = true;
    if (statusFilters.length > 0) {
      const code = req.statusCode ?? 200;
      matchesStatus = statusFilters.some(sf => 
        (sf === '2xx' && code >= 200 && code < 300) ||
        (sf === '3xx' && code >= 300 && code < 400) ||
        (sf === '4xx' && code >= 400 && code < 500) ||
        (sf === '5xx' && code >= 500 && code < 600) ||
        (sf === 'Error' && (code === 0 || code >= 400))
      );
    }

    let matchesType = true;
    if (typeFilters.length > 0) {
      const isGraphql = !!req.operationName;
      const isJson = req.contentType && req.contentType.toLowerCase().includes('json');
      matchesType = typeFilters.some(tf => 
        (tf === 'graphql' && isGraphql) ||
        (tf === 'json' && isJson)
      );
    }

    return matchesTerm && matchesMethod && matchesStatus && matchesType;
  });

  const toggleMethod = (m) => setMethodFilters(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleType = (t) => setTypeFilters(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
  const STATUS_OPTIONS = [
    { label: '2xx Success', value: '2xx' },
    { label: '3xx Redirect', value: '3xx' },
    { label: '4xx Error', value: '4xx' },
    { label: '5xx Error', value: '5xx' },
    { label: 'Any Error', value: 'Error' },
  ];
  const TYPE_OPTIONS = [
    { label: 'GraphQL', value: 'graphql' },
    { label: 'JSON', value: 'json' },
  ];

  // Section toggle state
  const [isExpanded, setIsExpanded] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editingMatchUrl, setEditingMatchUrl] = useState('');
  const [editingMatchRequestBody, setEditingMatchRequestBody] = useState('');
  const [editingMockResponse, setEditingMockResponse] = useState('');

  useEffect(() => {
    if (!chrome.storage) return;
    chrome.storage.local.get(['responseOverrides'], (result) => {
      if (result.responseOverrides) {
        setOverrides(result.responseOverrides);
      }
    });

    const listener = (changes, namespace) => {
      if (namespace === 'local' && changes.responseOverrides) {
        setOverrides(changes.responseOverrides.newValue || []);
      }
    };
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  const loadRecentRequests = () => {
    if (!chrome.tabs) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        let tabOrigin = '';
        try {
          if (tabs[0].url) {
            tabOrigin = new URL(tabs[0].url).origin;
          }
        } catch (e) {}
        chrome.runtime.sendMessage(
          { type: 'GET_RECENT_REQUESTS', tabId: tabs[0].id, origin: tabOrigin },
          (response) => {
            if (response && response.requests) {
              setRecentRequests(response.requests);
            }
          }
        );
      }
    });
  };

  const toggleShowRequests = () => {
    const nextVal = !showRequests;
    setShowRequests(nextVal);
    if (nextVal) {
      loadRecentRequests();
    }
  };

  const populateFromRequest = (req) => {
    // Attempt to format JSON nicely if possible
    let formattedResponse = formatJsonString(req.response);

    // Use just the pathname for better matching, fallback to URL
    let urlToMatch = req.url;
    try {
      const parsed = new URL(req.url);
      urlToMatch = parsed.pathname + (req.method === 'GET' ? parsed.search : '');
    } catch (e) {}

    setMatchUrl(urlToMatch);
    setMockResponse(formattedResponse);
    setShowRequests(false);
  };

  const updateOverrides = (newOverrides) => {
    setOverrides(newOverrides);
    if (chrome.storage) {
      chrome.storage.local.set({ responseOverrides: newOverrides });
    }
  };

  const addOverride = (e) => {
    e.preventDefault();
    if (!matchUrl.trim() || !mockResponse.trim()) return;

    const newOverride = {
      id: generateRandomId(),
      matchUrl: matchUrl.trim(),
      matchRequestBody: matchRequestBody.trim(),
      mockResponse: mockResponse.trim(),
      status: 200,
      statusText: 'OK',
      contentType: 'application/json',
      active: true,
    };

    updateOverrides([newOverride, ...overrides]);
    setMatchUrl('');
    setMatchRequestBody('');
    setMockResponse('');
  };

  const startEditing = (o) => {
    setEditingId(o.id);
    setEditingMatchUrl(o.matchUrl);
    setEditingMatchRequestBody(o.matchRequestBody || '');
    setEditingMockResponse(formatJsonString(o.mockResponse));
  };

  const saveEditing = (id) => {
    const nextOverrides = overrides.map((o) =>
      o.id === id
        ? {
            ...o,
            matchUrl: editingMatchUrl.trim(),
            matchRequestBody: editingMatchRequestBody.trim(),
            mockResponse: editingMockResponse.trim(),
          }
        : o
    );
    updateOverrides(nextOverrides);
    setEditingId(null);
  };

  const toggleOverride = (id) => {
    const newOverrides = overrides.map((o) =>
      o.id === id ? { ...o, active: !o.active } : o
    );
    updateOverrides(newOverrides);
  };

  const deleteOverride = (id) => {
    const newOverrides = overrides.filter((o) => o.id !== id);
    updateOverrides(newOverrides);
  };

  return (
    <div
      className="response-overrides-app"
      style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: '16px',
        marginTop: '24px',
        marginBottom: '16px',
        paddingLeft: '12px',
        paddingRight: '12px',
      }}
    >
      {/* Header section with expand/collapse control */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          paddingBottom: '12px',
          paddingTop: '6px',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            style={{ color: 'var(--color-indigo)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
          <h2
            style={{
              fontSize: '1.4rem',
              fontWeight: '600',
              margin: 0,
              color: 'var(--text-heading)',
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}
          >
            Response Interceptor
          </h2>
          {overrides.length > 0 && (
            <span
              className="badge badge--success"
              style={{
                marginLeft: '4px',
                padding: '1px 6px',
                fontSize: '0.95rem',
              }}
            >
              {overrides.length}
            </span>
          )}
        </div>

        {/* Expand/Collapse arrow */}
        <svg
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          style={{
            color: 'var(--text-muted)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-normal)',
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      {isExpanded && (
        <div style={{ marginTop: '4px' }} className="animate-fade-in">
          <p
            style={{
              fontSize: '1.15rem',
              color: 'var(--text-muted)',
              margin: '-4px 0 16px 0',
              lineHeight: '1.4',
            }}
          >
            Capture live network responses and craft custom payload overrides.
          </p>

          {!isEnabled && (
            <div
              className="warning-banner"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <span style={{ fontSize: '1.2rem', color: 'var(--text-heading)', fontWeight: '500' }}>
                  Response overrides are disabled. Enable them to activate mocks.
                </span>
              </div>
              <label className="switch-container" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  aria-label="Toggle Response Overrides Inline"
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          )}

          {matchUrl ? (
            /* Edit Override Dialog Card */
            <form
              onSubmit={addOverride}
              className="card-panel"
              style={{
                padding: '12px',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                border: '1px solid var(--color-indigo)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '1.1rem',
                    color: 'var(--color-indigo)',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Target Route
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMatchUrl('');
                    setMatchRequestBody('');
                    setMockResponse('');
                  }}
                  className="btn btn-link"
                  style={{
                    color: 'var(--color-rose)',
                    textTransform: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
              <div
                style={{
                  wordBreak: 'break-all',
                  fontSize: '1.15rem',
                  color: 'var(--code-text)',
                  background: 'var(--code-bg)',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'monospace',
                }}
              >
                {matchUrl}
              </div>
              <div>
                <label
                  style={{
                    fontSize: '1.1rem',
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '4px',
                    fontWeight: '500',
                  }}
                >
                  Request Body Match (Optional)
                </label>
                <input
                  type="text"
                  value={matchRequestBody}
                  onChange={(e) => setMatchRequestBody(e.target.value)}
                  className="input-text"
                  placeholder='e.g. "operationName":"MyMutation"'
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '1.1rem',
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '4px',
                    fontWeight: '500',
                  }}
                >
                  Mock Payload
                </label>
                <JsonEditor
                  value={mockResponse}
                  onChange={setMockResponse}
                  height="250px"
                  placeholder="Mock JSON or Plaintext data..."
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  padding: '9px 0',
                  fontSize: '1.25rem',
                  marginTop: '4px',
                }}
              >
                Save Response Mock
              </button>
            </form>
          ) : (
            /* Network Logger Selection Toggle Card */
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={toggleShowRequests}
                style={{
                  width: '100%',
                  borderRadius: '6px',
                  background: showRequests
                    ? 'var(--badge-post-bg)'
                    : 'var(--copy-btn-bg)',
                  borderColor: showRequests
                    ? 'var(--color-indigo)'
                    : 'var(--border-color)',
                  color: showRequests
                    ? 'var(--badge-post-text)'
                    : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 0',
                  textTransform: 'none',
                  fontSize: '1.2rem',
                  fontWeight: '600',
                }}
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                {showRequests
                  ? 'Close Network Logs'
                  : 'View Recent Requests to Mock...'}
              </button>
              {showRequests && (
                <div
                  className="card-panel custom-scroll"
                  style={{
                    padding: '12px',
                    background: 'var(--segment-bg)',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    marginTop: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <strong
                      style={{
                        fontSize: '1.15rem',
                        color: 'var(--text-heading)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Captured Requests
                    </strong>
                    <button
                      type="button"
                      onClick={loadRecentRequests}
                      className="btn btn-secondary"
                      style={{
                        padding: '3px 8px',
                        fontSize: '1.05rem',
                      }}
                    >
                      Refresh
                    </button>
                  </div>

                  {recentRequests.length === 0 ? (
                    <p
                      style={{
                        fontSize: '1.2rem',
                        margin: '20px 0',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        lineHeight: '1.4',
                      }}
                    >
                      No recent endpoints captured.
                      <br />
                      <span style={{ fontSize: '1rem', opacity: 0.7 }}>
                        Trigger some AJAX actions or reload page.
                      </span>
                    </p>
                  ) : (
                    <>
                      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexDirection: 'column' }}>
                        <input
                          type="text"
                          className="input-text"
                          placeholder="Filter captured requests by URL, method, or response..."
                          value={filterTerm}
                          onChange={(e) => setFilterTerm(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '1.2rem',
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {METHOD_OPTIONS.map(m => (
                              <button
                                key={m}
                                onClick={() => toggleMethod(m)}
                                className={`badge ${methodFilters.includes(m) ? (m === 'GET' ? 'badge--method-get' : m === 'POST' ? 'badge--method-post' : 'badge--method-other') : ''}`}
                                style={{
                                  border: methodFilters.includes(m) ? undefined : '1px solid var(--border-color)',
                                  background: methodFilters.includes(m) ? undefined : 'transparent',
                                  color: methodFilters.includes(m) ? undefined : 'var(--text-subtle)',
                                  cursor: 'pointer',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {STATUS_OPTIONS.map(s => (
                              <button
                                key={s.value}
                                onClick={() => toggleStatus(s.value)}
                                className={`badge ${statusFilters.includes(s.value) ? (s.value === 'Error' || s.value === '4xx' || s.value === '5xx' ? 'badge--header' : 'badge--success') : ''}`}
                                style={{
                                  border: statusFilters.includes(s.value) ? undefined : '1px solid var(--border-color)',
                                  background: statusFilters.includes(s.value) ? undefined : 'transparent',
                                  color: statusFilters.includes(s.value) ? undefined : 'var(--text-subtle)',
                                  cursor: 'pointer',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {TYPE_OPTIONS.map(t => (
                              <button
                                key={t.value}
                                onClick={() => toggleType(t.value)}
                                className={`badge ${typeFilters.includes(t.value) ? 'badge--query' : ''}`}
                                style={{
                                  border: typeFilters.includes(t.value) ? undefined : '1px solid var(--border-color)',
                                  background: typeFilters.includes(t.value) ? undefined : 'transparent',
                                  color: typeFilters.includes(t.value) ? undefined : 'var(--text-subtle)',
                                  cursor: 'pointer',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {filteredRequests.length === 0 ? (
                        <div
                          style={{
                            color: 'var(--text-subtle)',
                            textAlign: 'center',
                            padding: '20px 10px',
                            fontSize: '1.2rem',
                          }}
                        >
                          No requests matching active filters
                        </div>
                      ) : (
                        <ul
                          style={{
                            margin: 0,
                            padding: 0,
                            listStyle: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          {filteredRequests.map((req, i) => (
                            <li
                              key={i}
                              style={{
                                paddingBottom: '10px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span
                                    className={
                                      'badge ' +
                                      (req.method === 'POST'
                                        ? 'badge--method-post'
                                        : req.method === 'GET'
                                        ? 'badge--method-get'
                                        : 'badge--method-other')
                                    }
                                    style={{
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                      fontWeight: 'bold',
                                      display: 'inline-block',
                                    }}
                                  >
                                    {req.method}
                                  </span>
                                  {req.operationName && (
                                    <span
                                      className="badge badge--query"
                                      style={{
                                        marginLeft: '8px',
                                        fontSize: '0.95rem',
                                        textTransform: 'none',
                                        padding: '1px 5px',
                                      }}
                                    >
                                      GraphQL: {req.operationName}
                                    </span>
                                  )}
                                  <div
                                    className="custom-scroll"
                                    style={{
                                      wordBreak: 'break-all',
                                      fontSize: '1.1rem',
                                      lineHeight: '1.4',
                                      color: 'var(--text-heading)',
                                      marginTop: '4px',
                                      fontFamily: 'monospace',
                                      maxHeight: '40px',
                                      overflowY: 'auto',
                                    }}
                                    title={req.url}
                                  >
                                    {req.url}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => populateFromRequest(req)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '1.1rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  Mock
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Overrides Section */}
          {overrides.length > 0 && (
            <h3
              style={{
                fontSize: '1.2rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '6px',
                margin: '20px 0 10px 0',
                color: 'var(--color-indigo)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Simulated Responses ({overrides.length})
            </h3>
          )}

          <ul
            style={{
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {overrides.map((override) => (
              <li key={override.id} style={{ listStyle: 'none' }}>
                {editingId === override.id ? (
                  <form
                    className="card-panel"
                    style={{
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      border: '1px solid var(--color-indigo)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '1.1rem',
                          color: 'var(--color-indigo)',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                        }}
                      >
                        Edit Mock
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="btn btn-link"
                        style={{
                          color: 'var(--color-rose)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: '1.1rem',
                          color: 'var(--text-muted)',
                          display: 'block',
                          marginBottom: '4px',
                          fontWeight: '500',
                        }}
                      >
                        URL Contains Match
                      </label>
                      <input
                        type="text"
                        value={editingMatchUrl}
                        onChange={(e) => setEditingMatchUrl(e.target.value)}
                        className="input-text"
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: '1.1rem',
                          color: 'var(--text-muted)',
                          display: 'block',
                          marginBottom: '4px',
                          fontWeight: '500',
                        }}
                      >
                        Request Body Match (Optional)
                      </label>
                      <input
                        type="text"
                        value={editingMatchRequestBody}
                        onChange={(e) => setEditingMatchRequestBody(e.target.value)}
                        className="input-text"
                        placeholder='e.g. "operationName":"MyMutation"'
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: '1.1rem',
                          color: 'var(--text-muted)',
                          display: 'block',
                          marginBottom: '4px',
                          fontWeight: '500',
                        }}
                      >
                        Mock Payload
                      </label>
                      <JsonEditor
                        value={editingMockResponse}
                        onChange={setEditingMockResponse}
                        height="250px"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => saveEditing(override.id)}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        padding: '8px 0',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        marginTop: '4px',
                      }}
                    >
                      Save Changes
                    </button>
                  </form>
                ) : (
                  <div
                    className={
                      'card-panel animate-fade-in ' +
                      (override.active ? 'card-panel--active' : 'card-panel--inactive')
                    }
                    style={{
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '1.1rem',
                            color: override.active
                              ? 'var(--color-emerald)'
                              : 'var(--text-muted)',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: override.active
                                ? 'var(--color-emerald)'
                                : 'var(--text-muted)',
                              display: 'inline-block',
                            }}
                          />
                          {override.active ? 'Active Mock' : 'Inactive'}
                        </span>
                        <span
                          style={{
                            fontSize: '1rem',
                            color: 'var(--text-subtle)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                          }}
                        >
                          URL Substring Match
                        </span>
                      </div>
                      <div
                        style={{
                          wordBreak: 'break-all',
                          fontSize: '1.2rem',
                          fontWeight: '600',
                          color: 'var(--text-heading)',
                          fontFamily: 'monospace',
                          lineHeight: '1.3',
                        }}
                      >
                        {override.matchUrl}
                      </div>
                      {override.matchRequestBody && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '1rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: '2px' }}>Request Body Match</span>
                          <div style={{ wordBreak: 'break-all', fontSize: '1.1rem', color: 'var(--text-main)', fontFamily: 'monospace', background: 'var(--bg-overlay)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            {override.matchRequestBody}
                          </div>
                        </div>
                      )}

                      <div
                        className="code-container"
                        style={{ marginTop: '6px' }}
                      >
                        <pre className="code-content custom-scroll">
                          {formatJsonString(override.mockResponse)}
                        </pre>
                        <button
                          type="button"
                          className="copy-btn"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              formatJsonString(override.mockResponse || '')
                            )
                          }
                          title="Copy Payload"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                            width="11"
                            height="11"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div
                      className="btn-group"
                      style={{ display: 'flex', gap: '6px', marginTop: '4px' }}
                    >
                      <button
                        className="btn"
                        style={{
                          flex: 1.2,
                          padding: '4px 0',
                          fontSize: '1.1rem',
                          background: override.active
                            ? 'var(--btn-secondary-bg)'
                            : 'var(--color-emerald)',
                          borderColor: override.active
                            ? 'var(--border-color)'
                            : 'transparent',
                          color: override.active
                            ? 'var(--btn-secondary-text)'
                            : '#ffffff',
                          boxShadow: override.active
                            ? 'none'
                            : '0 2px 4px rgba(16, 185, 129, 0.2)',
                        }}
                        onClick={() => toggleOverride(override.id)}
                      >
                        {override.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{
                          flex: 0.9,
                          padding: '4px 0',
                          fontSize: '1.1rem',
                        }}
                        onClick={() => startEditing(override)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{
                          flex: 0.9,
                          padding: '4px 0',
                          fontSize: '1.1rem',
                        }}
                        onClick={() => deleteOverride(override.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ResponseOverridesApp;
