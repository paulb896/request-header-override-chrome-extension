import React from 'react';

export default function ThemeToggle({ theme, toggleTheme }) {
  const isDark = theme === 'dark';

  return (
    <label
      className="switch-container"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        className="switch-input"
        checked={isDark}
        onChange={toggleTheme}
        aria-label="Toggle Dark Mode"
      />
      <span className="switch-slider"></span>
      <span
        style={{
          fontSize: '1.2rem',
          color: 'var(--text-muted)',
          userSelect: 'none',
        }}
      >
        {isDark ? 'Dark Mode' : 'Light Mode'}
      </span>
    </label>
  );
}
