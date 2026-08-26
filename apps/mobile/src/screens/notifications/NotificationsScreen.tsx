import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { Notification } from '@sportspace/shared';
import { notificationsApi } from '../../api/client';
import { useTheme } from '../../theme';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';

export function NotificationsScreen() {
  const { colors, spacing } = useTheme();
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
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Thông báo" />
        <View style={styles.centerFill} testID="notifications-loading">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Thông báo" />
        <View style={styles.centerFill} testID="notifications-error">
          <Text style={{ color: colors.danger }}>{error}</Text>
          <Pressable testID="notifications-retry" onPress={() => void fetchNotifications()}>
            <Text style={[styles.link, { color: colors.primary }]}>Thử lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Thông báo" />
        <View style={styles.centerFill} testID="notifications-empty">
          <Text style={{ color: colors.foreground }}>Bạn chưa có thông báo nào</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Thông báo" />
      <FlatList
        testID="notifications-list"
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <Card
            testID={`notification-item-${item.id}`}
            onPress={markingId === item.id ? undefined : () => void handlePress(item)}
            style={styles.card}
          >
            {!item.isRead ? (
              <View
                testID={`notification-dot-${item.id}`}
                style={[styles.unreadDot, { backgroundColor: colors.primary }]}
              />
            ) : null}
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: colors.cardForeground }]}>{item.title}</Text>
              <Text style={{ color: colors.cardForeground }}>{item.body}</Text>
              <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>
                {new Date(item.createdAt).toLocaleString('vi-VN')}
              </Text>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'flex-start' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardTime: { fontSize: 12, marginTop: 4 },
});
