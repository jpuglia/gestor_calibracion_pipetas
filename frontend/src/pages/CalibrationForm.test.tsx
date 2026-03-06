import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CalibrationForm from '../pages/CalibrationForm';
import { pipetteService, specificationService } from '../services/api';

// Mock services
vi.mock('../services/api', () => ({
  pipetteService: {
    getAll: vi.fn(),
    getCalibrationTemplate: vi.fn(),
    getLastCalibrationTemplate: vi.fn(),
  },
  specificationService: {
    getByPipette: vi.fn(),
    getGlobalSpecsByVolMax: vi.fn(),
  },
  eventService: {
    create: vi.fn(),
  },
  resultService: {
    create: vi.fn(),
  },
}));

describe('CalibrationForm OOS Logic', () => {
  beforeEach(() => {
    vi.mocked(pipetteService.getAll).mockResolvedValue([
      {
        id: 1,
        codigo: 'PP-001',
        description: 'Test',
        brand: 'Brand',
        model: 'M',
        serial_number: 'SN',
        status: 'En uso',
        max_volume: 1000,
      },
    ]);
    vi.mocked(specificationService.getByPipette).mockResolvedValue([
      { id: 1, pipette_id: 1, volume: 1000, max_error: 5.0 },
    ]);
    vi.mocked(specificationService.getGlobalSpecsByVolMax).mockResolvedValue([]);
    vi.mocked(pipetteService.getCalibrationTemplate).mockResolvedValue([]);
    vi.mocked(pipetteService.getLastCalibrationTemplate).mockResolvedValue({
      volumes: [],
    });
  });

  it('auto-populates results when a pipette with history is selected', async () => {
    vi.mocked(pipetteService.getLastCalibrationTemplate).mockResolvedValue({
      volumes: [100, 500, 1000],
    });
    render(<CalibrationForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Seleccionar Pipeta/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Seleccionar Pipeta/i), {
      target: { value: '1' },
    });

    // Should now have 3 volume inputs with values 100, 500, 1000
    await waitFor(() => {
      const volInputs = screen.getAllByLabelText(/Volumen \(µL\)/i);
      expect(volInputs).toHaveLength(3);
      expect(volInputs[0]).toHaveValue('100');
      expect(volInputs[1]).toHaveValue('500');
      expect(volInputs[2]).toHaveValue('1000');
      // Verify they are read-only
      expect(volInputs[0]).toHaveAttribute('readonly');
    });
  });

  it('shows OOS warning when error exceeds max_error', async () => {
    render(<CalibrationForm />);

    // 1. Wait for pipettes to load and select one
    await waitFor(() => {
      expect(screen.getByLabelText(/Seleccionar Pipeta/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Seleccionar Pipeta/i), {
      target: { value: '1' },
    });

    // 2. Wait for template load and fill results
    await waitFor(() => {
      expect(pipetteService.getLastCalibrationTemplate).toHaveBeenCalledWith(1);
    });

    const volInput = screen.getByLabelText(/Volumen \(µL\)/i);
    const errInput = screen.getByLabelText(/Error \(%\)/i);

    fireEvent.change(volInput, { target: { value: '1000' } });
    fireEvent.change(errInput, { target: { value: '10' } }); // 10 > 5 (OOS)

    // 3. Check for OOS warning
    await waitFor(() => {
      expect(screen.getByText(/Fuera de especificación \(OOS\)/i)).toBeInTheDocument();
    });
  });

  it('does NOT show OOS warning when error is within max_error', async () => {
    render(<CalibrationForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Seleccionar Pipeta/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Seleccionar Pipeta/i), {
      target: { value: '1' },
    });

    await waitFor(() => {
      expect(pipetteService.getLastCalibrationTemplate).toHaveBeenCalledWith(1);
    });

    const volInput = screen.getByLabelText(/Volumen \(µL\)/i);
    const errInput = screen.getByLabelText(/Error \(%\)/i);

    fireEvent.change(volInput, { target: { value: '1000' } });
    fireEvent.change(errInput, { target: { value: '3' } }); // 3 < 5 (Pass)

    expect(
      screen.queryByText(/Fuera de especificación \(OOS\)/i),
    ).not.toBeInTheDocument();
  });

  it('correctly handles comma-separated decimal inputs', async () => {
    render(<CalibrationForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Seleccionar Pipeta/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Seleccionar Pipeta/i), {
      target: { value: '1' },
    });

    await waitFor(() => {
      expect(pipetteService.getLastCalibrationTemplate).toHaveBeenCalledWith(1);
    });

    const volInput = screen.getByLabelText(/Volumen \(µL\)/i);
    const errInput = screen.getByLabelText(/Error \(%\)/i);

    // Enter comma-separated value
    fireEvent.change(volInput, { target: { value: '1000' } });
    fireEvent.change(errInput, { target: { value: '6,5' } }); // 6.5 > 5 (OOS)

    // Verify OOS warning is shown (proving 6,5 was parsed as 6.5)
    await waitFor(() => {
      expect(screen.getByText(/Fuera de especificación \(OOS\)/i)).toBeInTheDocument();
    });
  });

  it('allows intermediate negative sign without showing NaN', async () => {
    render(<CalibrationForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Seleccionar Pipeta/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Seleccionar Pipeta/i), {
      target: { value: '1' },
    });

    await waitFor(() => {
      expect(pipetteService.getLastCalibrationTemplate).toHaveBeenCalledWith(1);
    });

    const errInput = screen.getByLabelText(/Error \(%\)/i);

    // 1. Enter minus sign
    fireEvent.change(errInput, { target: { value: '-' } });
    expect(errInput).toHaveValue('-');
    expect(errInput).not.toHaveValue('NaN');

    // 2. Complete the number
    fireEvent.change(errInput, { target: { value: '-0.5' } });
    expect(errInput).toHaveValue('-0.5');
    expect(errInput).not.toHaveValue('NaN');
  });
});
