import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import type { Match } from '@sportspace/shared';
import { MatchStatus } from '@sportspace/shared';
import { matchesApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { MatchesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

type JoinState = 'idle' | 'submitting' | 'requested' | 'error';

export function MatchDetailScreen({ route }: Props) {
  const { matchId } = route.params;
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinState, setJoinState] = useState<JoinState>('idle');
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchMatch = useCallback(async () => {
    setError(null);
    try {
      const { data } = await matchesApi.matchingControllerFindOne(matchId);
      setMatch(data);
    } catch {
      setError('Không tải được thông tin kèo');
    }
  }, [matchId]);

  useEffect(() => {
    void fetchMatch();
  }, [fetchMatch]);

  const handleJoin = async () => {
    setJoinState('submitting');
    setJoinError(null);
    try {
      await matchesApi.matchingControllerJoin(matchId);
      setJoinState('requested');
    } catch (err) {
      setJoinState('error');
      const status = isAxiosError(err) ? err.response?.status : undefined;
      setJoinError(
        status === 409 ? 'Kèo đã đủ người hoặc bạn đã xin ghép rồi' : 'Xin ghép thất bại, vui lòng thử lại',
      );
    }
  };

  if (error) {
    return (
      <View style={styles.centerFill} testID="match-detail-error">
        <Text style={styles.errorText}>{error}</Text>
        <Pressable testID="match-detail-retry" onPress={() => void fetchMatch()}>
          <Text style={styles.link}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.centerFill} testID="match-detail-loading">
        <ActivityIndicator />
      </View>
    );
  }

  const isHost = user?.userId === match.host.id;
  const isFull = match.status === MatchStatus.CLOSED || match.slotsFilled >= match.slotsTotal;

  return (
    <View style={styles.container} testID="match-detail-screen">
      <Text style={styles.title}>{match.booking.court.sport}</Text>
      <Text style={styles.subtitle}>{match.booking.court.name}</Text>
      <Text style={styles.subtitle}>
        {match.booking.bookingDate} {match.booking.startTime}-{match.booking.endTime}
      </Text>
      <Text style={styles.host}>Chủ kèo: {match.host.fullName}</Text>
      <Text style={styles.slots}>
        {match.slotsFilled}/{match.slotsTotal} chỗ đã ghép
      </Text>
      {match.skillLevel ? <Text style={styles.skill}>Trình độ: {match.skillLevel}</Text> : null}

      {isHost ? (
        <Text testID="match-host-note" style={styles.note}>
          Quản lý danh sách người xin ghép sẽ sớm có.
        </Text>
      ) : joinState === 'requested' ? (
        <Text testID="match-join-success" style={styles.success}>
          Đã gửi yêu cầu ghép kèo, chờ chủ kèo duyệt.
        </Text>
      ) : isFull ? (
        <Text testID="match-full" style={styles.note}>
          Kèo đã đủ người.
        </Text>
      ) : (
        <>
          {joinError ? (
            <Text testID="match-join-error" style={styles.errorText}>
              {joinError}
            </Text>
          ) : null}
          <Pressable
            testID="match-join-submit"
            style={styles.button}
            onPress={handleJoin}
            disabled={joinState === 'submitting'}
          >
            {joinState === 'submitting' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Xin ghép</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#555' },
  host: { color: '#333', marginTop: 8 },
  slots: { color: '#1d4ed8', fontWeight: '600' },
  skill: { color: '#333' },
  note: { color: '#888', marginTop: 16 },
  success: { color: '#16a34a', marginTop: 16, fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { color: '#dc2626' },
  link: { color: '#1d4ed8', fontWeight: '600' },
  button: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
