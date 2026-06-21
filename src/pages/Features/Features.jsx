import React, { useState, useEffect } from 'react';
import './Features.css';

const Features = () => {
  const [theme, setTheme] = useState('dark');
  
  // Simulator states
  const [ruleHeader, setRuleHeader] = useState(true);
  const [ruleParam, setRuleParam] = useState(false);
  const [ruleMock, setRuleMock] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [copiedRequest, setCopiedRequest] = useState(false);
  const [copiedTransaction, setCopiedTransaction] = useState(false);

  const requestText = `// Target URL:
fetch("https://api.example.com/v1/users${ruleParam ? '?debug=true' : ''}", {
  method: "GET",
  headers: {
    "Accept": "application/json"${ruleHeader ? ',\\n    "Authorization": "Bearer dev-token-xyz"' : ''}
  }
});`;

  const transactionText = ruleMock ? `// Upstream Mock Intercepted (Dynamic Rule Match)
HTTP/1.1 500 Internal Server Error
Content-Type: application/json
Access-Control-Allow-Origin: *

{
  "status": "error",
  "message": "Mock Server Error from RequestFlow Pro"
}` : `// Outbound Request Dispatched to Remote Server
GET /v1/users${ruleParam ? '?debug=true' : ''} HTTP/1.1
Host: api.example.com
${ruleHeader ? 'Authorization: Bearer dev-token-xyz\\n' : ''}Accept: application/json

// Server response (Actual Remote Server)
HTTP/1.1 200 OK
Content-Type: application/json
[
  { "id": 1, "username": "admin" },
  { "id": 2, "username": "developer" }
]`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'request') {
        setCopiedRequest(true);
        setTimeout(() => setCopiedRequest(false), 1500);
      } else {
        setCopiedTransaction(true);
        setTimeout(() => setCopiedTransaction(false), 1500);
      }
    });
  };
  const [simLogs, setSimLogs] = useState([
    {
      id: 1,
      timestamp: '18:40:02',
      url: 'https://api.example.com/v1/users',
      method: 'GET',
      status: 200,
      headers: { 'Accept': 'application/json' },
      type: 'original'
    }
  ]);

  // Load and sync theme
  useEffect(() => {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['theme'], (result) => {
        if (result.theme) {
          setTheme(result.theme);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ theme: nextTheme });
    }
  };

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      
      let finalUrl = 'https://api.example.com/v1/users';
      if (ruleParam) {
        finalUrl += '?debug=true';
      }

      const headers = {
        'Accept': 'application/json'
      };
      if (ruleHeader) {
        headers['Authorization'] = 'Bearer dev-token-xyz';
      }

      setSimLogs(prev => [
        {
          id: Date.now(),
          timestamp: timeStr,
          url: finalUrl,
          method: 'GET',
          status: ruleMock ? 500 : 200,
          headers: headers,
          type: ruleMock ? 'mocked' : (ruleHeader || ruleParam ? 'modified' : 'original')
        },
        ...prev
      ]);
      setIsSimulating(false);
    }, 600);
  };

  return (
    <div className="features-page-wrapper">
      {/* Header */}
      <header className="features-header">
        <div className="features-logo-group">
          <div className="features-logo-icon"></div>
          <h1>RequestFlow Pro</h1>
          <span className="badge badge--success">v2.0.0</span>
        </div>
        <div className="features-header-actions">
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => window.close()}
          >
            Go back
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="features-container">
        {/* Intro */}
        <section className="features-intro">
          <h2 className="glow-text">Architect outgoing requests and mock response flows</h2>
          <p>
            RequestFlow Pro intercepts, transforms, and mocks web traffic directly within your browser. 
            Configure custom header insertion, query string mutations, and mock APIs locally using Manifest V3 dynamic rules.
          </p>
        </section>

        {/* Feature Cards Grid */}
        <section className="features-grid">
          {/* Card 1 */}
          <div className="feature-card card-panel">
            <div className="feature-icon-wrapper header-glow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <h3>Request Header Overrides</h3>
            <p>Inject credentials, modify User-Agents, or remove security headers like CORS. Scoped by wildcard URL patterns so they only apply to the endpoints you specify.</p>
          </div>

          {/* Card 2 */}
          <div className="feature-card card-panel">
            <div className="feature-icon-wrapper query-glow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3>Query Parameter Mutations</h3>
            <p>Append debug flags, session IDs, or customize pagination queries dynamically. Alter outbound URLs seamlessly without breaking frontend navigation flows.</p>
          </div>

          {/* Card 3 */}
          <div className="feature-card card-panel">
            <div className="feature-icon-wrapper response-glow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
            <h3>Upstream Response Mocking</h3>
            <p>Mock complete backend responses. Supply custom HTTP status codes (e.g. 500, 403), custom headers, and write entire JSON or HTML response payloads directly from the rules engine.</p>
          </div>

          {/* Card 4 */}
          <div className="feature-card card-panel">
            <div className="feature-icon-wrapper log-glow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <h3>Real-time Log Inspector</h3>
            <p>Trace outgoing API calls with precision. View raw request details, inspect rules applied to specific endpoints, and troubleshoot match criteria on the fly.</p>
          </div>

          {/* Card 5 */}
          <div className="feature-card card-panel">
            <div className="feature-icon-wrapper secure-glow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3>Secure & 100% Local</h3>
            <p>Zero tracking, zero server calls. All modifications run inside Chrome's sandboxed declarativeNetRequest engine. Your credentials and rules never leave your machine.</p>
          </div>
        </section>

        {/* Live Playground Simulator */}
        <section className="playground-section card-panel card-panel--active">
          <div className="playground-header">
            <h2>Interactive Rules Simulator</h2>
            <p>Enable/disable rules below to preview how RequestFlow Pro mutates HTTP cycles before they leave the browser.</p>
          </div>

          <div className="playground-body">
            {/* Rules Toggles */}
            <div className="playground-controls">
              <h4>Active Extension Rules</h4>
              <div className="toggle-list">
                <label className={`simulator-toggle-card ${ruleHeader ? 'active-header' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={ruleHeader} 
                    onChange={(e) => setRuleHeader(e.target.checked)} 
                  />
                  <div className="toggle-label-content">
                    <span className="badge badge--header">Header Override</span>
                    <span className="toggle-desc">Inject <code>Authorization: Bearer dev-token-xyz</code></span>
                  </div>
                </label>

                <label className={`simulator-toggle-card ${ruleParam ? 'active-query' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={ruleParam} 
                    onChange={(e) => setRuleParam(e.target.checked)} 
                  />
                  <div className="toggle-label-content">
                    <span className="badge badge--query">Query Param</span>
                    <span className="toggle-desc">Append <code>debug=true</code> query variable</span>
                  </div>
                </label>

                <label className={`simulator-toggle-card ${ruleMock ? 'active-mock' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={ruleMock} 
                    onChange={(e) => setRuleMock(e.target.checked)} 
                  />
                  <div className="toggle-label-content">
                    <span className="badge badge--success">Response Mock</span>
                    <span className="toggle-desc">Mock upstream API to return <code>500 Server Error</code></span>
                  </div>
                </label>
              </div>

              <button 
                className="btn btn-primary simulation-trigger-btn" 
                onClick={handleSimulate}
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <>
                    <span className="spinner-icon"></span>
                    Simulating Request...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Send Simulated Request
                  </>
                )}
              </button>
            </div>

            {/* Code Block Outputs */}
            <div className="playground-visualizer">
              <div className="visualizer-block">
                <div className="block-title">Outbound Fetch Request</div>
                <div className="code-container">
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(requestText, 'request')}
                    title="Copy request script"
                  >
                    {copiedRequest ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                  <pre className="code-content">{requestText}</pre>
                </div>
              </div>

              <div className="visualizer-block">
                <div className="block-title">Upstream HTTP Transaction</div>
                <div className="code-container">
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(transactionText, 'transaction')}
                    title="Copy HTTP details"
                  >
                    {copiedTransaction ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                  <pre className="code-content">{transactionText}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Simulator Log Table */}
          <div className="simulator-logs-wrapper">
            <h4>Simulated Request History Log</h4>
            <div className="simulator-table-container custom-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Method</th>
                    <th>Url</th>
                    <th>Status</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {simLogs.map(log => (
                    <tr key={log.id} className="animate-fade-in">
                      <td>{log.timestamp}</td>
                      <td>
                        <span className={`badge badge--method-${log.method.toLowerCase()}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="url-cell-features" title={log.url}>{log.url}</td>
                      <td>
                        <span className={`badge ${log.status >= 500 ? 'badge--header' : 'badge--success'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td>
                        {log.type === 'mocked' && <span className="sim-mode mocked">MOCKED</span>}
                        {log.type === 'modified' && <span className="sim-mode modified">MODIFIED</span>}
                        {log.type === 'original' && <span className="sim-mode original">DIRECT</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="features-footer">
        <p>RequestFlow Pro is built with Manifest V3 and complies with the Google Web Store developer privacy guidelines.</p>
        <p>© 2026 RequestFlow Pro. Local local-sandbox environment.</p>
      </footer>
    </div>
  );
};

export default Features;
