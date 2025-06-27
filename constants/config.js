// In development, replace this IP with your computer's local IP address
// You can find this by running `ipconfig` on Windows or `ifconfig` on Mac/Linux
export const API_BASE_URL = 'http://192.168.1.153:8000';

export const ENDPOINTS = {
    SIGN_IN: `${API_BASE_URL}/api/signin/`,
    SIGN_UP: `${API_BASE_URL}/api/signup/`,
    SIGN_OUT: `${API_BASE_URL}/api/signout/`,
    PASSWORD_RESET: `${API_BASE_URL}/api/password-reset/`,
    PASSWORD_RESET_CONFIRM: (uid, token) => `${API_BASE_URL}/api/password-reset/${uid}/${token}/`,
    USER: `${API_BASE_URL}/api/user/`,
}; 