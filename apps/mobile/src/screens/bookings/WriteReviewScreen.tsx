import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import { reviewsApi } from '../../api/client';
import type { MyBookingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MyBookingsStackParamList, 'WriteReview'>;

const STARS = [1, 2, 3, 4, 5];

export function WriteReviewScreen({ route, navigation }: Props) {
  const { bookingId, courtName } = route.params;
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
    <View style={styles.container} testID="write-review-screen">
      <Text style={styles.title}>Đánh giá {courtName}</Text>
      <View style={styles.stars}>
        {STARS.map((value) => (
          <Pressable key={value} testID={`write-review-star-${value}`} onPress={() => setRating(value)}>
            <Text style={value <= rating ? styles.starActive : styles.starInactive}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        testID="write-review-comment"
        style={styles.input}
        placeholder="Nhận xét (không bắt buộc)"
        value={comment}
        onChangeText={setComment}
        multiline
      />
      {error ? (
        <Text testID="write-review-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      <Pressable
        testID="write-review-submit"
        style={styles.button}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Gửi đánh giá</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 8 },
  starActive: { fontSize: 32, color: '#f59e0b' },
  starInactive: { fontSize: 32, color: '#d1d5db' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, minHeight: 80 },
  errorText: { color: '#dc2626' },
  button: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
