import React, { useState, useRef, useEffect } from 'react';
import AddRequestHeaderForm from './AddRequestHeaderForm';
import RequestHeader from './RequestHeader';

import {
  CONSTANTS,
  generateRandomId,
  saveHeadersToStorage,
  loadHeadersFromStorage,
  cleanupOrphanedRules,
  usePrevious,
} from '../../../../utils/index';

function RequestHeadersApp() {
  const [headers, setHeaders] = useState([]);
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false);

  const listHeadingRef = useRef(null);
  const prevHeaderLength = usePrevious(headers.length);

  const updateHeaders = (newHeaders, removeRuleIds = []) => {
    setHeaders(newHeaders);
    saveHeadersToStorage(newHeaders, removeRuleIds);
  };

  const toggleHeaderEnabled = (id) => {
    const updatedHeaders = headers.map((header) => {
      if (header.id === id) {
        const newEnabledState = !header.enabled;
        return { ...header, enabled: newEnabledState };
      }
      return header;
    });

    const toggledHeader = updatedHeaders.find((header) => header.id === id);
    const removeRuleIds = toggledHeader.enabled ? [] : [id];

    updateHeaders(updatedHeaders, removeRuleIds);
  };

  const deleteHeader = (id) => {
    const remainingHeaders = headers.filter((header) => header.id !== id);
    updateHeaders(remainingHeaders, [id]);
  };

  const updateAllHeadersEnabled = (enabled) => {
    const updatedHeaders = headers.map((header) => ({ ...header, enabled }));
    const removeRuleIds = enabled ? [] : headers.map((header) => header.id);

    updateHeaders(updatedHeaders, removeRuleIds);
  };

  const editHeader = (id, name, value, urlRegex, overrideType) => {
    const updatedHeaders = headers.map((header) =>
      header.id === id
        ? { ...header, name, value, urlRegex, overrideType }
        : header
    );

    updateHeaders(updatedHeaders, [id]);
  };

  const addHeader = (name, value, overrideType) => {
    const newHeader = {
      id: generateRandomId(),
      name,
      value,
      enabled: false,
      urlRegex: '',
      overrideType: overrideType || CONSTANTS.DEFAULT_OVERRIDE_TYPE,
    };

    const newHeaders = [newHeader, ...headers];
    updateHeaders(newHeaders);
  };

  const enabledHeadersCount = headers.filter((header) => header.enabled).length;
  const headingText = `${enabledHeadersCount} / ${headers.length} active`;

  const renderHeaderItem = (header) => (
    <RequestHeader
      key={header.id}
      id={header.id}
      name={header.name}
      value={header.value}
      enabled={header.enabled}
      url-regex={header.urlRegex}
      overrideType={header.overrideType || CONSTANTS.DEFAULT_OVERRIDE_TYPE}
      toggleHeaderEnabled={toggleHeaderEnabled}
      deleteHeader={deleteHeader}
      editHeader={editHeader}
    />
  );

  const renderHeaderList = () => {
    if (headers.length > 0) {
      return headers.map(renderHeaderItem);
    }
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          background: 'var(--bg-overlay)',
          borderRadius: '6px',
          border: '1px dashed var(--border-color)',
          color: 'var(--text-muted)',
          marginTop: '8px',
        }}
      >
        <svg
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          width="36"
          height="36"
          style={{ marginBottom: '12px', opacity: 0.6 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <span style={{ fontSize: '1.2rem', fontWeight: '500' }}>
          No active rules yet
        </span>
        <span style={{ fontSize: '1.05rem', opacity: 0.8, marginTop: '4px' }}>
          Add a request header override above to get started.
        </span>
      </div>
    );
  };

  useEffect(() => {
    if (headers.length - prevHeaderLength === -1) {
      listHeadingRef.current?.focus();
    }
  }, [headers.length, prevHeaderLength]);

  useEffect(() => {
    if (!chrome.storage || isLoadedFromStorage) return;

    const initializeHeaders = async () => {
      const requestOverrides = await loadHeadersFromStorage();
      setHeaders(requestOverrides);
      cleanupOrphanedRules(requestOverrides);
      setIsLoadedFromStorage(true);
    };

    initializeHeaders();
  }, [isLoadedFromStorage]);

  return (
    <div
      className="request-header-app"
      style={{
        margin: 0,
        padding: '16px 12px 0 12px',
        boxShadow: 'none',
      }}
    >
      {/* Title Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        <svg
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          style={{ color: 'var(--color-indigo)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span
          style={{
            fontSize: '1.6rem',
            fontWeight: '700',
            color: 'var(--text-heading)',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          Request Override
        </span>
      </div>
      <p
        style={{
          fontSize: '1.15rem',
          color: 'var(--text-muted)',
          margin: '0 0 16px 0',
          lineHeight: '1.4',
        }}
      >
        Inject custom headers or query arguments into matching outgoing traffic.
      </p>

      <AddRequestHeaderForm addHeader={addHeader} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          marginBottom: '10px',
        }}
      >
        <strong
          id="list-heading"
          tabIndex="-1"
          ref={listHeadingRef}
          style={{
            fontSize: '1.2rem',
            color: 'var(--text-heading)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Rules Queue ({headingText})
        </strong>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => updateAllHeadersEnabled(false)}
            style={{ padding: '4px 8px', fontSize: '1.1rem' }}
          >
            Disable All
          </button>
          <button
            className="btn"
            onClick={() => updateAllHeadersEnabled(true)}
            style={{
              padding: '4px 10px',
              fontSize: '1.1rem',
              background: 'var(--color-emerald)',
              color: '#ffffff',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
            }}
          >
            Enable All
          </button>
        </div>
      </div>

      <ul
        className="request-header-list"
        aria-labelledby="list-heading"
        style={{
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {renderHeaderList()}
      </ul>
    </div>
  );
}

export default RequestHeadersApp;
