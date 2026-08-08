import * as SecureStore from 'expo-secure-store';
import type { AuthResponseDto } from '@sportspace/shared';

const ACCESS_TOKEN_KEY = 'sportspace.accessToken';
const REFRESH_TOKEN_KEY = 'sportspace.refreshToken';
const USER_ID_KEY = 'sportspace.userId';
const ROLE_KEY = 'sportspace.role';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  role: AuthResponseDto['role'];
}

export async function saveSession(auth: AuthResponseDto): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, auth.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, auth.refreshToken),
    SecureStore.setItemAsync(USER_ID_KEY, auth.userId),
    SecureStore.setItemAsync(ROLE_KEY, auth.role),
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, userId, role] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(USER_ID_KEY),
    SecureStore.getItemAsync(ROLE_KEY),
  ]);
  if (!accessToken || !refreshToken || !userId || !role) {
    return null;
  }
  return { accessToken, refreshToken, userId, role: role as AuthResponseDto['role'] };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_ID_KEY),
    SecureStore.deleteItemAsync(ROLE_KEY),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}
