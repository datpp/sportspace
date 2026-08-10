import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import type { Booking } from '@sportspace/shared';
import { bookingsApi } from '../../api/client';
import { startVnpayCheckout } from '../../payments/checkout';
import { pollBookingUntilConfirmed } from '../../payments/pollBookingStatus';
import type { VenuesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<VenuesStackParamList, 'BookingConfirm'>;

const HOLD_DURATION_MS = 5 * 60 * 1000;

type Status = 'idle' | 'submitting' | 'success' | 'conflict' | 'error';

type PaymentState =
  | 'idle'
  | 'opening'
  | 'verifying'
  | 'paid'
  | 'pending-confirm'
  | 'cancelled'
  | 'checkout-error';

export function BookingConfirmScreen({ route, navigation }: Props) {
  const { courtId, courtName, venueName, bookingDate, startTime, endTime, price } = route.params;
  const [status, setStatus] = useState<Status>('idle');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [remainingMs, setRemainingMs] = useState(HOLD_DURATION_MS);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');

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

  const handlePay = async () => {
    if (!booking) return;
    setPaymentState('opening');
    try {
      const result = await startVnpayCheckout(booking.id);
      if (result.type === 'success') {
        setPaymentState('verifying');
        const confirmed = await pollBookingUntilConfirmed(booking.id);
        if (confirmed) {
          setBooking(confirmed);
          setPaymentState('paid');
        } else {
          setPaymentState('pending-confirm');
        }
      } else {
        setPaymentState('cancelled');
      }
    } catch {
      setPaymentState('checkout-error');
    }
  };

  const handleCheckAgain = async () => {
    if (!booking) return;
    setPaymentState('verifying');
    const confirmed = await pollBookingUntilConfirmed(booking.id, 1);
    if (confirmed) {
      setBooking(confirmed);
      setPaymentState('paid');
    } else {
      setPaymentState('pending-confirm');
    }
  };

  useEffect(() => {
    if (status !== 'success' || !booking || paymentState === 'paid') return;
    const expiresAt = new Date(booking.createdAt).getTime() + HOLD_DURATION_MS;
    const tick = () => setRemainingMs(Math.max(0, expiresAt - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, booking, paymentState]);

  const countdownLabel = useMemo(() => {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [remainingMs]);

  if (status === 'success' && booking) {
    const canPay =
      paymentState === 'idle' ||
      paymentState === 'opening' ||
      paymentState === 'cancelled' ||
      paymentState === 'checkout-error';

    return (
      <View style={styles.container} testID="booking-success">
        {paymentState === 'paid' ? (
          <Text style={styles.title}>Đã thanh toán thành công!</Text>
        ) : (
          <>
            <Text style={styles.title}>Đặt sân thành công!</Text>
            <Text>Đang giữ chỗ, vui lòng thanh toán trong:</Text>
            <Text testID="booking-countdown" style={styles.countdown}>
              {remainingMs > 0 ? countdownLabel : 'Đã hết hạn giữ chỗ'}
            </Text>
          </>
        )}
        <Text>
          {venueName} — {courtName}
        </Text>
        <Text>
          {bookingDate} {startTime}-{endTime}
        </Text>
        <Text style={styles.price}>{price.toLocaleString('vi-VN')} đ</Text>

        {paymentState === 'verifying' ? (
          <View testID="payment-verifying" style={styles.centerRow}>
            <ActivityIndicator />
            <Text>Đang xác nhận thanh toán...</Text>
          </View>
        ) : null}

        {paymentState === 'cancelled' ? (
          <Text testID="payment-cancelled" style={styles.errorText}>
            Bạn đã đóng trang thanh toán trước khi hoàn tất.
          </Text>
        ) : null}

        {paymentState === 'checkout-error' ? (
          <Text testID="payment-checkout-error" style={styles.errorText}>
            Không mở được trang thanh toán, vui lòng thử lại.
          </Text>
        ) : null}

        {paymentState === 'pending-confirm' ? (
          <Text testID="payment-pending" style={styles.errorText}>
            Chưa xác nhận được thanh toán, có thể hệ thống đang xử lý — thử kiểm tra lại.
          </Text>
        ) : null}

        {paymentState === 'pending-confirm' ? (
          <Pressable testID="booking-check-again" style={styles.button} onPress={handleCheckAgain}>
            <Text style={styles.buttonText}>Kiểm tra lại</Text>
          </Pressable>
        ) : canPay ? (
          <Pressable testID="booking-pay-submit" style={styles.button} onPress={handlePay}>
            {paymentState === 'opening' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Thanh toán VNPAY</Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          testID="booking-go-my-bookings"
          onPress={() => (navigation.getParent() as { navigate: (name: string) => void } | undefined)?.navigate('MyBookings')}
        >
          <Text style={styles.link}>Xem lịch của tôi</Text>
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
  link: { color: '#1d4ed8', fontWeight: '600', textAlign: 'center' },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
