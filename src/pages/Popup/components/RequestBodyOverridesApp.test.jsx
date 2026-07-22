import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestBodyOverridesApp from './RequestBodyOverridesApp';

describe('RequestBodyOverridesApp Component', () => {
  const mockOverrides = [
    {
      id: 'rule-1',
      matchUrl: '/api/checkout',
      matchRequestBody: '"operationName":"SkateCheckoutPreloadUrlCreate"',
      overrideRequestBody: '{"mocked":"request"}',
      active: true,
    },
  ];

  let listeners = [];

  beforeEach(() => {
    listeners = [];
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys, cb) => {
            if (keys.includes('requestBodyOverrides')) {
              cb({
                requestBodyOverrides: [...mockOverrides],
                requestBodyOverridesEnabled: true,
              });
            } else {
              cb({});
            }
          }),
          set: jest.fn((data, cb) => {
            cb && cb();
            listeners.forEach((l) =>
              l(
                {
                  requestBodyOverrides: { newValue: data.requestBodyOverrides },
                  requestBodyOverridesEnabled: { newValue: data.requestBodyOverridesEnabled },
                },
                'local'
              )
            );
          }),
        },
        onChanged: {
          addListener: jest.fn((l) => listeners.push(l)),
          removeListener: jest.fn((l) => {
            listeners = listeners.filter((fn) => fn !== l);
          }),
        },
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders overrides list and form', async () => {
    render(<RequestBodyOverridesApp />);

    expect(screen.getByText('Enable Request Body Overrides')).toBeInTheDocument();
    expect(screen.getByText('Add Request Body Override Rule')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('/api/checkout')).toBeInTheDocument();
    });
    expect(screen.getByText('"operationName":"SkateCheckoutPreloadUrlCreate"')).toBeInTheDocument();
    expect(screen.getByText('{"mocked":"request"}')).toBeInTheDocument();
  });

  test('enables/disables overrides toggle', async () => {
    const setEnabledMock = jest.fn();
    render(<RequestBodyOverridesApp requestBodyOverridesEnabled={true} setRequestBodyOverridesEnabled={setEnabledMock} />);

    const toggle = screen.getByTestId('toggle-request-body-overrides');
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(setEnabledMock).toHaveBeenCalledWith(false);
    });
  });

  test('adds a new request body override', async () => {
    render(<RequestBodyOverridesApp />);

    fireEvent.change(screen.getByTestId('add-match-url-input'), {
      target: { value: '/api/test' },
    });
    fireEvent.change(screen.getByTestId('add-match-body-input'), {
      target: { value: '{"action":"buy"}' },
    });
    fireEvent.change(screen.getByTestId('add-override-body-input'), {
      target: { value: '{"action":"mocked"}' },
    });

    fireEvent.click(screen.getByText('Add Override Rule'));

    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    const setCall = chrome.storage.local.set.mock.calls.find(
      (c) => c[0].requestBodyOverrides !== undefined
    );
    expect(setCall[0].requestBodyOverrides.length).toBe(2);
    expect(setCall[0].requestBodyOverrides[0].matchUrl).toBe('/api/test');
  });

  test('deletes an override rule', async () => {
    render(<RequestBodyOverridesApp />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal-confirm')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    const setCall = chrome.storage.local.set.mock.calls.find(
      (c) => c[0].requestBodyOverrides !== undefined
    );
    expect(setCall[0].requestBodyOverrides.length).toBe(0);
  });

  test('edits an override rule', async () => {
    render(<RequestBodyOverridesApp />);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit'));

    // Input fields should now contain edit values
    const urlInput = screen.getByTestId('edit-match-url-input');
    const bodyInput = screen.getByTestId('edit-match-body-input');
    const overrideInput = screen.getByTestId('edit-override-body-input');

    expect(urlInput).toHaveValue('/api/checkout');
    expect(bodyInput).toHaveValue('"operationName":"SkateCheckoutPreloadUrlCreate"');
    expect(overrideInput).toHaveValue('{"mocked":"request"}');

    fireEvent.change(urlInput, { target: { value: '/api/updated' } });
    fireEvent.change(overrideInput, { target: { value: '{"mocked":"updated"}' } });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    const setCall = chrome.storage.local.set.mock.calls.find(
      (c) => c[0].requestBodyOverrides !== undefined
    );
    expect(setCall[0].requestBodyOverrides[0].matchUrl).toBe('/api/updated');
    expect(setCall[0].requestBodyOverrides[0].overrideRequestBody).toBe('{"mocked":"updated"}');
  });

  test('toggles an override rule on/off', async () => {
    render(<RequestBodyOverridesApp />);
    await waitFor(() => {
      expect(screen.getByText('/api/checkout')).toBeInTheDocument();
    });

    const toggle = screen.getByLabelText('Toggle active for /api/checkout');
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      const setCall = chrome.storage.local.set.mock.calls.find(
        (c) => c[0].requestBodyOverrides !== undefined
      );
      expect(setCall[0].requestBodyOverrides[0].active).toBe(false);
    });
  });

  test('cancels editing an override', async () => {
    render(<RequestBodyOverridesApp />);
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('edit-match-url-input')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('edit-match-url-input')).not.toBeInTheDocument();
  });

  test('cancels deleting an override', async () => {
    render(<RequestBodyOverridesApp />);
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByTestId('confirm-modal-cancel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-modal-cancel'));
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('does not add override if required fields are empty', async () => {
    render(<RequestBodyOverridesApp />);
    fireEvent.click(screen.getByText('Add Override Rule'));
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('does not save edit if required fields are empty', async () => {
    render(<RequestBodyOverridesApp />);
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByTestId('edit-match-url-input'), { target: { value: ' ' } });
    fireEvent.click(screen.getByText('Save Changes'));
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('shows empty state when no overrides exist', async () => {
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      cb({ requestBodyOverrides: [] });
    });
    render(<RequestBodyOverridesApp />);
    await waitFor(() => {
      expect(screen.getByText('No Request Body Overrides configured. Add one above.')).toBeInTheDocument();
    });
  });

  test('handles no chrome storage gracefully', () => {
    delete global.chrome.storage;
    render(<RequestBodyOverridesApp />);
    expect(screen.getByText('Enable Request Body Overrides')).toBeInTheDocument();
    const toggle = screen.getByTestId('toggle-request-body-overrides');
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });

  test('updates on external storage change', async () => {
    render(<RequestBodyOverridesApp />);
    await waitFor(() => {
      expect(screen.getByText('/api/checkout')).toBeInTheDocument();
    });

    const newOverrides = [{ ...mockOverrides[0], matchUrl: '/api/new' }];
    act(() => {
      listeners.forEach(l => l({ requestBodyOverrides: { newValue: newOverrides } }, 'local'));
    });

    await waitFor(() => {
      expect(screen.getByText('/api/new')).toBeInTheDocument();
    });
  });

  test('handles local state toggle when propSetEnabled is not provided', async () => {
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      cb({ requestBodyOverridesEnabled: false });
    });
    render(<RequestBodyOverridesApp />);
    const toggle = screen.getByTestId('toggle-request-body-overrides');
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ requestBodyOverridesEnabled: true });
  });

  test('handles storage listener for enabled state', async () => {
    render(<RequestBodyOverridesApp />);

    act(() => {
      listeners.forEach(l => l({ requestBodyOverridesEnabled: { newValue: true } }, 'local'));
    });

    await waitFor(() => {
      const toggle = screen.getByTestId('toggle-request-body-overrides');
      expect(toggle).toBeChecked();
    });
  });
});
