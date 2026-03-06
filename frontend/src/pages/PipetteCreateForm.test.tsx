import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipetteCreateForm from './PipetteCreateForm';
import { pipetteService } from '../services/api';

// Mock the pipetteService
vi.mock('../services/api', () => ({
  pipetteService: {
    create: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('PipetteCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(
      <MemoryRouter>
        <PipetteCreateForm />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Código \(UID\)/i)).toBeDefined();
    expect(screen.getByLabelText(/Número de Serie/i)).toBeDefined();
    expect(screen.getByLabelText(/Marca/i)).toBeDefined();
    expect(screen.getByLabelText(/Modelo/i)).toBeDefined();
    expect(screen.getByLabelText(/Volumen Máximo \(µL\)/i)).toBeDefined();
    expect(screen.getByLabelText(/Estado/i)).toBeDefined();
    expect(screen.getByLabelText(/Descripción/i)).toBeDefined();
  });

  it('shows validation errors for empty required fields', async () => {
    render(
      <MemoryRouter>
        <PipetteCreateForm />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Registrar Pipeta/i }));

    await waitFor(() => {
      expect(screen.getByText(/El código es requerido/i)).toBeDefined();
      expect(screen.getByText(/El número de serie es requerido/i)).toBeDefined();
      expect(screen.getByText(/La marca es requerida/i)).toBeDefined();
      expect(screen.getByText(/El modelo es requerido/i)).toBeDefined();
      expect(screen.getByText(/El volumen máximo es requerido/i)).toBeDefined();
    });
  });

  it('submits the form successfully with valid data', async () => {
    const mockPipette = {
      codigo: 'P-101',
      serial_number: 'SN9999',
      brand: 'Gilson',
      model: 'Pipetman',
      max_volume: 1000,
      status: 'Active',
      description: 'Test pipette',
    };

    (pipetteService.create as any).mockResolvedValue({ id: 1, ...mockPipette });

    render(
      <MemoryRouter>
        <PipetteCreateForm />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Código \(UID\)/i), { target: { value: mockPipette.codigo } });
    fireEvent.change(screen.getByLabelText(/Número de Serie/i), { target: { value: mockPipette.serial_number } });
    fireEvent.change(screen.getByLabelText(/Marca/i), { target: { value: mockPipette.brand } });
    fireEvent.change(screen.getByLabelText(/Modelo/i), { target: { value: mockPipette.model } });
    fireEvent.change(screen.getByLabelText(/Volumen Máximo \(µL\)/i), { target: { value: mockPipette.max_volume.toString() } });
    fireEvent.change(screen.getByLabelText(/Descripción/i), { target: { value: mockPipette.description } });

    fireEvent.click(screen.getByRole('button', { name: /Registrar Pipeta/i }));

    await waitFor(() => {
      expect(pipetteService.create).toHaveBeenCalledWith(mockPipette);
      expect(screen.getByText(/Pipeta registrada con éxito/i)).toBeDefined();
    });
  });

  it('handles duplicate serial number error from server', async () => {
    (pipetteService.create as any).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Número de serie ya registrado' },
      },
    });

    render(
      <MemoryRouter>
        <PipetteCreateForm />
      </MemoryRouter>
    );

    // Fill minimum required fields
    fireEvent.change(screen.getByLabelText(/Código \(UID\)/i), { target: { value: 'P-DUP' } });
    fireEvent.change(screen.getByLabelText(/Número de Serie/i), { target: { value: 'SN-DUP' } });
    fireEvent.change(screen.getByLabelText(/Marca/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/Modelo/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/Volumen Máximo \(µL\)/i), { target: { value: '100' } });

    fireEvent.click(screen.getByRole('button', { name: /Registrar Pipeta/i }));

    await waitFor(() => {
      expect(screen.getByText(/Número de serie ya registrado/i)).toBeDefined();
    });
  });
});
