import React, { useState } from 'react';

function AddRequestHeaderForm(props) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [overrideType, setOverrideType] = useState('header');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    props.addHeader(name, value, overrideType);
    setName('');
    setValue('');
    setOverrideType('header');
  }

  function handleNameChange(e) {
    setName(e.target.value);
  }

  function handleValueChange(e) {
    setValue(e.target.value);
  }

  function handleRequestOverrideTypeChange(e) {
    setOverrideType(e.target.value);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-panel"
      style={{
        padding: '16px',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
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
            d="M12 4v16m8-8H4"
          />
        </svg>
        <h2
          style={{
            fontSize: '1.4rem',
            fontWeight: '600',
            color: 'var(--text-heading)',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}
        >
          Add Override Rule
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="text"
          id="new-request-header-input"
          placeholder="Header / Parameter Name (e.g., Authorization)"
          autoComplete="off"
          value={name}
          onChange={handleNameChange}
          className="input-text"
        />
        <input
          type="text"
          id="new-request-header-input-value"
          placeholder="Value (e.g., Bearer token...)"
          autoComplete="off"
          value={value}
          onChange={handleValueChange}
          className="input-text"
        />
      </div>

      {/* Segment Selector for Header vs Query Param */}
      <div className="segmented-control">
        <input
          onChange={handleRequestOverrideTypeChange}
          type="radio"
          value="header"
          id="add-type-header"
          name="overrideType"
          checked={overrideType === 'header'}
          className="segmented-control__input"
        />
        <label htmlFor="add-type-header" className="segmented-control__label">
          Header Injection
        </label>
        <input
          onChange={handleRequestOverrideTypeChange}
          type="radio"
          value="requestQueryParam"
          id="add-type-query"
          name="overrideType"
          checked={overrideType === 'requestQueryParam'}
          className="segmented-control__input"
        />
        <label htmlFor="add-type-query" className="segmented-control__label">
          Query Parameter
        </label>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '9px 0',
          fontSize: '1.25rem',
          fontWeight: '600',
        }}
      >
        Add Parameter Override
      </button>
    </form>
  );
}

export default AddRequestHeaderForm;
