import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import InspectorPanel from './InspectorPanel';

// Mock JsonEditor component
jest.mock('./JsonEditor', () => {
  return function MockJsonEditor({ value, onChange }) {
    return (
      <div data-testid="json-editor">
        <textarea 
          data-testid="json-editor-textarea"
          value={value} 
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  };
});

describe('InspectorPanel Component', () => {
  const mockSelectedRequest = {
    url: 'https://example.com/api/test?q=1',
    method: 'GET',
    requestHeaders: [{ name: 'Authorization', value: 'Bearer token' }],
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    requestBody: '{"req":"body"}',
    response: '{"res":"body"}',
    statusCode: 200,
    timestamp: 1000,
    contentType: 'application/json'
  };

  const mockOverrides = [
    {
      id: 'override-1',
      matchUrl: '/api/test?q=1',
      mockResponse: '{"mocked":"true"}'
    }
  ];

  let listeners = [];

  beforeEach(() => {
    jest.useFakeTimers();
    listeners = [];
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys, cb) => {
            if (keys.includes('responseOverrides')) {
              cb({ responseOverrides: [...mockOverrides] });
            } else {
              cb({});
            }
          }),
          set: jest.fn((data, cb) => {
            cb && cb();
            listeners.forEach(l => l({ responseOverrides: { newValue: data.responseOverrides } }, 'local'));
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
    jest.useRealTimers();
  });

  test('renders nothing if no selectedRequest', () => {
    render(<InspectorPanel selectedRequest={null} onClose={jest.fn()} />);
    expect(screen.getByText('No Request Selected')).toBeInTheDocument();
  });

  test('renders correctly with selected request', async () => {
    render(<InspectorPanel selectedRequest={mockSelectedRequest} onClose={jest.fn()} />);
    
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/api/test?q=1')).toBeInTheDocument();
    expect(screen.getByText('Headers')).toBeInTheDocument();
    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByText('Payload')).toBeInTheDocument();
  });

  test('switches tabs correctly', () => {
    render(<InspectorPanel selectedRequest={mockSelectedRequest} onClose={jest.fn()} />);
    
    // Initially payload tab is active
    expect(screen.getByText(/Mock Active/i)).toBeInTheDocument();
    
    // Switch to Request Body
    fireEvent.click(screen.getByText('Request'));
    expect(screen.getByTestId('json-editor')).toBeInTheDocument();
    
    // Switch to Headers
    fireEvent.click(screen.getByText('Headers'));
    expect(screen.getByText('Request Headers')).toBeInTheDocument();

    // Switch back to Payload
    fireEvent.click(screen.getByText('Payload'));
    expect(screen.getByText(/Mock Active/i)).toBeInTheDocument();
  });

  test('displays mock status if URL is matched', async () => {
    render(<InspectorPanel selectedRequest={mockSelectedRequest} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Payload'));
    
    await waitFor(() => {
      expect(screen.getByText(/Mock Active/i)).toBeInTheDocument();
    });
  });

  test('saves mock correctly when Save Mock button is clicked', async () => {
    render(<InspectorPanel selectedRequest={mockSelectedRequest} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Payload'));
    
    // Edit response in mock JSON editor
    await waitFor(() => {
      expect(screen.getAllByTestId('json-editor-textarea')[0]).toBeInTheDocument();
    });
    const textarea = screen.getAllByTestId('json-editor-textarea')[0];
    fireEvent.change(textarea, { target: { value: '{"new":"mock"}' } });
    
    // Click Save
    const saveBtn = screen.getByText('Update Mock Response');
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
    
    // Check saved state text
    expect(screen.getByText('Saved Successfully! ✓')).toBeInTheDocument();
    
    // Trigger save again quickly to cover clearTimeout
    fireEvent.click(saveBtn);
    
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    
    expect(screen.queryByText('Saved Successfully! ✓')).not.toBeInTheDocument();
    expect(screen.getByText('Update Mock Response')).toBeInTheDocument();
  });

  test('saves new mock if no match exists', async () => {
    const newRequest = { ...mockSelectedRequest, url: 'https://example.com/api/new' };
    render(<InspectorPanel selectedRequest={newRequest} onClose={jest.fn()} />);
    
    fireEvent.click(screen.getByText('Payload'));
    
    await waitFor(() => {
      expect(screen.getAllByTestId('json-editor-textarea')[0]).toBeInTheDocument();
    });
    const textarea = screen.getAllByTestId('json-editor-textarea')[0];
    fireEvent.change(textarea, { target: { value: '{"fresh":"mock"}' } });
    
    fireEvent.click(screen.getByText('Mock this Response'));
    
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
    
    const setCallArgs = chrome.storage.local.set.mock.calls[0][0];
    expect(setCallArgs.responseOverrides.length).toBe(2);
    expect(setCallArgs.responseOverrides[0].matchUrl).toBe('/api/new');
  });

  test('removes mock correctly by id', async () => {
    render(<InspectorPanel selectedRequest={mockSelectedRequest} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Payload'));
    
    await waitFor(() => {
      expect(screen.getByText(/Mock Active/i)).toBeInTheDocument();
    });
    
    const removeBtn = screen.getByText('Delete Mock');
    fireEvent.click(removeBtn);
    
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
    
    const setCallArgs = chrome.storage.local.set.mock.calls[0][0];
    expect(setCallArgs.responseOverrides.length).toBe(0);
  });

  test('removes mock correctly by matchUrl fallback', async () => {
    // Override the mock storage to return an item without an id
    global.chrome.storage.local.get.mockImplementationOnce((keys, cb) => {
      cb({ responseOverrides: [{ matchUrl: '/api/test?q=1', mockResponse: '{}' }] });
    });
    
    render(<InspectorPanel selectedRequest={mockSelectedRequest} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Payload'));
    
    await waitFor(() => {
      expect(screen.getByText(/Mock Active/i)).toBeInTheDocument();
    });
    
    const removeBtn = screen.getByText('Delete Mock');
    fireEvent.click(removeBtn);
    
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
    
    // The set should be called with an empty array because it matches by matchUrl
    const setCallArgs = chrome.storage.local.set.mock.calls[0][0];
    expect(setCallArgs.responseOverrides.length).toBe(0);
  });

  test('calls onClose when close button is clicked', () => {
    const handleClose = jest.fn();
    const { container } = render(<InspectorPanel selectedRequest={mockSelectedRequest} onClose={handleClose} />);
    
    const closeBtn = container.querySelector('.btn-link');
    fireEvent.click(closeBtn);
    
    expect(handleClose).toHaveBeenCalled();
  });

  test('does not throw if invalid URL is provided', () => {
    const req = { ...mockSelectedRequest, url: 'invalid-url' };
    render(<InspectorPanel selectedRequest={req} onClose={jest.fn()} />);
    expect(screen.getByText('invalid-url')).toBeInTheDocument();
  });

  test('handles case where no headers are provided', () => {
    const req = { ...mockSelectedRequest, requestHeaders: null, responseHeaders: null };
    render(<InspectorPanel selectedRequest={req} onClose={jest.fn()} />);
    
    fireEvent.click(screen.getByText('Headers'));
    expect(screen.getByText('Request Headers')).toBeInTheDocument();
    expect(screen.getByText('No request headers recorded')).toBeInTheDocument();
    expect(screen.getByText('No response headers recorded')).toBeInTheDocument();
  });

  test('handles plain text payload editing', async () => {
    const plainTextReq = {
      ...mockSelectedRequest,
      url: 'https://example.com/api/plaintext',
      contentType: 'text/plain',
      response: 'some plain text'
    };
    render(<InspectorPanel selectedRequest={plainTextReq} onClose={jest.fn()} />);
    
    fireEvent.click(screen.getByText('Payload'));
    
    const textarea = screen.getByPlaceholderText('Response body text...');
    fireEvent.change(textarea, { target: { value: 'plain text' } });
    
    expect(textarea).toHaveValue('plain text');
  });

  test('handles invalid JSON starting with bracket or brace in formatJsonString', () => {
    const invalidJsonResReq = {
      ...mockSelectedRequest,
      url: 'https://example.com/api/invalid-json-res',
      response: '{"invalid json'
    };
    render(<InspectorPanel selectedRequest={invalidJsonResReq} onClose={jest.fn()} />);
    
    fireEvent.click(screen.getByText('Payload'));
    const textarea = screen.getByDisplayValue('{"invalid json');
    expect(textarea).toBeInTheDocument();
  });

  test('auto-detects JSON response when contentType does not specify json', () => {
    const jsonWithoutHeaderReq = {
      ...mockSelectedRequest,
      url: 'https://example.com/api/json-no-header',
      contentType: 'text/plain',
      response: '{"detected": true}'
    };
    render(<InspectorPanel selectedRequest={jsonWithoutHeaderReq} onClose={jest.fn()} />);
    
    fireEvent.click(screen.getByText('Payload'));
    expect(screen.getByTestId('json-editor')).toBeInTheDocument();
  });

  test('handles invalid json request body', () => {
    const invalidJsonReq = { ...mockSelectedRequest, requestBody: '{"invalid"' };
    render(<InspectorPanel selectedRequest={invalidJsonReq} onClose={jest.fn()} />);
    
    fireEvent.click(screen.getByText('Request'));
    
    // Fallbacks to plain textarea for invalid json
    const textarea = screen.getByDisplayValue('{"invalid"');
    expect(textarea).toBeInTheDocument();
  });

  test('clears active save status timeout when selectedRequest changes', async () => {
    const { rerender } = render(<InspectorPanel selectedRequest={mockSelectedRequest} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Payload'));
    
    await waitFor(() => {
      expect(screen.getAllByTestId('json-editor-textarea')[0]).toBeInTheDocument();
    });
    
    const saveBtn = screen.getByText('Update Mock Response');
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Saved Successfully! ✓')).toBeInTheDocument();
    });
    
    const anotherReq = { ...mockSelectedRequest, url: 'https://example.com/api/different' };
    rerender(<InspectorPanel selectedRequest={anotherReq} onClose={jest.fn()} />);
    
    act(() => {
      jest.advanceTimersByTime(2000);
    });
  });

  test('covers remaining edge case branches and full screen mode', async () => {
    const edgeCaseReq = {
      url: 'https://example.com/api/post-test',
      method: 'POST',
      requestHeaders: [],
      responseHeaders: [],
      requestBody: '',
      response: null,
      statusCode: 201,
      timestamp: 1500,
      contentType: null
    };

    const { rerender } = render(
      <InspectorPanel 
        selectedRequest={null} 
        onClose={jest.fn()} 
        isFullScreen={true} 
      />
    );
    expect(screen.getByText('No Request Selected')).toBeInTheDocument();

    rerender(
      <InspectorPanel 
        selectedRequest={edgeCaseReq} 
        onClose={jest.fn()} 
        isFullScreen={true} 
      />
    );

    expect(screen.getByText('https://example.com/api/post-test')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Payload'));

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Response body text...')[0]).toBeInTheDocument();
    });

    const textarea = screen.getAllByPlaceholderText('Response body text...')[0];
    fireEvent.change(textarea, { target: { value: '{"hello":"world"}' } });

    global.chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));

    const saveBtn = screen.getByRole('button', { name: /Mock this Response/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });

    const originalStorage = global.chrome.storage;
    const originalWindowStorage = window.chrome.storage;
    global.chrome.storage = undefined;
    window.chrome.storage = undefined;

    rerender(
      <InspectorPanel 
        selectedRequest={mockSelectedRequest} 
        onClose={jest.fn()} 
      />
    );
    
    const deleteBtn = screen.getByText('Delete Mock');
    fireEvent.click(deleteBtn);
    
    rerender(
      <InspectorPanel 
        selectedRequest={edgeCaseReq} 
        onClose={jest.fn()} 
      />
    );
    const mockBtn = screen.getByText('Update Mock Response');
    fireEvent.click(mockBtn);

    global.chrome.storage = originalStorage;
    window.chrome.storage = originalWindowStorage;

    // Rerender with statusCode >= 400 (covers line 230 branch)
    rerender(
      <InspectorPanel 
        selectedRequest={{ ...edgeCaseReq, statusCode: 400 }} 
        onClose={jest.fn()} 
      />
    );
    expect(screen.getByText('400')).toBeInTheDocument();

    // Rerender with statusCode = null (covers line 235 PENDING branch)
    rerender(
      <InspectorPanel 
        selectedRequest={{ ...edgeCaseReq, statusCode: null }} 
        onClose={jest.fn()} 
      />
    );
    expect(screen.getByText('PENDING')).toBeInTheDocument();

    // Rerender with requestBody starting with '[' (covers lines 446-448 branch)
    rerender(
      <InspectorPanel 
        selectedRequest={{ ...edgeCaseReq, requestBody: '[{"a":1}]' }} 
        onClose={jest.fn()} 
      />
    );
    fireEvent.click(screen.getByText('Request'));
    expect(screen.getByTestId('json-editor')).toBeInTheDocument();

    // Rerender with no requestBody (covers line 488 branch)
    rerender(
      <InspectorPanel 
        selectedRequest={{ ...edgeCaseReq, requestBody: null }} 
        onClose={jest.fn()} 
      />
    );
  });

  test('covers handleRemoveMock when matchedOverrideId is missing, url is invalid, and method is POST', async () => {
    const overrideWithoutIdPost = {
      matchUrl: '/api/post-test',
      mockResponse: '{"mocked":"true"}'
    };
    
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      cb({ responseOverrides: [overrideWithoutIdPost] });
    });

    const validPostReq = {
      url: 'https://example.com/api/post-test',
      method: 'POST',
      requestHeaders: [],
      responseHeaders: [],
      requestBody: null,
      response: null,
      statusCode: 200,
      timestamp: 1200,
      contentType: 'text/html'
    };

    const { rerender } = render(
      <InspectorPanel 
        selectedRequest={validPostReq} 
        onClose={jest.fn()} 
      />
    );

    fireEvent.click(screen.getByText('Payload'));

    await waitFor(() => {
      expect(screen.getByText('Delete Mock')).toBeInTheDocument();
    });

    const deleteBtnPost = screen.getByText('Delete Mock');
    fireEvent.click(deleteBtnPost);

    const overrideWithoutIdInvalid = {
      matchUrl: 'invalid-url',
      mockResponse: '{"mocked":"true"}'
    };
    
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      cb({ responseOverrides: [overrideWithoutIdInvalid] });
    });

    const badUrlReq = {
      url: 'invalid-url',
      method: 'GET',
      requestHeaders: [],
      responseHeaders: [],
      requestBody: null,
      response: null,
      statusCode: 200,
      timestamp: 1200,
      contentType: 'text/html'
    };

    rerender(
      <InspectorPanel 
        selectedRequest={badUrlReq} 
        onClose={jest.fn()} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Mock')).toBeInTheDocument();
    });

    global.chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));

    const deleteBtnInvalid = screen.getByText('Delete Mock');
    fireEvent.click(deleteBtnInvalid);

    await waitFor(() => {
      expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });
  });
});


