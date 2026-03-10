/**
 * API service layer for communicating with the FastAPI backend.
 * Uses axios for HTTP requests and includes logging interceptors.
 */

import axios from 'axios';

import type {
  DashboardStats,
  EventLog,
  ExpirationAlert,
  GlobalSpecification,
  Pipette,
  PipetteStatus,
  Result,
  Specification,
} from '../types';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`Starting Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log(`Response received from ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`API Error: ${error.message} - ${error.config?.url}`);
    return Promise.reject(error);
  },
);

/**
 * Service for pipette-related operations.
 */
export const pipetteService = {
  /**
   * Retrieves all pipettes from the database.
   * @returns {Promise<Pipette[]>} Array of pipettes.
   */
  getAll: async (): Promise<Pipette[]> => {
    const response = await api.get('/pipettes');
    return response.data;
  },

  /**
   * Retrieves a single pipette by ID.
   * @param {number} id - Pipette primary key.
   * @returns {Promise<Pipette>} The pipette object.
   */
  getOne: async (id: number): Promise<Pipette> => {
    const response = await api.get(`/pipettes/${id}`);
    return response.data;
  },

  /**
   * Retrieves calibration error history for a pipette.
   * @param {number} id - Pipette ID.
   * @returns {Promise<any[]>} Array of calibration error data points.
   */
  getCalibrationErrors: async (id: number) => {
    const response = await api.get(`/pipettes/${id}/calibration-errors`);
    return response.data;
  },

  /**
   * Retrieves a calibration template (suggested volumes).
   * @param {number} id - Pipette ID.
   * @returns {Promise<number[]>} Array of target volumes.
   */
  getCalibrationTemplate: async (id: number): Promise<number[]> => {
    const response = await api.get(`/pipettes/${id}/calibration-template`);
    return response.data;
  },

  /**
   * Retrieves the last calibration template (v2 endpoint).
   * @param {number} id - Pipette ID.
   * @returns {Promise<{volumes: number[]}>} Object containing target volumes.
   */
  getLastCalibrationTemplate: async (id: number): Promise<{ volumes: number[] }> => {
    const response = await api.get(`/api/pipettes/${id}/last-calibration-template`);
    return response.data;
  },

  /**
   * Registers a new pipette in the database.
   * @param {Partial<Pipette>} pipetteData - The pipette data to register.
   * @returns {Promise<Pipette>} The created pipette object.
   */
  create: async (pipetteData: Partial<Pipette>): Promise<Pipette> => {
    const response = await api.post('/api/v1/pipettes', pipetteData);
    return response.data;
  },

  /**
   * Updates the status of a specific pipette.
   * @param {number} id - Pipette ID.
   * @param {PipetteStatus} newStatus - The new status to set.
   * @returns {Promise<Pipette>} The updated pipette object.
   */
  updateStatus: async (id: number, newStatus: PipetteStatus): Promise<Pipette> => {
    const response = await api.put(`/api/v1/pipettes/${id}/status`, null, {
      params: { new_status: newStatus },
    });
    return response.data;
  },
};

/**
 * Service for event log operations.
 */
export const eventService = {
  /**
   * Retrieves all events for a specific pipette.
   * @param {number} pipetteId - Pipette ID.
   * @returns {Promise<EventLog[]>} Array of event logs.
   */
  getAllByPipette: async (pipetteId: number): Promise<EventLog[]> => {
    const response = await api.get(`/events/${pipetteId}`);
    return response.data;
  },

  /**
   * Registers a new event.
   * @param {Partial<EventLog>} eventData - Event data.
   * @returns {Promise<EventLog>} The created event.
   */
  create: async (eventData: Partial<EventLog>): Promise<EventLog> => {
    const response = await api.post('/events', eventData);
    return response.data;
  },
};

/**
 * Service for calibration result operations.
 */
export const resultService = {
  /**
   * Registers a new calibration result.
   * @param {Partial<Result>} resultData - Result data.
   * @returns {Promise<Result>} The created result.
   */
  create: async (resultData: Partial<Result>): Promise<Result> => {
    const response = await api.post('/results', resultData);
    return response.data;
  },

  /**
   * Retrieves all results for a specific event log.
   * @param {number} eventId - Event Log ID.
   * @returns {Promise<Result[]>} Array of calibration results.
   */
  getByEvent: async (eventId: number): Promise<Result[]> => {
    const response = await api.get(`/events/${eventId}/results`);
    return response.data;
  },
};

/**
 * Service for specification operations.
 */
export const specificationService = {
  /**
   * Retrieves specific specifications for a pipette.
   * @param {number} pipetteId - Pipette ID.
   * @returns {Promise<Specification[]>} Array of specifications.
   */
  getByPipette: async (pipetteId: number): Promise<Specification[]> => {
    const response = await api.get(`/specifications/${pipetteId}`);
    return response.data;
  },

  /**
   * Creates a new specification.
   * @param {Partial<Specification>} specData - Specification data.
   * @returns {Promise<Specification>} The created specification.
   */
  create: async (specData: Partial<Specification>): Promise<Specification> => {
    const response = await api.post('/specifications', specData);
    return response.data;
  },

  /**
   * Retrieves all global specifications.
   * @returns {Promise<GlobalSpecification[]>} Array of global specifications.
   */
  getGlobalSpecs: async (): Promise<GlobalSpecification[]> => {
    const response = await api.get('/global-specifications');
    return response.data;
  },

  /**
   * Retrieves global specifications for a specific category.
   * @param {number} volMax - Maximum volume of the pipette category.
   * @returns {Promise<GlobalSpecification[]>} Array of global specifications.
   */
  getGlobalSpecsByVolMax: async (volMax: number): Promise<GlobalSpecification[]> => {
    const response = await api.get(`/global-specifications/${volMax}`);
    return response.data;
  },
};

/**
 * Service for dashboard statistics and alerts.
 */
export const dashboardService = {
  /**
   * Retrieves dashboard summary statistics.
   * @returns {Promise<DashboardStats>} Dashboard stats object.
   */
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  /**
   * Retrieves active expiration alerts.
   * @returns {Promise<ExpirationAlert[]>} Array of expiration alerts.
   */
  getAlerts: async (): Promise<ExpirationAlert[]> => {
    const response = await api.get('/alerts/expirations');
    return response.data;
  },
};

export default api;
