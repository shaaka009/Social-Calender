import Constants from 'expo-constants';
import { clearTokens, getAccessToken, getRefreshToken, isTokenExpired, storeTokens } from './auth';

// Callback invoked when a session definitively expires (refresh token rejected).
// Registered by the root layout to redirect to /welcome and clear cached data.
let _onSessionExpired = null;
export function setOnSessionExpired(fn) {
  _onSessionExpired = fn;
}

const DEFAULT_API_BASE = 'http://127.0.0.1:8000';

/**
 * EXPO_PUBLIC_API_URL wins (production, tunnels, custom setups). In __DEV__, if unset,
 * use the same host Expo uses for Metro (LAN IP when you scan the QR code) so Django
 * on :8000 is reachable from a physical device.
 */
function resolveApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (!__DEV__) return DEFAULT_API_BASE;

  const raw = Constants.expoConfig?.hostUri;
  if (!raw) return DEFAULT_API_BASE;

  let hostname;
  try {
    const normalized = raw.includes('://') ? raw : `http://${raw}`;
    hostname = new URL(normalized).hostname;
  } catch {
    return DEFAULT_API_BASE;
  }

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  ) {
    return DEFAULT_API_BASE;
  }

  const privateLan =
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

  if (privateLan || hostname === '10.0.2.2' || hostname.endsWith('.local')) {
    return `http://${hostname}:8000`;
  }

  // e.g. Expo tunnel — set EXPO_PUBLIC_API_URL to a reachable API base
  return DEFAULT_API_BASE;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const ENDPOINTS = {
  SIGN_IN: `${API_BASE_URL}/api/signin/`,
  SIGN_UP: `${API_BASE_URL}/api/signup/`,
  VERIFY_EMAIL: `${API_BASE_URL}/api/verify-email/`,
  RESEND_VERIFICATION_EMAIL: `${API_BASE_URL}/api/verify-email/resend/`,
  REQUEST_LOGIN_EMAIL_CHANGE: `${API_BASE_URL}/api/login-email/change/request/`,
  VERIFY_LOGIN_EMAIL_CHANGE: `${API_BASE_URL}/api/login-email/change/verify/`,
  SIGN_OUT: `${API_BASE_URL}/api/signout/`,
  TOKEN_REFRESH: `${API_BASE_URL}/api/token/refresh/`,
  PASSWORD_RESET: `${API_BASE_URL}/api/password-reset/`,
  PASSWORD_RESET_CONFIRM: (uid, token) => {
    const u = encodeURIComponent(String(uid ?? ''));
    const t = encodeURIComponent(String(token ?? ''));
    return `${API_BASE_URL}/api/password-reset/${u}/${t}/`;
  },
  USER: `${API_BASE_URL}/api/user/`,
  DASHBOARD: `${API_BASE_URL}/api/dashboard/`,
  CONNECTIONS: `${API_BASE_URL}/api/connections/`,
  USER_SEARCH: `${API_BASE_URL}/api/users/search/`,
  INTERACTIONS: `${API_BASE_URL}/api/interactions/`,
  EVENTS: `${API_BASE_URL}/api/events/`,
  EVENT_DETAIL: (id) => `${API_BASE_URL}/api/events/${id}/`,
  PROFILE: `${API_BASE_URL}/api/profile/`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/account/change-password/`,
  DELETE_ACCOUNT: `${API_BASE_URL}/api/account/delete/`,
  TAGS: `${API_BASE_URL}/api/tags/`,
  TAG_DETAIL: (id) => `${API_BASE_URL}/api/tags/${id}/`,
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
        _onSessionExpired?.();
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
// Startup auth check: is there a usable session?
// Returns true only if we have a valid (or successfully refreshed)
// access token. A stale/expired token that can't be refreshed clears
// itself and returns false, so the app routes to /welcome instead of
// stranding the user on an authenticated screen.
// -----------------------------------------------------------------
export async function ensureValidSession() {
  const access = await getAccessToken();
  if (!access) return false;
  if (!isTokenExpired(access)) return true;
  return _refreshAccessToken();
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
