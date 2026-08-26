import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi } from '../../api/client';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colors, spacing, typography } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập email');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Email không hợp lệ');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.authControllerForgotPassword({ email: trimmedEmail });
      setSuccess(true);
    } catch {
      setError('Không thể gửi yêu cầu, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]}
        testID="forgot-password-success"
      >
        <Text style={[typography.title, { color: colors.foreground, marginBottom: spacing.md }]}>
          Kiểm tra email của bạn
        </Text>
        <Text style={{ color: colors.foreground }}>
          Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.
        </Text>
        <Pressable testID="forgot-password-back-to-login" onPress={() => navigation.goBack()}>
          <Text style={[styles.link, { color: colors.primary }]}>Quay lại đăng nhập</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]}
      testID="forgot-password-screen"
    >
      <Text style={[typography.title, { color: colors.foreground, marginBottom: spacing.md }]}>
        Quên mật khẩu
      </Text>
      <Input
        testID="forgot-password-email"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {error ? (
        <Text testID="forgot-password-error" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button testID="forgot-password-submit" onPress={() => void handleSubmit()} loading={isSubmitting}>
        Gửi link đặt lại mật khẩu
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  link: { textAlign: 'center', marginTop: 8 },
});
