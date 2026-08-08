import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/server';
import { apiClient } from '../client';
import { clearSession, saveSession } from '../../auth/session';
import { Role } from '@sportspace/shared';

describe('apiClient request interceptor', () => {
  beforeEach(() => {
    server.use(
      http.get('*/ping', ({ request }) => {
        return HttpResponse.json({ authorization: request.headers.get('authorization') });
      }),
    );
  });

  afterEach(async () => {
    await clearSession();
  });

  it('gắn Bearer accessToken khi đã đăng nhập', async () => {
    await saveSession({
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      userId: 'user-1',
      role: Role.PLAYER,
    });

    const response = await apiClient.get('/ping');

    expect(response.data.authorization).toBe('Bearer access-123');
  });

  it('không gắn header Authorization khi chưa đăng nhập', async () => {
    const response = await apiClient.get('/ping');

    expect(response.data.authorization).toBeNull();
  });
});
