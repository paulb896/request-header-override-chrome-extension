import React, { useEffect, useRef, useState } from "react";

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export default function RequestHeader(props) {
  const [isEditing, setEditing] = useState(false);
  const [newName, setNewName] = useState(props.name);
  const [newValue, setNewValue] = useState(props.value);
  const [newUrlRegex, setUrlRegex] = useState(props['url-regex']);
  const [overrideType, setOverrideType] = useState(props.overrideType);

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
    setNewName('');
    setNewValue('');
    setUrlRegex('');
    setOverrideType('header');
    setEditing(false);
  }

  function overrideTypeDisplayName(overrideType) {
    if (overrideType === 'header') {
      return 'Header';
    } else {
      return 'Query Param'
    }
  }

  const editingTemplate = (
    <form className="stack-small" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="request-header-label" htmlFor={props.id + '-name'}>
          Name
        </label>
        <input
          id={props.id + '-name'}
          className="request-header-text"
          type="text"
          value={newName}
          onChange={handleNameChange}
          ref={editFieldRef}
        />
        <label className="request-header-label" htmlFor={props.id + '-value'}>
          Value
        </label>
        <input
          id={props.id + '-value'}
          className="request-header-text"
          type="text"
          value={newValue}
          onChange={handleValueChange}
          ref={editFieldRef}
        />
        <label className="request-header-label" htmlFor={props.id + '-url-regex'}>
          Url Search Pattern
        </label>
        <input
          id={props.id + '-url-regex'}
          className="request-header-text"
          type="text"
          value={newUrlRegex}
          onChange={handleUrlRegexChange}
          ref={editFieldRef}
        />
        <div>
          <label className="input label__radio input__radio">
            <input onChange={handleRequestOverrideTypeChange} type="radio" value="header" name="overrideType" checked={overrideType === "header"} /> Header Param
          </label>
          <label className="input label__radio input__radio">
            <input onChange={handleRequestOverrideTypeChange} type="radio" value="requestQueryParam" name="overrideType" checked={overrideType === "requestQueryParam"} /> Request Query Param
          </label>
        </div>
      </div>
      <div className="btn-group">
        <button
          type="button"
          className="btn request-header-cancel"
          onClick={() => setEditing(false)}
        >
          Cancel
          <span className="visually-hidden">renaming {props.name}</span>
        </button>
        <button type="submit" className="btn btn__primary request-header-edit">
          Save
          <span className="visually-hidden">new name for {props.name}</span>
        </button>
      </div>
    </form>
  );

  const viewTemplate = (
    <div className="stack-small">
      <div className="c-cb">
        <input
          id={props.id}
          type="checkbox"
          checked={props.enabled}
          onChange={() => props.toggleHeaderEnabled(props.id)}
        />
        <label className="request-header-label" htmlFor={props.id}>
          {props.name} : {props.value} - <b>{props['url-regex']}</b>
          <b className="overrideType">
            {overrideTypeDisplayName(props.overrideType || 'header')}
          </b>
        </label>
      </div>
      <div className="btn-group">
        <button
          type="button"
          className="btn"
          onClick={() => setEditing(true)}
          ref={editButtonRef}
        >
          Edit <span className="visually-hidden">{props.name}: {props.value}</span>
          <span className="visually-hidden">{props['url-regex']}</span>
        </button>
        <button
          type="button"
          className="btn btn__danger"
          onClick={() => props.deleteHeader(props.id)}
        >
          Delete <span className="visually-hidden">{props.name}: {props.value}</span>
        </button>
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
    console.log('props', props);
    setNewName(props.name);
    setNewValue(props.value);
    setUrlRegex(props['url-regex']);
    setOverrideType(props.overrideType);
  }, [props.name, props.value, props['url-regex'], props.enabled])

  return <li className="request-header">{isEditing ? editingTemplate : viewTemplate}</li>;
}
