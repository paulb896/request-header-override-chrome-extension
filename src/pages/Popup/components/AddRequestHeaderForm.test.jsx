import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import AddRequestHeaderForm from './AddRequestHeaderForm';

describe('AddRequestHeaderForm', () => {
  it('does not submit if name is empty', () => {
    const addHeaderSpy = jest.fn();
    render(<AddRequestHeaderForm addHeader={addHeaderSpy} />);
    
    // Default name is empty, try submitting
    const form = screen.getByRole('button', { name: /Add Parameter Override/i }).closest('form');
    fireEvent.submit(form);
    
    expect(addHeaderSpy).not.toHaveBeenCalled();
  });

  it('updates overrideType on radio change', () => {
    const addHeaderSpy = jest.fn();
    render(<AddRequestHeaderForm addHeader={addHeaderSpy} />);
    
    // Change to query param
    const queryRadio = screen.getByLabelText('Query Parameter');
    fireEvent.click(queryRadio);
    expect(queryRadio).toBeChecked();
    
    // Change to header
    const headerRadio = screen.getByLabelText('Header Injection');
    fireEvent.click(headerRadio);
    expect(headerRadio).toBeChecked();
    
    // Fill out form
    const nameInput = screen.getByPlaceholderText(/Header \/ Parameter Name/i);
    fireEvent.change(nameInput, { target: { value: 'Foo' } });
    
    const valueInput = screen.getByPlaceholderText(/Value/i);
    fireEvent.change(valueInput, { target: { value: 'Bar' } });
    
    // Submit
    const form = screen.getByRole('button', { name: /Add Parameter Override/i }).closest('form');
    fireEvent.submit(form);
    
    expect(addHeaderSpy).toHaveBeenCalledWith('Foo', 'Bar', 'header');
  });
});
