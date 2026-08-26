import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SlotDto } from '@sportspace/shared';
import { BookingStatus } from '@sportspace/shared';
import { courtsApi } from '../../api/client';
import { toDateOnlyString } from '../../utils/date';
import { useCourtSlotUpdates } from '../../hooks/useCourtSlotUpdates';
import type { SlotUpdatePayload } from '../../realtime/socket';
import { useTheme } from '../../theme';
import type { VenuesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<VenuesStackParamList, 'CourtSlots'>;

const DAY_OPTIONS = Array.from({ length: 4 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() + i);
  return date;
});

export function CourtSlotsScreen({ route, navigation }: Props) {
  const { venueId, courtId, courtName, venueName } = route.params;
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState<Date>(DAY_OPTIONS[0]);
  const [slots, setSlots] = useState<SlotDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const dateString = useMemo(() => toDateOnlyString(selectedDate), [selectedDate]);

  const fetchSlots = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setSlots(null);
      }
      setError(null);
      try {
        const { data } = await courtsApi.courtControllerGetSlots(courtId, { date: dateString });
        setSlots(data);
      } catch {
        setError('Không tải được danh sách ô giờ');
      } finally {
        setIsRefreshing(false);
      }
    },
    [courtId, dateString],
  );

  // Ô giờ có thể bị người khác đặt mất giữa chừng — refetch mỗi khi màn hình
  // được focus lại (vd sau khi quay về từ BookingConfirm do gặp 409), không
  // chỉ khi courtId/ngày đổi.
  useFocusEffect(
    useCallback(() => {
      void fetchSlots();
    }, [fetchSlots]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchSlots({ silent: true });
  }, [fetchSlots]);

  // Cập nhật tại chỗ trong lúc đang xem màn hình (bổ sung cho REST refetch ở
  // useFocusEffect phía trên, không thay thế) — thấy ngay khi người khác vừa
  // đặt/huỷ ô giờ mà không cần tự kéo refresh.
  const handleSlotUpdate = useCallback((payload: SlotUpdatePayload) => {
    setSlots((prev) =>
      prev?.map((slot) =>
        slot.startTime === payload.startTime
          ? { ...slot, available: payload.status === BookingStatus.CANCELLED }
          : slot,
      ) ?? prev,
    );
  }, []);

  useCourtSlotUpdates(courtId, dateString, handleSlotUpdate);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="court-slots-screen">
      <Text style={[styles.title, { color: colors.foreground }]}>{courtName}</Text>
      <Text style={{ color: colors.mutedForeground }}>{venueName}</Text>

      <View style={styles.dayRow}>
        {DAY_OPTIONS.map((date) => {
          const iso = toDateOnlyString(date);
          const isSelected = iso === dateString;
          return (
            <Pressable
              key={iso}
              testID={`date-option-${iso}`}
              style={[
                styles.dayButton,
                {
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                },
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={{ color: isSelected ? colors.primaryForeground : colors.foreground, fontWeight: isSelected ? '600' : '400' }}>
                {date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={styles.centerFill} testID="court-slots-error">
          <Text style={{ color: colors.danger }}>{error}</Text>
          <Pressable testID="court-slots-retry" onPress={() => void fetchSlots()}>
            <Text style={[styles.link, { color: colors.primary }]}>Thử lại</Text>
          </Pressable>
        </View>
      ) : slots === null ? (
        <View style={styles.centerFill} testID="court-slots-loading">
          <ActivityIndicator />
        </View>
      ) : slots.length === 0 ? (
        <View style={styles.centerFill} testID="court-slots-empty">
          <Text style={{ color: colors.foreground }}>Không có ô giờ nào trong ngày này</Text>
        </View>
      ) : (
        <FlatList
          testID="slot-list"
          data={slots}
          numColumns={3}
          keyExtractor={(item) => item.startTime}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`slot-${item.startTime}`}
              disabled={!item.available}
              style={[
                styles.slot,
                {
                  borderColor: item.available ? colors.primary : colors.border,
                  backgroundColor: item.available ? 'transparent' : colors.card,
                },
              ]}
              onPress={() =>
                navigation.navigate('BookingConfirm', {
                  venueId,
                  courtId,
                  courtName,
                  venueName,
                  bookingDate: dateString,
                  startTime: item.startTime,
                  endTime: item.endTime,
                  price: item.price,
                })
              }
            >
              <Text style={{ color: item.available ? colors.primary : colors.mutedForeground, fontWeight: '600' }}>
                {item.startTime}
              </Text>
              <Text
                style={[
                  styles.slotPrice,
                  { color: item.available ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {item.price.toLocaleString('vi-VN')} đ
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  dayRow: { flexDirection: 'row', gap: 8, marginVertical: 8, flexWrap: 'wrap' },
  dayButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { fontWeight: '600' },
  slot: {
    flex: 1,
    margin: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  slotPrice: { fontSize: 12, marginTop: 2 },
});
