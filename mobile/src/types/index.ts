/**
 * HeatGuard Twin — Shared TypeScript Types
 */

export type WorkerCategory =
  | 'construction'
  | 'delivery'
  | 'street_vendor'
  | 'traffic_police';

export type MetricType =
  | 'heart_rate'
  | 'steps'
  | 'distance'
  | 'oxygen_saturation'
  | 'skin_temperature';

export type DataSource =
  | 'health_connect'
  | 'synthetic'
  | 'simulated'
  | 'manual';

export type AssessmentStatus =
  | 'insufficient_data'
  | 'no_unusual_pattern'
  | 'monitor'
  | 'supervisor_review';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Worker {
  id: string;
  display_name: string;
  category: WorkerCategory;
  age_years: number | null;
  baseline_hr_bpm: number | null;
  is_synthetic: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerListResponse {
  workers: Worker[];
  total: number;
}

export interface WearableReading {
  id: string;
  worker_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  measured_at: string;
  source: DataSource;
  is_synthetic: boolean;
  source_record_id: string | null;
  created_at: string;
}

export interface ReadingListResponse {
  readings: WearableReading[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReadingCreate {
  worker_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  measured_at: string;
  source: DataSource;
  is_synthetic: boolean;
  source_record_id?: string | null;
}

export interface DataQuality {
  freshness: 'recent' | 'stale' | 'unavailable';
  baseline_available: boolean;
  reading_count: number;
}

export interface EnvironmentContext {
  temperature_c: number | null;
  humidity_pct: number | null;
  source: string;
  observed_at: string | null;
}

export interface MLPrediction {
  risk_level: number;
  risk_label: string;
  confidence: number;
  probabilities: Record<string, number>;
  source: string;
  model_name: string;
  disclaimer: string;
}

export interface MLHealthResponse {
  status: string;
  service_available: boolean;
  local_model_available: boolean;
  active_mode: string;
  model_path: string | null;
  token_auth_enabled: boolean;
  token_status: string;
  trained_at: string | null;
  test_accuracy: number | null;
  test_f1_macro: number | null;
  disclaimer: string;
}

export interface AssessmentResponse {
  worker_id: string;
  status: AssessmentStatus;
  assessment_type: string;
  observations: string[];
  environment: EnvironmentContext | null;
  data_quality: DataQuality;
  recommended_actions: string[];
  assessed_at: string;
  latest_hr: number | null;
  baseline_hr: number | null;
  ml_prediction?: MLPrediction | null;
}

export interface WeatherResponse {
  latitude: number;
  longitude: number;
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_speed_kmh: number | null;
  weather_code: number | null;
  source: string;
  is_simulated: boolean;
  observed_at: string;
  fetched_at: string;
}

export interface DemoStatus {
  demo_mode: boolean;
  worker_count: number;
  reading_count: number;
  categories: Record<string, number>;
  last_reset: string | null;
}

export interface HealthCheckResponse {
  status: string;
  version: string;
  environment: string;
  database: string;
}

// Health Connect types
export interface HealthConnectReading {
  type: MetricType;
  value: number;
  unit: string;
  startTime: string;
  endTime?: string;
  metadata?: {
    id?: string;
    dataOrigin?: { packageName: string };
  };
}

// App state
export interface SyncStatus {
  lastSyncAt: string | null;
  isConnected: boolean;
  isSyncing: boolean;
  error: string | null;
}

export interface ConsentState {
  hasConsented: boolean;
  consentVersion: string;
  consentedAt: string | null;
}

// Authentication & OTP types
export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  worker_id?: string | null;
  created_at: string;
  last_login_at?: string | null;
}

export interface OTPResponse {
  message: string;
  email: string;
  mode?: 'login' | 'register';
  cooldown_seconds: number;
  expires_in_minutes: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
