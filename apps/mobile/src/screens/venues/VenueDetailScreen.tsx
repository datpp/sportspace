import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Venue, VenueReviewsDto } from '@sportspace/shared';
import { API_BASE_URL, reviewsApi, venuesApi } from '../../api/client';
import { useTheme } from '../../theme';
import { Card } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import type { VenuesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<VenuesStackParamList, 'VenueDetail'>;

export function VenueDetailScreen({ route, navigation }: Props) {
  const { venueId, venueName } = route.params;
  const { colors, statusColors, spacing, radius } = useTheme();
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
      <View style={[styles.centerFill, { backgroundColor: colors.background }]} testID="venue-detail-error">
        <Text style={{ color: colors.danger }}>{error}</Text>
        <Pressable testID="venue-detail-retry" onPress={() => void fetchVenue()}>
          <Text style={[styles.link, { color: colors.primary }]}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={[styles.centerFill, { backgroundColor: colors.background }]} testID="venue-detail-loading">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="venue-detail-screen">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{venue.name || venueName}</Text>
        <Text style={{ color: colors.mutedForeground }}>{venue.address}</Text>
        {venue.description ? (
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{venue.description}</Text>
        ) : null}
        {reviews && reviews.total > 0 ? (
          <View testID="venue-average-rating" style={styles.ratingRow}>
            <Text style={[styles.ratingValue, { color: statusColors.warning.text }]}>
              {reviews.averageRating.toFixed(1)} ★
            </Text>
            <Text style={{ color: colors.mutedForeground }}>({reviews.total} đánh giá)</Text>
          </View>
        ) : null}
      </View>
      {venue.images.length > 0 ? (
        <FlatList
          testID="venue-image-carousel"
          horizontal
          data={venue.images}
          keyExtractor={(img) => img}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageCarousel}
          renderItem={({ item, index }) => (
            <Image
              testID={`venue-image-${index}`}
              source={{ uri: `${API_BASE_URL}${item}` }}
              style={[styles.venueImage, { borderRadius: radius.md, backgroundColor: colors.border }]}
            />
          )}
        />
      ) : (
        <View
          testID="venue-image-placeholder"
          style={[styles.venueImagePlaceholder, { borderRadius: radius.md, backgroundColor: colors.border }]}
        >
          <Text style={{ color: colors.mutedForeground }}>Chưa có ảnh</Text>
        </View>
      )}
      {venue.courts.length === 0 ? (
        <View style={[styles.centerFill, { backgroundColor: colors.background }]} testID="venue-detail-no-courts">
          <Text style={{ color: colors.foreground }}>Sân này chưa có sân con nào</Text>
        </View>
      ) : (
        <FlatList
          testID="court-list"
          data={venue.courts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card
              testID={`court-item-${item.id}`}
              onPress={() =>
                navigation.navigate('CourtSlots', {
                  venueId,
                  courtId: item.id,
                  courtName: item.name,
                  venueName: venue.name,
                })
              }
            >
              <Text style={[styles.cardTitle, { color: colors.cardForeground }]}>{item.name}</Text>
              <StatusPill variant="info" uppercase={false}>
                {item.sport}
              </StatusPill>
              <Text style={[styles.cardPrice, { color: colors.primary }]}>
                {item.basePrice.toLocaleString('vi-VN')} đ/giờ
              </Text>
            </Card>
          )}
        />
      )}
      {reviews && reviews.items.length > 0 ? (
        <View style={styles.reviewsSection}>
          <Text style={[styles.reviewsTitle, { color: colors.foreground }]}>Đánh giá</Text>
          {reviews.items.map((review) => (
            <View
              key={review.id}
              testID={`review-item-${review.id}`}
              style={[styles.reviewItem, { borderTopColor: colors.border }]}
            >
              <Text style={[styles.reviewRating, { color: statusColors.warning.text }]}>{review.rating} ★</Text>
              {review.comment ? <Text style={{ color: colors.foreground }}>{review.comment}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1, gap: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  description: { marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  ratingValue: { fontSize: 16, fontWeight: '700' },
  reviewsSection: { padding: 16, gap: 8 },
  reviewsTitle: { fontSize: 16, fontWeight: '700' },
  reviewItem: { borderTopWidth: 1, paddingTop: 8, gap: 2 },
  reviewRating: { fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardPrice: { marginTop: 4, fontWeight: '600' },
  imageCarousel: { gap: 8, paddingVertical: 8 },
  venueImage: { width: 240, height: 160 },
  venueImagePlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
});
