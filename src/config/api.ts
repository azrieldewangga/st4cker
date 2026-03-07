// API Configuration
// Uses Vite environment variables with fallback to default production server

const DEFAULT_SERVER_URL = 'http://178.128.215.237:3000';

export const API_CONFIG = {
  // Base URL for API requests
  BASE_URL: import.meta.env.VITE_API_BASE_URL || DEFAULT_SERVER_URL,

  // API Endpoints
  ENDPOINTS: {
    SYNC_USER_DATA: '/api/sync-user-data',
    TASKS: '/api/v1/tasks',
    PROJECTS: '/api/v1/projects',
    TRANSACTIONS: '/api/v1/transactions',
    SCHEDULES: '/api/v1/schedules',
    SCHEDULES_SYNC: '/api/v1/schedules/sync',
    SCHEDULES_SYNC_STATUS: '/api/v1/schedules/sync-status',
    BALANCE: '/api/v1/balance',
  },

  // WebSocket URL
  WEBSOCKET_URL: import.meta.env.VITE_WEBSOCKET_URL || 'http://178.128.215.237:3000',
};

// Helper to build full API URL
export const buildApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  return url;
};

export default API_CONFIG;
