import React, { useState, useEffect, useRef } from 'react';
import JsonEditor from './JsonEditor';

const InspectorPanel = ({ selectedRequest, onClose, isFullScreen = false }) => {
  const [activeTab, setActiveTab] = useState('headers');
  const [editedResponse, setEditedResponse] = useState('');
  const [isMocked, setIsMocked] = useState(false);
  const [matchedOverrideId, setMatchedOverrideId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (selectedRequest) {
      setEditedResponse(selectedRequest.response || '');
      setMatchedOverrideId(null);
      setSaveStatus('idle');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (chrome.storage) {
        chrome.storage.local.get(['responseOverrides'], (result) => {
          const overrides = result.responseOverrides || [];
          let matchUrl = selectedRequest.url;
          try {
            const parsed = new URL(selectedRequest.url);
            matchUrl = parsed.pathname + (selectedRequest.method === 'GET' ? parsed.search : '');
          } catch (e) {}

          const matched = overrides.find(
            (o) =>
              o.matchUrl &&
              (selectedRequest.url.includes(o.matchUrl) ||
                matchUrl.includes(o.matchUrl))
          );
          setIsMocked(!!matched);
          if (matched) {
            setMatchedOverrideId(matched.id);
            setEditedResponse(matched.mockResponse);
          }
        });
      }
    }
  }, [selectedRequest]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSaveMock = () => {
    if (!chrome.storage || !selectedRequest) return;

    chrome.storage.local.get(['responseOverrides'], (result) => {
      const overrides = result.responseOverrides || [];
      let matchUrl = selectedRequest.url;
      try {
        const parsed = new URL(selectedRequest.url);
        matchUrl = parsed.pathname + (selectedRequest.method === 'GET' ? parsed.search : '');
      } catch (e) {}

      // Find by ID first, then fallback to matchUrl
      let existingIdx = -1;
      if (matchedOverrideId) {
        existingIdx = overrides.findIndex((o) => o.id === matchedOverrideId);
      }
      if (existingIdx === -1) {
        existingIdx = overrides.findIndex((o) => o.matchUrl === matchUrl);
      }

      const newOverride = {
        id:
          existingIdx >= 0
            ? overrides[existingIdx].id
            : matchedOverrideId || Math.random().toString(36).substring(2, 9),
        matchUrl: existingIdx >= 0 ? overrides[existingIdx].matchUrl : matchUrl,
        matchRequestBody: existingIdx >= 0 ? overrides[existingIdx].matchRequestBody : '',
        mockResponse: editedResponse,
        status: 200,
        statusText: 'OK',
        contentType: selectedRequest.contentType || 'application/json',
        active: true,
      };

      let newOverrides;
      if (existingIdx >= 0) {
        newOverrides = [...overrides];
        newOverrides[existingIdx] = newOverride;
      } else {
        newOverrides = [newOverride, ...overrides];
      }

      chrome.storage.local.set({ responseOverrides: newOverrides }, () => {
        setIsMocked(true);
        setMatchedOverrideId(newOverride.id);
        setSaveStatus('saved');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 1500);
      });
    });
  };

  const handleRemoveMock = () => {
    if (!chrome.storage || !selectedRequest) return;

    chrome.storage.local.get(['responseOverrides'], (result) => {
      const overrides = result.responseOverrides || [];
      let newOverrides;

      if (matchedOverrideId) {
        newOverrides = overrides.filter((o) => o.id !== matchedOverrideId);
      } else {
        let matchUrl = selectedRequest.url;
        try {
          const parsed = new URL(selectedRequest.url);
          matchUrl = parsed.pathname + (selectedRequest.method === 'GET' ? parsed.search : '');
        } catch (e) {}
        newOverrides = overrides.filter((o) => o.matchUrl !== matchUrl);
      }

      chrome.storage.local.set({ responseOverrides: newOverrides }, () => {
        setIsMocked(false);
        setMatchedOverrideId(null);
        setEditedResponse(selectedRequest.response || '');
        setSaveStatus('idle');
      });
    });
  };

  if (!selectedRequest) {
    return (
      <div
        className="inspector-panel animate-fade-in"
        style={{
          width: isFullScreen ? '50%' : '280px',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px dashed rgba(99, 102, 241, 0.25)',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.1)',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-indigo)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <div
          style={{
            fontWeight: 600,
            fontSize: '1.3rem',
            color: 'var(--text-heading)',
            marginBottom: '6px',
          }}
        >
          No Request Selected
        </div>
        <div
          style={{
            fontSize: '1.1rem',
            color: 'var(--text-subtle)',
            maxWidth: '200px',
            lineHeight: '1.4',
          }}
        >
          Select any network request from the list to view headers and mock
          response payloads.
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-panel animate-fade-in" style={{ width: isFullScreen ? '50%' : '280px' }}>
      <div className="panel-header">
        Detailed Inspector
        <button
          className="btn btn-link"
          onClick={onClose}
          style={{ color: 'var(--text-subtle)' }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <span
          className={
            selectedRequest.statusCode >= 400
              ? 'badge badge--header'
              : 'badge badge--success'
          }
        >
          {selectedRequest.statusCode || 'PENDING'}
        </span>
        <span
          style={{
            color: 'var(--text-subtle)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={selectedRequest.url}
        >
          {selectedRequest.url}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className="btn btn-primary"
          onClick={handleSaveMock}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '1.15rem',
            ...(saveStatus === 'saved'
              ? {
                  background:
                    'linear-gradient(135deg, var(--color-emerald) 0%, #059669 100%)',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                  borderColor: 'var(--color-emerald)',
                }
              : {}),
          }}
        >
          {saveStatus === 'saved'
            ? 'Saved Successfully! ✓'
            : isMocked
            ? 'Update Mock Response'
            : 'Mock this Response'}
        </button>
        {isMocked && (
          <button
            className="btn btn-secondary"
            onClick={handleRemoveMock}
            style={{
              padding: '8px 12px',
              fontSize: '1.15rem',
              color: 'var(--color-rose)',
              borderColor: 'var(--color-rose)',
            }}
          >
            Delete Mock
          </button>
        )}
      </div>

      <div className="segmented-control" style={{ marginBottom: '16px' }}>
        <input
          type="radio"
          id="tab-headers"
          className="segmented-control__input"
          name="inspector-tab"
          checked={activeTab === 'headers'}
          onChange={() => setActiveTab('headers')}
        />
        <label htmlFor="tab-headers" className="segmented-control__label">
          Headers
        </label>

        {selectedRequest.requestBody && (
          <>
            <input
              type="radio"
              id="tab-request"
              className="segmented-control__input"
              name="inspector-tab"
              checked={activeTab === 'request'}
              onChange={() => setActiveTab('request')}
            />
            <label htmlFor="tab-request" className="segmented-control__label">
              Request
            </label>
          </>
        )}

        <input
          type="radio"
          id="tab-payload"
          className="segmented-control__input"
          name="inspector-tab"
          checked={activeTab === 'payload'}
          onChange={() => setActiveTab('payload')}
        />
        <label htmlFor="tab-payload" className="segmented-control__label">
          Payload
        </label>
      </div>

      {activeTab === 'headers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div
              style={{
                fontSize: '1.2rem',
                color: 'var(--text-heading)',
                marginBottom: '8px',
                fontWeight: 500,
              }}
            >
              Request Headers
            </div>
            {selectedRequest.requestHeaders &&
            selectedRequest.requestHeaders.length > 0 ? (
              <div className="code-container">
                <pre
                  className="code-content custom-scroll"
                  style={{ maxHeight: '200px' }}
                >
                  {selectedRequest.requestHeaders
                    .map((h) => `${h.name}: ${h.value}`)
                    .join('\n')}
                </pre>
              </div>
            ) : (
              <div
                style={{
                  color: 'var(--text-subtle)',
                  fontStyle: 'italic',
                  fontSize: '1.2rem',
                }}
              >
                No request headers recorded
              </div>
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: '1.2rem',
                color: 'var(--text-heading)',
                marginBottom: '8px',
                fontWeight: 500,
                marginTop: '8px',
              }}
            >
              Response Headers
            </div>
            {selectedRequest.responseHeaders &&
            selectedRequest.responseHeaders.length > 0 ? (
              <div className="code-container">
                <pre
                  className="code-content custom-scroll"
                  style={{ maxHeight: '200px' }}
                >
                  {selectedRequest.responseHeaders
                    .map((h) => `${h.name}: ${h.value}`)
                    .join('\n')}
                </pre>
              </div>
            ) : (
              <div
                style={{
                  color: 'var(--text-subtle)',
                  fontStyle: 'italic',
                  fontSize: '1.2rem',
                }}
              >
                No response headers recorded
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'request' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            gap: '12px',
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
                fontSize: '1.2rem',
                color: 'var(--text-heading)',
                fontWeight: 500,
              }}
            >
              Request Body
            </span>
          </div>

          <div
            style={{
              flex: 1,
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              overflow: 'hidden',
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selectedRequest.requestBody &&
            (selectedRequest.requestBody.trim().startsWith('{') ||
              selectedRequest.requestBody.trim().startsWith('[')) ? (
              <JsonEditor
                value={(() => {
                  try {
                    return JSON.stringify(
                      JSON.parse(selectedRequest.requestBody),
                      null,
                      2
                    );
                  } catch (e) {
                    return selectedRequest.requestBody;
                  }
                })()}
                readOnly={true}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'var(--bg-overlay)',
                  overflow: 'auto',
                  display: 'flex',
                }}
                className="custom-scroll"
              >
                <textarea
                  className="form-control"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    resize: 'none',
                    fontFamily: 'monospace',
                    fontSize: '1.1rem',
                    color: 'var(--text-heading)',
                    outline: 'none',
                    minHeight: '400px',
                  }}
                  value={
                    selectedRequest.requestBody || 'No request body recorded'
                  }
                  readOnly={true}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payload' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            gap: '12px',
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
                fontSize: '1.2rem',
                color: 'var(--text-heading)',
                fontWeight: 500,
              }}
            >
              Response Body{' '}
              {selectedRequest.contentType
                ? `(${selectedRequest.contentType.split(';')[0]})`
                : ''}
            </span>
            {isMocked && (
              <span
                className="badge badge--success"
                style={{ fontSize: '1rem', textTransform: 'uppercase' }}
              >
                Mock Active
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              overflow: 'hidden',
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selectedRequest.contentType &&
            selectedRequest.contentType.toLowerCase().includes('json') ? (
              <JsonEditor
                value={editedResponse}
                onChange={setEditedResponse}
                readOnly={false}
                height="400px"
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'var(--bg-overlay)',
                  overflow: 'auto',
                  display: 'flex',
                }}
                className="custom-scroll"
              >
                <textarea
                  className="form-control"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    resize: 'none',
                    fontFamily: 'monospace',
                    fontSize: '1.1rem',
                    color: 'var(--text-heading)',
                    outline: 'none',
                    minHeight: '400px',
                  }}
                  value={editedResponse}
                  onChange={(e) => setEditedResponse(e.target.value)}
                  placeholder="Response body text..."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectorPanel;
