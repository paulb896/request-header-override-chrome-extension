import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestHeader from './RequestHeader';

describe('RequestHeader', () => {
  const defaultProps = {
    id: '123',
    name: 'X-Custom-Header',
    value: 'my-value',
    'url-regex': '*google*',
    overrideType: 'header',
    enabled: true,
    toggleHeaderEnabled: jest.fn(),
    deleteHeader: jest.fn(),
    editHeader: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly in view mode', () => {
    render(<RequestHeader {...defaultProps} />);

    expect(screen.getByText('X-Custom-Header')).toBeInTheDocument();
    expect(screen.getByText('my-value')).toBeInTheDocument();
    expect(screen.getByText('*google*')).toBeInTheDocument();
    expect(screen.getByText('Header')).toBeInTheDocument(); // Badge
  });

  it('calls toggleHeaderActive when the toggle switch is clicked', () => {
    render(<RequestHeader {...defaultProps} />);

    // The toggle is an input checkbox
    const toggle = screen.getByRole('checkbox');
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    expect(defaultProps.toggleHeaderEnabled).toHaveBeenCalledWith('123');
  });

  it('calls deleteHeader when delete button is clicked', () => {
    render(<RequestHeader {...defaultProps} />);

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);
    expect(defaultProps.deleteHeader).toHaveBeenCalledWith('123');
  });

  it('enters edit mode when Edit is clicked', () => {
    render(<RequestHeader {...defaultProps} />);

    const editBtn = screen.getByText('Edit');
    fireEvent.click(editBtn);

    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue(
      'X-Custom-Header'
    );
    expect(screen.getByRole('textbox', { name: /value/i })).toHaveValue(
      'my-value'
    );
    expect(screen.getByRole('textbox', { name: /url/i })).toHaveValue(
      '*google*'
    );
  });

  it('saves changes and exits edit mode', () => {
    render(<RequestHeader {...defaultProps} />);

    fireEvent.click(screen.getByText('Edit'));

    const nameInput = screen.getByRole('textbox', { name: /name/i });
    fireEvent.change(nameInput, { target: { value: 'X-New-Header' } });

    const valueInput = screen.getByRole('textbox', { name: /value/i });
    fireEvent.change(valueInput, { target: { value: 'new-value' } });

    const urlRegexInput = screen.getByRole('textbox', { name: /url/i });
    fireEvent.change(urlRegexInput, { target: { value: '*test*' } });

    const queryRadio = screen.getByLabelText('Query Param');
    fireEvent.click(queryRadio);

    fireEvent.click(screen.getByText('Save'));

    expect(defaultProps.editHeader).toHaveBeenCalledWith(
      '123',
      'X-New-Header',
      'new-value',
      '*test*',
      'requestQueryParam'
    );
  });

  it('cancels edit mode without saving', () => {
    render(<RequestHeader {...defaultProps} />);

    fireEvent.click(screen.getByText('Edit'));

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(defaultProps.editHeader).not.toHaveBeenCalled();
    // Verify we are back to view mode
    expect(
      screen.queryByRole('textbox', { name: /name/i })
    ).not.toBeInTheDocument();
  });
  it('toggles header when name is clicked', () => {
    render(<RequestHeader {...defaultProps} />);
    const nameElement = screen.getByText('X-Custom-Header');
    fireEvent.click(nameElement);
    expect(defaultProps.toggleHeaderEnabled).toHaveBeenCalledWith('123');
  });

  it('renders Query Param badge and handles empty value copy', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    });

    render(<RequestHeader {...defaultProps} overrideType="requestQueryParam" value="" />);
    expect(screen.getByText('Query Param')).toBeInTheDocument();
    
    const copyBtn = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
  });

  it('does not save edit if name is empty', () => {
    render(<RequestHeader {...defaultProps} />);
    const editButton = screen.getByRole('button', { name: /Edit/i });
    fireEvent.click(editButton);
    
    const nameInput = screen.getByDisplayValue("X-Custom-Header");
    fireEvent.change(nameInput, { target: { value: '   ' } });
    
    const saveButton = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveButton);
    
    expect(defaultProps.editHeader).not.toHaveBeenCalled();
  });
});
