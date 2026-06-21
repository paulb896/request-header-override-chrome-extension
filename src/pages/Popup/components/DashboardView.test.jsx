import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardView from './DashboardView';

jest.mock('./RequestHeadersApp', () => () => <div data-testid="request-headers-app" />);
jest.mock('./ResponseOverridesApp', () => ({ hideRecentRequests }) => (
  <div data-testid="response-overrides-app" data-hide={hideRecentRequests} />
));

describe('DashboardView', () => {
  test('renders RequestHeadersApp and ResponseOverridesApp', () => {
    render(<DashboardView />);
    
    expect(screen.getByText('Active Request & Response Overrides')).toBeInTheDocument();
    expect(screen.getByText('Header and Query Parameter Overrides')).toBeInTheDocument();
    expect(screen.getByText('Response Mocks')).toBeInTheDocument();
    
    expect(screen.getByTestId('request-headers-app')).toBeInTheDocument();
    
    const overridesApp = screen.getByTestId('response-overrides-app');
    expect(overridesApp).toBeInTheDocument();
    expect(overridesApp).toHaveAttribute('data-hide', 'true');
  });
});
