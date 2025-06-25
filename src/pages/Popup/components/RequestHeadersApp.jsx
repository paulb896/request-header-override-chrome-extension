import React, { useState, useRef, useEffect } from "react";
import AddRequestHeaderForm from "./AddRequestHeaderForm";
import RequestHeader from "./RequestHeader";

import {
  CONSTANTS,
  generateRandomId,
  getPluralizedText,
  saveHeadersToStorage,
  loadHeadersFromStorage,
  cleanupOrphanedRules,
  usePrevious
} from "../../../../utils/index";

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
    const updatedHeaders = headers.map(header => {
      if (header.id === id) {
        const newEnabledState = !header.enabled;
        return { ...header, enabled: newEnabledState };
      }
      return header;
    });

    const toggledHeader = updatedHeaders.find(header => header.id === id);
    const removeRuleIds = toggledHeader.enabled ? [] : [id];

    updateHeaders(updatedHeaders, removeRuleIds);
  };

  const deleteHeader = (id) => {
    const remainingHeaders = headers.filter(header => header.id !== id);
    updateHeaders(remainingHeaders, [id]);
  };

  const updateAllHeadersEnabled = (enabled) => {
    const updatedHeaders = headers.map(header => ({ ...header, enabled }));
    const removeRuleIds = enabled ? [] : headers.map(header => header.id);

    updateHeaders(updatedHeaders, removeRuleIds);
  };

  const editHeader = (id, name, value, urlRegex, overrideType) => {
    const updatedHeaders = headers.map(header =>
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
      overrideType: overrideType || CONSTANTS.DEFAULT_OVERRIDE_TYPE
    };

    const newHeaders = [newHeader, ...headers];
    updateHeaders(newHeaders);
  };

  const enabledHeadersCount = headers.filter(header => header.enabled).length;
  const headersNoun = getPluralizedText(enabledHeadersCount, 'request header', 'request headers');
  const headingText = `${enabledHeadersCount} ${headersNoun} set`;

  const renderHeaderItem = (header) => (
    <React.Fragment key={header.id}>
      <RequestHeader
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
      <hr />
    </React.Fragment>
  );

  const renderHeaderList = () =>
    headers.length > 0 ? headers.map(renderHeaderItem) : '';

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
    <div className="request-header-app stack-small">
      <AddRequestHeaderForm addHeader={addHeader} />

      <h3 id="list-heading" tabIndex="-1" ref={listHeadingRef}>
        {headingText}
      </h3>

      <div className="btn-group">
        <button
          className="btn btn__primary btn__sm"
          onClick={() => updateAllHeadersEnabled(false)}
        >
          Disable All
        </button>
        <button
          className="btn btn__primary btn__sm"
          onClick={() => updateAllHeadersEnabled(true)}
        >
          Enable All
        </button>
      </div>

      <hr />

      <ul
        role="list"
        className="request-header-list stack-small stack-exception"
        aria-labelledby="list-heading"
      >
        {renderHeaderList()}
      </ul>
    </div>
  );
}

export default RequestHeadersApp;