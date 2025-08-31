// API utility functions for better error handling and retries

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
}

export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  maxRetries: number = 3,
  timeout: number = 30000
): Promise<Response> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If request was successful, return immediately
      if (response.ok) {
        return response;
      }
      
      // If it's a client error (4xx), don't retry
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // For server errors (5xx), retry
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on abort errors (timeout)
      if (lastError.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.warn(`API request failed (attempt ${attempt}/${maxRetries}):`, lastError.message);
    }
  }
  
  throw lastError!;
}

export async function apiCall<T = unknown>(
  url: string, 
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<ApiResponse<T>> {
  try {
    const response = await fetchWithRetry(url, options, maxRetries);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage
    };
  }
}

export function getApiUrl(endpoint: string, baseUrl?: string): string {
  const base = baseUrl || (window as { API_BASE?: string }).API_BASE || 'http://localhost:8000';
  return `${base.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
}
