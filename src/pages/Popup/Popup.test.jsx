import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Popup from './Popup';

// Mock components
jest.mock('./components/ThemeToggle', () => ({ theme, toggleTheme }) => (
  <button data-testid="theme-toggle" onClick={toggleTheme}>
    {theme}
  </button>
));
jest.mock('./components/TopNav', () => ({ activeTab, onTabChange, toggleTheme }) => (
  <div data-testid="top-nav">
    <button onClick={() => onTabChange('dashboard')}>Tab: Dashboard</button>
    <button onClick={() => onTabChange('logs')}>Tab: Logs</button>
    <button onClick={() => onTabChange('mocks')}>Tab: Mocks</button>
    <button onClick={() => onTabChange('settings')}>Tab: Settings</button>
    <button onClick={() => onTabChange('unknown')}>Tab: Unknown</button>
    <button onClick={() => toggleTheme()}>Nav Theme Toggle</button>
  </div>
));
jest.mock('./components/DashboardView', () => () => <div data-testid="dashboard-view" />);
jest.mock('./components/ResponseOverridesApp', () => () => <div data-testid="response-overrides-app" />);
jest.mock('./components/RequestLogsView', () => (props) => (
  <button
    data-testid="request-logs-view"
    data-enabled={String(props.requestCollectingEnabled)}
    onClick={() => {
      props.onSelectRequest({ id: 1 });
      if (props.setRequestCollectingEnabled) {
        props.setRequestCollectingEnabled(true);
      }
    }}
  />
));
jest.mock('./components/InspectorPanel', () => ({ onClose }) => (
  <div data-testid="inspector-panel">
    <button onClick={onClose}>Close Inspector</button>
  </div>
));

