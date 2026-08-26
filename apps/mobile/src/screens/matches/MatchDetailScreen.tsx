import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import type { Match } from '@sportspace/shared';
import { MatchParticipantStatus, MatchStatus } from '@sportspace/shared';
import { matchesApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme';
import type { StatusVariant } from '../../theme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import type { MatchesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

type JoinState = 'idle' | 'submitting' | 'requested' | 'error';
type ParticipantAction = 'accepting' | 'rejecting';

const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  [MatchParticipantStatus.REQUESTED]: 'Đang chờ duyệt',
  [MatchParticipantStatus.ACCEPTED]: 'Đã chấp nhận',
  [MatchParticipantStatus.REJECTED]: 'Đã từ chối',
};

const PARTICIPANT_STATUS_VARIANT: Record<string, StatusVariant> = {
  [MatchParticipantStatus.REQUESTED]: 'warning',
  [MatchParticipantStatus.ACCEPTED]: 'success',
  [MatchParticipantStatus.REJECTED]: 'danger',
};

export function MatchDetailScreen({ route }: Props) {
  const { matchId } = route.params;
  const { user } = useAuth();
  const { colors, statusColors, spacing } = useTheme();
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
      <View style={[styles.centerFill, { backgroundColor: colors.background }]} testID="match-detail-error">
        <Text style={{ color: colors.danger }}>{error}</Text>
        <Pressable testID="match-detail-retry" onPress={() => void fetchMatch()}>
          <Text style={[styles.link, { color: colors.primary }]}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.centerFill, { backgroundColor: colors.background }]} testID="match-detail-loading">
        <ActivityIndicator />
      </View>
    );
  }

  const isHost = user?.userId === match.host.id;
  const isFull = match.status === MatchStatus.CLOSED || match.slotsFilled >= match.slotsTotal;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.background },
      ]}
      testID="match-detail-screen"
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{match.booking.court.sport}</Text>
      <Text style={{ color: colors.mutedForeground }}>{match.booking.court.name}</Text>
      <Text style={{ color: colors.mutedForeground }}>
        {match.booking.bookingDate} {match.booking.startTime}-{match.booking.endTime}
      </Text>
      <Text style={[styles.host, { color: colors.foreground }]}>Chủ kèo: {match.host.fullName}</Text>
      <StatusPill variant={isFull ? 'neutral' : 'warning'}>
        {match.slotsFilled}/{match.slotsTotal} chỗ đã ghép
      </StatusPill>
      {match.skillLevel ? (
        <Text style={{ color: colors.foreground }}>Trình độ: {match.skillLevel}</Text>
      ) : null}

      {isHost ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }} testID="match-participants-section">
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Người xin ghép</Text>
          {match.participants.length === 0 ? (
            <Text testID="match-participants-empty" style={{ color: colors.mutedForeground }}>
              Chưa có ai xin ghép
            </Text>
          ) : (
            match.participants.map((participant) => (
              <Card
                key={participant.id}
                testID={`participant-item-${participant.id}`}
                style={{ gap: spacing.sm }}
              >
                <View style={styles.participantInfo}>
                  <Text style={[styles.participantName, { color: colors.cardForeground }]}>
                    {participant.user.fullName}
                  </Text>
                  <StatusPill variant={PARTICIPANT_STATUS_VARIANT[participant.status] ?? 'neutral'}>
                    {PARTICIPANT_STATUS_LABEL[participant.status] ?? participant.status}
                  </StatusPill>
                </View>
                {participant.status === MatchParticipantStatus.REQUESTED ? (
                  <View style={[styles.participantActions, { gap: spacing.sm }]}>
                    <Button
                      testID={`participant-accept-${participant.id}`}
                      disabled={!!participantActions[participant.id]}
                      onPress={() => void handleAccept(participant.id)}
                    >
                      {participantActions[participant.id] === 'accepting' ? 'Đang duyệt...' : 'Duyệt'}
                    </Button>
                    <Button
                      testID={`participant-reject-${participant.id}`}
                      variant="destructive"
                      disabled={!!participantActions[participant.id]}
                      onPress={() => void handleReject(participant.id)}
                    >
                      {participantActions[participant.id] === 'rejecting' ? 'Đang từ chối...' : 'Từ chối'}
                    </Button>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </View>
      ) : joinState === 'requested' ? (
        <Text testID="match-join-success" style={[styles.success, { color: statusColors.success.text }]}>
          Đã gửi yêu cầu ghép kèo, chờ chủ kèo duyệt.
        </Text>
      ) : isFull ? (
        <Text testID="match-full" style={[styles.note, { color: colors.mutedForeground }]}>
          Kèo đã đủ người.
        </Text>
      ) : (
        <>
          {joinError ? (
            <Text testID="match-join-error" style={{ color: colors.danger }}>
              {joinError}
            </Text>
          ) : null}
          <Button
            testID="match-join-submit"
            onPress={handleJoin}
            loading={joinState === 'submitting'}
            style={{ marginTop: spacing.lg }}
          >
            Xin ghép
          </Button>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700' },
  host: { marginTop: 8 },
  note: { marginTop: 16 },
  success: { marginTop: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  participantInfo: { gap: 2 },
  participantName: { fontWeight: '600' },
  participantActions: { flexDirection: 'row', flexWrap: 'wrap' },
});
