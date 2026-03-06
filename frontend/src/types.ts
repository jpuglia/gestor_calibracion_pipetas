export enum PipetteStatus {
  EN_USO = 'En Uso',
  CALIBRANDO = 'Calibrando',
  FUERA_DE_USO = 'Fuera de uso',
}

export interface Pipette {
  id: number;
  codigo: string;
  description: string;
  brand: string;
  model: string;
  serial_number: string;
  status: PipetteStatus;
  max_volume: number;
  last_status_change?: string;
}

export interface Specification {
  id: number;
  pipette_id: number;
  volume: number;
  max_error: number;
}

export interface GlobalSpecification {
  id: number;
  vol_max: number;
  test_volume: number;
  max_error_percent: number;
}

export interface EventLog {
  id?: number;
  pipette_id: number;
  type_event: string;
  date_calibration: string;
  service_provider: string;
  expiration_date: string;
}

export interface Result {
  id?: number;
  event_log_id: number;
  tested_volume: number;
  measured_error: number;
  repetition_count: number;
  report_number: string;
  is_oos?: boolean;
}

export interface DashboardStats {
  total_pipettes: number;
  total_events: number;
  expiring_soon: number;
}

export interface ExpirationAlert {
  pipette_id: number;
  pipette_codigo: string;
  type_event: string;
  expiration_date: string;
  days_left: number;
}
