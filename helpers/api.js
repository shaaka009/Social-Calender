export const API_BASE_URL = 'http://127.0.0.1:8000';

export const ENDPOINTS = {
  SIGN_IN: `${API_BASE_URL}/api/signin/`,
  SIGN_UP: `${API_BASE_URL}/api/signup/`,
  SIGN_OUT: `${API_BASE_URL}/api/signout/`,
  PASSWORD_RESET: `${API_BASE_URL}/api/password-reset/`,
  PASSWORD_RESET_CONFIRM: (uid, token) =>
    `${API_BASE_URL}/api/password-reset/${uid}/${token}/`,
  USER: `${API_BASE_URL}/api/user/`,
  DASHBOARD: `${API_BASE_URL}/api/dashboard/`,
  CONNECTIONS: `${API_BASE_URL}/api/connections/`,
  USER_SEARCH: `${API_BASE_URL}/api/users/search/`,
  INTERACTIONS: `${API_BASE_URL}/api/interactions/`,
  EVENTS: `${API_BASE_URL}/api/events/`,
  EVENT_DETAIL: (id) => `${API_BASE_URL}/api/events/${id}/`,
  PROFILE: `${API_BASE_URL}/api/profile/`,
  TAGS: `${API_BASE_URL}/api/tags/`,
};

// Lightweight wrapper around fetch that always includes credentials and throws on non-2xx
export const apiFetch = async (url, options = {}) => {
  // Add Content-Type: application/json for non-GET requests that have a body (except FormData)
  const isFormData = options.body instanceof FormData;
  const headers = options.body && !isFormData ? {
    'Content-Type': 'application/json',
    ...options.headers,
  } : options.headers;

  try {
    const response = await fetch(url, { 
      credentials: 'include',  // This ensures cookies are sent
      ...options,
      headers,
    });

    // For DELETE requests that return 204 No Content, return null
    if (response.status === 204) {
      return null;
    }

    let data = null;
    const text = await response.text();
    
    // Only try to parse as JSON if there's actual content
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        throw new Error('Invalid JSON response from server');
      }
    }

    if (!response.ok) {
      const message = data?.message || data?.detail || 'Network request failed';
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    // Only log actual errors, not debug info
    if (error.status >= 500 || !error.status) {
      console.error(`API Request to ${url} failed:`, error.message);
    }
    throw error;
  }
}; 