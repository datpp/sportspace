import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.authControllerForgotPassword({ email: email.trim() });
      setSuccess(true);
    } catch {
      setError('Không thể gửi yêu cầu, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container} testID="forgot-password-success">
        <Text style={styles.title}>Kiểm tra email của bạn</Text>
        <Text>Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.</Text>
        <Pressable testID="forgot-password-back-to-login" onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Quay lại đăng nhập</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="forgot-password-screen">
      <Text style={styles.title}>Quên mật khẩu</Text>
      <TextInput
        testID="forgot-password-email"
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {error ? (
        <Text testID="forgot-password-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable
        testID="forgot-password-submit"
        style={styles.button}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Gửi link đặt lại mật khẩu</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#dc2626' },
  link: { color: '#1d4ed8', textAlign: 'center', marginTop: 8 },
});
