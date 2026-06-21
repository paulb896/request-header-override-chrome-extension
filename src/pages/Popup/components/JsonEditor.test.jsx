import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import JsonEditor from './JsonEditor';

// Mock CodeMirror since it's hard to test directly
jest.mock('@uiw/react-codemirror', () => {
  return function MockCodeMirror({ value, onChange }) {
    return (
      <textarea
        data-testid="codemirror-mock"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  };
});

describe('JsonEditor', () => {
  test('renders without crashing', () => {
    render(<JsonEditor value="{}" onChange={() => {}} />);
    expect(screen.getByTestId('codemirror-mock')).toBeInTheDocument();
  });

  test('calls onChange when value changes', () => {
    const handleChange = jest.fn();
    render(<JsonEditor value="" onChange={handleChange} />);
    
    const textarea = screen.getByTestId('codemirror-mock');
    fireEvent.change(textarea, { target: { value: '{"a": 1}' } });
    
    expect(handleChange).toHaveBeenCalledWith('{"a": 1}');
  });

  test('does not error if onChange is not provided', () => {
    render(<JsonEditor value="" />);
    const textarea = screen.getByTestId('codemirror-mock');
    fireEvent.change(textarea, { target: { value: '{"a": 1}' } });
    // Should not throw
  });

  test('displays valid JSON indicator', () => {
    render(<JsonEditor value='{"valid": true}' onChange={() => {}} />);
    expect(screen.getByText('Valid JSON')).toBeInTheDocument();
  });

  test('displays invalid JSON indicator', () => {
    render(<JsonEditor value='{"invalid": true' onChange={() => {}} />);
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
  });

  test('formats JSON when format button is clicked', () => {
    const handleChange = jest.fn();
    render(<JsonEditor value='{"a":1}' onChange={handleChange} />);
    
    const formatBtn = screen.getByTitle('Format JSON');
    fireEvent.click(formatBtn);
    
    expect(handleChange).toHaveBeenCalledWith('{\n  "a": 1\n}');
  });

  test('does not format invalid JSON when format button is clicked', () => {
    const handleChange = jest.fn();
    render(<JsonEditor value='{"a":1' onChange={handleChange} />);
    
    const formatBtn = screen.getByTitle('Format JSON');
    fireEvent.click(formatBtn);
    
    expect(handleChange).not.toHaveBeenCalled();
  });
});
