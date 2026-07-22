import React, { useState, useEffect } from 'react';
import './Popup.css';
import ThemeToggle from './components/ThemeToggle';
import TopNav from './components/TopNav';
import DashboardView from './components/DashboardView';
import InspectorPanel from './components/InspectorPanel';
import RequestLogsView from './components/RequestLogsView';


const Popup = ({ isOptionsPage = false }) => {
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestCollectingEnabled, setRequestCollectingEnabledState] = useState(false);
  const [responseOverridesEnabled, setResponseOverridesEnabledState] = useState(false);
  const [requestBodyOverridesEnabled, setRequestBodyOverridesEnabledState] = useState(false);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  useEffect(() => {
    if (chrome.storage) {
      chrome.storage.local.get(
        [
          'theme',
          'requestCollectingEnabled',
          'responseOverridesEnabled',
          'requestBodyOverridesEnabled',
          'rho_activeTab',
          'rho_selectedRequest',
        ],
        (result) => {
          if (result.theme) {
            setTheme(result.theme);
          } else if (
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: light)').matches
          ) {
            setTheme('light');
          }
          if (result.requestCollectingEnabled !== undefined) {
            setRequestCollectingEnabledState(result.requestCollectingEnabled);
          } else {
            setRequestCollectingEnabledState(false);
          }
          if (result.responseOverridesEnabled !== undefined) {
            setResponseOverridesEnabledState(result.responseOverridesEnabled);
          } else {
            setResponseOverridesEnabledState(false);
          }
          if (result.requestBodyOverridesEnabled !== undefined) {
            setRequestBodyOverridesEnabledState(result.requestBodyOverridesEnabled);
          } else {
            setRequestBodyOverridesEnabledState(false);
          }
          if (result.rho_activeTab) {
            setActiveTab(result.rho_activeTab);
          }
          if (result.rho_selectedRequest !== undefined) {
            setSelectedRequest(result.rho_selectedRequest);
          }
          setIsStorageLoaded(true);
        }
      );

      const listener = (changes, namespace) => {
        if (namespace === 'local') {
          if (changes.rho_activeTab) {
            setActiveTab(changes.rho_activeTab.newValue || 'dashboard');
          }
          if (changes.rho_selectedRequest) {
            setSelectedRequest(changes.rho_selectedRequest.newValue || null);
          }
          if (changes.requestBodyOverridesEnabled) {
            setRequestBodyOverridesEnabledState(changes.requestBodyOverridesEnabled.newValue || false);
          }
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } else {
      setIsStorageLoaded(true);
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
    if (chrome.storage) {
      chrome.storage.local.set({ theme: nextTheme });
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (chrome.storage) {
      chrome.storage.local.set({ rho_activeTab: tab });
    }
  };

  const handleSelectRequest = (req) => {
    setSelectedRequest(req);
    if (chrome.storage) {
      chrome.storage.local.set({ rho_selectedRequest: req });
    }
  };

  const setRequestCollectingEnabled = (val) => {
    setRequestCollectingEnabledState(val);
    if (chrome.storage) {
      chrome.storage.local.set({ requestCollectingEnabled: val });
    }
  };

  const setResponseOverridesEnabled = (val) => {
    setResponseOverridesEnabledState(val);
    if (chrome.storage) {
      chrome.storage.local.set({ responseOverridesEnabled: val });
    }
  };

  const setRequestBodyOverridesEnabled = (val) => {
    setRequestBodyOverridesEnabledState(val);
    if (chrome.storage) {
      chrome.storage.local.set({ requestBodyOverridesEnabled: val });
    }
  };

  const renderContent = () => {
    if (!isStorageLoaded) {
      return <div className="main-content" style={{ flex: 1 }} />;
    }
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            responseOverridesEnabled={responseOverridesEnabled}
            setResponseOverridesEnabled={setResponseOverridesEnabled}
            requestBodyOverridesEnabled={requestBodyOverridesEnabled}
            setRequestBodyOverridesEnabled={setRequestBodyOverridesEnabled}
          />
        );
      case 'logs':
        return (
          <RequestLogsView
            onSelectRequest={handleSelectRequest}
            selectedRequest={selectedRequest}
            requestCollectingEnabled={requestCollectingEnabled}
            setRequestCollectingEnabled={setRequestCollectingEnabled}
          />
        );
      case 'settings':
        return (
          <div className="main-content" style={{ overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '1.6rem' }}>
              Settings
            </h2>
            <div className="card-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>Theme</span>
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '500' }}>Request Collecting</span>
                  <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Passively log XHR/Fetch request and response metadata.
                  </span>
                </div>
                <label className="switch-container" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="switch-input"
                    checked={requestCollectingEnabled}
                    onChange={(e) => setRequestCollectingEnabled(e.target.checked)}
                    aria-label="Toggle Request Collecting"
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '500' }}>Response Overrides</span>
                  <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Intercept matching requests and override responses with mocked data.
                  </span>
                </div>
                <label className="switch-container" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="switch-input"
                    checked={responseOverridesEnabled}
                    onChange={(e) => setResponseOverridesEnabled(e.target.checked)}
                    aria-label="Toggle Response Overrides"
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '500' }}>Request Body Overrides</span>
                  <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Intercept matching requests and override request payloads sent to the server.
                  </span>
                </div>
                <label className="switch-container" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="switch-input"
                    checked={requestBodyOverridesEnabled}
                    onChange={(e) => setRequestBodyOverridesEnabled(e.target.checked)}
                    aria-label="Toggle Request Body Overrides"
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <React.StrictMode>
      <div
        className="dashboard-layout"
        style={
          isOptionsPage
            ? { width: '100vw', height: '100vh', maxWidth: 'none' }
            : {}
        }
      >
        <TopNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          hideOpenTab={isOptionsPage}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {renderContent()}
          {(activeTab === 'dashboard' || activeTab === 'logs') &&
            selectedRequest && (
              <InspectorPanel
                selectedRequest={selectedRequest}
                onClose={() => handleSelectRequest(null)}
                isFullScreen={isOptionsPage}
              />
            )}
        </div>
      </div>
    </React.StrictMode>
  );
};

export default Popup;
