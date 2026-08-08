import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { Role } from '@sportspace/shared';
import { server } from '../../test-utils/server';
import { AuthProvider, useAuth } from '../AuthContext';
import { clearSession, getAccessToken, saveSession } from '../session';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  afterEach(async () => {
    await clearSession();
  });

  it('login thành công lưu session vào SecureStore và set user', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login({ email: 'player@sportspace.dev', password: 'secret123' });
    });

    expect(result.current.user).not.toBeNull();
    await expect(getAccessToken()).resolves.toEqual(expect.any(String));
  });

  it('login sai (401) không set session', async () => {
    server.use(
      http.post('*/auth/login', () =>
        HttpResponse.json({ message: 'Sai email hoặc mật khẩu' }, { status: 401 }),
      ),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login({ email: 'player@sportspace.dev', password: 'wrong' });
      }),
    ).rejects.toBeTruthy();

    expect(result.current.user).toBeNull();
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it('logout xoá session khỏi SecureStore', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register({
        email: 'new-player@sportspace.dev',
        password: 'secret123',
        fullName: 'Người Chơi Mới',
      });
    });
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it('khôi phục session lúc mount nếu SecureStore đã có token', async () => {
    await saveSession({
      accessToken: 'stored-access-token',
      refreshToken: 'stored-refresh-token',
      userId: 'user-9',
      role: Role.PLAYER,
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual({ userId: 'user-9', role: Role.PLAYER });
  });
});
