import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Match } from '@sportspace/shared';
import { MatchStatus } from '@sportspace/shared';
import { matchesApi } from '../../api/client';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusPill } from '../../components/StatusPill';
import type { MatchesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchList'>;

export function MatchListScreen({ navigation }: Props) {
  const { colors, spacing } = useTheme();
  const [sportInput, setSportInput] = useState('');
  const [appliedSport, setAppliedSport] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMatches = useCallback(async () => {
    setError(null);
    try {
      const { data } = await matchesApi.matchingControllerFindAll(
        appliedSport ? { sport: appliedSport } : undefined,
      );
      setMatches(data);
    } catch {
      setError('Không tải được danh sách kèo');
    } finally {
      setIsRefreshing(false);
    }
  }, [appliedSport]);

  useFocusEffect(
    useCallback(() => {
      void fetchMatches();
    }, [fetchMatches]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchMatches();
  }, [fetchMatches]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="match-list-screen">
      <ScreenHeader title="Tìm kèo" />
      <View style={[styles.searchRow, { padding: spacing.lg }]}>
        <Input
          testID="match-sport-input"
          style={styles.input}
          placeholder="Lọc theo bộ môn (vd: bóng đá)"
          value={sportInput}
          onChangeText={setSportInput}
          onSubmitEditing={() => setAppliedSport(sportInput.trim())}
        />
        <Button
          testID="match-search-submit"
          onPress={() => setAppliedSport(sportInput.trim())}
          variant="secondary"
        >
          Tìm
        </Button>
      </View>

      {error ? (
        <View style={styles.centerFill} testID="match-list-error">
          <Text style={{ color: colors.danger }}>{error}</Text>
          <Pressable testID="match-list-retry" onPress={() => void fetchMatches()}>
            <Text style={[styles.link, { color: colors.primary }]}>Thử lại</Text>
          </Pressable>
        </View>
      ) : matches === null ? (
        <View style={styles.centerFill} testID="match-list-loading">
          <ActivityIndicator />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.centerFill} testID="match-list-empty">
          <Text style={{ color: colors.foreground }}>Chưa có kèo nào đang mở</Text>
        </View>
      ) : (
        <FlatList
          testID="match-list"
          data={matches}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            // Chỗ đã đầy dù kèo vẫn ở trạng thái OPEN thì cũng coi như đóng —
            // pill phải phản ánh khả năng ghép thực tế, không chỉ status thô.
            const isOpen = item.status === MatchStatus.OPEN && item.slotsFilled < item.slotsTotal;
            return (
              <Card
                testID={`match-item-${item.id}`}
                onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
              >
                <Text style={[styles.cardTitle, { color: colors.cardForeground }]}>
                  {item.booking.court.sport}
                </Text>
                <Text style={{ color: colors.mutedForeground }}>
                  {item.booking.court.name} — {item.booking.bookingDate} {item.booking.startTime}-
                  {item.booking.endTime}
                </Text>
                <Text style={{ color: colors.cardForeground }}>Chủ kèo: {item.host.fullName}</Text>
                <View style={[styles.cardFooter, { gap: spacing.sm }]}>
                  <StatusPill variant={isOpen ? 'warning' : 'neutral'}>
                    {item.slotsFilled}/{item.slotsTotal} chỗ đã ghép
                  </StatusPill>
                  {item.skillLevel ? (
                    <Text style={{ color: colors.mutedForeground }}>Trình độ: {item.skillLevel}</Text>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
});
