import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { getMatchingControllerFindAllResponseMock } from '@sportspace/shared/mocks';
import { MatchListScreen } from '../MatchListScreen';
import type { MatchesStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const navigate = jest.fn();
const navigation = { navigate } as unknown as NativeStackNavigationProp<
  MatchesStackParamList,
  'MatchList'
>;

async function renderScreen() {
  return render(
    <NavigationContainer>
      <MatchListScreen navigation={navigation} route={{ key: 'MatchList', name: 'MatchList' }} />
    </NavigationContainer>,
  );
}

describe('MatchListScreen', () => {
  afterEach(() => {
    navigate.mockClear();
  });

  it('hiển thị danh sách kèo sau khi tải xong', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.queryByTestId('match-list-loading')).toBeNull());
    expect(screen.getByTestId('match-list')).toBeTruthy();
  });

  it('hiển thị empty state khi không có kèo nào', async () => {
    server.use(http.get('*/matches', () => HttpResponse.json([], { status: 200 })));

    await renderScreen();

    expect(await screen.findByTestId('match-list-empty')).toBeTruthy();
  });

  it('hiển thị error state khi API lỗi và cho thử lại', async () => {
    server.use(http.get('*/matches', () => HttpResponse.json({ message: 'fail' }, { status: 500 })));

    await renderScreen();

    expect(await screen.findByTestId('match-list-error')).toBeTruthy();
  });

  it('lọc theo bộ môn gửi đúng query param sport', async () => {
    let capturedSport: string | null = null;
    server.use(
      http.get('*/matches', ({ request }) => {
        const url = new URL(request.url);
        capturedSport = url.searchParams.get('sport');
        return HttpResponse.json(getMatchingControllerFindAllResponseMock(), { status: 200 });
      }),
    );
    const user = userEvent.setup();
    await renderScreen();
    await waitFor(() => expect(screen.queryByTestId('match-list-loading')).toBeNull());

    await user.type(screen.getByTestId('match-sport-input'), 'cau-long');
    await user.press(screen.getByTestId('match-search-submit'));

    await waitFor(() => expect(capturedSport).toBe('cau-long'));
  });

  it('bấm vào 1 kèo điều hướng sang MatchDetail đúng matchId', async () => {
    const oneMatch = getMatchingControllerFindAllResponseMock().slice(0, 1);
    server.use(http.get('*/matches', () => HttpResponse.json(oneMatch, { status: 200 })));
    const user = userEvent.setup();
    await renderScreen();

    const item = await screen.findByTestId(`match-item-${oneMatch[0].id}`);
    await user.press(item);

    expect(navigate).toHaveBeenCalledWith('MatchDetail', { matchId: oneMatch[0].id });
  });
});
