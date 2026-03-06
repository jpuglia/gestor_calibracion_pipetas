/**
 * PipetteDetails component for viewing detailed information about a specific pipette.
 * Includes inventory data, calibration history, specifications, and error trend analysis charts.
 */

import 'chartjs-adapter-date-fns';
import './PipetteDetails.css';

import {
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from 'chart.js';
import { es } from 'date-fns/locale';
import { ArrowLeft, Calendar, Download, ShieldCheck } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Link, useParams } from 'react-router-dom';

import { eventService, pipetteService, specificationService } from '../services/api';
import { PipetteStatus } from '../types';
import type { EventLog, GlobalSpecification, Pipette, Specification } from '../types';
import { toAbsoluteValue } from '../utils/mathUtils';

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
);

/**
 * Interface for calibration error data points returned by the API.
 */
interface CalibrationErrorPoint {
  date_calibration: string;
  target_volume: number;
  error_percent: number;
  max_error_limit: number;
}

const PipetteDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [pipette, setPipette] = useState<Pipette | null>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [globalSpecs, setGlobalSpecs] = useState<GlobalSpecification[]>([]);
  const [calibrationErrors, setCalibrationErrors] = useState<CalibrationErrorPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        console.log(`Fetching data for pipette ID: ${id}`);
        // First get the pipette itself
        const p = await pipetteService.getOne(Number(id));
        setPipette(p);

        if (p) {
          // Then get other data in parallel
          const [e, s, errs, gs] = await Promise.all([
            eventService.getAllByPipette(Number(id)).catch((err) => {
              console.warn('Events fail', err);
              return [];
            }),
            specificationService.getByPipette(Number(id)).catch((err) => {
              console.warn('Specs fail', err);
              return [];
            }),
            pipetteService.getCalibrationErrors(Number(id)).catch((err) => {
              console.warn('Errors fail', err);
              return [];
            }),
            specificationService.getGlobalSpecsByVolMax(p.max_volume).catch((err) => {
              console.warn('Global specs fail', err);
              return [];
            }),
          ]);
          setEvents(e);
          setSpecs(s);
          setCalibrationErrors(errs);
          setGlobalSpecs(gs);
        }
      } catch (error) {
        console.error('Error fetching pipette details:', error);
        setPipette(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  /**
   * Updates the pipette status via API.
   */
  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as PipetteStatus;
    if (!pipette || !id) return;

    try {
      setUpdatingStatus(true);
      const updatedPipette = await pipetteService.updateStatus(Number(id), newStatus);
      setPipette(updatedPipette);
      console.log(`Status updated successfully to: ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado. Por favor intente de nuevo.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  /**
   * Exports the measurement error chart as a PNG image.
   */
  const handleExport = () => {
    if (chartRef.current) {
      const base64Image = chartRef.current.toBase64Image('image/png', 2);
      const link = document.createElement('a');
      link.href = base64Image;
      link.download = `${pipette?.codigo}_Analisis_Error.png`;
      link.click();
    }
  };

  if (loading) return <div className="loading">Cargando detalles...</div>;
  if (!pipette) return <div className="error">Pipeta no encontrada.</div>;

  // Process data for Chart
  const datasetsMap = new Map<number, { x: string; y: number }[]>();
  const specsMap = new Map<number, number>();
  let maxMeasuredError = 0;

  calibrationErrors.forEach((err) => {
    if (!datasetsMap.has(err.target_volume)) {
      datasetsMap.set(err.target_volume, []);
      specsMap.set(err.target_volume, err.max_error_limit);
    }
    // Use absolute value for visualization as per requirement
    const absError = toAbsoluteValue(err.error_percent);
    datasetsMap.get(err.target_volume)!.push({
      x: err.date_calibration,
      y: absError,
    });
    if (absError > maxMeasuredError) maxMeasuredError = absError;
  });

  // Terminal logging as per requirement
  console.log(
    `Frontend: Processing ${datasetsMap.size} volume series for Pipette ${id}. Data points:`,
    Array.from(datasetsMap.entries()).map(([vol, data]) => ({
      volume: vol,
      points: data.length,
    })),
  );

  const chartDatasets: any[] = [];
  Array.from(datasetsMap.entries()).forEach(([vol, data], index) => {
    // Sober, distinct color palette using HSL
    const color = `hsl(${(index * 137.5) % 360}, 65%, 45%)`;

    // 1. Solid line with markers for measurements
    chartDatasets.push({
      label: `Error ${vol}µL`,
      data: data.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime()),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointStyle: 'circle',
      showLine: true,
      fill: false,
      tension: 0.1,
      order: 1,
    });

    // 2. Horizontal dashed line for specification limit
    const specLimit = specsMap.get(vol);
    if (specLimit !== undefined && specLimit > 0) {
      // Create spec line matching volume line color
      const sortedData = [...data].sort(
        (a, b) => new Date(a.x).getTime() - new Date(b.x).getTime(),
      );
      const specData = sortedData.map((d) => ({ x: d.x, y: specLimit }));

      chartDatasets.push({
        label: `Límite Spec ${vol}µL (${specLimit}%)`,
        data: specData,
        borderColor: color,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0, // No markers for limit line
        fill: false,
        stepped: false,
        order: 2,
      });
    }
  });

  const chartData = {
    datasets: chartDatasets,
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 15,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return ` ${label}: ${value}%`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'month' as const,
          displayFormats: {
            month: 'MMM yyyy',
            day: 'dd/MM/yy',
          },
        },
        adapters: {
          date: {
            locale: es,
          },
        },
        title: {
          display: true,
          text: 'Fecha de Calibración',
          font: { weight: 'bold' as const },
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        // Scaling adjusted to fit measured errors with 10% headroom, minimum 1%
        max: Math.max(1, maxMeasuredError * 1.1),
        title: {
          display: true,
          text: 'Error Absoluto (%)',
          font: { weight: 'bold' as const },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
    },
  };

  // Console log as per requirement
  console.log(
    `Frontend: Rendered ${chartData.datasets.length} volume lines for Pipette ${id}.`,
  );

  return (
    <div className="pipette-details-page">
      <Link to="/inventory" className="back-link">
        <ArrowLeft size={16} /> Volver al Inventario
      </Link>

      <div className="details-grid">
        <div className="main-info-card">
          <div className="card-header">
            <h2>{pipette.codigo}</h2>
            <div className="status-selector-container">
              <select
                className={`status-select ${
                  pipette.status.toLowerCase() === 'en uso'
                    ? 'green'
                    : pipette.status.toLowerCase() === 'fuera de uso'
                      ? 'red'
                      : 'yellow'
                }`}
                value={pipette.status}
                onChange={handleStatusChange}
                disabled={updatingStatus}
              >
                {Object.values(PipetteStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {updatingStatus && <span className="updating-spinner" />}
            </div>
          </div>
          <div className="info-list">
            <div className="info-item">
              <span className="label">Estado:</span>
              <span className="value capitalize">{pipette.status}</span>
            </div>
            {pipette.last_status_change && (
              <div className="info-item">
                <span className="label">Último Cambio:</span>
                <span className="value">
                  {new Date(pipette.last_status_change).toLocaleString('es-ES')}
                </span>
              </div>
            )}
            <div className="info-item">
              <span className="label">Descripción:</span>
              <span className="value">{pipette.description}</span>
            </div>
            <div className="info-item">
              <span className="label">Marca:</span>
              <span className="value">{pipette.brand}</span>
            </div>
            <div className="info-item">
              <span className="label">Modelo:</span>
              <span className="value">{pipette.model}</span>
            </div>
            <div className="info-item">
              <span className="label">N° Serie:</span>
              <span className="value">{pipette.serial_number}</span>
            </div>
            <div className="info-item">
              <span className="label">Volumen Máximo:</span>
              <span className="value">{pipette.max_volume} µL</span>
            </div>
          </div>
        </div>

        <div className="specs-card">
          <div className="card-header-with-action">
            <h3>
              <ShieldCheck size={18} /> Especificaciones
            </h3>
          </div>

          {specs.length === 0 && globalSpecs.length === 0 ? (
            <p className="empty-msg">No hay especificaciones disponibles.</p>
          ) : (
            <table className="small-table">
              <thead>
                <tr>
                  <th>Volumen (µL)</th>
                  <th>Error Máx (%)</th>
                </tr>
              </thead>
              <tbody>
                {/* Prefer specific specs, fallback to global */}
                {(specs.length > 0
                  ? specs.map((s) => ({
                      id: s.id,
                      volume: s.volume,
                      max_error_percent: s.max_error,
                      is_global: false,
                    }))
                  : globalSpecs.map((gs) => ({
                      id: gs.id,
                      volume: gs.test_volume,
                      max_error_percent: gs.max_error_percent,
                      is_global: true,
                    }))
                )
                  .sort((a: any, b: any) => b.volume - a.volume)
                  .map((s: any) => (
                    <tr key={s.id}>
                      <td>{s.volume}</td>
                      <td className="bold">{s.max_error_percent}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {calibrationErrors.length > 0 && (
        <div className="chart-section print-landscape">
          <div className="chart-header">
            <h3>Análisis de Error de Medición</h3>
            <button className="export-btn hide-on-print" onClick={handleExport}>
              <Download size={16} /> Exportar
            </button>
          </div>
          <div className="chart-container" style={{ height: '400px', width: '100%' }}>
            <Line ref={chartRef} options={chartOptions} data={chartData} />
          </div>
        </div>
      )}

      <div className="history-section hide-on-print">
        <h3>
          <Calendar size={18} /> Historial de Servicios
        </h3>
        {events.length === 0 ? (
          <div className="empty-history">
            No se han registrado servicios para esta pipeta.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Proveedor</th>
                  <th>Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {events
                  .sort(
                    (a, b) =>
                      new Date(b.date_calibration).getTime() -
                      new Date(a.date_calibration).getTime(),
                  )
                  .map((e) => (
                    <tr key={e.id}>
                      <td>{e.date_calibration}</td>
                      <td className="capitalize">{e.type_event}</td>
                      <td>{e.service_provider}</td>
                      <td className="bold">{e.expiration_date}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PipetteDetails;
