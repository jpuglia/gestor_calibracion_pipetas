import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Dashboard from '../pages/Dashboard';
import { dashboardService } from '../services/api';

// Mock the dashboardService
vi.mock('../services/api', () => ({
  dashboardService: {
    getStats: vi.fn(),
    getAlerts: vi.fn(),
  },
}));

describe('Dashboard Component', () => {
  it('renders loading state initially', () => {
    vi.mocked(dashboardService.getStats).mockReturnValue(new Promise(() => {}));
    vi.mocked(dashboardService.getAlerts).mockReturnValue(new Promise(() => {}));

    render(<Dashboard />);
    expect(screen.getByText(/Cargando dashboard.../i)).toBeInTheDocument();
  });

  it('renders stats after data fetching', async () => {
    vi.mocked(dashboardService.getStats).mockResolvedValue({
      total_pipettes: 10,
      total_events: 5,
      expiring_soon: 2,
    });
    vi.mocked(dashboardService.getAlerts).mockResolvedValue([]);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });
});
