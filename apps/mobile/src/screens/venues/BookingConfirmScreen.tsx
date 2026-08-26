import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import type { AddOnService, Booking } from '@sportspace/shared';
import { addonServicesApi, bookingsApi } from '../../api/client';
import { startVnpayCheckout } from '../../payments/checkout';
import { pollBookingUntilConfirmed } from '../../payments/pollBookingStatus';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
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
  const { venueId, courtId, courtName, venueName, bookingDate, startTime, endTime, price } =
    route.params;
  const { colors, spacing } = useTheme();
  const [status, setStatus] = useState<Status>('idle');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [remainingMs, setRemainingMs] = useState(HOLD_DURATION_MS);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [services, setServices] = useState<AddOnService[]>([]);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    addonServicesApi
      .addonServicesControllerFindAll({ venueId })
      .then(({ data }) => setServices(data.filter((s) => s.isActive)))
      .catch(() => {
        // Dịch vụ đi kèm không phải dữ liệu bắt buộc để đặt sân — lỗi ở đây không chặn màn hình.
      });
  }, [venueId]);

  const toggleService = (serviceId: string) => {
    setSelectedQuantities((prev) => {
      const next = { ...prev };
      if (next[serviceId]) {
        delete next[serviceId];
      } else {
        next[serviceId] = 1;
      }
      return next;
    });
  };

  const servicesTotal = services.reduce(
    (sum, s) => (selectedQuantities[s.id] ? sum + Number(s.price) * selectedQuantities[s.id] : sum),
    0,
  );
  const displayTotal = price + servicesTotal;

  const handleConfirm = async () => {
    setStatus('submitting');
    try {
      const selectedServices = Object.entries(selectedQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([addOnServiceId, quantity]) => ({ addOnServiceId, quantity }));
      const { data } = await bookingsApi.bookingControllerCreate({
        courtId,
        bookingDate,
        startTime,
        endTime,
        ...(selectedServices.length > 0 ? { services: selectedServices } : {}),
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
      <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]} testID="booking-success">
        {paymentState === 'paid' ? (
          <Text style={[styles.title, { color: colors.foreground }]}>Đã thanh toán thành công!</Text>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Đặt sân thành công!</Text>
            <Text style={{ color: colors.foreground }}>Đang giữ chỗ, vui lòng thanh toán trong:</Text>
            <Text testID="booking-countdown" style={[styles.countdown, { color: colors.danger }]}>
              {remainingMs > 0 ? countdownLabel : 'Đã hết hạn giữ chỗ'}
            </Text>
          </>
        )}
        <Card>
          <Text style={{ color: colors.cardForeground }}>
            {venueName} — {courtName}
          </Text>
          <Text style={{ color: colors.mutedForeground }}>
            {bookingDate} {startTime}-{endTime}
          </Text>
          <Text style={[styles.price, { color: colors.primary }]}>
            <Text testID="booking-total">{displayTotal.toLocaleString('vi-VN')}</Text> đ
          </Text>
        </Card>

        {paymentState === 'verifying' ? (
          <View testID="payment-verifying" style={[styles.centerRow, { gap: spacing.sm }]}>
            <ActivityIndicator />
            <Text style={{ color: colors.foreground }}>Đang xác nhận thanh toán...</Text>
          </View>
        ) : null}

        {paymentState === 'cancelled' ? (
          <Text testID="payment-cancelled" style={{ color: colors.danger }}>
            Bạn đã đóng trang thanh toán trước khi hoàn tất.
          </Text>
        ) : null}

        {paymentState === 'checkout-error' ? (
          <Text testID="payment-checkout-error" style={{ color: colors.danger }}>
            Không mở được trang thanh toán, vui lòng thử lại.
          </Text>
        ) : null}

        {paymentState === 'pending-confirm' ? (
          <Text testID="payment-pending" style={{ color: colors.danger }}>
            Chưa xác nhận được thanh toán, có thể hệ thống đang xử lý — thử kiểm tra lại.
          </Text>
        ) : null}

        {paymentState === 'pending-confirm' ? (
          <Button testID="booking-check-again" onPress={() => void handleCheckAgain()}>
            Kiểm tra lại
          </Button>
        ) : canPay ? (
          <Button testID="booking-pay-submit" onPress={() => void handlePay()} loading={paymentState === 'opening'}>
            Thanh toán VNPAY
          </Button>
        ) : null}

        <Button
          testID="booking-go-my-bookings"
          variant="ghost"
          onPress={() => (navigation.getParent() as { navigate: (name: string) => void } | undefined)?.navigate('MyBookings')}
        >
          Xem lịch của tôi
        </Button>
      </View>
    );
  }

  if (status === 'conflict') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]} testID="booking-conflict">
        <Text style={{ color: colors.danger }}>Ô giờ này vừa có người đặt trước, vui lòng chọn ô khác.</Text>
        <Button testID="booking-conflict-back" onPress={() => navigation.goBack()}>
          Chọn ô khác
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]} testID="booking-confirm-screen">
      <Text style={[styles.title, { color: colors.foreground }]}>Xác nhận đặt sân</Text>
      <Card>
        <Text style={{ color: colors.cardForeground }}>
          {venueName} — {courtName}
        </Text>
        <Text style={{ color: colors.mutedForeground }}>
          {bookingDate}: {startTime} - {endTime}
        </Text>
      </Card>
      {services.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[styles.servicesTitle, { color: colors.foreground }]}>Dịch vụ đi kèm</Text>
          {services.map((s) => (
            <Pressable
              key={s.id}
              testID={`service-item-${s.id}`}
              onPress={() => toggleService(s.id)}
              accessibilityRole="button"
              style={[styles.serviceRow, { gap: spacing.sm }]}
            >
              <View
                testID={`service-checkbox-${s.id}`}
                style={[
                  styles.checkbox,
                  { borderColor: colors.primary },
                  selectedQuantities[s.id] ? { backgroundColor: colors.primary } : null,
                ]}
              />
              <Text style={[styles.serviceName, { color: colors.foreground }]}>{s.name}</Text>
              <Text style={{ color: colors.mutedForeground }}>
                {Number(s.price).toLocaleString('vi-VN')} đ
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={[styles.price, { color: colors.primary }]}>
        <Text testID="booking-total">{displayTotal.toLocaleString('vi-VN')}</Text> đ
      </Text>
      {status === 'error' ? (
        <Text testID="booking-error" style={{ color: colors.danger }}>
          Đặt sân thất bại, vui lòng thử lại
        </Text>
      ) : null}
      <Button testID="booking-confirm-submit" onPress={() => void handleConfirm()} loading={status === 'submitting'}>
        Đặt sân
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '700' },
  countdown: { fontSize: 32, fontWeight: '700' },
  centerRow: { flexDirection: 'row', alignItems: 'center' },
  servicesTitle: { fontSize: 14, fontWeight: '700' },
  serviceRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 4 },
  serviceName: { flex: 1 },
});
