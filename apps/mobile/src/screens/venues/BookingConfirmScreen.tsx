import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import type { Booking } from '@sportspace/shared';
import { bookingsApi } from '../../api/client';
import type { VenuesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<VenuesStackParamList, 'BookingConfirm'>;

const HOLD_DURATION_MS = 5 * 60 * 1000;

type Status = 'idle' | 'submitting' | 'success' | 'conflict' | 'error';

export function BookingConfirmScreen({ route, navigation }: Props) {
  const { courtId, courtName, venueName, bookingDate, startTime, endTime, price } = route.params;
  const [status, setStatus] = useState<Status>('idle');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [remainingMs, setRemainingMs] = useState(HOLD_DURATION_MS);

  const handleConfirm = async () => {
    setStatus('submitting');
    try {
      const { data } = await bookingsApi.bookingControllerCreate({
        courtId,
        bookingDate,
        startTime,
        endTime,
      });
      setBooking(data);
      setStatus('success');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setStatus('conflict');
      } else {
        setStatus('error');
      }
    }
  };

  useEffect(() => {
    if (status !== 'success' || !booking) return;
    const expiresAt = new Date(booking.createdAt).getTime() + HOLD_DURATION_MS;
    const tick = () => setRemainingMs(Math.max(0, expiresAt - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, booking]);

  const countdownLabel = useMemo(() => {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [remainingMs]);

  if (status === 'success' && booking) {
    return (
      <View style={styles.container} testID="booking-success">
        <Text style={styles.title}>Đặt sân thành công!</Text>
        <Text>Đang giữ chỗ, vui lòng thanh toán trong:</Text>
        <Text testID="booking-countdown" style={styles.countdown}>
          {remainingMs > 0 ? countdownLabel : 'Đã hết hạn giữ chỗ'}
        </Text>
        <Text>
          {venueName} — {courtName}
        </Text>
        <Text>
          {bookingDate} {startTime}-{endTime}
        </Text>
        <Text style={styles.price}>{price.toLocaleString('vi-VN')} đ</Text>
        <Pressable
          testID="booking-go-my-bookings"
          style={styles.button}
          // Điều hướng sang tab "Lịch của tôi" ở navigator cha (Tab) — navigation
          // ở đây chỉ có type của VenuesStack nên phải nới kiểu cho lệnh gọi chéo tab.
          onPress={() => (navigation.getParent() as { navigate: (name: string) => void } | undefined)?.navigate('MyBookings')}
        >
          <Text style={styles.buttonText}>Xem lịch của tôi</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'conflict') {
    return (
      <View style={styles.container} testID="booking-conflict">
        <Text style={styles.errorText}>Ô giờ này vừa có người đặt trước, vui lòng chọn ô khác.</Text>
        <Pressable
          testID="booking-conflict-back"
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Chọn ô khác</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="booking-confirm-screen">
      <Text style={styles.title}>Xác nhận đặt sân</Text>
      <Text>
        {venueName} — {courtName}
      </Text>
      <Text>
        {bookingDate}: {startTime} - {endTime}
      </Text>
      <Text style={styles.price}>{price.toLocaleString('vi-VN')} đ</Text>
      {status === 'error' ? (
        <Text testID="booking-error" style={styles.errorText}>
          Đặt sân thất bại, vui lòng thử lại
        </Text>
      ) : null}
      <Pressable
        testID="booking-confirm-submit"
        style={styles.button}
        onPress={handleConfirm}
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Đặt sân</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '700', color: '#1d4ed8' },
  countdown: { fontSize: 32, fontWeight: '700', color: '#dc2626' },
  errorText: { color: '#dc2626' },
  button: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
