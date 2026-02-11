/**
 * API Client for communicating with FastAPI backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // If endpoint is already absolute (rare), use it. Otherwise prepend base.
  // With empty base, it creates relative URL like "/analyze"
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Unknown error',
        detail: response.statusText,
      }));
      throw errorData;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Upload files as FormData
 */
async function fetchUpload<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  // Check if endpoint is absolute
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Unknown error',
        detail: response.statusText,
      }));
      throw errorData;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Upload Error [${endpoint}]:`, error);
    throw error;
  }
}

// ============================================================================
// Configs API
// ============================================================================

export async function analyzeConfig(formData: FormData) {
  // Use legacy endpoint matching Vite proxy
  return fetchUpload('/analyze', formData);
}

export async function convertConfig(formData: FormData) {
  // Using legacy endpoint as seen in Step2_Mapping
  return fetchUpload('/convert', formData);
}

export async function listVendors() {
  return fetchApi('/api/v1/configs/vendors');
}

export async function getVendorCapabilities(vendorId: string) {
  return fetchApi(`/api/v1/configs/vendors/${vendorId}/capabilities`);
}

// ============================================================================
// Health Check
// ============================================================================

export async function healthCheck() {
  return fetchApi('/health');
}

// ============================================================================
// Export
// ============================================================================

const apiClient = {
  analyzeConfig,
  convertConfig,
  listVendors,
  getVendorCapabilities,
  healthCheck,
};

export default apiClient;
