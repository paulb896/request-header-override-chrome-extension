import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResponseOverridesApp from './ResponseOverridesApp';

jest.mock('./JsonEditor', () => {
  return function MockJsonEditor(props) {
    return (
      <textarea
        data-testid="json-editor"
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  };
});

describe('ResponseOverridesApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      cb({
        responseOverrides: [
          {
            id: 'mock-1',
            matchUrl: 'https://api.example.com/data',
            mockResponse: '{"data": "mocked"}',
            matchRequestBody: 'test-body',
            active: true,
          },
          {
            id: 'mock-2',
            matchUrl: 'https://api.example.com/empty',
            mockResponse: '',
            active: false,
          },
        ],
      });
    });
  });

  it('renders correctly and loads data from storage', async () => {
    render(<ResponseOverridesApp />);

    // Expand the accordion
    fireEvent.click(screen.getByText('Response Interceptor'));

    await waitFor(() => {
      expect(
        screen.getByText('https://api.example.com/data')
      ).toBeInTheDocument();
    });
  });

  it('can toggle the active state of a mock', async () => {
    render(<ResponseOverridesApp />);

    fireEvent.click(screen.getByText('Response Interceptor'));

    await waitFor(() => {
      expect(
        screen.getByText('https://api.example.com/data')
      ).toBeInTheDocument();
    });

    const activeBtn = screen.getByText('Disable');
    fireEvent.click(activeBtn);

    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    const setArgs = global.chrome.storage.local.set.mock.calls[0][0];
    expect(setArgs.responseOverrides[0].active).toBe(false);
  });

  it('can add a new mock from recent requests', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        cb({
          requests: [
            { id: 'req-1', url: 'https://test.com/api', method: 'GET' },
          ],
        });
      }
    });

    render(<ResponseOverridesApp />);

    fireEvent.click(screen.getByText('Response Interceptor'));

    // Toggle recent requests list
    const toggleBtn = screen.getByText(/View Recent Requests to Mock/i);
    fireEvent.click(toggleBtn);

    // Wait for the recent request to show up
    await waitFor(() => {
      expect(screen.getByText('https://test.com/api')).toBeInTheDocument();
    });

    // Click on the Mock button for that request
    // The button might have text 'Mock'
    const mockBtns = screen.getAllByText('Mock');
    fireEvent.click(mockBtns[0]);

    // Now we should be in the 'edit override dialog'
    await waitFor(() => {
      expect(screen.getByText('Target Route')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('json-editor'), {
      target: { value: '{}' },
    });

    const addBtn = screen.getByText('Save Response Mock');
    fireEvent.click(addBtn);

    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    const setArgs = global.chrome.storage.local.set.mock.calls[0][0];
    expect(setArgs.responseOverrides.length).toBe(3);
    expect(setArgs.responseOverrides[0].matchUrl).toBe('/api');
  });

  it('fetches recent requests when View Recent Network Requests is toggled', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        cb({
          requests: [{ id: '1', url: 'https://recent.com', method: 'GET' }],
        });
      }
    });

    render(<ResponseOverridesApp />);

    fireEvent.click(screen.getByText('Response Interceptor'));

    const toggleBtn = screen.getByText(/View Recent Requests to Mock/i);
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
      expect(screen.getByText('https://recent.com')).toBeInTheDocument();
    });
  });
  it('can delete a mock', async () => {
    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    await waitFor(() => expect(screen.getByText('https://api.example.com/data')).toBeInTheDocument());

    const deleteBtn = screen.getAllByText('Delete')[0];
    fireEvent.click(deleteBtn);

    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    const setArgs = global.chrome.storage.local.set.mock.calls[0][0];
    expect(setArgs.responseOverrides.length).toBe(1);
  });

  it('can filter recent requests by term, method, and status', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        cb({
          requests: [
            { url: 'https://recent.com', method: 'GET', statusCode: 200, response: '{"data":"Alice"}' },
            { url: 'https://other.com', method: 'POST', statusCode: 404, response: '{"error":"Not Found"}' },
            { url: 'https://graphql.com', method: 'POST', operationName: 'MyQuery', statusCode: 200 },
            { url: 'https://pending.com', method: 'GET' }, // no statusCode
            { url: 'https://options.com', method: 'OPTIONS', statusCode: 200 }
          ],
        });
      }
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    
    const toggleBtn = screen.getByText('View Recent Requests to Mock...');
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('https://recent.com')).toBeInTheDocument();
      expect(screen.getByText('https://other.com')).toBeInTheDocument();
      expect(screen.getByText('https://options.com')).toBeInTheDocument();
    });

    // Term filter
    const filterInput = screen.getByPlaceholderText('Filter captured requests by URL, method, or response...');
    fireEvent.change(filterInput, { target: { value: 'other' } });
    expect(screen.getByText('https://other.com')).toBeInTheDocument();
    expect(screen.queryByText('https://recent.com')).not.toBeInTheDocument();

    // Response filter
    fireEvent.change(filterInput, { target: { value: 'Alice' } });
    expect(screen.getByText('https://recent.com')).toBeInTheDocument();
    expect(screen.queryByText('https://other.com')).not.toBeInTheDocument();
    
    // Non-matching term (covers operationName falsy check and empty results view)
    fireEvent.change(filterInput, { target: { value: 'xyz' } });
    expect(screen.getByText('No requests matching active filters')).toBeInTheDocument();
    fireEvent.change(filterInput, { target: { value: '' } });

    // Method filter - GET
    const getBtn = screen.getByRole('button', { name: 'GET' });
    fireEvent.click(getBtn);
    expect(screen.getByText('https://recent.com')).toBeInTheDocument();
    expect(screen.queryByText('https://other.com')).not.toBeInTheDocument();
    fireEvent.click(getBtn);

    // Method filter - POST
    const postBtn = screen.getByRole('button', { name: 'POST' });
    fireEvent.click(postBtn);
    expect(screen.getByText('https://other.com')).toBeInTheDocument();
    expect(screen.queryByText('https://recent.com')).not.toBeInTheDocument();
    fireEvent.click(postBtn);

    // Method filter - OPTIONS (covers badge--method-other style)
    const optionsBtn = screen.getByRole('button', { name: 'OPTIONS' });
    fireEvent.click(optionsBtn);
    expect(screen.getByText('https://options.com')).toBeInTheDocument();
    expect(screen.queryByText('https://recent.com')).not.toBeInTheDocument();
    fireEvent.click(optionsBtn);

    // Status filter
    const statusBtn = screen.getByRole('button', { name: '4xx Error' });
    fireEvent.click(statusBtn);
    expect(screen.getByText('https://other.com')).toBeInTheDocument();
    expect(screen.queryByText('https://recent.com')).not.toBeInTheDocument();
    fireEvent.click(statusBtn);

    // Toggle off (covers nextVal falsy branch)
    const closeBtn = screen.getByText('Close Network Logs');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Captured Requests')).not.toBeInTheDocument();
  });

  it('can edit a mock', async () => {
    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    await waitFor(() => expect(screen.getByText('https://api.example.com/data')).toBeInTheDocument());

    const editBtn = screen.getAllByText('Edit')[0];
    fireEvent.click(editBtn);

    const matchUrlInput = screen.getByDisplayValue('https://api.example.com/data');
    fireEvent.change(matchUrlInput, { target: { value: 'https://new.url' } });

    const matchBodyInput = screen.getByPlaceholderText(/e.g. "operationName":"MyMutation"/);
    fireEvent.change(matchBodyInput, { target: { value: 'different-body' } });

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    // Click edit again to save
    fireEvent.click(screen.getAllByText('Edit')[0]);
    const newMatchUrlInput = screen.getByDisplayValue('https://api.example.com/data');
    fireEvent.change(newMatchUrlInput, { target: { value: 'https://saved.url' } });

    const updateBtn = screen.getByText('Save Changes');
    fireEvent.click(updateBtn);

    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    const setArgs = global.chrome.storage.local.set.mock.calls[0][0];
    expect(setArgs.responseOverrides[0].matchUrl).toBe('https://saved.url');

    // Click edit on mock-2 (covers o.matchRequestBody || '' fallback)
    const editBtn2 = screen.getAllByText('Edit')[1];
    fireEvent.click(editBtn2);
    const cancelBtn2 = screen.getByText('Cancel');
    fireEvent.click(cancelBtn2);
  });

  it('can copy payload to clipboard', async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn() } });
    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    await waitFor(() => expect(screen.getByText('https://api.example.com/data')).toBeInTheDocument());

    const copyBtns = screen.getAllByTitle('Copy Payload');
    fireEvent.click(copyBtns[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify({"data": "mocked"}, null, 2));

    fireEvent.click(copyBtns[1]);
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('');
  });

  it('handles invalid json and plain text mock responses in formatJsonString', async () => {
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      if (keys.includes('responseOverridesEnabled')) {
        cb({ responseOverridesEnabled: true });
      } else if (keys.includes('responseOverrides')) {
        cb({
          responseOverrides: [
            {
              id: 'mock-invalid',
              matchUrl: 'https://api.example.com/invalid',
              mockResponse: '{"invalid json',
              active: true,
            },
            {
              id: 'mock-plain',
              matchUrl: 'https://api.example.com/plain',
              mockResponse: 'plain text',
              active: true,
            },
          ],
        });
      } else {
        cb({});
      }
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));

    await waitFor(() => {
      expect(screen.getByText('{"invalid json')).toBeInTheDocument();
      expect(screen.getByText('plain text')).toBeInTheDocument();
    });

    // Start editing one of them to cover startEditing formatting fallback
    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(screen.getByDisplayValue('{"invalid json')).toBeInTheDocument();
  });

  it('returns early if no chrome.storage', () => {
    const originalStorage = global.chrome.storage;
    global.chrome.storage = undefined;
    const { container } = render(<ResponseOverridesApp />);
    expect(container).toBeInTheDocument();
    global.chrome.storage = originalStorage;
  });

  it('handles invalid recent requests URL parsing', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        cb({
          requests: [
            { url: 'not-a-valid-url', method: 'GET', statusCode: 200 },
          ],
        });
      }
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    fireEvent.click(screen.getByText('View Recent Requests to Mock...'));

    await waitFor(() => {
      expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
    });
  });

  it('handles invalid json payloads', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        cb({
          requests: [
            { url: 'https://test.com/invalid-json', method: 'POST', statusCode: 200, requestBody: '{ invalid: json ' },
          ],
        });
      }
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    fireEvent.click(screen.getByText('View Recent Requests to Mock...'));

    await waitFor(() => {
      expect(screen.getByText('https://test.com/invalid-json')).toBeInTheDocument();
    });
  });

  it('updates overrides when chrome.storage.onChanged fires', async () => {
    let storageListener;
    global.chrome.storage.onChanged.addListener.mockImplementation((listener) => {
      storageListener = listener;
    });

    const { unmount } = render(<ResponseOverridesApp />);

    fireEvent.click(screen.getByText('Response Interceptor'));

    await waitFor(() => {
      expect(screen.getByText('https://api.example.com/data')).toBeInTheDocument();
    });

    act(() => {
      storageListener(
        {
          responseOverrides: {
            newValue: [
              {
                id: 'mock-changed',
                matchUrl: 'https://changed.url',
                mockResponse: '{"status": "ok"}',
                active: true,
              },
            ],
          },
        },
        'local'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('https://changed.url')).toBeInTheDocument();
      expect(screen.queryByText('https://api.example.com/data')).not.toBeInTheDocument();
    });

    act(() => {
      storageListener(
        {
          responseOverrides: {
            newValue: undefined,
          },
        },
        'local'
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('https://changed.url')).not.toBeInTheDocument();
    });

    // Trigger onChanged with other namespace and empty changes to cover line 87 false branch
    act(() => {
      storageListener({}, 'sync');
    });

    unmount();
    expect(global.chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(storageListener);
  });

  it('covers loadRecentRequests url origin parsing and error handling', async () => {
    global.chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([{ id: 123, url: 'https://test-origin.com/some/path?param=1' }]);
    });

    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        expect(msg.tabId).toBe(123);
        expect(msg.origin).toBe('https://test-origin.com');
        cb({ requests: [] });
      }
    });

    const { rerender } = render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    fireEvent.click(screen.getByText('View Recent Requests to Mock...'));

    await waitFor(() => {
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    jest.clearAllMocks();
    global.chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([{ id: 456, url: 'invalid-url-string' }]);
    });

    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        expect(msg.tabId).toBe(456);
        expect(msg.origin).toBe('');
        cb({ requests: [] });
      }
    });

    rerender(<ResponseOverridesApp />);
  });

  it('can edit body match and cancel template creation', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        cb({
          requests: [
            { id: 'req-graphql', url: 'https://graphql.example.com', method: 'POST' },
          ],
        });
      }
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    fireEvent.click(screen.getByText('View Recent Requests to Mock...'));

    await waitFor(() => {
      expect(screen.getByText('https://graphql.example.com')).toBeInTheDocument();
    });

    const mockBtns = screen.getAllByText('Mock');
    fireEvent.click(mockBtns[0]);

    const bodyMatchInput = screen.getByPlaceholderText(/e.g. "operationName":"MyMutation"/);
    expect(bodyMatchInput).toBeInTheDocument();

    fireEvent.change(bodyMatchInput, { target: { value: 'operationName' } });
    expect(bodyMatchInput).toHaveValue('operationName');

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Target Route')).not.toBeInTheDocument();
  });

  it('filters recent captured requests by type (GraphQL and JSON)', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      if (msg.type === 'GET_RECENT_REQUESTS') {
        cb({
          requests: [
            { id: '1', url: 'https://test.com/graphql-req', method: 'POST', operationName: 'MyQuery', statusCode: 500 },
            { id: '2', url: 'https://test.com/json-req', method: 'GET', contentType: 'application/json', statusCode: 302 },
            { id: '3', url: 'https://test.com/other-req', method: 'GET', statusCode: 400 },
          ],
        });
      }
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    fireEvent.click(screen.getByText('View Recent Requests to Mock...'));

    await waitFor(() => {
      expect(screen.getByText('https://test.com/graphql-req')).toBeInTheDocument();
      expect(screen.getByText('https://test.com/json-req')).toBeInTheDocument();
      expect(screen.getByText('https://test.com/other-req')).toBeInTheDocument();
    });

    const graphqlBtn = screen.getByRole('button', { name: 'GraphQL' });
    fireEvent.click(graphqlBtn);
    expect(screen.getByText('https://test.com/graphql-req')).toBeInTheDocument();
    expect(screen.queryByText('https://test.com/json-req')).not.toBeInTheDocument();
    expect(screen.queryByText('https://test.com/other-req')).not.toBeInTheDocument();

    fireEvent.click(graphqlBtn);
    expect(screen.getByText('https://test.com/json-req')).toBeInTheDocument();

    const jsonBtn = screen.getByRole('button', { name: 'JSON' });
    fireEvent.click(jsonBtn);
    expect(screen.getByText('https://test.com/json-req')).toBeInTheDocument();
    expect(screen.queryByText('https://test.com/graphql-req')).not.toBeInTheDocument();
    expect(screen.queryByText('https://test.com/other-req')).not.toBeInTheDocument();

    fireEvent.click(jsonBtn);
    expect(screen.getByText('https://test.com/other-req')).toBeInTheDocument();

    // 5xx status code filter
    const status5xxBtn = screen.getByRole('button', { name: '5xx Error' });
    fireEvent.click(status5xxBtn);
    expect(screen.getByText('https://test.com/graphql-req')).toBeInTheDocument();
    expect(screen.queryByText('https://test.com/json-req')).not.toBeInTheDocument();
    expect(screen.queryByText('https://test.com/other-req')).not.toBeInTheDocument();
    fireEvent.click(status5xxBtn);

    // Any Error status code filter
    const anyErrorBtn = screen.getByRole('button', { name: 'Any Error' });
    fireEvent.click(anyErrorBtn);
    expect(screen.getByText('https://test.com/graphql-req')).toBeInTheDocument();
    expect(screen.getByText('https://test.com/other-req')).toBeInTheDocument();
    expect(screen.queryByText('https://test.com/json-req')).not.toBeInTheDocument();
    fireEvent.click(anyErrorBtn);

    // 3xx Redirect status code filter
    const redirectBtn = screen.getByRole('button', { name: '3xx Redirect' });
    fireEvent.click(redirectBtn);
    expect(screen.getByText('https://test.com/json-req')).toBeInTheDocument();
    expect(screen.queryByText('https://test.com/graphql-req')).not.toBeInTheDocument();
    expect(screen.queryByText('https://test.com/other-req')).not.toBeInTheDocument();
    fireEvent.click(redirectBtn);

    // 2xx Success status code filter
    const successBtn = screen.getByRole('button', { name: '2xx Success' });
    fireEvent.click(successBtn);
    expect(screen.queryByText('https://test.com/json-req')).not.toBeInTheDocument();
    expect(screen.queryByText('https://test.com/graphql-req')).not.toBeInTheDocument();
    expect(screen.queryByText('https://test.com/other-req')).not.toBeInTheDocument();
    fireEvent.click(successBtn);
  });

  it('covers remaining edge cases: chrome.tabs is undefined, empty tabs array, falsy sendMessage response, undefined storage', async () => {
    // 1. chrome.tabs and chrome.storage are undefined on mount
    const originalTabs = global.chrome.tabs;
    const originalStorage = global.chrome.storage;
    const originalWindowStorage = window.chrome.storage;
    
    delete global.chrome.tabs;
    global.chrome.storage = undefined;
    window.chrome.storage = undefined;

    let renderResult;
    act(() => {
      renderResult = render(<ResponseOverridesApp />);
    });
    const { unmount } = renderResult;
    
    // Restore storage so operations function
    global.chrome.storage = originalStorage;
    window.chrome.storage = originalWindowStorage;

    fireEvent.click(screen.getByText('Response Interceptor'));
    
    // View recent requests button
    const toggleBtn = screen.getByText('View Recent Requests to Mock...');
    fireEvent.click(toggleBtn);

    // Verify message is not sent because chrome.tabs is undefined
    expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();

    // Restore chrome.tabs but mock it to return empty tabs array
    global.chrome.tabs = originalTabs;
    global.chrome.tabs.query.mockImplementationOnce((queryInfo, callback) => {
      callback([]);
    });

    // Toggle off then on to trigger loadRecentRequests again
    fireEvent.click(screen.getByText('Close Network Logs'));
    fireEvent.click(screen.getByText('View Recent Requests to Mock...'));
    expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();

    // Mock chrome.tabs.query to return a tab but mock runtime.sendMessage to return a falsy response
    global.chrome.tabs.query.mockImplementationOnce((queryInfo, callback) => {
      callback([{ id: 789, url: 'https://test.com' }]);
    });
    global.chrome.runtime.sendMessage.mockImplementationOnce((msg, cb) => {
      cb(null); // falsy response
    });

    // Toggle off then on
    fireEvent.click(screen.getByText('Close Network Logs'));
    fireEvent.click(screen.getByText('View Recent Requests to Mock...'));
    await waitFor(() => {
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    // Mock chrome.tabs.query to return a tab and runtime.sendMessage to return requests
    global.chrome.tabs.query.mockImplementationOnce((queryInfo, callback) => {
      callback([{ id: 789, url: 'https://test.com' }]);
    });
    global.chrome.runtime.sendMessage.mockImplementationOnce((msg, cb) => {
      cb({
        requests: [
          { id: 'req-1', url: 'https://test.com/api', method: 'GET' },
        ],
      });
    });

    // Toggle off then on
    fireEvent.click(screen.getByText('Close Network Logs'));
    fireEvent.click(screen.getByText('View Recent Requests to Mock...'));

    await waitFor(() => {
      expect(screen.getByText('https://test.com/api')).toBeInTheDocument();
    });

    // Click mock button to open the Save Response Mock form
    const mockBtns = screen.getAllByText('Mock');
    fireEvent.click(mockBtns[0]);

    // Verify dialog opened
    expect(screen.getByText('Target Route')).toBeInTheDocument();

    // Test early exit on empty mockResponse in addOverride
    fireEvent.change(screen.getByTestId('json-editor'), {
      target: { value: '   ' },
    });

    const addBtnEmpty = screen.getByText('Save Response Mock');
    fireEvent.click(addBtnEmpty);
    expect(global.chrome.storage.local.set).not.toHaveBeenCalled();

    // Now fill it in properly
    fireEvent.change(screen.getByTestId('json-editor'), {
      target: { value: '{}' },
    });

    // 2. chrome.storage is undefined
    global.chrome.storage = undefined;
    window.chrome.storage = undefined;

    // Save the mock (calls addOverride -> updateOverrides -> chrome.storage undefined)
    const addBtn = screen.getByText('Save Response Mock');
    fireEvent.click(addBtn);

    // Restore storage
    global.chrome.storage = originalStorage;
    window.chrome.storage = originalWindowStorage;

    // 3. chrome.storage.onChanged is undefined on mount
    const originalOnChanged = global.chrome.storage.onChanged;
    global.chrome.storage.onChanged = undefined;
    if (window.chrome && window.chrome.storage) {
      window.chrome.storage.onChanged = undefined;
    }

    let renderResult2;
    act(() => {
      renderResult2 = render(<ResponseOverridesApp />);
    });
    renderResult2.unmount();

    // Restore onChanged
    global.chrome.storage.onChanged = originalOnChanged;
    if (window.chrome && window.chrome.storage) {
      window.chrome.storage.onChanged = originalOnChanged;
    }

    unmount();
  });

  it('handles empty result from storage on mount', async () => {
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      cb({});
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));

    await waitFor(() => {
      expect(screen.queryByText('https://api.example.com/data')).not.toBeInTheDocument();
    });
  });

  it('renders a warning banner when response overrides are disabled, and allows enabling inline', async () => {
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      if (keys.includes('responseOverridesEnabled')) {
        cb({ responseOverridesEnabled: false });
      } else {
        cb({});
      }
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));

    await waitFor(() => {
      expect(screen.getByText('Response overrides are disabled. Enable them to activate mocks.')).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText('Toggle Response Overrides Inline');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ responseOverridesEnabled: true });
  });

  it('calls propSetEnabled if provided', () => {
    const propSetEnabledMock = jest.fn();
    render(
      <ResponseOverridesApp
        responseOverridesEnabled={false}
        setResponseOverridesEnabled={propSetEnabledMock}
      />
    );
    fireEvent.click(screen.getByText('Response Interceptor'));
    const toggle = screen.getByLabelText('Toggle Response Overrides Inline');
    fireEvent.click(toggle);
    expect(propSetEnabledMock).toHaveBeenCalledWith(true);
  });

  it('updates inline state when storage changes responseOverridesEnabled', async () => {
    const testListeners = [];
    global.chrome.storage.onChanged.addListener.mockImplementation((listener) => {
      testListeners.push(listener);
    });

    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));

    await waitFor(() => {
      expect(screen.getByText('Response overrides are disabled. Enable them to activate mocks.')).toBeInTheDocument();
    });

    act(() => {
      testListeners.forEach(l => l({
        responseOverridesEnabled: {
          newValue: true
        }
      }, 'local'));
    });

    expect(screen.queryByText('Response overrides are disabled. Enable them to activate mocks.')).not.toBeInTheDocument();

    act(() => {
      // Trigger with non-local namespace
      testListeners.forEach(l => l({
        responseOverridesEnabled: {
          newValue: true
        }
      }, 'sync'));
      // Trigger with missing responseOverridesEnabled key
      testListeners.forEach(l => l({
        someOtherKey: {
          newValue: true
        }
      }, 'local'));
    });

    expect(screen.queryByText('Response overrides are disabled. Enable them to activate mocks.')).not.toBeInTheDocument();

    act(() => {
      testListeners.forEach(l => l({
        responseOverridesEnabled: {
          newValue: undefined
        }
      }, 'local'));
    });

    expect(screen.getByText('Response overrides are disabled. Enable them to activate mocks.')).toBeInTheDocument();
  });

  it('toggles inline and handles falsy storage', () => {
    const originalStorage = global.chrome.storage;
    global.chrome.storage = undefined;
    render(<ResponseOverridesApp />);
    fireEvent.click(screen.getByText('Response Interceptor'));
    const toggle = screen.getByLabelText('Toggle Response Overrides Inline');
    fireEvent.click(toggle);
    expect(screen.queryByLabelText('Toggle Response Overrides Inline')).not.toBeInTheDocument();
    global.chrome.storage = originalStorage;
  });
});

