import React from 'react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Delete' }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.15s ease-out forwards',
      }}
      data-testid="confirm-modal"
    >
      <div
        className="card-panel"
        style={{
          width: '340px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1.4rem',
            color: 'var(--text-heading)',
            fontWeight: '600',
          }}
        >
          {title || 'Confirm Deletion'}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '1.15rem',
            color: 'var(--text-muted)',
            lineHeight: '1.5',
          }}
        >
          {message || 'Are you sure you want to delete this? This action cannot be undone.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ padding: '8px 16px', fontSize: '1.1rem' }}
            data-testid="confirm-modal-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              fontSize: '1.1rem',
              background: 'var(--color-rose, #e11d48)',
              borderColor: 'var(--color-rose, #e11d48)',
            }}
            data-testid="confirm-modal-confirm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
