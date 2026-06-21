import React from 'react';
import RequestHeadersApp from './RequestHeadersApp';
import ResponseOverridesApp from './ResponseOverridesApp';

const DashboardView = () => {
  return (
    <div
      className="main-content custom-scroll"
      style={{ overflowY: 'auto', overflowX: 'hidden' }}
    >
      <div
        className="card-panel"
        style={{
          padding: '20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2 style={{ marginBottom: '16px', fontSize: '1.6rem' }}>
          Active Request & Response Overrides
        </h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            flex: 1,
            minHeight: '300px',
          }}
        >
          <div>
            <h3
              style={{
                marginBottom: '12px',
                fontSize: '1.3rem',
                color: 'var(--text-muted)',
              }}
            >
              Header and Query Parameter Overrides
            </h3>
            <RequestHeadersApp />
          </div>
          <div
            style={{
              height: '1px',
              background: 'var(--border-color)',
              width: '100%',
            }}
          ></div>
          <div>
            <h3
              style={{
                marginBottom: '12px',
                fontSize: '1.3rem',
                color: 'var(--text-muted)',
              }}
            >
              Response Mocks
            </h3>
            <ResponseOverridesApp hideRecentRequests={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
