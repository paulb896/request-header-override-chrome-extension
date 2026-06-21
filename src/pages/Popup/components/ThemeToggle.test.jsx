import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  it('renders a checkbox', () => {
    const toggleTheme = jest.fn();
    render(<ThemeToggle theme="dark" toggleTheme={toggleTheme} />);
    expect(
      screen.getByRole('checkbox', { name: /Toggle Dark Mode/i })
    ).toBeInTheDocument();
  });

  it('shows Switch to Light Mode when theme is dark', () => {
    const toggleTheme = jest.fn();
    render(<ThemeToggle theme="dark" toggleTheme={toggleTheme} />);
    expect(screen.getByTitle('Switch to Light Mode')).toBeInTheDocument();
  });

  it('shows Switch to Dark Mode when theme is light', () => {
    const toggleTheme = jest.fn();
    render(<ThemeToggle theme="light" toggleTheme={toggleTheme} />);
    expect(screen.getByTitle('Switch to Dark Mode')).toBeInTheDocument();
  });

  it('calls toggleTheme on change', () => {
    const toggleTheme = jest.fn();
    render(<ThemeToggle theme="dark" toggleTheme={toggleTheme} />);
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Toggle Dark Mode/i })
    );
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });
});
