import React, { useEffect, useRef, useState } from 'react';
import usePrevious from '../../../../utils/usePrevious.js';

export default function RequestHeader(props) {
  const {
    name,
    value,
    'url-regex': urlRegexProp,
    overrideType: overrideTypeProp,
    enabled,
  } = props;
  const [isEditing, setEditing] = useState(false);
  const [newName, setNewName] = useState(name);
  const [newValue, setNewValue] = useState(value);
  const [newUrlRegex, setUrlRegex] = useState(urlRegexProp);
  const [overrideType, setOverrideType] = useState(overrideTypeProp);

  const editFieldRef = useRef(null);
  const editButtonRef = useRef(null);

  const wasEditing = usePrevious(isEditing);

  function handleNameChange(e) {
    setNewName(e.target.value);
  }

  function handleValueChange(e) {
    setNewValue(e.target.value);
  }

  function handleUrlRegexChange(e) {
    setUrlRegex(e.target.value);
  }

  function handleRequestOverrideTypeChange(e) {
    setOverrideType(e.target.value);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!newName.trim()) {
      return;
    }
    props.editHeader(props.id, newName, newValue, newUrlRegex, overrideType);
    setEditing(false);
  }

  function overrideTypeDisplayName(overrideType) {
    if (overrideType === 'header') {
      return 'Header';
    } else {
      return 'Query Param';
    }
  }

  const editingTemplate = (
    <form
      className="card-panel"
      onSubmit={handleSubmit}
      style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        border: '1px solid var(--color-indigo)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <label
            htmlFor={props.id + '-name'}
            style={{
              fontSize: '1.1rem',
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: '3px',
              fontWeight: '500',
            }}
          >
            Parameter Name
          </label>
          <input
            id={props.id + '-name'}
            type="text"
            value={newName}
            onChange={handleNameChange}
            ref={editFieldRef}
            className="input-text"
          />
        </div>

        <div>
          <label
            htmlFor={props.id + '-value'}
            style={{
              fontSize: '1.1rem',
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: '3px',
              fontWeight: '500',
            }}
          >
            Parameter Value
          </label>
          <input
            id={props.id + '-value'}
            type="text"
            value={newValue}
            onChange={handleValueChange}
            className="input-text"
          />
        </div>

        <div>
          <label
            htmlFor={props.id + '-url-regex'}
            style={{
              fontSize: '1.1rem',
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: '3px',
              fontWeight: '500',
            }}
          >
            Url Substring Filter (Optional)
          </label>
          <input
            id={props.id + '-url-regex'}
            type="text"
            value={newUrlRegex}
            onChange={handleUrlRegexChange}
            placeholder="*"
            className="input-text"
          />
        </div>

        {/* Edit Segment Controller */}
        <div className="segmented-control" style={{ marginTop: '4px' }}>
          <input
            onChange={handleRequestOverrideTypeChange}
            type="radio"
            value="header"
            id={'edit-type-header-' + props.id}
            name={'editOverrideType-' + props.id}
            checked={overrideType === 'header'}
            className="segmented-control__input"
          />
          <label
            htmlFor={'edit-type-header-' + props.id}
            className="segmented-control__label"
          >
            Header
          </label>
          <input
            onChange={handleRequestOverrideTypeChange}
            type="radio"
            value="requestQueryParam"
            id={'edit-type-query-' + props.id}
            name={'editOverrideType-' + props.id}
            checked={overrideType === 'requestQueryParam'}
            className="segmented-control__input"
          />
          <label
            htmlFor={'edit-type-query-' + props.id}
            className="segmented-control__label"
          >
            Query Param
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setEditing(false)}
          style={{ flex: 1, padding: '7px 0', fontSize: '1.15rem' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ flex: 1, padding: '7px 0', fontSize: '1.15rem' }}
        >
          Save
        </button>
      </div>
    </form>
  );

  const viewTemplate = (
    <div
      className={
        'card-panel animate-fade-in ' +
        (props.enabled ? 'card-panel--active' : 'card-panel--inactive')
      }
      style={{
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'all var(--transition-fast)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '4px',
            flex: 1,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <label className="switch-container" style={{ alignSelf: 'center' }}>
            <input
              id={props.id}
              type="checkbox"
              checked={props.enabled}
              onChange={() => props.toggleHeaderEnabled(props.id)}
              className="switch-input"
            />
            <span className="switch-slider"></span>
          </label>
          <div
            onClick={() => props.toggleHeaderEnabled(props.id)}
            style={{
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1.35rem',
              color: 'var(--text-heading)',
              wordBreak: 'break-all',
              lineHeight: '1.3',
              userSelect: 'none',
            }}
          >
            {props.name}
          </div>
        </div>
        <span
          className={
            props.overrideType === 'requestQueryParam'
              ? 'badge badge--query'
              : 'badge badge--header'
          }
        >
          {overrideTypeDisplayName(props.overrideType)}
        </span>
      </div>

      {/* Monospace Code Editor View with Copy button */}
      <div className="code-container">
        <pre className="code-content custom-scroll">
          {props.value || '(Empty String)'}
        </pre>
        <button
          type="button"
          className="copy-btn"
          onClick={() => navigator.clipboard.writeText(props.value || '')}
          title="Copy Value"
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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1.1rem',
          color: 'var(--text-muted)',
        }}
      >
        <div
          style={{
            minWidth: 0,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            paddingRight: '6px',
          }}
        >
          URL Contains:{' '}
          <span
            style={{
              fontFamily: 'monospace',
              color: 'var(--text-heading)',
              fontWeight: 'bold',
            }}
          >
            {props['url-regex'] || '*'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setEditing(true)}
            ref={editButtonRef}
            style={{ padding: '3px 8px', fontSize: '1.1rem' }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => props.deleteHeader(props.id)}
            style={{ padding: '3px 8px', fontSize: '1.1rem' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!wasEditing && isEditing) {
      editFieldRef.current.focus();
    }
    if (wasEditing && !isEditing) {
      editButtonRef.current.focus();
    }
  }, [wasEditing, isEditing]);

  React.useEffect(() => {
    setNewName(name);
    setNewValue(value);
    setUrlRegex(urlRegexProp);
    setOverrideType(overrideTypeProp);
  }, [name, value, urlRegexProp, overrideTypeProp, enabled]);

  return (
    <li className="request-header" style={{ listStyle: 'none' }}>
      {isEditing ? editingTemplate : viewTemplate}
    </li>
  );
}
