import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Booking } from '@sportspace/shared';
import { BookingStatus } from '@sportspace/shared';
import { bookingsApi } from '../../api/client';
import { useTheme } from '../../theme';
import type { StatusVariant } from '../../theme';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusPill } from '../../components/StatusPill';
import type { MyBookingsStackParamList } from '../../navigation/types';

const STATUS_LABEL: Record<string, string> = {
  [BookingStatus.PENDING]: 'Đang giữ chỗ',
  [BookingStatus.CONFIRMED]: 'Đã xác nhận',
  [BookingStatus.CANCELLED]: 'Đã huỷ',
};

const STATUS_VARIANT: Record<string, StatusVariant> = {
  [BookingStatus.PENDING]: 'warning',
  [BookingStatus.CONFIRMED]: 'success',
  [BookingStatus.CANCELLED]: 'danger',
};

type Props = NativeStackScreenProps<MyBookingsStackParamList, 'MyBookingsList'>;

export function MyBookingsScreen({ navigation }: Props) {
  const { colors, statusColors, spacing } = useTheme();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    setError(null);
    try {
      const { data } = await bookingsApi.bookingControllerFindAll();
      setBookings(data);
    } catch {
      setError('Không tải được lịch đặt sân');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Trạng thái booking đổi ngay sau khi thanh toán/huỷ ở màn khác — refetch
  // mỗi khi tab này được focus lại, không chỉ lúc mount.
  useFocusEffect(
    useCallback(() => {
      void fetchBookings();
    }, [fetchBookings]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchBookings();
  }, [fetchBookings]);

  const performCancel = useCallback(async (id: string) => {
    setCancellingId(id);
    try {
      const { data } = await bookingsApi.bookingControllerCancel(id);
      setBookings((prev) => prev?.map((booking) => (booking.id === id ? data : booking)) ?? prev);
    } catch {
      Alert.alert('Huỷ lịch thất bại', 'Vui lòng thử lại sau');
    } finally {
      setCancellingId(null);
    }
  }, []);

  const confirmCancel = useCallback(
    (id: string) => {
      Alert.alert('Huỷ lịch đặt sân?', 'Bạn chắc chắn muốn huỷ lịch này?', [
        { text: 'Không', style: 'cancel' },
        { text: 'Huỷ lịch', style: 'destructive', onPress: () => void performCancel(id) },
      ]);
    },
    [performCancel],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Lịch của tôi" />
      {bookings === null && !error ? (
        <View style={styles.centerFill} testID="my-bookings-loading">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.centerFill} testID="my-bookings-error">
          <Text style={{ color: colors.danger }}>{error}</Text>
          <Pressable testID="my-bookings-retry" onPress={() => void fetchBookings()}>
            <Text style={[styles.link, { color: colors.primary }]}>Thử lại</Text>
          </Pressable>
        </View>
      ) : !bookings || bookings.length === 0 ? (
        <View style={styles.centerFill} testID="my-bookings-empty">
          <Text style={{ color: colors.foreground }}>Bạn chưa có lịch đặt sân nào</Text>
        </View>
      ) : (
        <FlatList
          testID="my-bookings-list"
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => {
            const cancellable = item.status !== BookingStatus.CANCELLED;
            const canCreateMatch = item.status === BookingStatus.CONFIRMED;
            const canReview =
              item.status === BookingStatus.CONFIRMED && new Date(item.bookingDate) <= new Date();
            return (
              <Card testID={`booking-item-${item.id}`}>
                <Text style={[styles.cardTitle, { color: colors.cardForeground }]}>{item.court.name}</Text>
                <Text style={{ color: colors.mutedForeground }}>
                  {item.bookingDate} {item.startTime}-{item.endTime}
                </Text>
                <StatusPill variant={STATUS_VARIANT[item.status] ?? 'neutral'}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </StatusPill>
                <Text style={[styles.cardPrice, { color: colors.cardForeground }]}>
                  {item.totalAmount.toLocaleString('vi-VN')} đ
                </Text>
                {item.status === BookingStatus.CANCELLED && item.payment ? (
                  <Text
                    testID={`booking-refund-${item.id}`}
                    style={[styles.cardRefund, { color: statusColors.success.text }]}
                  >
                    {item.payment.refundAmount && item.payment.refundAmount > 0
                      ? `Đã hoàn ${item.payment.refundAmount.toLocaleString('vi-VN')} đ`
                      : 'Không được hoàn tiền'}
                  </Text>
                ) : null}
                <View style={[styles.cardActions, { gap: spacing.sm, marginTop: spacing.sm }]}>
                  {canCreateMatch ? (
                    <Button
                      testID={`booking-create-match-${item.id}`}
                      onPress={() =>
                        navigation.navigate('CreateMatch', {
                          bookingId: item.id,
                          courtName: item.court.name,
                          bookingDate: item.bookingDate,
                          startTime: item.startTime,
                          endTime: item.endTime,
                        })
                      }
                    >
                      Tạo kèo
                    </Button>
                  ) : null}
                  {canReview ? (
                    <Button
                      testID={`booking-review-${item.id}`}
                      onPress={() =>
                        navigation.navigate('WriteReview', {
                          bookingId: item.id,
                          courtName: item.court.name,
                        })
                      }
                    >
                      Đánh giá
                    </Button>
                  ) : null}
                  {cancellable ? (
                    <Button
                      testID={`booking-cancel-${item.id}`}
                      variant="destructive"
                      disabled={cancellingId === item.id}
                      onPress={() => confirmCancel(item.id)}
                    >
                      {cancellingId === item.id ? 'Đang huỷ...' : 'Huỷ lịch'}
                    </Button>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardPrice: { fontWeight: '600' },
  cardRefund: { fontWeight: '600' },
  cardActions: { flexDirection: 'row' },
});
