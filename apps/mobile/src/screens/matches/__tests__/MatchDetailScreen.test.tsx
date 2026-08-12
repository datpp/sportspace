import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { MatchParticipantStatus, MatchStatus, Role } from '@sportspace/shared';
import { server } from '../../../test-utils/server';
import {
  getMatchingControllerFindOneResponseMock,
  getMatchingControllerJoinResponseMock,
} from '@sportspace/shared/mocks';
import type { Match } from '@sportspace/shared';
import { MatchDetailScreen } from '../MatchDetailScreen';
import { AuthProvider } from '../../../auth/AuthContext';
import { clearSession, saveSession } from '../../../auth/session';
import type { MatchesStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const navigation = {} as unknown as NativeStackNavigationProp<MatchesStackParamList, 'MatchDetail'>;

async function renderScreen(matchId = 'match-1') {
  return render(
    <AuthProvider>
      <MatchDetailScreen navigation={navigation} route={{ key: 'MatchDetail', name: 'MatchDetail', params: { matchId } }} />
    </AuthProvider>,
  );
}

async function loginAs(userId: string) {
  await saveSession({
    accessToken: 'token',
    refreshToken: 'refresh',
    userId,
    role: Role.PLAYER,
  });
}

function matchWithHostId(hostId: string, overrides: Partial<Match> = {}): Match {
  const base = getMatchingControllerFindOneResponseMock(overrides);
  return { ...base, host: { ...base.host, id: hostId } };
}

describe('MatchDetailScreen', () => {
  afterEach(async () => {
    await clearSession();
  });

  it('hiển thị thông tin kèo sau khi tải xong', async () => {
    await loginAs('someone-else');
    await renderScreen();

    await waitFor(() => expect(screen.queryByTestId('match-detail-loading')).toBeNull());
    expect(screen.getByTestId('match-detail-screen')).toBeTruthy();
  });

  it('hiển thị error state khi API lỗi', async () => {
    server.use(http.get('*/matches/:id', () => HttpResponse.json({ message: 'fail' }, { status: 500 })));
    await loginAs('someone-else');

    await renderScreen();

    expect(await screen.findByTestId('match-detail-error')).toBeTruthy();
  });

  it('host thấy danh sách người xin ghép, không thấy nút xin ghép', async () => {
    const participant = getMatchingControllerJoinResponseMock({ status: MatchParticipantStatus.REQUESTED });
    const match = matchWithHostId('host-1', { participants: [participant] });
    server.use(http.get('*/matches/:id', () => HttpResponse.json(match, { status: 200 })));
    await loginAs('host-1');

    await renderScreen();

    expect(await screen.findByTestId('match-participants-section')).toBeTruthy();
    expect(screen.getByTestId(`participant-item-${participant.id}`)).toBeTruthy();
    expect(screen.queryByTestId('match-join-submit')).toBeNull();
  });

  it('host thấy empty state khi chưa có ai xin ghép', async () => {
    const match = matchWithHostId('host-1', { participants: [] });
    server.use(http.get('*/matches/:id', () => HttpResponse.json(match, { status: 200 })));
    await loginAs('host-1');

    await renderScreen();

    expect(await screen.findByTestId('match-participants-empty')).toBeTruthy();
  });

  it('host duyệt yêu cầu ghép gọi đúng API rồi refetch cập nhật trạng thái', async () => {
    let participant = getMatchingControllerJoinResponseMock({
      id: 'p-1',
      status: MatchParticipantStatus.REQUESTED,
    });
    const baseMatch = matchWithHostId('host-1', {});
    // GET đọc `participant` động (closure) để phản ánh đúng trạng thái sau
    // khi accept — mô phỏng backend thật thay vì trả response tĩnh.
    server.use(
      http.get('*/matches/:id', () =>
        HttpResponse.json({ ...baseMatch, participants: [participant] }, { status: 200 }),
      ),
    );
    server.use(
      http.post('*/matches/:id/participants/:participantId/accept', () => {
        participant = { ...participant, status: MatchParticipantStatus.ACCEPTED };
        return HttpResponse.json(participant, { status: 201 });
      }),
    );
    await loginAs('host-1');
    const user = userEvent.setup();

    await renderScreen();
    await user.press(await screen.findByTestId('participant-accept-p-1'));

    await waitFor(() => expect(screen.queryByTestId('participant-accept-p-1')).toBeNull());
    expect(screen.getByTestId('participant-item-p-1')).toHaveTextContent('Đã chấp nhận', {
      exact: false,
    });
  });

  it('host từ chối yêu cầu ghép gọi đúng API rồi refetch cập nhật trạng thái', async () => {
    let participant = getMatchingControllerJoinResponseMock({
      id: 'p-1',
      status: MatchParticipantStatus.REQUESTED,
    });
    const baseMatch = matchWithHostId('host-1', {});
    server.use(
      http.get('*/matches/:id', () =>
        HttpResponse.json({ ...baseMatch, participants: [participant] }, { status: 200 }),
      ),
    );
    server.use(
      http.post('*/matches/:id/participants/:participantId/reject', () => {
        participant = { ...participant, status: MatchParticipantStatus.REJECTED };
        return HttpResponse.json(participant, { status: 201 });
      }),
    );
    await loginAs('host-1');
    const user = userEvent.setup();

    await renderScreen();
    await user.press(await screen.findByTestId('participant-reject-p-1'));

    await waitFor(() => expect(screen.queryByTestId('participant-reject-p-1')).toBeNull());
    expect(screen.getByTestId('participant-item-p-1')).toHaveTextContent('Đã từ chối', {
      exact: false,
    });
  });

  it('non-host xin ghép thành công hiện thông báo chờ duyệt', async () => {
    const match = matchWithHostId('host-1', { slotsTotal: 4, slotsFilled: 1, status: MatchStatus.OPEN });
    server.use(http.get('*/matches/:id', () => HttpResponse.json(match, { status: 200 })));
    server.use(http.post('*/matches/:id/join', () => HttpResponse.json({ id: 'p1' }, { status: 201 })));
    await loginAs('player-2');
    const user = userEvent.setup();

    await renderScreen();
    await user.press(await screen.findByTestId('match-join-submit'));

    expect(await screen.findByTestId('match-join-success')).toBeTruthy();
  });

  it('xin ghép gặp 409 báo lỗi phù hợp', async () => {
    const match = matchWithHostId('host-1', { slotsTotal: 4, slotsFilled: 1, status: MatchStatus.OPEN });
    server.use(http.get('*/matches/:id', () => HttpResponse.json(match, { status: 200 })));
    server.use(
      http.post('*/matches/:id/join', () =>
        HttpResponse.json({ message: 'Đã xin ghép rồi' }, { status: 409 }),
      ),
    );
    await loginAs('player-2');
    const user = userEvent.setup();

    await renderScreen();
    await user.press(await screen.findByTestId('match-join-submit'));

    expect(await screen.findByTestId('match-join-error')).toBeTruthy();
  });

  it('kèo đã đủ người thì không hiện nút xin ghép', async () => {
    const match = matchWithHostId('host-1', { slotsTotal: 4, slotsFilled: 4 });
    server.use(http.get('*/matches/:id', () => HttpResponse.json(match, { status: 200 })));
    await loginAs('player-2');

    await renderScreen();

    expect(await screen.findByTestId('match-full')).toBeTruthy();
    expect(screen.queryByTestId('match-join-submit')).toBeNull();
  });
});
