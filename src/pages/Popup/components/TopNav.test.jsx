import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopNav from './TopNav';

describe('TopNav Component', () => {
  let mockOnTabChange;
  let mockToggleTheme;

  beforeEach(() => {
    mockOnTabChange = jest.fn();
    mockToggleTheme = jest.fn();
    
    global.chrome = {
      runtime: {
        openOptionsPage: jest.fn(),
      },
    };
    
    // mock window.open
    global.open = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders all tabs and handles tab clicks', () => {
    const { rerender } = render(
      <TopNav
        activeTab="dashboard"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
      />
    );

    expect(screen.getByText('RequestFlow Pro')).toBeInTheDocument();
    
    const dashboardTab = screen.getByText('Dashboard');
    const logsTab = screen.getByText('Recent Requests');
    const settingsTab = screen.getByText('Settings');

    // active tab
    expect(dashboardTab.closest('.nav-item')).toHaveClass('active');
    expect(logsTab.closest('.nav-item')).not.toHaveClass('active');

    // re-render to cover logs branch
    rerender(
      <TopNav
        activeTab="logs"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
      />
    );
    expect(logsTab.closest('.nav-item')).toHaveClass('active');

    // re-render to cover settings branch
    rerender(
      <TopNav
        activeTab="settings"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
      />
    );
    expect(settingsTab.closest('.nav-item')).toHaveClass('active');

    fireEvent.click(logsTab);
    expect(mockOnTabChange).toHaveBeenCalledWith('logs');

    fireEvent.click(settingsTab);
    expect(mockOnTabChange).toHaveBeenCalledWith('settings');
    
    fireEvent.click(dashboardTab);
    expect(mockOnTabChange).toHaveBeenCalledWith('dashboard');
  });

  test('toggles theme when theme icon is clicked', () => {
    const { rerender } = render(
      <TopNav
        activeTab="dashboard"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
      />
    );

    const themeToggle = screen.getByTitle('Toggle Theme');
    fireEvent.click(themeToggle);
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);

    // Render light theme to ensure no errors
    rerender(
      <TopNav
        activeTab="dashboard"
        onTabChange={mockOnTabChange}
        theme="light"
        toggleTheme={mockToggleTheme}
      />
    );
    expect(screen.getByTitle('Toggle Theme')).toBeInTheDocument();
  });

  test('handles open options page via chrome api', () => {
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
        hideOpenTab={false}
      />
    );

    // The open external button is the last nav-item, it doesn't have text
    const navItems = document.querySelectorAll('.nav-item');
    const openOptionsBtn = navItems[navItems.length - 1];
    
    fireEvent.click(openOptionsBtn);
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalledTimes(1);
    expect(global.open).not.toHaveBeenCalled();
  });

  test('falls back to window.open if chrome api is unavailable', () => {
    delete global.chrome.runtime.openOptionsPage;
    
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
        hideOpenTab={false}
      />
    );

    const navItems = document.querySelectorAll('.nav-item');
    const openOptionsBtn = navItems[navItems.length - 1];
    
    fireEvent.click(openOptionsBtn);
    expect(global.open).toHaveBeenCalledWith('options.html', '_blank');
  });

  test('hides open options page button when hideOpenTab is true', () => {
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
        hideOpenTab={true}
      />
    );

    const navItems = document.querySelectorAll('.nav-item');
    // Dashboard, Logs, Settings, Features, Theme
    expect(navItems.length).toBe(5);
  });

  test('opens features page via chrome runtime getURL when available', () => {
    global.chrome.runtime.getURL = jest.fn().mockReturnValue('chrome-extension://ieopjhecaagldnplmcgngbpgciejcbgh/features.html');
    
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
      />
    );

    const featuresTab = screen.getByTitle('Features & Help Guide');
    fireEvent.click(featuresTab);

    expect(global.chrome.runtime.getURL).toHaveBeenCalledWith('features.html');
    expect(global.open).toHaveBeenCalledWith('chrome-extension://ieopjhecaagldnplmcgngbpgciejcbgh/features.html', '_blank');
  });

  test('opens features page via window.open directly if chrome runtime is not available', () => {
    delete global.chrome;
    
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={mockOnTabChange}
        theme="dark"
        toggleTheme={mockToggleTheme}
      />
    );

    const featuresTab = screen.getByTitle('Features & Help Guide');
    fireEvent.click(featuresTab);

    expect(global.open).toHaveBeenCalledWith('features.html', '_blank');
  });
});
