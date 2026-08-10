import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Venue } from '@sportspace/shared';
import { venuesApi } from '../../api/client';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { haversineDistanceKm } from '../../utils/distance';
import type { VenuesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<VenuesStackParamList, 'VenueList'>;

interface VenueWithDistance {
  venue: Venue;
  distanceKm: number | null;
}

export function VenueListScreen({ navigation }: Props) {
  const location = useCurrentLocation();
  const [sportInput, setSportInput] = useState('');
  const [appliedSport, setAppliedSport] = useState('');
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchVenues = useCallback(async () => {
    setError(null);
    try {
      const { data } = await venuesApi.venueControllerFindAll({
        ...(location.status === 'granted'
          ? { lat: location.coords.lat, lng: location.coords.lng }
          : {}),
        ...(appliedSport ? { sport: appliedSport } : {}),
      });
      setVenues(data);
    } catch {
      setError('Không tải được danh sách sân, kéo xuống để thử lại');
    } finally {
      setIsRefreshing(false);
    }
  }, [location, appliedSport]);

  useEffect(() => {
    if (location.status === 'loading') return;
    void fetchVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.status, appliedSport]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchVenues();
  }, [fetchVenues]);

  const sortedVenues = useMemo<VenueWithDistance[]>(() => {
    if (!venues) return [];
    const withDistance = venues.map((venue) => ({
      venue,
      distanceKm:
        location.status === 'granted'
          ? haversineDistanceKm(location.coords, { lat: venue.lat, lng: venue.lng })
          : null,
    }));
    return withDistance.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [venues, location]);

  return (
    <View style={styles.container} testID="venue-list-screen">
      <View style={styles.searchRow}>
        <TextInput
          testID="venue-sport-input"
          style={styles.input}
          placeholder="Lọc theo bộ môn (vd: bóng đá)"
          value={sportInput}
          onChangeText={setSportInput}
          onSubmitEditing={() => setAppliedSport(sportInput.trim())}
        />
        <Pressable
          testID="venue-search-submit"
          style={styles.searchButton}
          onPress={() => setAppliedSport(sportInput.trim())}
        >
          <Text style={styles.searchButtonText}>Tìm</Text>
        </Pressable>
      </View>

      {location.status === 'denied' || location.status === 'error' ? (
        <View testID="venue-location-banner" style={styles.banner}>
          <Text style={styles.bannerText}>
            Chưa có quyền vị trí — danh sách sẽ không sắp xếp theo khoảng cách.
          </Text>
          <Pressable testID="venue-location-retry" onPress={() => void location.retry()}>
            <Text style={styles.bannerLink}>Cấp quyền vị trí</Text>
          </Pressable>
        </View>
      ) : null}

      {venues === null && !error ? (
        <View style={styles.centerFill} testID="venue-list-loading">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.centerFill} testID="venue-list-error">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable testID="venue-list-retry" onPress={() => void fetchVenues()}>
            <Text style={styles.bannerLink}>Thử lại</Text>
          </Pressable>
        </View>
      ) : sortedVenues.length === 0 ? (
        <View style={styles.centerFill} testID="venue-list-empty">
          <Text>Không tìm thấy sân nào phù hợp</Text>
        </View>
      ) : (
        <FlatList
          testID="venue-list"
          data={sortedVenues}
          keyExtractor={(item) => item.venue.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`venue-item-${item.venue.id}`}
              style={styles.card}
              onPress={() =>
                navigation.navigate('VenueDetail', {
                  venueId: item.venue.id,
                  venueName: item.venue.name,
                })
              }
            >
              <Text style={styles.cardTitle}>{item.venue.name}</Text>
              <Text style={styles.cardSubtitle}>{item.venue.address}</Text>
              {item.distanceKm !== null ? (
                <Text style={styles.cardDistance}>{item.distanceKm.toFixed(1)} km</Text>
              ) : null}
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
  banner: { paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
  bannerText: { color: '#92400e' },
  bannerLink: { color: '#1d4ed8', fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { color: '#dc2626' },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#555', marginTop: 2 },
  cardDistance: { color: '#1d4ed8', marginTop: 4, fontWeight: '600' },
});
