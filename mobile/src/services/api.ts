/**
 * HeatGuard Twin — API Service
 * Axios-based client for FastAPI backend communication.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  AssessmentResponse,
  DemoStatus,
  HealthCheckResponse,
  MLHealthResponse,
  MLPrediction,
  ReadingCreate,
  ReadingListResponse,
  WeatherResponse,
  Worker,
  WorkerListResponse,
  OTPResponse,
  TokenResponse,
  User,
} from '../types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Permanent non-expiring API token used across mobile and backend microservices
const PERMANENT_API_TOKEN =
  process.env.EXPO_PUBLIC_API_TOKEN || 'heatguard-permanent-token-2026';

export const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  // If a remote URL is provided in .env (e.g. Render, Railway, cloud domain), always prioritize it
  if (envUrl && (envUrl.startsWith('https://') || envUrl.includes('.onrender.com') || envUrl.includes('ngrok'))) {
    return envUrl.replace(/\/+$/, '');
  }

  // If running on web, talk to the current browser host or localhost
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:8000`;
    }
    return 'http://localhost:8000';
  }

  // Fallback: If running in Expo Go on a physical phone, dynamically resolve Metro bundler host IP
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000`;
    }
  }

  // If explicitly specified in .env (e.g. custom LAN IP)
  if (envUrl && !envUrl.includes('10.0.2.2')) {
    return envUrl.replace(/\/+$/, '');
  }

  // Android emulator fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
};

const client: AxiosInstance = axios.create({
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client': 'heatguard-mobile/1.0.0',
    'X-API-Key': PERMANENT_API_TOKEN,
    Authorization: `Bearer ${PERMANENT_API_TOKEN}`,
  },
});

let activeUserToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  activeUserToken = token;
};

export const getAuthToken = (): string | null => activeUserToken;

// Dynamically set baseURL before each request to ensure physical device IP is always current
client.interceptors.request.use((config) => {
  const base = getBaseUrl();
  config.baseURL = `${base}/api/v1`;
  if (activeUserToken) {
    config.headers.Authorization = `Bearer ${activeUserToken}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function extractMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    if (err.response?.data?.detail) {
      const d = err.response.data.detail;
      return typeof d === 'string' ? d : JSON.stringify(d);
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

export class ApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AxiosError) {
      throw new ApiError(extractMessage(err), err.response?.status ?? 0);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const checkHealth = (): Promise<HealthCheckResponse> => {
  const base = getBaseUrl();
  return request(() => axios.get(`${base}/health`, { timeout: 10_000 }).then(r => r.data));
};

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

export const fetchWorkers = (params?: {
  category?: string;
  active_only?: boolean;
  page?: number;
  page_size?: number;
}): Promise<WorkerListResponse> =>
  request(() => client.get('/workers', { params }).then(r => r.data));

export const fetchWorker = (workerId: string): Promise<Worker> =>
  request(() => client.get(`/workers/${workerId}`).then(r => r.data));

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

export const submitReading = (reading: ReadingCreate): Promise<unknown> =>
  request(() => client.post('/readings', reading).then(r => r.data));

export const submitBatchReadings = (
  readings: ReadingCreate[]
): Promise<{ stored: number; duplicates: number; errors: string[]; total: number }> =>
  request(() => client.post('/readings/batch', { readings }).then(r => r.data));

export const fetchWorkerReadings = (
  workerId: string,
  params?: { metric_type?: string; page?: number; page_size?: number }
): Promise<ReadingListResponse> =>
  request(() =>
    client.get(`/readings/${workerId}`, { params }).then(r => r.data)
  );

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export const fetchWorkerAssessment = (
  workerId: string
): Promise<AssessmentResponse> =>
  request(() =>
    client.get(`/assessments/workers/${workerId}`).then(r => r.data)
  );

export const fetchAssessments = (params?: {
  worker_id?: string;
  limit?: number;
}): Promise<AssessmentResponse[]> =>
  request(() => client.get('/assessments', { params }).then(r => r.data));

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export const fetchCurrentWeather = (params?: {
  lat?: number;
  lon?: number;
}): Promise<WeatherResponse> =>
  request(() => client.get('/weather/current', { params }).then(r => r.data));

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export const fetchDemoStatus = (): Promise<DemoStatus> =>
  request(() => client.get('/demo/status').then(r => r.data));

export const resetDemo = (): Promise<{
  success: boolean;
  message: string;
  worker_count: number;
}> => request(() => client.post('/demo/reset').then(r => r.data));

// ---------------------------------------------------------------------------
// Machine Learning Pipeline
// ---------------------------------------------------------------------------

export const fetchMLHealth = (): Promise<MLHealthResponse> =>
  request(() => client.get('/ml/health').then(r => r.data));

export const predictML = (payload: {
  heart_rate_bpm: number;
  baseline_hr_bpm: number;
  temperature_c: number;
  humidity_pct: number;
  heat_index?: number;
  age_years?: number;
  minutes_since_break?: number;
  activity_level?: number;
  reading_age_minutes?: number;
}): Promise<MLPrediction> =>
  request(() => client.post('/ml/predict', payload).then(r => r.data));

// ---------------------------------------------------------------------------
// Authentication & OTP Verification (Brevo)
// ---------------------------------------------------------------------------

export const requestOTP = (
  email: string,
  mode: 'login' | 'register' = 'login',
  fullName?: string,
  role: string = 'admin'
): Promise<OTPResponse> =>
  request(() =>
    client
      .post('/auth/request-otp', {
        email,
        mode,
        full_name: fullName,
        role,
      })
      .then(r => r.data)
  );

export const resendOTP = (
  email: string,
  mode: 'login' | 'register' = 'login',
  fullName?: string,
  role: string = 'admin'
): Promise<OTPResponse> =>
  request(() =>
    client
      .post('/auth/resend-otp', {
        email,
        mode,
        full_name: fullName,
        role,
      })
      .then(r => r.data)
  );

export const verifyOTP = (
  email: string,
  otp: string,
  mode: 'login' | 'register' = 'login',
  fullName?: string,
  role: string = 'admin'
): Promise<TokenResponse> =>
  request(() =>
    client
      .post('/auth/verify-otp', {
        email,
        otp,
        mode,
        full_name: fullName,
        role,
      })
      .then(r => {
        if (r.data?.access_token) {
          setAuthToken(r.data.access_token);
        }
        return r.data;
      })
  );

export const fetchCurrentUser = (): Promise<User> =>
  request(() => client.get('/auth/me').then(r => r.data));

export const updateCurrentUser = (payload: {
  full_name?: string;
  role?: string;
}): Promise<User> =>
  request(() => client.put('/auth/me', payload).then(r => r.data));

export const logoutUser = (): Promise<{ message: string }> =>
  request(() =>
    client.post('/auth/logout').then(r => {
      setAuthToken(null);
      return r.data;
    })
  );

