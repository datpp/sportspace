import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export function AccountScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container} testID="account-screen">
      <Text style={styles.title}>Tài khoản</Text>
      <Text>Vai trò: {user?.role}</Text>
      <Pressable testID="account-logout" style={styles.button} onPress={() => void logout()}>
        <Text style={styles.buttonText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 20, fontWeight: '700' },
  button: { backgroundColor: '#dc2626', borderRadius: 8, padding: 12, marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
