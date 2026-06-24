import React, { useState, useEffect, useRef } from 'react';

const RequestLogsView = ({
  onSelectRequest,
  selectedRequest,
  requestCollectingEnabled: propEnabled,
  setRequestCollectingEnabled: propSetEnabled,
}) => {
  const isHoveringLogs = useRef(false);
  const [recentRequests, setRecentRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilters, setMethodFilters] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [typeFilters, setTypeFilters] = useState([]);

  const [localEnabled, setLocalEnabled] = useState(false);

  const isEnabled = propEnabled !== undefined ? propEnabled : localEnabled;
  const setIsEnabled = (val) => {
    if (propSetEnabled) {
      propSetEnabled(val);
    } else {
      setLocalEnabled(val);
      if (chrome.storage) {
        chrome.storage.local.set({ requestCollectingEnabled: val });
      }
    }
  };

  useEffect(() => {
    if (propEnabled === undefined && chrome.storage) {
      chrome.storage.local.get(['requestCollectingEnabled'], (result) => {
        if (result.requestCollectingEnabled !== undefined) {
          setLocalEnabled(result.requestCollectingEnabled);
        }
      });
      const listener = (changes, namespace) => {
        if (namespace === 'local' && changes.requestCollectingEnabled) {
          setLocalEnabled(changes.requestCollectingEnabled.newValue || false);
        }
      };
      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
      }
    }
  }, [propEnabled]);

  useEffect(() => {
    if (chrome.storage) {
      chrome.storage.local.get(['recentRequests'], (result) => {
        if (result.recentRequests) {
          setRecentRequests(result.recentRequests);
        }
      });

      const listener = (changes, namespace) => {
        if (namespace === 'local' && changes.recentRequests) {
          setRecentRequests(changes.recentRequests.newValue || []);
        }
      };
      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
      }
    }
  }, []);

  const clearLogs = () => {
    if (chrome.storage) {
      chrome.storage.local.set({ recentRequests: [] });
    }
  };

  const getMethodBadgeClass = (method) => {
    if (method === 'GET') return 'badge badge--method-get';
    if (method === 'POST') return 'badge badge--method-post';
    return 'badge badge--method-other';
  };

  const getStatusBadgeClass = (status) => {
    if (!status) return 'badge badge--other';
    if (status >= 200 && status < 300) return 'badge badge--success';
    if (status >= 400) return 'badge badge--header';
    return 'badge badge--query';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const filteredRequests = recentRequests.filter((req) => {
    const term = searchTerm.toLowerCase();
    const matchesTerm = (
      (req.url && req.url.toLowerCase().includes(term)) ||
      (req.method && req.method.toLowerCase().includes(term)) ||
      (req.operationName && req.operationName.toLowerCase().includes(term))
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only navigate if cursor is over the logs list
      if (!isHoveringLogs.current) return;

      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (selectedRequest && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const currentIndex = filteredRequests.findIndex(r => 
          r.url === selectedRequest.url && r.timestamp === selectedRequest.timestamp
        );
        
        if (currentIndex !== -1) {
          if (e.key === 'ArrowUp' && currentIndex > 0) {
            onSelectRequest(filteredRequests[currentIndex - 1]);
          } else if (e.key === 'ArrowDown' && currentIndex < filteredRequests.length - 1) {
            onSelectRequest(filteredRequests[currentIndex + 1]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRequest, filteredRequests, onSelectRequest]);

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

  return (
    <div
      className="main-content custom-scroll"
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <div
        className="card-panel"
        style={{
          padding: '20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Request Logs</h2>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '1.15rem',
                margin: '4px 0 0 0',
              }}
            >
              View and inspect details of all intercepted outgoing requests.
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={clearLogs}
            disabled={recentRequests.length === 0}
            style={{ padding: '8px 16px', fontSize: '1.2rem' }}
          >
            Clear Logs
          </button>
        </div>
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
                Request collecting is disabled. Enable it to start capturing requests.
              </span>
            </div>
            <label className="switch-container" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                className="switch-input"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                aria-label="Toggle Request Collecting Inline"
              />
              <span className="switch-slider"></span>
            </label>
          </div>
        )}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <input
            type="text"
            className="input-text"
            placeholder="Search logs by URL or method..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '1.2rem' }}
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

        <div
          style={{ flex: 1, overflowY: 'auto', minHeight: '300px' }}
          className="custom-scroll"
          onMouseEnter={() => (isHoveringLogs.current = true)}
          onMouseLeave={() => (isHoveringLogs.current = false)}
        >
          {filteredRequests.length === 0 ? (
            <div
              style={{
                color: 'var(--text-subtle)',
                textAlign: 'center',
                padding: '40px 20px',
                fontSize: '1.2rem',
              }}
            >
              {recentRequests.length === 0
                ? 'No network requests intercepted yet. Make sure the extension is active and make some requests.'
                : 'No requests matching active filters.'}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Time</th>
                  <th style={{ width: '90px' }}>Status</th>
                  <th style={{ width: '90px' }}>Method</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req, idx) => {
                  const isSelected =
                    selectedRequest &&
                    selectedRequest.url === req.url &&
                    selectedRequest.timestamp === req.timestamp;
                  return (
                    <tr
                      key={idx}
                      onClick={() => onSelectRequest(req)}
                      className={isSelected ? 'active-row' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      <td
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '1.1rem',
                        }}
                      >
                        {formatTime(req.timestamp)}
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(req.statusCode)}>
                          {req.statusCode || '---'}{' '}
                          {req.statusCode === 200 ? 'OK' : ''}
                        </span>
                      </td>
                      <td>
                        <span className={getMethodBadgeClass(req.method)}>
                          {req.method}
                        </span>
                      </td>
                      <td className="url-cell-logs" title={req.url}>
                        {req.operationName && (
                          <span
                            className="badge badge--query"
                            style={{
                              marginRight: '8px',
                              fontSize: '0.95rem',
                              textTransform: 'none',
                              padding: '1px 5px',
                            }}
                          >
                            GraphQL: {req.operationName}
                          </span>
                        )}
                        {req.url}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestLogsView;
