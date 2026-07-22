import React, { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';

const generateRandomId = () => Math.random().toString(36).substring(2, 9);

function RequestBodyOverridesApp({
  requestBodyOverridesEnabled: propEnabled,
  setRequestBodyOverridesEnabled: propSetEnabled,
}) {
  const [overrides, setOverrides] = useState([]);
  const [localEnabled, setLocalEnabled] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const isEnabled = propEnabled !== undefined ? propEnabled : localEnabled;
  const setIsEnabled = (val) => {
    if (propSetEnabled) {
      propSetEnabled(val);
    } else {
      setLocalEnabled(val);
      if (chrome.storage) {
        chrome.storage.local.set({ requestBodyOverridesEnabled: val });
      }
    }
  };

  // Form states
  const [matchUrl, setMatchUrl] = useState('');
  const [matchRequestBody, setMatchRequestBody] = useState('');
  const [overrideRequestBody, setOverrideRequestBody] = useState('');

  // Editing states
  const [editingId, setEditingId] = useState(null);
  const [editingMatchUrl, setEditingMatchUrl] = useState('');
  const [editingMatchRequestBody, setEditingMatchRequestBody] = useState('');
  const [editingOverrideRequestBody, setEditingOverrideRequestBody] = useState('');

  // Storage loads
  useEffect(() => {
    if (chrome.storage) {
      chrome.storage.local.get(['requestBodyOverrides'], (result) => {
        if (result.requestBodyOverrides) {
          setOverrides(result.requestBodyOverrides);
        }
      });

      if (propEnabled === undefined) {
        chrome.storage.local.get(['requestBodyOverridesEnabled'], (result) => {
          if (result.requestBodyOverridesEnabled !== undefined) {
            setLocalEnabled(result.requestBodyOverridesEnabled);
          }
        });
      }

      const listener = (changes, namespace) => {
        if (namespace === 'local') {
          if (changes.requestBodyOverrides) {
            setOverrides(changes.requestBodyOverrides.newValue || []);
          }
          if (propEnabled === undefined && changes.requestBodyOverridesEnabled) {
            setLocalEnabled(changes.requestBodyOverridesEnabled.newValue || false);
          }
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, [propEnabled]);

  const updateOverrides = (nextOverrides) => {
    setOverrides(nextOverrides);
    if (chrome.storage) {
      chrome.storage.local.set({ requestBodyOverrides: nextOverrides });
    }
  };

  const toggleEnabled = (val) => {
    setIsEnabled(val);
  };

  const addOverride = (e) => {
    e.preventDefault();
    if (!matchUrl.trim() || !overrideRequestBody.trim()) return;

    const newOverride = {
      id: generateRandomId(),
      matchUrl: matchUrl.trim(),
      matchRequestBody: matchRequestBody.trim(),
      overrideRequestBody: overrideRequestBody.trim(),
      active: true,
    };

    const nextOverrides = [newOverride, ...overrides];
    updateOverrides(nextOverrides);

    // Reset form
    setMatchUrl('');
    setMatchRequestBody('');
    setOverrideRequestBody('');
  };

  const startEditing = (o) => {
    setEditingId(o.id);
    setEditingMatchUrl(o.matchUrl);
    setEditingMatchRequestBody(o.matchRequestBody || '');
    setEditingOverrideRequestBody(o.overrideRequestBody || '');
  };

  const saveEditing = (id) => {
    if (!editingMatchUrl.trim() || !editingOverrideRequestBody.trim()) return;
    const nextOverrides = overrides.map((o) =>
      o.id === id
        ? {
            ...o,
            matchUrl: editingMatchUrl.trim(),
            matchRequestBody: editingMatchRequestBody.trim(),
            overrideRequestBody: editingOverrideRequestBody.trim(),
          }
        : o
    );
    updateOverrides(nextOverrides);
    setEditingId(null);
  };

  const toggleOverride = (id) => {
    const newOverrides = overrides.map((o) =>
      o.id === id ? { ...o, active: !o.active } : o
    );
    updateOverrides(newOverrides);
  };

  const deleteOverride = (id) => {
    const newOverrides = overrides.filter((o) => o.id !== id);
    updateOverrides(newOverrides);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} data-testid="request-body-overrides-app">
      {/* Active Toggle Switch */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-overlay-light)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <span style={{ fontWeight: '600', fontSize: '1.25rem', color: 'var(--text-heading)' }}>
          Enable Request Body Overrides
        </span>
        <label className="switch-container" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
          <input
            type="checkbox"
            className="switch-input"
            checked={isEnabled}
            onChange={(e) => toggleEnabled(e.target.checked)}
            aria-label="Toggle Request Body Overrides"
            data-testid="toggle-request-body-overrides"
          />
          <span className="switch-slider"></span>
        </label>
      </div>

      {/* Warning Banner when disabled */}
      {!isEnabled && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-heading)', fontWeight: '500' }}>
              Request body overrides are disabled. Enable them to activate modifications.
            </span>
          </div>
        </div>
      )}

      {/* Add New Request Body Override Form */}
      <form onSubmit={addOverride} className="card-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-heading)', fontWeight: '600' }}>
          Add Request Body Override Rule
        </h4>
        <div>
          <label style={{ fontSize: '1.1rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            Request URL Pattern (Route) *
          </label>
          <input
            type="text"
            className="input-text"
            placeholder="e.g. /graphql or /api/checkout"
            value={matchUrl}
            onChange={(e) => setMatchUrl(e.target.value)}
            required
            style={{ fontSize: '1.15rem' }}
            data-testid="add-match-url-input"
          />
        </div>

        <div>
          <label style={{ fontSize: '1.1rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            Request Body Match (Optional)
          </label>
          <textarea
            className="input-text custom-scroll"
            placeholder='e.g. "operationName":"SkateCheckoutPreloadUrlCreate"'
            value={matchRequestBody}
            onChange={(e) => setMatchRequestBody(e.target.value)}
            style={{
              height: '100px',
              fontFamily: 'monospace',
              resize: 'vertical',
              fontSize: '1.15rem',
              boxSizing: 'border-box',
            }}
            data-testid="add-match-body-input"
          />
        </div>

        <div>
          <label style={{ fontSize: '1.1rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
            Override Request Body *
          </label>
          <textarea
            className="input-text custom-scroll"
            placeholder="JSON or raw string payload..."
            value={overrideRequestBody}
            onChange={(e) => setOverrideRequestBody(e.target.value)}
            required
            style={{
              height: '180px',
              fontFamily: 'monospace',
              resize: 'vertical',
              fontSize: '1.15rem',
              boxSizing: 'border-box',
            }}
            data-testid="add-override-body-input"
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '1.15rem', alignSelf: 'flex-start' }}>
          Add Override Rule
        </button>
      </form>

      {/* List of Active Rules */}
      {overrides.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {overrides.map((override) => {
            const isEditing = editingId === override.id;

            return (
              <div
                key={override.id}
                className="card-panel"
                style={{
                  padding: '16px',
                  borderLeft: override.active ? '3px solid var(--color-indigo)' : '3px solid var(--border-color)',
                  opacity: override.active ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {isEditing ? (
                  /* Edit State */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '1.05rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Request URL Pattern (Route) *
                      </label>
                      <input
                        type="text"
                        className="input-text"
                        value={editingMatchUrl}
                        onChange={(e) => setEditingMatchUrl(e.target.value)}
                        required
                        style={{ fontSize: '1.15rem' }}
                        data-testid="edit-match-url-input"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '1.05rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Request Body Match (Optional)
                      </label>
                      <textarea
                        className="input-text custom-scroll"
                        value={editingMatchRequestBody}
                        onChange={(e) => setEditingMatchRequestBody(e.target.value)}
                        style={{
                          height: '100px',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                          fontSize: '1.15rem',
                          boxSizing: 'border-box',
                        }}
                        data-testid="edit-match-body-input"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '1.05rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Override Request Body *
                      </label>
                      <textarea
                        className="input-text custom-scroll"
                        value={editingOverrideRequestBody}
                        onChange={(e) => setEditingOverrideRequestBody(e.target.value)}
                        required
                        style={{
                          height: '180px',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                          fontSize: '1.15rem',
                          boxSizing: 'border-box',
                        }}
                        data-testid="edit-override-body-input"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => saveEditing(override.id)}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '1.1rem' }}
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '1.1rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display State */
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span
                          style={{
                            fontWeight: '600',
                            fontSize: '1.25rem',
                            color: 'var(--text-heading)',
                            wordBreak: 'break-all',
                          }}
                        >
                          {override.matchUrl}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label className="switch-container" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            className="switch-input"
                            checked={override.active}
                            onChange={() => toggleOverride(override.id)}
                            aria-label={`Toggle active for ${override.matchUrl}`}
                          />
                          <span className="switch-slider"></span>
                        </label>

                        <button
                          type="button"
                          onClick={() => startEditing(override)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '1.05rem' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(override.id)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '1.05rem', color: 'var(--color-rose)', borderColor: 'var(--color-rose)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {override.matchRequestBody && (
                      <div style={{ marginTop: '6px' }}>
                        <span style={{ fontSize: '1.05rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                          If request body includes:
                        </span>
                        <pre style={{ margin: '4px 0 0 0', background: 'var(--code-bg)', color: 'var(--code-text)', padding: '6px', borderRadius: '4px', fontSize: '1.05rem', fontFamily: 'monospace' }}>
                          {override.matchRequestBody}
                        </pre>
                      </div>
                    )}

                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '1.05rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                        Override Payload:
                      </span>
                      <pre style={{ margin: '4px 0 0 0', background: 'var(--code-bg)', color: 'var(--code-text)', padding: '8px', borderRadius: '4px', fontSize: '1.05rem', fontFamily: 'monospace', overflowX: 'auto' }}>
                        {override.overrideRequestBody}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-subtle)', background: 'var(--bg-overlay-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '1.2rem' }}>
          No Request Body Overrides configured. Add one above.
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Delete Request Body Override"
        message="Are you sure you want to delete this request body override rule?"
        onConfirm={() => {
          deleteOverride(deleteTargetId);
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}

export default RequestBodyOverridesApp;
