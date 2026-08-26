import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';

export function AccountScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="account-screen">
      <ScreenHeader title="Tài khoản" />
      <View style={styles.content}>
        <Text style={{ color: colors.foreground }}>Vai trò: {user?.role}</Text>
        <Button testID="account-logout" variant="destructive" onPress={() => void logout()}>
          Đăng xuất
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
});
