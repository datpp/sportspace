import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Venue, VenueReviewsDto } from '@sportspace/shared';
import { reviewsApi, venuesApi } from '../../api/client';
import type { VenuesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<VenuesStackParamList, 'VenueDetail'>;

export function VenueDetailScreen({ route, navigation }: Props) {
  const { venueId, venueName } = route.params;
  const [venue, setVenue] = useState<Venue | null>(null);
  const [reviews, setReviews] = useState<VenueReviewsDto | null>(null);
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

  const fetchReviews = useCallback(async () => {
    try {
      const { data } = await reviewsApi.reviewControllerFindByVenue({ venueId });
      setReviews(data);
    } catch {
      // Điểm đánh giá không phải dữ liệu bắt buộc để xem sân — lỗi ở đây không chặn màn hình.
    }
  }, [venueId]);

  useEffect(() => {
    void fetchVenue();
    void fetchReviews();
  }, [fetchVenue, fetchReviews]);

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
        {reviews && reviews.total > 0 ? (
          <View testID="venue-average-rating" style={styles.ratingRow}>
            <Text style={styles.ratingValue}>{reviews.averageRating.toFixed(1)} ★</Text>
            <Text style={styles.ratingCount}>({reviews.total} đánh giá)</Text>
          </View>
        ) : null}
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
      {reviews && reviews.items.length > 0 ? (
        <View style={styles.reviewsSection}>
          <Text style={styles.reviewsTitle}>Đánh giá</Text>
          {reviews.items.map((review) => (
            <View key={review.id} testID={`review-item-${review.id}`} style={styles.reviewItem}>
              <Text style={styles.reviewRating}>{review.rating} ★</Text>
              {review.comment ? <Text>{review.comment}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#555' },
  description: { color: '#777', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  ratingValue: { fontSize: 16, fontWeight: '700', color: '#f59e0b' },
  ratingCount: { color: '#777' },
  reviewsSection: { padding: 16, gap: 8 },
  reviewsTitle: { fontSize: 16, fontWeight: '700' },
  reviewItem: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, gap: 2 },
  reviewRating: { color: '#f59e0b', fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { color: '#dc2626' },
  link: { color: '#1d4ed8', fontWeight: '600' },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#555', marginTop: 2 },
  cardPrice: { color: '#1d4ed8', marginTop: 4, fontWeight: '600' },
});
