// API configuration
// Automatically uses local API in development, Vercel API in production

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Use environment variable for API URL in development, or default to relative path
export const API_BASE_URL = isDevelopment
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')  // Development: use env var or localhost
  : '/api';  // Production (Vercel serverless functions)

export const API_ENDPOINTS = {
  updateManualContributions: `${API_BASE_URL}/update-manual-contributions`,
  exportManualContributions: `${API_BASE_URL}/export-manual-contributions`,
  pullAndRefresh: `${API_BASE_URL}/pull-and-refresh`,
  health: `${API_BASE_URL}/health`,
};

console.log(`🔧 API Mode: ${isDevelopment ? 'Development (localhost)' : 'Production (Vercel)'}`);
console.log(`🌐 API Base URL: ${API_BASE_URL}`);
