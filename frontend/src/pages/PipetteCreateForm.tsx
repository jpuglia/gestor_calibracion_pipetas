import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { pipetteService } from '../services/api';
import { pipetteRegistrationSchema, type PipetteRegistrationData } from '../schemas/pipetteSchema';
import { PipetteStatus } from '../types';
import './PipetteCreateForm.css';

/**
 * PipetteCreateForm component for registering new pipettes.
 * Uses react-hook-form for state management and Zod for validation.
 */
const PipetteCreateForm: React.FC = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PipetteRegistrationData>({
    resolver: zodResolver(pipetteRegistrationSchema),
    defaultValues: {
      status: PipetteStatus.EN_USO,
    },
  });

  /**
   * Handles form submission.
   */
  const onSubmit = async (data: PipetteRegistrationData) => {
    setIsSubmitting(true);
    setServerError(null);
    setSuccessMsg(null);

    try {
      await pipetteService.create(data);
      setSuccessMsg('Pipeta registrada con éxito.');
      reset();
      // Optional: navigate back to inventory after a delay
      setTimeout(() => navigate('/inventory'), 2000);
    } catch (error: any) {
      console.error('Error creating pipette:', error);
      if (error.response?.status === 409) {
        setServerError(error.response.data.detail || 'Conflicto: El código o número de serie ya existe.');
      } else {
        setServerError('Ocurrió un error al registrar la pipeta. Por favor, intente de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pipette-form-container">
      <h2>Registro de Nueva Pipeta</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="form-grid">
        <div className="form-group">
          <label htmlFor="codigo">Código (UID)</label>
          <input
            id="codigo"
            type="text"
            placeholder="P-001"
            {...register('codigo')}
            className={errors.codigo ? 'error' : ''}
          />
          {errors.codigo && <span className="error-message">{errors.codigo.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="serial_number">Número de Serie</label>
          <input
            id="serial_number"
            type="text"
            placeholder="SN12345678"
            {...register('serial_number')}
            className={errors.serial_number ? 'error' : ''}
          />
          {errors.serial_number && <span className="error-message">{errors.serial_number.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="brand">Marca</label>
          <input
            id="brand"
            type="text"
            placeholder="Eppendorf"
            {...register('brand')}
            className={errors.brand ? 'error' : ''}
          />
          {errors.brand && <span className="error-message">{errors.brand.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="model">Modelo</label>
          <input
            id="model"
            type="text"
            placeholder="Research Plus"
            {...register('model')}
            className={errors.model ? 'error' : ''}
          />
          {errors.model && <span className="error-message">{errors.model.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="max_volume">Volumen Máximo (µL)</label>
          <input
            id="max_volume"
            type="number"
            step="0.1"
            placeholder="1000"
            {...register('max_volume')}
            className={errors.max_volume ? 'error' : ''}
          />
          {errors.max_volume && <span className="error-message">{errors.max_volume.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="status">Estado</label>
          <select id="status" {...register('status')}>
            <option value="En Uso">Activa</option>
            <option value="Calibrando">En Calibración</option>
            <option value="Fuera de uso">Fuera de servicio</option>
          </select>
          {errors.status && <span className="error-message">{errors.status.message}</span>}
        </div>

        <div className="form-group full-width">
          <label htmlFor="description">Descripción</label>
          <textarea
            id="description"
            rows={3}
            placeholder="Opcional: Detalles adicionales de la pipeta..."
            {...register('description')}
          ></textarea>
          {errors.description && <span className="error-message">{errors.description.message}</span>}
        </div>

        {serverError && <div className="status-msg error">{serverError}</div>}
        {successMsg && <div className="status-msg success">{successMsg}</div>}

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={() => navigate('/inventory')}>
            Cancelar
          </button>
          <button type="submit" className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando...' : 'Registrar Pipeta'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PipetteCreateForm;
