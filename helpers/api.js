export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.153:8000';

export const ENDPOINTS = {
  SIGN_IN: `${API_BASE_URL}/api/signin/`,
  SIGN_UP: `${API_BASE_URL}/api/signup/`,
  SIGN_OUT: `${API_BASE_URL}/api/signout/`,
  PASSWORD_RESET: `${API_BASE_URL}/api/password-reset/`,
  PASSWORD_RESET_CONFIRM: (uid, token) =>
    `${API_BASE_URL}/api/password-reset/${uid}/${token}/`,
  USER: `${API_BASE_URL}/api/user/`,
};

// Lightweight wrapper around fetch that always includes credentials and throws on non-2xx
export const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, { credentials: 'include', ...options });
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* ignore – not all responses have JSON */
  }
  if (!response.ok) {
    const message = data?.message || data?.detail || 'Network request failed';
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}; 