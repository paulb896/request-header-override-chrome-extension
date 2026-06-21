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

  // ... (keep useEffects)

  useEffect(() => {
    if (chrome.storage) {
      chrome.storage.local.get(['theme'], (result) => {
        if (result.theme) {
          setTheme(result.theme);
        } else if (
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: light)').matches
        ) {
          setTheme('light');
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
    if (chrome.storage) {
      chrome.storage.local.set({ theme: nextTheme });
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView />
        );
      case 'logs':
        return (
          <RequestLogsView
            onSelectRequest={setSelectedRequest}
            selectedRequest={selectedRequest}
          />
        );


      case 'settings':
        return (
          <div className="main-content" style={{ overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px', fontSize: '1.6rem' }}>
              Settings
            </h2>
            <div className="card-panel" style={{ padding: '20px' }}>
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
          onTabChange={setActiveTab}
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
                onClose={() => setSelectedRequest(null)}
                isFullScreen={isOptionsPage}
              />
            )}
        </div>
      </div>
    </React.StrictMode>
  );
};

export default Popup;
