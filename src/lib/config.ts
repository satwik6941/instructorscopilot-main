// API Configuration with better environment handling
export const API_BASE: string = (() => {
  // Try to get from Vite environment variables
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  
  // Try legacy environment variable
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) {
    return (import.meta as any).env.VITE_API_BASE;
  }
  
  // Try Node.js environment (fallback)
  if (typeof process !== 'undefined' && (process as any).env?.VITE_API_BASE) {
    return (process as any).env.VITE_API_BASE;
  }
  
  // Production fallback - Updated with actual Render URL
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) {
    return 'https://instructorscopilot-main.onrender.com';
  }
  
  // Development fallback
  return 'http://localhost:8000';
})();

// Add timeout and polling configuration
export const API_TIMEOUT = 300000; // 5 minutes timeout for long operations
export const POLLING_INTERVAL = 2000; // 2 seconds for status polling

// Log the API base for debugging
console.log('API_BASE configured as:', API_BASE);
