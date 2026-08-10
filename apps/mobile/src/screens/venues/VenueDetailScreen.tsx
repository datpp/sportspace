import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Venue } from '@sportspace/shared';
import { venuesApi } from '../../api/client';
import type { VenuesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<VenuesStackParamList, 'VenueDetail'>;

export function VenueDetailScreen({ route, navigation }: Props) {
  const { venueId, venueName } = route.params;
  const [venue, setVenue] = useState<Venue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchVenue = useCallback(async () => {
    setError(null);
    try {
      const { data } = await venuesApi.venueControllerFindOne(venueId);
      setVenue(data);
    } catch {
      setError('Không tải được thông tin sân');
    } finally {
      setIsRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => {
    void fetchVenue();
  }, [fetchVenue]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchVenue();
  }, [fetchVenue]);

  if (error) {
    return (
      <View style={styles.centerFill} testID="venue-detail-error">
        <Text style={styles.errorText}>{error}</Text>
        <Pressable testID="venue-detail-retry" onPress={() => void fetchVenue()}>
          <Text style={styles.link}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.centerFill} testID="venue-detail-loading">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="venue-detail-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{venue.name || venueName}</Text>
        <Text style={styles.subtitle}>{venue.address}</Text>
        {venue.description ? <Text style={styles.description}>{venue.description}</Text> : null}
      </View>
      {venue.courts.length === 0 ? (
        <View style={styles.centerFill} testID="venue-detail-no-courts">
          <Text>Sân này chưa có sân con nào</Text>
        </View>
      ) : (
        <FlatList
          testID="court-list"
          data={venue.courts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`court-item-${item.id}`}
              style={styles.card}
              onPress={() =>
                navigation.navigate('CourtSlots', {
                  courtId: item.id,
                  courtName: item.name,
                  venueName: venue.name,
                })
              }
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>{item.sport}</Text>
              <Text style={styles.cardPrice}>{item.basePrice.toLocaleString('vi-VN')} đ/giờ</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#555' },
  description: { color: '#777', marginTop: 4 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { color: '#dc2626' },
  link: { color: '#1d4ed8', fontWeight: '600' },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#555', marginTop: 2 },
  cardPrice: { color: '#1d4ed8', marginTop: 4, fontWeight: '600' },
});
