import React, { useState, useRef, useEffect } from "react";
import AddRequestHeaderForm from "./AddRequestHeaderForm";
import RequestHeader from "./RequestHeader";
import { nanoid } from "nanoid";

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

let loadedFromStorage = false;

const saveRequestHeaders = (requestHeaders) => chrome.storage.local.set({ requestHeaders: JSON.stringify(requestHeaders) }, function () {
  console.log('Request headers saved', JSON.stringify(requestHeaders));
});

function RequestHeadersApp(props) {
  const [headers, setHeaders] = useState([]);

  function toggleHeaderEnabled(id) {
    const updatedHeaders = headers.map(header => {
      if (id === header.id) {
        return { ...header, enabled: !header.enabled }
      }
      return header;
    });

    setHeaders(updatedHeaders);
    saveRequestHeaders(updatedHeaders);
  }


  function deleteHeader(id) {
    const remainingHeaders = headers.filter(header => id !== header.id);

    setHeaders(remainingHeaders);
    saveRequestHeaders(remainingHeaders);
  }

  function disableAllHandler() {
    const updatedHeaders = headers.map(header => ({ ...header, enabled: false }));

    setHeaders(updatedHeaders);
    saveRequestHeaders(updatedHeaders);
  }

  function enableAllHandler() {
    const updatedHeaders = headers.map(header => ({ ...header, enabled: true }));

    setHeaders(updatedHeaders);
    saveRequestHeaders(updatedHeaders);
  }

  function editHeader(id, newName, newValue, newUrlRegex) {
    const editedHeaderList = headers.map(header => {
      // if this header has the same ID as the edited header
      if (id === header.id) {
        //
        return { ...header, name: newName, value: newValue, urlRegex: newUrlRegex }
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
        key={header.id}
        toggleHeaderEnabled={toggleHeaderEnabled}
        deleteHeader={deleteHeader}
        editHeader={editHeader}
      />
      <hr />
    </>
    )) : '';

  function addHeader(name, value) {
    const newHeader = { id: "request-header-" + nanoid(), name, value, enabled: false, urlRegex: '' };
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
          setHeaders(JSON.parse(response.requestHeaders))
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
