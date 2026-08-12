import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Match } from '@sportspace/shared';
import { matchesApi } from '../../api/client';
import type { MatchesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchList'>;

export function MatchListScreen({ navigation }: Props) {
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
    <View style={styles.container} testID="match-list-screen">
      <View style={styles.searchRow}>
        <TextInput
          testID="match-sport-input"
          style={styles.input}
          placeholder="Lọc theo bộ môn (vd: bóng đá)"
          value={sportInput}
          onChangeText={setSportInput}
          onSubmitEditing={() => setAppliedSport(sportInput.trim())}
        />
        <Pressable
          testID="match-search-submit"
          style={styles.searchButton}
          onPress={() => setAppliedSport(sportInput.trim())}
        >
          <Text style={styles.searchButtonText}>Tìm</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.centerFill} testID="match-list-error">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable testID="match-list-retry" onPress={() => void fetchMatches()}>
            <Text style={styles.link}>Thử lại</Text>
          </Pressable>
        </View>
      ) : matches === null ? (
        <View style={styles.centerFill} testID="match-list-loading">
          <ActivityIndicator />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.centerFill} testID="match-list-empty">
          <Text>Chưa có kèo nào đang mở</Text>
        </View>
      ) : (
        <FlatList
          testID="match-list"
          data={matches}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`match-item-${item.id}`}
              style={styles.card}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
            >
              <Text style={styles.cardTitle}>{item.booking.court.sport}</Text>
              <Text style={styles.cardSubtitle}>
                {item.booking.court.name} — {item.booking.bookingDate} {item.booking.startTime}-
                {item.booking.endTime}
              </Text>
              <Text style={styles.cardHost}>Chủ kèo: {item.host.fullName}</Text>
              <Text style={styles.cardSlots}>
                {item.slotsFilled}/{item.slotsTotal} chỗ đã ghép
                {item.skillLevel ? ` — Trình độ: ${item.skillLevel}` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: 8, padding: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  searchButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: { color: '#fff', fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { color: '#dc2626' },
  link: { color: '#1d4ed8', fontWeight: '600' },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#555', marginTop: 2 },
  cardHost: { color: '#333', marginTop: 4 },
  cardSlots: { color: '#1d4ed8', marginTop: 4, fontWeight: '600' },
});