describe('Popup Component', () => {
  let mockStorage;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {};

    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys, cb) => {
            const res = {};
            keys.forEach((key) => {
              if (mockStorage[key] !== undefined) {
                res[key] = mockStorage[key];
              }
            });
            cb(res);
          }),
          set: jest.fn((data, cb) => {
            Object.assign(mockStorage, data);
            cb && cb();
          }),
        },
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
      },
    };

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    document.documentElement.className = '';
  });

  test('renders with default dark theme when no storage', async () => {
    render(<Popup />);
    expect(screen.getByTestId('top-nav')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('theme-light')).toBeFalsy();
  });

  test('loads light theme from storage', async () => {
    mockStorage.theme = 'light';
    render(<Popup />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains('theme-light')).toBeTruthy();
    });
  });

  test('falls back to prefers-color-scheme light', async () => {
    window.matchMedia.mockImplementation(query => ({
      matches: query === '(prefers-color-scheme: light)',
    }));

    render(<Popup />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains('theme-light')).toBeTruthy();
    });
  });

  test('toggles theme correctly', async () => {
    render(<Popup />);

    fireEvent.click(screen.getByText('Tab: Settings'));

    const toggleBtn = screen.getByTestId('theme-toggle');
    expect(toggleBtn).toHaveTextContent('dark');

    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'light' });
    });
    expect(toggleBtn).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('theme-light')).toBeTruthy();

    // Toggle back to dark
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'dark' });
    });
    expect(toggleBtn).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('theme-light')).toBeFalsy();
  });

  test('navigates between tabs', () => {
    render(<Popup />);

    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tab: Logs'));
    expect(screen.getByTestId('request-logs-view')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Tab: Settings'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  test('handles unknown tab', () => {
    render(<Popup />);
    fireEvent.click(screen.getByText('Tab: Unknown'));

    // Default switch case returns null
    expect(screen.queryByTestId('dashboard-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-logs-view')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  test('selects and closes request inspector', () => {
    render(<Popup />);

    fireEvent.click(screen.getByText('Tab: Logs'));

    expect(screen.queryByTestId('inspector-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('request-logs-view'));
    expect(screen.getByTestId('inspector-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Inspector'));
    expect(screen.queryByTestId('inspector-panel')).not.toBeInTheDocument();
  });

  test('handles no chrome storage gracefully', () => {
    delete global.chrome.storage;

    render(<Popup />);
    expect(screen.getByTestId('top-nav')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Nav Theme Toggle'));
    expect(document.documentElement.classList.contains('theme-light')).toBeTruthy();
  });

  test('renders as options page layout', () => {
    const { container } = render(<Popup isOptionsPage={true} />);
    const dashboardLayout = container.querySelector('.dashboard-layout');
    expect(dashboardLayout).toHaveStyle({ width: '100vw', height: '100vh', maxWidth: 'none' });
  });

  test('loads settings from storage on mount', async () => {
    mockStorage.requestCollectingEnabled = true;
    mockStorage.responseOverridesEnabled = true;

    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      cb({
        theme: mockStorage.theme,
        requestCollectingEnabled: mockStorage.requestCollectingEnabled,
        responseOverridesEnabled: mockStorage.responseOverridesEnabled,
      });
    });

    render(<Popup />);
    fireEvent.click(screen.getByText('Tab: Settings'));

    const rcToggle = screen.getByLabelText('Toggle Request Collecting');
    const roToggle = screen.getByLabelText('Toggle Response Overrides');

    expect(rcToggle).toBeChecked();
    expect(roToggle).toBeChecked();
  });

  test('toggles settings correctly', async () => {
    render(<Popup />);
    fireEvent.click(screen.getByText('Tab: Settings'));

    const rcToggle = screen.getByLabelText('Toggle Request Collecting');
    const roToggle = screen.getByLabelText('Toggle Response Overrides');

    expect(rcToggle).not.toBeChecked();
    expect(roToggle).not.toBeChecked();

    fireEvent.click(rcToggle);
    expect(rcToggle).toBeChecked();
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ requestCollectingEnabled: true });

    fireEvent.click(roToggle);
    expect(roToggle).toBeChecked();
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ responseOverridesEnabled: true });
  });

  test('handles settings toggle when storage is unavailable', () => {
    delete global.chrome.storage;
    render(<Popup />);
    fireEvent.click(screen.getByText('Tab: Settings'));

    const rcToggle = screen.getByLabelText('Toggle Request Collecting');
    const roToggle = screen.getByLabelText('Toggle Response Overrides');

    fireEvent.click(rcToggle);
    expect(rcToggle).toBeChecked();

    fireEvent.click(roToggle);
    expect(roToggle).toBeChecked();
  });

  test('passes requestCollectingEnabled props to RequestLogsView and propagates changes', async () => {
    mockStorage.requestCollectingEnabled = false;
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      cb({
        theme: mockStorage.theme,
        requestCollectingEnabled: mockStorage.requestCollectingEnabled,
      });
    });

    render(<Popup />);
    fireEvent.click(screen.getByText('Tab: Logs'));

    const logsBtn = screen.getByTestId('request-logs-view');
    expect(logsBtn).toHaveAttribute('data-enabled', 'false');

    fireEvent.click(logsBtn); // triggers setRequestCollectingEnabled(true)
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ requestCollectingEnabled: true });
  });

  test('should default requestCollectingEnabled to false if not in storage', async () => {
    render(<Popup />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('Tab: Settings'));
    });
    const rcToggle = screen.getByLabelText('Toggle Request Collecting');
    expect(rcToggle).not.toBeChecked();
  });

  test('should default responseOverridesEnabled to false if not in storage', async () => {
    render(<Popup />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('Tab: Settings'));
    });
    const roToggle = screen.getByLabelText('Toggle Response Overrides');
    expect(roToggle).not.toBeChecked();
  });

  test('should default requestBodyOverridesEnabled to false if not in storage', async () => {
    render(<Popup />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('Tab: Settings'));
    });
    const rboToggle = screen.getByLabelText('Toggle Request Body Overrides');
    expect(rboToggle).not.toBeChecked();
  });

  test('persists and loads activeTab and selectedRequest to/from storage', async () => {
    mockStorage.rho_activeTab = 'logs';
    mockStorage.rho_selectedRequest = { id: 42, url: 'https://sync.com', method: 'GET' };

    render(<Popup />);

    // TopNav activeTab should be 'logs' on mount
    await waitFor(() => {
      expect(screen.getByTestId('request-logs-view')).toBeInTheDocument();
    });

    // InspectorPanel should be open for the selected request
    expect(screen.getByTestId('inspector-panel')).toBeInTheDocument();

    // Click on Dashboard Tab
    fireEvent.click(screen.getByText('Tab: Dashboard'));
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ rho_activeTab: 'dashboard' });

    // Close Inspector
    fireEvent.click(screen.getByText('Close Inspector'));
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ rho_selectedRequest: null });
  });

  test('updates state on chrome storage change', async () => {
    render(<Popup />);

    const listener = global.chrome.storage.onChanged.addListener.mock.calls[0][0];

    act(() => {
      listener({ rho_activeTab: { newValue: 'logs' } }, 'local');
    });

    await waitFor(() => {
      expect(screen.getByTestId('request-logs-view')).toBeInTheDocument();
    });

    act(() => {
      listener({ rho_selectedRequest: { newValue: { id: 123 } } }, 'local');
    });

    await waitFor(() => {
      expect(screen.getByTestId('inspector-panel')).toBeInTheDocument();
    });

    act(() => {
      listener({ requestBodyOverridesEnabled: { newValue: true } }, 'local');
    });

    fireEvent.click(screen.getByText('Tab: Settings'));

    await waitFor(() => {
      const rboToggle = screen.getByLabelText('Toggle Request Body Overrides');
      expect(rboToggle).toBeChecked();
    });
  });

  test('handles settings toggle for request body overrides', async () => {
    render(<Popup />);
    fireEvent.click(screen.getByText('Tab: Settings'));

    const rboToggle = screen.getByLabelText('Toggle Request Body Overrides');
    expect(rboToggle).not.toBeChecked();

    fireEvent.click(rboToggle);
    expect(rboToggle).toBeChecked();
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ requestBodyOverridesEnabled: true });
  });

  test('renders nothing for default case in renderContent when storage is loaded', async () => {
    render(<Popup />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tab: Unknown'));
    expect(screen.queryByTestId('dashboard-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('main-content')).toBeNull();
  });
});
