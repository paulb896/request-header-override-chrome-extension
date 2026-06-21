import React, { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

function JsonEditor({
  value,
  onChange,
  height = '120px',
  placeholder = 'Enter JSON...',
  readOnly = false,
}) {
  const handleChange = useCallback(
    (val) => {
      if (onChange) onChange(val);
    },
    [onChange]
  );

  // Try to detect if the value looks like JSON to offer auto-format
  const formatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(value), null, 2);
      onChange(formatted);
    } catch (e) {
      // Not valid JSON, leave as-is
    }
  };

  const isValidJson = (() => {
    if (!value || !value.trim()) return null; // empty — neutral
    try {
      JSON.parse(value);
      return true;
    } catch (e) {
      return false;
    }
  })();

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        {isValidJson === true && (
          <span
            style={{
              fontSize: '0.95rem',
              color: 'var(--color-emerald)',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            Valid JSON
          </span>
        )}
        {isValidJson === false && (
          <span
            style={{
              fontSize: '0.95rem',
              color: 'var(--color-rose)',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Invalid JSON
          </span>
        )}
        {isValidJson === null && <span />}
        <button
          type="button"
          onClick={formatJson}
          className="btn btn-secondary"
          title="Format JSON"
          style={{
            padding: '3px 8px',
            fontSize: '1.05rem',
            marginLeft: 'auto',
          }}
        >
          <svg
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            style={{ marginRight: '4px' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          Format
        </button>
      </div>
      <CodeMirror
        value={value}
        height={height}
        extensions={[json()]}
        theme={oneDark}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
        }}
        style={{
          borderRadius: '6px',
          overflow: 'hidden',
          border:
            isValidJson === false
              ? '1px solid var(--color-rose)'
              : '1px solid var(--border-color)',
          fontSize: '1.1rem',
          boxShadow:
            isValidJson === false ? '0 0 0 1px var(--color-rose)' : 'none',
          transition:
            'border-color var(--transition-fast), box-shadow var(--transition-fast)',
        }}
      />
    </div>
  );
}

export default JsonEditor;
