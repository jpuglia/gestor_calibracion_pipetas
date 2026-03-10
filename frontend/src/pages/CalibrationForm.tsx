/**
 * CalibrationForm component for registering new calibration events and results.
 * Handles pipette selection, event details, and automated repetition/OOS checks.
 */

import './CalibrationForm.css';

import { AlertCircle, Plus, Save, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  eventService,
  pipetteService,
  resultService,
  specificationService,
} from '../services/api';
import type {
  EventLog,
  GlobalSpecification,
  Pipette,
  Result,
  Specification,
} from '../types';

/**
 * Result state including internal UI-only properties.
 */
interface ResultState extends Partial<Result> {
  is_template?: boolean;
}

const CalibrationForm: React.FC = () => {
  const [pipettes, setPipettes] = useState<Pipette[]>([]);
  const [selectedPipetteId, setSelectedPipetteId] = useState<number | ''>('');
  const [specs, setSpecs] = useState<Specification[]>([]);

  const [eventData, setEventData] = useState<Partial<EventLog>>({
    type_event: 'calibración',
    date_calibration: new Date().toISOString().split('T')[0],
    service_provider: '',
    expiration_date: '',
  });

  const [reportNumber, setReportNumber] = useState('');

  const [results, setResults] = useState<ResultState[]>([
    { tested_volume: 0, measured_error: 0 },
  ]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    pipetteService.getAll().then(setPipettes);
  }, []);

  /**
   * Handles pipette selection change, fetching associated specifications and templates.
   * @param {number | ''} id - The ID of the selected pipette.
   */
  const handlePipetteChange = async (id: number | '') => {
    setSelectedPipetteId(id);
    if (id) {
      const fetchedPipette = pipettes.find((p) => p.id === Number(id));
      const fetchedSpecs = await specificationService.getByPipette(Number(id));

      // Fetch global specs to supplement if needed
      const combinedSpecs: Specification[] = [...fetchedSpecs];
      if (fetchedPipette) {
        const gSpecs = await specificationService.getGlobalSpecsByVolMax(
          fetchedPipette.max_volume,
        );
        // Only add global specs for volumes that don't have a specific spec
        const specificVolumes = new Set(fetchedSpecs.map((s: Specification) => s.volume));
        gSpecs.forEach((gs: GlobalSpecification) => {
          if (!specificVolumes.has(gs.test_volume)) {
            combinedSpecs.push({
              id: gs.id as number,
              pipette_id: Number(id),
              volume: gs.test_volume,
              max_error: gs.max_error_percent,
            });
          }
        });
      }

      setSpecs(combinedSpecs);

      if (combinedSpecs.length > 0) {
        // Sort specs by volume descending for consistent UI (e.g. 1000, 500, 100)
        const sortedSpecs = [...combinedSpecs].sort((a, b) => b.volume - a.volume);
        setResults(
          sortedSpecs.map((spec) => ({
            tested_volume: spec.volume,
            measured_error: 0,
            is_template: true,
          })),
        );
      } else {
        try {
          const data = await pipetteService.getLastCalibrationTemplate(Number(id));
          if (data.volumes && data.volumes.length > 0) {
            setResults(
              data.volumes.map((vol: number) => ({
                tested_volume: vol,
                measured_error: 0,
                is_template: true,
              })),
            );
          } else {
            setResults([{ tested_volume: 0, measured_error: 0 }]);
          }
        } catch (error) {
          console.error('Error fetching calibration template:', error);
          setResults([{ tested_volume: 0, measured_error: 0 }]);
        }
      }
    } else {
      setSpecs([]);
      setResults([{ tested_volume: 0, measured_error: 0 }]);
    }
  };

  /**
   * Adds a new empty result row to the form.
   */
  const handleAddResult = () => {
    setResults([...results, { tested_volume: 0, measured_error: 0 }]);
  };

  /**
   * Removes a result row by index.
   * @param {number} index - Index of the result row.
   */
  const handleRemoveResult = (index: number) => {
    setResults(results.filter((_, i) => i !== index));
  };

  /**
   * Handles changes to result input fields with numeric validation.
   * @param {number} index - Index of the result row.
   * @param {keyof Result} field - Field being updated.
   * @param {string} value - Raw input value.
   */
  const handleResultChange = (index: number, field: keyof Result, value: string) => {
    const newResults = [...results];

    // For numeric fields, handle intermediate states and normalization
    if (field === 'tested_volume' || field === 'measured_error') {
      // Allow comma and normalize it to dot
      const normalizedValue = value.replace(/,/g, '.');

      // Regex to allow intermediate numeric states:
      // optional minus, followed by any number of digits, optional dot, optional digits
      const numericRegex = /^-?\d*\.?\d*$/;

      if (normalizedValue === '' || numericRegex.test(normalizedValue)) {
        newResults[index] = { ...newResults[index], [field]: normalizedValue as any };
        setResults(newResults);
      }
      return;
    }

    newResults[index] = { ...newResults[index], [field]: value };
    setResults(newResults);
  };

  /**
   * Checks if a result point is Out of Specification (OOS).
   * @param {number} testedVolume - Target volume tested.
   * @param {number} measuredError - Measured error percentage.
   * @returns {boolean} True if OOS.
   */
  const isOOS = (testedVolume: number, measuredError: number) => {
    const spec = specs.find((s) => s.volume === Number(testedVolume));
    if (!spec) return false;
    // Relative error comparison (%) as per user request
    return Number(measuredError) > spec.max_error;
  };

  /**
   * Submits the calibration event and all associated results.
   * @param {React.FormEvent} e - Form event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPipetteId) return;

    // Validate results before submission
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const vol = Number(r.tested_volume);
      const err = Number(r.measured_error);

      if (
        isNaN(vol) ||
        r.tested_volume === ('' as any) ||
        r.tested_volume === ('-' as any) ||
        r.tested_volume === ('.' as any)
      ) {
        alert(`El volumen en la prueba ${i + 1} no es un número válido.`);
        return;
      }
      if (
        isNaN(err) ||
        r.measured_error === ('' as any) ||
        r.measured_error === ('-' as any) ||
        r.measured_error === ('.' as any)
      ) {
        alert(`El error en la prueba ${i + 1} no es un número válido.`);
        return;
      }
    }

    setLoading(true);
    try {
      console.log('Submitting Event:', {
        ...eventData,
        pipette_id: Number(selectedPipetteId),
      });
      const createdEvent = await eventService.create({
        ...eventData,
        pipette_id: Number(selectedPipetteId),
      } as EventLog);
      console.log('Event created successfully, ID:', createdEvent.id);

      // Submit results sequentially
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`Submitting Result ${i + 1}/${results.length}:`, {
          ...r,
          event_log_id: createdEvent.id,
        });

        try {
          await resultService.create({
            event_log_id: createdEvent.id,
            tested_volume: Number(r.tested_volume),
            measured_error: Number(r.measured_error),
            report_number: reportNumber,
          });
          console.log(`Result ${i + 1} saved.`);
        } catch (resErr) {
          console.error(`Error saving result ${i + 1}:`, resErr);
          throw new Error(`Failed to save result ${i + 1}. The process was interrupted.`);
        }
      }

      setSuccess(true);
      // Reset form state
      setSelectedPipetteId('');
      setEventData({
        type_event: 'calibración',
        date_calibration: new Date().toISOString().split('T')[0],
        service_provider: '',
        expiration_date: '',
      });
      setReportNumber('');
      setResults([{ tested_volume: 0, measured_error: 0 }]);

      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error('Final Error saving calibration:', error);
      alert('Error al guardar el servicio. Por favor revise la consola.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="calibration-page">
      <div className="form-container">
        <h2>Registrar Nuevo Servicio</h2>

        {success && <div className="success-msg">¡Servicio registrado con éxito!</div>}

        <form onSubmit={handleSubmit}>
          <section className="form-section">
            <h3>1. Información de la Pipeta</h3>
            <div className="form-group">
              <label htmlFor="pipette-select">Seleccionar Pipeta</label>
              <select
                id="pipette-select"
                value={selectedPipetteId}
                onChange={(e) =>
                  handlePipetteChange(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
              >
                <option value="">-- Seleccione una pipeta --</option>
                {pipettes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} - {p.description} ({p.brand})
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="form-section">
            <h3>2. Detalles del Evento</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="event-type">Tipo de Evento</label>
                <select
                  id="event-type"
                  value={eventData.type_event}
                  onChange={(e) =>
                    setEventData({ ...eventData, type_event: e.target.value })
                  }
                >
                  <option value="calibración">Calibración</option>
                  <option value="calificación">Calificación</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="calibration-date">Fecha de Servicio</label>
                <input
                  id="calibration-date"
                  type="date"
                  value={eventData.date_calibration}
                  onChange={(e) =>
                    setEventData({ ...eventData, date_calibration: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="provider">Proveedor de Servicio</label>
                <input
                  id="provider"
                  type="text"
                  placeholder="Ej: Mettler Toledo"
                  value={eventData.service_provider}
                  onChange={(e) =>
                    setEventData({ ...eventData, service_provider: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="expiration-date">Fecha de Vencimiento</label>
                <input
                  id="expiration-date"
                  type="date"
                  value={eventData.expiration_date}
                  onChange={(e) =>
                    setEventData({ ...eventData, expiration_date: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="report-number">Número de Informe</label>
                <input
                  id="report-number"
                  type="text"
                  placeholder="Ej: CERT-123"
                  value={reportNumber}
                  onChange={(e) => setReportNumber(e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-header">
              <h3>3. Resultados de las Pruebas</h3>
              <button type="button" className="btn-secondary" onClick={handleAddResult}>
                <Plus size={16} /> Añadir Prueba
              </button>
            </div>

            <div className="results-list">
              {results.map((result, idx) => (
                <div key={idx} className="result-row-container">
                  <div className="result-inputs">
                    <div className="form-group small">
                      <label htmlFor={`vol-${idx}`}>Volumen (µL)</label>

                      <input
                        id={`vol-${idx}`}
                        type="text"
                        placeholder="0"
                        value={result.tested_volume || ''}
                        onChange={(e) =>
                          handleResultChange(idx, 'tested_volume', e.target.value)
                        }
                        required
                        readOnly={result.is_template}
                        className={result.is_template ? 'read-only-input' : ''}
                      />
                    </div>
                    <div className="form-group small">
                      <label htmlFor={`err-${idx}`}>Error (%)</label>
                      <input
                        id={`err-${idx}`}
                        type="text"
                        placeholder="0.00"
                        value={result.measured_error ?? ''}
                        onChange={(e) =>
                          handleResultChange(idx, 'measured_error', e.target.value)
                        }
                        required
                      />
                    </div>
                    {results.length > 1 && (
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleRemoveResult(idx)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {isOOS(
                    Number(result.tested_volume) || 0,
                    Number(result.measured_error) || 0,
                  ) && (
                      <div className="oos-warning">
                        <AlertCircle size={14} /> Fuera de especificación (OOS)
                      </div>
                    )}
                </div>
              ))}
            </div>
          </section>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              <Save size={18} /> {loading ? 'Guardando...' : 'Guardar Servicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalibrationForm;
