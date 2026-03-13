import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// SecureStore works on iOS/Android; for web we fall back to in-memory (or localStorage).
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// In-memory fallback for web (or environments where SecureStore isn't available)
const _mem = {};

async function _get(key) {
  if (isNative) {
    return SecureStore.getItemAsync(key);
  }
  return _mem[key] ?? null;
}

async function _set(key, value) {
  if (isNative) {
    return SecureStore.setItemAsync(key, value);
  }
  _mem[key] = value;
}

async function _del(key) {
  if (isNative) {
    return SecureStore.deleteItemAsync(key);
  }
  delete _mem[key];
}

// -------------------------------------------------------
// Public API
// -------------------------------------------------------

export async function getAccessToken() {
  return _get(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return _get(REFRESH_TOKEN_KEY);
}

export async function storeTokens({ access, refresh }) {
  await _set(ACCESS_TOKEN_KEY, access);
  await _set(REFRESH_TOKEN_KEY, refresh);
}

export async function clearTokens() {
  await _del(ACCESS_TOKEN_KEY);
  await _del(REFRESH_TOKEN_KEY);
}

export async function isAuthenticated() {
  const token = await getAccessToken();
  return !!token;
}
