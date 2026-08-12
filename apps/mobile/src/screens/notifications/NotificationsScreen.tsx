import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { Notification } from '@sportspace/shared';
import { notificationsApi } from '../../api/client';

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setError(null);
    try {
      const { data } = await notificationsApi.notificationControllerFindAll();
      setNotifications(data);
    } catch {
      setError('Không tải được thông báo');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications();
    }, [fetchNotifications]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchNotifications();
  }, [fetchNotifications]);

  const handlePress = useCallback(async (item: Notification) => {
    if (item.isRead) return;
    setMarkingId(item.id);
    try {
      const { data } = await notificationsApi.notificationControllerMarkRead(item.id);
      setNotifications((prev) => prev?.map((n) => (n.id === item.id ? data : n)) ?? prev);
    } catch {
      // Không critical — user có thể bấm lại để thử đánh dấu đã đọc lần nữa.
    } finally {
      setMarkingId(null);
    }
  }, []);

  if (notifications === null && !error) {
    return (
      <View style={styles.centerFill} testID="notifications-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerFill} testID="notifications-error">
        <Text style={styles.errorText}>{error}</Text>
        <Pressable testID="notifications-retry" onPress={() => void fetchNotifications()}>
          <Text style={styles.link}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <View style={styles.centerFill} testID="notifications-empty">
        <Text>Bạn chưa có thông báo nào</Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="notifications-list"
      data={notifications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => (
        <Pressable
          testID={`notification-item-${item.id}`}
          style={[styles.card, !item.isRead && styles.cardUnread]}
          disabled={markingId === item.id}
          onPress={() => void handlePress(item)}
        >
          {!item.isRead ? <View testID={`notification-dot-${item.id}`} style={styles.unreadDot} /> : null}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMessage}>{item.body}</Text>
            <Text style={styles.cardTime}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { color: '#dc2626' },
  link: { color: '#1d4ed8', fontWeight: '600' },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  cardUnread: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1d4ed8', marginTop: 6 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMessage: { color: '#333' },
  cardTime: { color: '#888', fontSize: 12, marginTop: 4 },
});
