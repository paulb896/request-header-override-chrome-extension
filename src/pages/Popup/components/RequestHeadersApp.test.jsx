import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestHeadersApp from './RequestHeadersApp';

let mockAddHeader;
jest.mock('./AddRequestHeaderForm', () => {
  const Actual = jest.requireActual('./AddRequestHeaderForm').default;
  return function MockAddRequestHeaderForm(props) {
    mockAddHeader = props.addHeader;
    return <Actual {...props} />;
  };
});

describe('RequestHeadersApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome.storage.local.get.mockImplementation((keys, cb) => {
      const data = {
        requestHeaders: JSON.stringify([
          { id: 1, name: 'X-Mock-Header', value: '123', overrideType: 'header', enabled: true },
          { id: 2, name: 'X-Mock-2', value: '456', overrideType: 'header', enabled: false },
          { id: 3, name: 'X-Mock-3', value: '789', enabled: true }
        ]),
      };
      if (cb) cb(data);
      return Promise.resolve(data);
    });
    global.chrome.storage.local.set.mockImplementation((data, cb) => {
      if (cb) cb();
      return Promise.resolve();
    });
  });

  it('renders correctly', async () => {
    await act(async () => { render(<RequestHeadersApp />); });
    expect(await screen.findByText('X-Mock-Header')).toBeInTheDocument();
  });

  it('toggles header enabled state', async () => {
    await act(async () => { render(<RequestHeadersApp />); });
    const toggleButtons = await screen.findAllByRole('checkbox');
    
    // Toggle first from true -> false
    fireEvent.click(toggleButtons[0]);
    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    
    // Toggle second from false -> true
    fireEvent.click(toggleButtons[1]);
    expect(global.chrome.storage.local.set).toHaveBeenCalledTimes(2);
  });


  it('edits a header', async () => {
    await act(async () => { render(<RequestHeadersApp />); });
    const editButtons = await screen.findAllByRole('button', { name: /Edit/i });
    fireEvent.click(editButtons[0]);
    const saveButton = await screen.findByRole('button', { name: /Save/i });
    fireEvent.click(saveButton);
    expect(global.chrome.storage.local.set).toHaveBeenCalled();
  });

  it('enables all headers', async () => {
    await act(async () => { render(<RequestHeadersApp />); });
    const enableAllBtn = await screen.findByRole('button', { name: /Enable All/i });
    fireEvent.click(enableAllBtn);
    expect(global.chrome.storage.local.set).toHaveBeenCalled();
  });
  
  it('disables all headers', async () => {
    await act(async () => { render(<RequestHeadersApp />); });
    const disableAllBtn = await screen.findByRole('button', { name: /Disable All/i });
    fireEvent.click(disableAllBtn);
    expect(global.chrome.storage.local.set).toHaveBeenCalled();
  });

  it('adds a new header', async () => {
    await act(async () => { render(<RequestHeadersApp />); });
    
    // Fill out AddRequestHeaderForm
    const nameInput = screen.getByPlaceholderText(/Header \/ Parameter Name/i);
    fireEvent.change(nameInput, { target: { value: 'New-Header' } });
    
    const valueInput = screen.getByPlaceholderText(/Value/i);
    fireEvent.change(valueInput, { target: { value: 'New-Value' } });
    
    const form = screen.getByRole('button', { name: /Add Parameter Override/i }).closest('form');
    fireEvent.submit(form);
    
    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    const setArgs = global.chrome.storage.local.set.mock.calls[0][0];
    const newHeaders = JSON.parse(setArgs.requestHeaders);
    expect(newHeaders.length).toBe(4);
    expect(newHeaders[0].name).toBe('New-Header');
  });


  it('deletes a header', async () => {
    await act(async () => { render(<RequestHeadersApp />); });
    const deleteButtons = await screen.findAllByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButtons[0]);
    expect(global.chrome.storage.local.set).toHaveBeenCalled();
  });

  it('handles addHeader with undefined overrideType', async () => {
    await act(async () => { render(<RequestHeadersApp />); });
    
    await act(async () => {
      mockAddHeader('Header-Undefined', 'Val-Undefined');
    });
    
    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    const setArgs = global.chrome.storage.local.set.mock.calls[0][0];
    const newHeaders = JSON.parse(setArgs.requestHeaders);
    const added = newHeaders.find(h => h.name === 'Header-Undefined');
    expect(added).toBeDefined();
    expect(added.overrideType).toBe('header');
  });
});

