import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
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

// expo-secure-store has no web implementation; fall back to localStorage there.
async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveSession(auth: AuthResponseDto): Promise<void> {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, auth.accessToken),
    setItem(REFRESH_TOKEN_KEY, auth.refreshToken),
    setItem(USER_ID_KEY, auth.userId),
    setItem(ROLE_KEY, auth.role),
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, userId, role] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
    getItem(USER_ID_KEY),
    getItem(ROLE_KEY),
  ]);
  if (!accessToken || !refreshToken || !userId || !role) {
    return null;
  }
  return { accessToken, refreshToken, userId, role: role as AuthResponseDto['role'] };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    deleteItem(ACCESS_TOKEN_KEY),
    deleteItem(REFRESH_TOKEN_KEY),
    deleteItem(USER_ID_KEY),
    deleteItem(ROLE_KEY),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_TOKEN_KEY);
}
