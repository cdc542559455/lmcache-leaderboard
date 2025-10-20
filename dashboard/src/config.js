// API configuration
// Automatically uses local API in development, Vercel API in production

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const API_BASE_URL = isDevelopment
  ? 'http://localhost:3001/api'  // Local development
  : '/api';  // Production (Vercel serverless functions)

export const API_ENDPOINTS = {
  updateManualContributions: `${API_BASE_URL}/update-manual-contributions`,
  exportManualContributions: `${API_BASE_URL}/export-manual-contributions`,
  pullAndRefresh: `${API_BASE_URL}/pull-and-refresh`,
  health: `${API_BASE_URL}/health`,
};

console.log(`🔧 API Mode: ${isDevelopment ? 'Development (localhost)' : 'Production (Vercel)'}`);
console.log(`🌐 API Base URL: ${API_BASE_URL}`);
