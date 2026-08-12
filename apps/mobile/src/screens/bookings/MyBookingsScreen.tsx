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
import type { MyBookingsStackParamList } from '../../navigation/types';

const STATUS_LABEL: Record<string, string> = {
  [BookingStatus.PENDING]: 'Đang giữ chỗ',
  [BookingStatus.CONFIRMED]: 'Đã xác nhận',
  [BookingStatus.CANCELLED]: 'Đã huỷ',
};

type Props = NativeStackScreenProps<MyBookingsStackParamList, 'MyBookingsList'>;

export function MyBookingsScreen({ navigation }: Props) {
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

  if (bookings === null && !error) {
    return (
      <View style={styles.centerFill} testID="my-bookings-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerFill} testID="my-bookings-error">
        <Text style={styles.errorText}>{error}</Text>
        <Pressable testID="my-bookings-retry" onPress={() => void fetchBookings()}>
          <Text style={styles.link}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <View style={styles.centerFill} testID="my-bookings-empty">
        <Text>Bạn chưa có lịch đặt sân nào</Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="my-bookings-list"
      data={bookings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => {
        const cancellable = item.status !== BookingStatus.CANCELLED;
        const canCreateMatch = item.status === BookingStatus.CONFIRMED;
        return (
          <View testID={`booking-item-${item.id}`} style={styles.card}>
            <Text style={styles.cardTitle}>{item.court.name}</Text>
            <Text style={styles.cardSubtitle}>
              {item.bookingDate} {item.startTime}-{item.endTime}
            </Text>
            <Text style={styles.cardStatus}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            <Text style={styles.cardPrice}>{item.totalAmount.toLocaleString('vi-VN')} đ</Text>
            <View style={styles.cardActions}>
              {canCreateMatch ? (
                <Pressable
                  testID={`booking-create-match-${item.id}`}
                  style={styles.matchButton}
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
                  <Text style={styles.matchButtonText}>Tạo kèo</Text>
                </Pressable>
              ) : null}
              {cancellable ? (
                <Pressable
                  testID={`booking-cancel-${item.id}`}
                  style={styles.cancelButton}
                  disabled={cancellingId === item.id}
                  onPress={() => confirmCancel(item.id)}
                >
                  <Text style={styles.cancelButtonText}>
                    {cancellingId === item.id ? 'Đang huỷ...' : 'Huỷ lịch'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { color: '#dc2626' },
  link: { color: '#1d4ed8', fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#555' },
  cardStatus: { color: '#1d4ed8', fontWeight: '600' },
  cardPrice: { fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  matchButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  matchButtonText: { color: '#fff', fontWeight: '600' },
  cancelButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: { color: '#fff', fontWeight: '600' },
});
