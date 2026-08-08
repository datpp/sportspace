import axios from 'axios';
import { getAuth, getBookings, getCourts, getVenues } from '@sportspace/shared';
import { getAccessToken } from '../auth/session';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// openapi.json hiện chưa có endpoint /auth/refresh: refreshToken được lưu lại
// cho tương lai nhưng không dùng để silent-refresh. Khi accessToken hết hạn
// (401 ngoài các endpoint /auth/*), điều hướng thẳng về Login qua handler này.
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = typeof error.config?.url === 'string' && error.config.url.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export const authApi = getAuth(apiClient);
export const venuesApi = getVenues(apiClient);
export const courtsApi = getCourts(apiClient);
export const bookingsApi = getBookings(apiClient);
