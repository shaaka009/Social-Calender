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
  CONTACTS: `${API_BASE_URL}/api/contacts/`,
  USER_SEARCH: `${API_BASE_URL}/api/users/search/`,
};

// Lightweight wrapper around fetch that always includes credentials and throws on non-2xx
export const apiFetch = async (url, options = {}) => {
  // Add Content-Type: application/json for non-GET requests that have a body
  const headers = options.body ? {
    'Content-Type': 'application/json',
    ...options.headers,
  } : options.headers;

  const response = await fetch(url, { 
    credentials: 'include',  // This ensures cookies are sent
    ...options,
    headers,
  });
  
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    console.error('Failed to parse response:', error);
    /* ignore – not all responses have JSON */
  }
  if (!response.ok) {
    const message = data?.message || data?.detail || 'Network request failed';
    console.error('API Error:', {
      status: response.status,
      message,
      data,
    });
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}; 