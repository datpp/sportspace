import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import type { Match } from '@sportspace/shared';
import { MatchParticipantStatus, MatchStatus } from '@sportspace/shared';
import { matchesApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { MatchesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

type JoinState = 'idle' | 'submitting' | 'requested' | 'error';
type ParticipantAction = 'accepting' | 'rejecting';

const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  [MatchParticipantStatus.REQUESTED]: 'Đang chờ duyệt',
  [MatchParticipantStatus.ACCEPTED]: 'Đã chấp nhận',
  [MatchParticipantStatus.REJECTED]: 'Đã từ chối',
};

export function MatchDetailScreen({ route }: Props) {
  const { matchId } = route.params;
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinState, setJoinState] = useState<JoinState>('idle');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [participantActions, setParticipantActions] = useState<Record<string, ParticipantAction>>({});

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

  const handleAccept = async (participantId: string) => {
    setParticipantActions((prev) => ({ ...prev, [participantId]: 'accepting' }));
    try {
      await matchesApi.matchingControllerAcceptParticipant(matchId, participantId);
      // Duyệt cũng tăng slotsFilled phía server — refetch để lấy trạng thái
      // thật thay vì tự suy ra ở client.
      await fetchMatch();
    } catch {
      setError('Duyệt yêu cầu thất bại, vui lòng thử lại');
    } finally {
      setParticipantActions((prev) => {
        const { [participantId]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleReject = async (participantId: string) => {
    setParticipantActions((prev) => ({ ...prev, [participantId]: 'rejecting' }));
    try {
      await matchesApi.matchingControllerRejectParticipant(matchId, participantId);
      await fetchMatch();
    } catch {
      setError('Từ chối yêu cầu thất bại, vui lòng thử lại');
    } finally {
      setParticipantActions((prev) => {
        const { [participantId]: _removed, ...rest } = prev;
        return rest;
      });
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
    <ScrollView contentContainerStyle={styles.container} testID="match-detail-screen">
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
        <View style={styles.participantsSection} testID="match-participants-section">
          <Text style={styles.sectionTitle}>Người xin ghép</Text>
          {match.participants.length === 0 ? (
            <Text testID="match-participants-empty">Chưa có ai xin ghép</Text>
          ) : (
            match.participants.map((participant) => (
              <View
                key={participant.id}
                testID={`participant-item-${participant.id}`}
                style={styles.participantRow}
              >
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>{participant.user.fullName}</Text>
                  <Text style={styles.participantStatus}>
                    {PARTICIPANT_STATUS_LABEL[participant.status] ?? participant.status}
                  </Text>
                </View>
                {participant.status === MatchParticipantStatus.REQUESTED ? (
                  <View style={styles.participantActions}>
                    <Pressable
                      testID={`participant-accept-${participant.id}`}
                      style={styles.acceptButton}
                      disabled={!!participantActions[participant.id]}
                      onPress={() => void handleAccept(participant.id)}
                    >
                      <Text style={styles.acceptButtonText}>
                        {participantActions[participant.id] === 'accepting' ? 'Đang duyệt...' : 'Duyệt'}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID={`participant-reject-${participant.id}`}
                      style={styles.rejectButton}
                      disabled={!!participantActions[participant.id]}
                      onPress={() => void handleReject(participant.id)}
                    >
                      <Text style={styles.rejectButtonText}>
                        {participantActions[participant.id] === 'rejecting' ? 'Đang từ chối...' : 'Từ chối'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 8 },
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
  participantsSection: { marginTop: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  participantRow: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  participantInfo: { gap: 2 },
  participantName: { fontWeight: '600' },
  participantStatus: { color: '#555', fontSize: 12 },
  participantActions: { flexDirection: 'row', gap: 8 },
  acceptButton: {
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  acceptButtonText: { color: '#fff', fontWeight: '600' },
  rejectButton: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rejectButtonText: { color: '#fff', fontWeight: '600' },
});
