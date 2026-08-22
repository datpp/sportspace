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
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import type { VenuesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<VenuesStackParamList, 'VenueList'>;

interface VenueWithDistance {
  venue: Venue;
  distanceKm: number | null;
}

export function VenueListScreen({ navigation }: Props) {
  const { colors, statusColors, spacing, radius } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="venue-list-screen">
      <ScreenHeader title="Tìm sân" />
      <View style={[styles.searchRow, { padding: spacing.lg }]}>
        <TextInput
          testID="venue-sport-input"
          style={[
            styles.input,
            {
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.sm,
              color: colors.foreground,
            },
          ]}
          placeholder="Lọc theo bộ môn (vd: bóng đá)"
          placeholderTextColor={colors.mutedForeground}
          value={sportInput}
          onChangeText={setSportInput}
          onSubmitEditing={() => setAppliedSport(sportInput.trim())}
        />
        <Button testID="venue-search-submit" onPress={() => setAppliedSport(sportInput.trim())} variant="secondary">
          Tìm
        </Button>
      </View>

      {location.status === 'denied' || location.status === 'error' ? (
        <View testID="venue-location-banner" style={[styles.banner, { paddingHorizontal: spacing.lg }]}>
          <Text style={{ color: statusColors.warning.text }}>
            Chưa có quyền vị trí — danh sách sẽ không sắp xếp theo khoảng cách.
          </Text>
          <Pressable testID="venue-location-retry" onPress={() => void location.retry()}>
            <Text style={[styles.bannerLink, { color: colors.primary }]}>Cấp quyền vị trí</Text>
          </Pressable>
        </View>
      ) : null}

      {venues === null && !error ? (
        <View style={styles.centerFill} testID="venue-list-loading">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.centerFill} testID="venue-list-error">
          <Text style={{ color: colors.danger }}>{error}</Text>
          <Pressable testID="venue-list-retry" onPress={() => void fetchVenues()}>
            <Text style={[styles.bannerLink, { color: colors.primary }]}>Thử lại</Text>
          </Pressable>
        </View>
      ) : sortedVenues.length === 0 ? (
        <View style={styles.centerFill} testID="venue-list-empty">
          <Text style={{ color: colors.foreground }}>Không tìm thấy sân nào phù hợp</Text>
        </View>
      ) : (
        <FlatList
          testID="venue-list"
          data={sortedVenues}
          keyExtractor={(item) => item.venue.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card
              testID={`venue-item-${item.venue.id}`}
              onPress={() =>
                navigation.navigate('VenueDetail', {
                  venueId: item.venue.id,
                  venueName: item.venue.name,
                })
              }
            >
              <Text style={[styles.cardTitle, { color: colors.cardForeground }]}>{item.venue.name}</Text>
              <Text style={{ color: colors.mutedForeground }}>{item.venue.address}</Text>
              {item.distanceKm !== null ? (
                <Text style={[styles.cardDistance, { color: colors.primary }]}>
                  {item.distanceKm.toFixed(1)} km
                </Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1 },
  banner: { paddingBottom: 8, gap: 4 },
  bannerLink: { fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDistance: { marginTop: 4, fontWeight: '600' },
});
