import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestLogsView from './RequestLogsView';

describe('RequestLogsView Component', () => {
  let mockStorage;
  let listeners = [];

  beforeEach(() => {
    mockStorage = {
      recentRequests: [
        { url: 'https://example.com/api', method: 'GET', statusCode: 200, contentType: 'application/json', timestamp: 1000, response: '{"success":true,"user":{"name":"Alice"}}' },
        { url: 'https://test.com/graphql', method: 'POST', statusCode: 400, operationName: 'GetData', timestamp: 2000, response: '{"errors":[{"message":"Unauthorized"}]}' },
        { url: 'https://error.com/foo', method: 'OPTIONS', statusCode: 500, timestamp: 3000 },
        { url: 'https://other.com/bar', method: 'PUT', statusCode: 0, timestamp: 4000 },
        { url: 'https://redirect.com', method: 'PATCH', statusCode: 302, timestamp: 5000 },
        { url: 'https://pending.com/api', method: 'GET', timestamp: 6000 },
        { url: 'https://notimestamp.com', method: 'GET', statusCode: 200 }
      ]
    };
    listeners = [];

    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys, cb) => cb(mockStorage)),
          set: jest.fn((data) => {
            Object.assign(mockStorage, data);
            listeners.forEach(l => l({ recentRequests: { newValue: data.recentRequests } }, 'local'));
          }),
        },
        onChanged: {
          addListener: jest.fn(l => listeners.push(l)),
          removeListener: jest.fn(l => {
            listeners = listeners.filter(fn => fn !== l);
          })
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders logs and handles empty state', () => {
    mockStorage.recentRequests = [];
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    expect(screen.getByText(/No network requests intercepted yet/i)).toBeInTheDocument();
  });

  test('renders list of requests', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();
    expect(screen.getByText('https://test.com/graphql')).toBeInTheDocument();
    expect(screen.getByText(/GetData/)).toBeInTheDocument();
  });

  test('filters by search term', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    const searchInput = screen.getByPlaceholderText('Search logs by URL, method, or response...');

    fireEvent.change(searchInput, { target: { value: 'graphql' } });

    expect(screen.queryByText('https://example.com/api')).not.toBeInTheDocument();
    expect(screen.getByText('https://test.com/graphql')).toBeInTheDocument();
  });

  test('filters by response data', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    const searchInput = screen.getByPlaceholderText('Search logs by URL, method, or response...');

    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();
    expect(screen.queryByText('https://test.com/graphql')).not.toBeInTheDocument();
  });

  test('filters by method', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    const postFilterBtn = screen.getAllByText('POST')[0];

    fireEvent.click(postFilterBtn);
    expect(screen.queryByText('https://example.com/api')).not.toBeInTheDocument();
    expect(screen.getByText('https://test.com/graphql')).toBeInTheDocument();

    // Toggle off
    fireEvent.click(postFilterBtn);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();

    // Click OPTIONS to cover the 'badge--header' branch of nested ternary
    const optionsFilterBtn = screen.getAllByText('OPTIONS')[0];
    fireEvent.click(optionsFilterBtn);
    expect(screen.getByText('https://error.com/foo')).toBeInTheDocument();
    fireEvent.click(optionsFilterBtn);

    // Click GET to cover the GET filter button branch
    const getFilterBtn = screen.getAllByText('GET')[0];
    fireEvent.click(getFilterBtn);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();
    fireEvent.click(getFilterBtn);
  });

  test('filters by status code', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    const errorFilterBtn = screen.getByText('Any Error');

    fireEvent.click(errorFilterBtn);
    expect(screen.queryByText('https://example.com/api')).not.toBeInTheDocument();
    expect(screen.getByText('https://error.com/foo')).toBeInTheDocument();
    expect(screen.getByText('https://other.com/bar')).toBeInTheDocument(); // status 0 = error

    fireEvent.click(errorFilterBtn);

    const successFilterBtn = screen.getByText('2xx Success');
    fireEvent.click(successFilterBtn);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();
    expect(screen.queryByText('https://test.com/graphql')).not.toBeInTheDocument();

    const status3xx = screen.getByText('3xx Redirect');
    fireEvent.click(status3xx);
    expect(screen.getByText('https://redirect.com')).toBeInTheDocument();

    const status4xx = screen.getByText('4xx Error');
    fireEvent.click(status4xx);
    expect(screen.getByText('https://test.com/graphql')).toBeInTheDocument();

    const status5xx = screen.getByText('5xx Error');
    fireEvent.click(status5xx);
    expect(screen.getByText('https://error.com/foo')).toBeInTheDocument();
  });

  test('clears logs', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();

    const clearBtn = screen.getByText('Clear Logs');
    fireEvent.click(clearBtn);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ recentRequests: [] });
    expect(screen.getByText(/No network requests intercepted yet/i)).toBeInTheDocument();
  });

  test('handles selecting a request', () => {
    const handleSelect = jest.fn();
    render(<RequestLogsView onSelectRequest={handleSelect} selectedRequest={null} />);

    const row = screen.getByText('https://example.com/api').closest('tr');
    fireEvent.click(row);

    expect(handleSelect).toHaveBeenCalledWith(mockStorage.recentRequests[0]);
  });

  test('keyboard navigation ArrowDown and ArrowUp', () => {
    const handleSelect = jest.fn();
    const selected = mockStorage.recentRequests[1]; // POST test.com

    const { container, rerender } = render(<RequestLogsView onSelectRequest={handleSelect} selectedRequest={selected} />);
    expect(screen.getByText(/GetData/)).toBeInTheDocument();

    // Simulate mouse enter to activate hover mode
    const scrollContainer = container.querySelectorAll('.custom-scroll')[1];
    fireEvent.mouseEnter(scrollContainer);
    fireEvent.mouseOver(scrollContainer);

    // Arrow down
    fireEvent(window, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(handleSelect).toHaveBeenCalledWith(mockStorage.recentRequests[2]); // Next item

    // Arrow up
    fireEvent(window, new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(handleSelect).toHaveBeenCalledWith(mockStorage.recentRequests[0]); // Prev item

    // Arrow up when at top should not go out of bounds
    handleSelect.mockClear();
    rerender(<RequestLogsView onSelectRequest={handleSelect} selectedRequest={mockStorage.recentRequests[0]} />);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();
    fireEvent(window, new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(handleSelect).not.toHaveBeenCalled();

    // Arrow down when at bottom
    handleSelect.mockClear();
    rerender(<RequestLogsView onSelectRequest={handleSelect} selectedRequest={mockStorage.recentRequests[mockStorage.recentRequests.length - 1]} />);
    expect(screen.getByText('https://notimestamp.com')).toBeInTheDocument();
    fireEvent(window, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(handleSelect).not.toHaveBeenCalled();

    // Mouse leave disables
    fireEvent.mouseLeave(scrollContainer);
    handleSelect.mockClear();
    fireEvent(window, new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(handleSelect).not.toHaveBeenCalled();
  });

  test('keyboard navigation ignores if typing in input', () => {
    const handleSelect = jest.fn();
    const selected = mockStorage.recentRequests[1];

    const { container } = render(<RequestLogsView onSelectRequest={handleSelect} selectedRequest={selected} />);
    const scrollContainer = container.querySelectorAll('.custom-scroll')[1];
    fireEvent.mouseEnter(scrollContainer);

    const input = screen.getByPlaceholderText('Search logs by URL, method, or response...');
    input.focus();

    fireEvent(input, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(handleSelect).not.toHaveBeenCalled();
  });

  test('displays formatTime correctly', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    // 1000ms is epoch start + 1s. Just check that it didn't throw and rendered time cell.
    expect(document.querySelectorAll('td')[0].textContent.length).toBeGreaterThan(0);
  });

  test('handles no chrome storage gracefully', () => {
    const originalStorage = global.chrome.storage;

    // 1. Test clearLogs when storage is undefined
    const { unmount } = render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();

    delete global.chrome.storage;
    const clearBtn = screen.getByText('Clear Logs');
    fireEvent.click(clearBtn);

    global.chrome.storage = originalStorage;
    unmount();

    // 2. Test mount useEffect when storage is undefined
    delete global.chrome.storage;
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    expect(screen.getByText(/No network requests intercepted yet/i)).toBeInTheDocument();

    global.chrome.storage = originalStorage;
  });

  test('empty search results message', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    const searchInput = screen.getByPlaceholderText('Search logs by URL, method, or response...');

    fireEvent.change(searchInput, { target: { value: 'nomatchwillbefound' } });

    expect(screen.getByText(/No requests matching active filters/i)).toBeInTheDocument();
  });

  test('filters by type (GraphQL and JSON)', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);

    const graphqlBtn = screen.getByRole('button', { name: 'GraphQL' });
    fireEvent.click(graphqlBtn);

    expect(screen.getByText('https://test.com/graphql')).toBeInTheDocument();
    expect(screen.queryByText('https://example.com/api')).not.toBeInTheDocument();

    fireEvent.click(graphqlBtn);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();

    const jsonBtn = screen.getByRole('button', { name: 'JSON' });
    fireEvent.click(jsonBtn);

    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();
    expect(screen.queryByText('https://test.com/graphql')).not.toBeInTheDocument();

    fireEvent.click(jsonBtn);
  });

  test('keyboard navigation ArrowDown does nothing if no request is selected', () => {
    const handleSelect = jest.fn();
    const { container } = render(<RequestLogsView onSelectRequest={handleSelect} selectedRequest={null} />);
    const scrollContainer = container.querySelectorAll('.custom-scroll')[1];
    fireEvent.mouseEnter(scrollContainer);

    fireEvent(window, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(handleSelect).not.toHaveBeenCalled();
  });

  test('updates logs when chrome.storage.onChanged fires', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    expect(screen.getByText('https://example.com/api')).toBeInTheDocument();

    // Trigger onChanged with namespace !== 'local' to cover that branch
    act(() => {
      listeners.forEach(l => l({
        recentRequests: {
          newValue: [{ url: 'https://sync-log.com', method: 'GET', timestamp: 8000 }]
        }
      }, 'sync'));
    });
    expect(screen.queryByText('https://sync-log.com')).not.toBeInTheDocument();

    // Trigger onChanged with no recentRequests key in changes
    act(() => {
      listeners.forEach(l => l({}, 'local'));
    });

    act(() => {
      listeners.forEach(l => l({
        recentRequests: {
          newValue: [
            { url: 'https://new-log.com', method: 'GET', timestamp: 7000 }
          ]
        }
      }, 'local'));
    });

    expect(screen.getByText('https://new-log.com')).toBeInTheDocument();
    expect(screen.queryByText('https://example.com/api')).not.toBeInTheDocument();

    act(() => {
      listeners.forEach(l => l({
        recentRequests: {
          newValue: undefined
        }
      }, 'local'));
    });

    expect(screen.getByText(/No network requests intercepted yet/i)).toBeInTheDocument();
  });

  test('handles empty result from storage on mount', () => {
    global.chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    expect(screen.getByText(/No network requests intercepted yet/i)).toBeInTheDocument();
  });

  test('keyboard navigation does nothing if selectedRequest is not in the list', () => {
    const handleSelect = jest.fn();
    const notInListReq = { url: 'https://not-in-list.com', timestamp: 9999 };
    const { container } = render(<RequestLogsView onSelectRequest={handleSelect} selectedRequest={notInListReq} />);
    const scrollContainer = container.querySelectorAll('.custom-scroll')[1];
    fireEvent.mouseEnter(scrollContainer);

    fireEvent(window, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(handleSelect).not.toHaveBeenCalled();
  });

  test('renders warning banner when request collecting is disabled, and allows enabling inline', () => {
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      if (keys.includes('requestCollectingEnabled')) {
        cb({ requestCollectingEnabled: false });
      } else {
        cb({});
      }
    });

    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    expect(screen.getByText('Request collecting is disabled. Enable it to start capturing requests.')).toBeInTheDocument();

    const toggle = screen.getByLabelText('Toggle Request Collecting Inline');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ requestCollectingEnabled: true });
  });

  test('covers chrome.storage.onChanged is undefined on mount', () => {
    const originalOnChanged = global.chrome.storage.onChanged;
    global.chrome.storage.onChanged = undefined;

    const { unmount } = render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    unmount();

    global.chrome.storage.onChanged = originalOnChanged;
  });

  test('calls propSetEnabled if provided', () => {
    const propSetEnabledMock = jest.fn();
    render(
      <RequestLogsView
        onSelectRequest={jest.fn()}
        selectedRequest={null}
        requestCollectingEnabled={false}
        setRequestCollectingEnabled={propSetEnabledMock}
      />
    );
    const toggle = screen.getByLabelText('Toggle Request Collecting Inline');
    fireEvent.click(toggle);
    expect(propSetEnabledMock).toHaveBeenCalledWith(true);
  });

  test('updates inline state when storage changes requestCollectingEnabled', () => {
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);

    act(() => {
      listeners.forEach(l => l({
        requestCollectingEnabled: {
          newValue: true
        }
      }, 'local'));
    });

    expect(screen.queryByText('Request collecting is disabled. Enable it to start capturing requests.')).not.toBeInTheDocument();

    act(() => {
      listeners.forEach(l => l({
        requestCollectingEnabled: {
          newValue: undefined
        }
      }, 'local'));
    });
    expect(screen.getByText('Request collecting is disabled. Enable it to start capturing requests.')).toBeInTheDocument();
  });

  test('toggles inline and handles falsy storage', () => {
    const originalStorage = global.chrome.storage;
    global.chrome.storage = undefined;
    render(<RequestLogsView onSelectRequest={jest.fn()} selectedRequest={null} />);
    const toggle = screen.getByLabelText('Toggle Request Collecting Inline');
    fireEvent.click(toggle);
    expect(screen.queryByLabelText('Toggle Request Collecting Inline')).not.toBeInTheDocument();
    global.chrome.storage = originalStorage;
  });
});

