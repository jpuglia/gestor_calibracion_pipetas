import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { eventService, pipetteService, specificationService } from '../services/api';
import PipetteDetails from './PipetteDetails';

// Mock services
vi.mock('../services/api', () => ({
  pipetteService: {
    getOne: vi.fn(),
    getCalibrationErrors: vi.fn(),
  },
  eventService: {
    getAllByPipette: vi.fn(),
  },
  specificationService: {
    getByPipette: vi.fn(),
    getGlobalSpecsByVolMax: vi.fn(),
  },
}));

// Mock react-chartjs-2 to avoid canvas issues
vi.mock('react-chartjs-2', () => ({
  Line: vi.fn(({ data }: any) => {
    // We can inspect data passed to the chart here
    return <div data-testid="mock-chart" data-datasets={JSON.stringify(data.datasets)} />;
  }),
}));

describe('PipetteDetails Component', () => {
  const mockPipette = {
    id: 1,
    codigo: 'P1000',
    description: 'Pipeta de 1000uL',
    brand: 'Eppendorf',
    model: 'Research Plus',
    serial_number: 'SN12345',
    status: 'Activa',
    max_volume: 1000,
  };

  const mockErrors = [
    {
      date_calibration: '2023-01-01',
      target_volume: 1000,
      error_percent: -0.5,
      max_error_limit: 1.0,
    },
    {
      date_calibration: '2023-06-01',
      target_volume: 1000,
      error_percent: 0.8,
      max_error_limit: 1.0,
    },
    {
      date_calibration: '2023-01-01',
      target_volume: 500,
      error_percent: 0.3,
      max_error_limit: 1.5,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pipette details and the chart with absolute values and spec lines', async () => {
    vi.mocked(pipetteService.getOne).mockResolvedValue(mockPipette);
    vi.mocked(eventService.getAllByPipette).mockResolvedValue([]);
    vi.mocked(specificationService.getByPipette).mockResolvedValue([
      { id: 10, pipette_id: 1, volume: 1000, max_error: 1.0 },
    ]);
    vi.mocked(specificationService.getGlobalSpecsByVolMax).mockResolvedValue([]);
    vi.mocked(pipetteService.getCalibrationErrors).mockResolvedValue(mockErrors);

    render(
      <MemoryRouter initialEntries={['/pipettes/1']}>
        <Routes>
          <Route path="/pipettes/:id" element={<PipetteDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('P1000')).toBeInTheDocument();
      expect(screen.getByText('Eppendorf')).toBeInTheDocument();
    });

    // Check if the chart is rendered
    const chart = screen.getByTestId('mock-chart');
    expect(chart).toBeInTheDocument();

    // Verify datasets
    const datasets = JSON.parse(chart.getAttribute('data-datasets') || '[]');

    // We expect 4 datasets: 2 volumes (500 and 1000), each with a measurement line and a spec line
    expect(datasets.length).toBe(4);

    // Find measurement line for 1000uL
    const measurement1000 = datasets.find((d: any) => d.label === 'Error 1000µL');
    expect(measurement1000).toBeTruthy();

    // Check absolute value conversion: -0.5 should be 0.5
    expect(measurement1000.data.some((p: any) => p.y === 0.5)).toBe(true);
    expect(measurement1000.data.every((p: any) => p.y >= 0)).toBe(true);

    // Find spec line for 1000uL
    const spec1000 = datasets.find((d: any) => d.label === 'Límite Spec 1000µL (1%)');
    expect(spec1000).toBeTruthy();
    expect(spec1000.borderDash).toEqual([6, 4]);
    expect(spec1000.borderColor).toBe(measurement1000.borderColor);
  });
});
