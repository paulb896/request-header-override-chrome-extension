import React, { useState, useRef, useEffect } from "react";
import AddRequestHeaderForm from "./AddRequestHeaderForm";
import RequestHeader from "./RequestHeader";

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

let loadedFromStorage = false;

function getAction(header) {
  if (header.overrideType === 'requestQueryParam') {
    return {
      type: 'redirect',
      redirect: {
        transform: {
          queryTransform: {
            addOrReplaceParams: [{
              key: header.name,
              value: header.value
            }]
          }
        }
      }
    };
  }

  return {
    type: 'modifyHeaders',
    requestHeaders: [
      { header: header.name, operation: 'set', value: header.value }
    ]
  };
}

const updateOverrideHeaders = (headerOverrides, removeRuleIds = []) => {
  if (removeRuleIds.length) {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds
    }, () => console.log(`rules have been removed for ${JSON.stringify(removeRuleIds)}`));
  } else {
    headerOverrides.map(header => {
      if (header.enabled || removeRuleIds.length) {
        chrome.declarativeNetRequest.updateDynamicRules({
          addRules: removeRuleIds.length ? undefined : [
            {
              id: header.id,
              priority: 1,
              action: getAction(header),
              condition: { urlFilter: header.urlFilter, resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'other'] }
            }
          ],
          removeRuleIds
        }, () => console.log(`rules have been saved for ${JSON.stringify(header)}`));
      }

      chrome.declarativeNetRequest.getDynamicRules(rawRules => {
        console.log('rawRules', rawRules)
      });
    });
  }
}

const saveRequestHeaders = (requestHeaders, removeRuleIds) =>
  chrome.storage.local.set({
    requestHeaders: JSON.stringify(requestHeaders)
  }, updateOverrideHeaders(requestHeaders, removeRuleIds))

function RequestHeadersApp(props) {
  const [headers, setHeaders] = useState([]);

  function toggleHeaderEnabled(id) {
    let headerEnabled = true;

    const updatedHeaders = headers.map(header => {
      if (id === header.id) {

        headerEnabled = !header.enabled;
        return { ...header, enabled: headerEnabled }
      }
      return header;
    });

    setHeaders(updatedHeaders);
    saveRequestHeaders(updatedHeaders, headerEnabled ? [] : [id]);
  }


  function deleteHeader(id) {
    const remainingHeaders = headers.filter(header => id !== header.id);

    setHeaders(remainingHeaders);
    saveRequestHeaders(remainingHeaders, [id]);
  }

  function disableAllHandler() {
    const updatedHeaders = headers.map(header => ({ ...header, enabled: false }));

    setHeaders(updatedHeaders);
    saveRequestHeaders(updatedHeaders, headers.map(header => header.id));
  }

  function enableAllHandler() {
    const updatedHeaders = headers.map(header => ({ ...header, enabled: true }));

    setHeaders(updatedHeaders);
    saveRequestHeaders(updatedHeaders);
  }

  function editHeader(id, name, value, urlRegex, overrideType) {
    const editedHeaderList = headers.map(header => {
      // if this header has the same ID as the edited header
      if (id === header.id) {
        return { ...header, name, value, urlRegex, overrideType }
      }
      return header;
    });

    setHeaders(editedHeaderList);
    saveRequestHeaders(editedHeaderList);
  }

  const headerList = headers ? headers
    .map(header => (<>
      <RequestHeader
        id={header.id}
        name={header.name}
        value={header.value}
        enabled={header.enabled}
        url-regex={header.urlRegex}
        overrideType={header.overrideType || 'header'}
        key={header.id}
        toggleHeaderEnabled={toggleHeaderEnabled}
        deleteHeader={deleteHeader}
        editHeader={editHeader}
      />
      <hr />
    </>
    )) : '';

  const generateRandomInteger = (max) => {
    return Math.floor(Math.random() * max) + 1;
  }

  function addHeader(name, value, overrideType) {
    const MAX_HEADER_ID = 9999999;
    const newHeader = { id: generateRandomInteger(MAX_HEADER_ID), name, value, enabled: false, urlRegex: '', overrideType };
    const newHeaders = [newHeader, ...headers];

    setHeaders(newHeaders);
    saveRequestHeaders(newHeaders);
  }

  const headersNoun = headers.filter(header => header.enabled).length !== 1 ? 'request headers' : 'request header';
  const headingText = `${headers.filter(header => header.enabled).length} ${headersNoun} set  `;

  const listHeadingRef = useRef(null);
  const prevHeaderLength = usePrevious(headers.length);

  useEffect(() => {
    if (headers.length - prevHeaderLength === -1) {
      listHeadingRef.current.focus();
    }
  }, [headers.length, prevHeaderLength]);

  useEffect(() => {
    if (chrome.storage) {
      if (!loadedFromStorage) {
        chrome.storage.local.get(["requestHeaders"]).then(response => {
          const requestOverrides = JSON.parse(response.requestHeaders);
          setHeaders(requestOverrides);

          // Remove rules that don't match overrides in local storage
          chrome.declarativeNetRequest.getDynamicRules((rules) => {
            rules.forEach(rule => {
              if (!requestOverrides.find((requestOverride) => requestOverride.id === rule.id)) {
                chrome.declarativeNetRequest.updateDynamicRules({
                  removeRuleIds: [rule.id]
                })
              }
            })
          });
        })
        loadedFromStorage = true;
      }
    }
  });

  return (
    <div className="request-header-app stack-small">
      <AddRequestHeaderForm addHeader={addHeader} />
      <h3 id="list-heading" tabIndex="-1" ref={listHeadingRef}>
        {headingText}
      </h3>
      <button className="btn btn__primary btn__sm" onClick={disableAllHandler}>
        Disable All
      </button>&nbsp;
      <button className="btn btn__primary btn__sm" onClick={enableAllHandler}>
        Enable All
      </button>
      <hr />
      <ul
        role="list"
        className="request-header-list stack-small stack-exception"
        aria-labelledby="list-heading"
      >
        {headerList}
      </ul>
    </div>
  );
}

export default RequestHeadersApp;
