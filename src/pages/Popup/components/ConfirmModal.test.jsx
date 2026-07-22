import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
  const onConfirmMock = jest.fn();
  const onCancelMock = jest.fn();

  beforeEach(() => {
    onConfirmMock.mockClear();
    onCancelMock.mockClear();
  });

  test('should not render when isOpen is false', () => {
    render(<ConfirmModal isOpen={false} onConfirm={onConfirmMock} onCancel={onCancelMock} />);
    expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
  });

  test('should render with default title and message when not provided', () => {
    render(<ConfirmModal isOpen={true} onConfirm={onConfirmMock} onCancel={onCancelMock} />);
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this? This action cannot be undone.')).toBeInTheDocument();
  });

  test('should render with provided title and message', () => {
    const title = 'Custom Title';
    const message = 'Custom message.';
    render(<ConfirmModal isOpen={true} title={title} message={message} onConfirm={onConfirmMock} onCancel={onCancelMock} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  test('should call onConfirm when confirm button is clicked', () => {
    render(<ConfirmModal isOpen={true} onConfirm={onConfirmMock} onCancel={onCancelMock} confirmText="Confirm" />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });

  test('should call onCancel when cancel button is clicked', () => {
    render(<ConfirmModal isOpen={true} onConfirm={onConfirmMock} onCancel={onCancelMock} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
