import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from './auth';

// Use an Expo env var when available; fall back to localhost for development.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const ENDPOINTS = {
  SIGN_IN: `${API_BASE_URL}/api/signin/`,
  SIGN_UP: `${API_BASE_URL}/api/signup/`,
  VERIFY_EMAIL: `${API_BASE_URL}/api/verify-email/`,
  RESEND_VERIFICATION_EMAIL: `${API_BASE_URL}/api/verify-email/resend/`,
  SIGN_OUT: `${API_BASE_URL}/api/signout/`,
  TOKEN_REFRESH: `${API_BASE_URL}/api/token/refresh/`,
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
  DELETE_ACCOUNT: `${API_BASE_URL}/api/account/delete/`,
  TAGS: `${API_BASE_URL}/api/tags/`,
};

// -----------------------------------------------------------------
// Internal: attempt to refresh the access token using the refresh
// token.  Returns `true` if successful.
// -----------------------------------------------------------------
let _refreshPromise = null;

async function _refreshAccessToken() {
  // Deduplicate concurrent refreshes
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(ENDPOINTS.TOKEN_REFRESH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!res.ok) {
        // Refresh token is also expired / invalid → force logout
        await clearTokens();
        return false;
      }

      const data = await res.json();
      await storeTokens({
        access: data.access,
        refresh: data.refresh ?? refreshToken, // keep old refresh if server didn't rotate
      });
      return true;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// -----------------------------------------------------------------
// Public fetch wrapper: attaches JWT, auto-refreshes on 401, throws
// on non-2xx.
// -----------------------------------------------------------------
export const apiFetch = async (url, options = {}, _retried = false) => {
  const accessToken = await getAccessToken();

  // Build headers
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 401 and we haven't retried yet → try refreshing
    if (response.status === 401 && !_retried) {
      const refreshed = await _refreshAccessToken();
      if (refreshed) {
        return apiFetch(url, options, true);
      }
      // Refresh failed — surface the 401
    }

    // 204 No Content
    if (response.status === 204) return null;

    let data = null;
    const text = await response.text();
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
    if (error.status >= 500 || !error.status) {
      console.error(`API Request to ${url} failed:`, error.message);
    }
    throw error;
  }
};
