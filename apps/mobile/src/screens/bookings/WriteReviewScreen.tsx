import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import { reviewsApi } from '../../api/client';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import type { MyBookingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MyBookingsStackParamList, 'WriteReview'>;

const STARS = [1, 2, 3, 4, 5];

export function WriteReviewScreen({ route, navigation }: Props) {
  const { bookingId, courtName } = route.params;
  const { colors, statusColors, spacing } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1) {
      setError('Vui lòng chọn số sao đánh giá');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await reviewsApi.reviewControllerCreate({
        bookingId,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      navigation.goBack();
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.status === 400
          ? (err.response.data as { message?: string })?.message
          : undefined;
      setError(message ?? 'Gửi đánh giá thất bại, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, gap: spacing.md }]} testID="write-review-screen">
      <Text style={[styles.title, { color: colors.foreground }]}>Đánh giá {courtName}</Text>
      <View style={[styles.stars, { gap: spacing.sm }]}>
        {STARS.map((value) => (
          <Pressable key={value} testID={`write-review-star-${value}`} onPress={() => setRating(value)}>
            <Text style={[styles.star, { color: value <= rating ? statusColors.warning.text : colors.border }]}>
              ★
            </Text>
          </Pressable>
        ))}
      </View>
      <Input
        testID="write-review-comment"
        style={{ minHeight: 80 }}
        placeholder="Nhận xét (không bắt buộc)"
        value={comment}
        onChangeText={setComment}
        multiline
      />
      {error ? (
        <Text testID="write-review-error" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button testID="write-review-submit" onPress={() => void handleSubmit()} loading={isSubmitting}>
        Gửi đánh giá
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 20, fontWeight: '700' },
  stars: { flexDirection: 'row' },
  star: { fontSize: 32 },
});
