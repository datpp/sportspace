import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { colors, spacing, radius, typography } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch {
      setError('Sai email hoặc mật khẩu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]}
      testID="login-screen"
    >
      <Text style={[typography.title, { color: colors.foreground, marginBottom: spacing.md }]}>Đăng nhập</Text>
      <TextInput
        testID="login-email"
        style={[styles.input, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.foreground }]}
        placeholder="Email"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        testID="login-password"
        style={[styles.input, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.foreground }]}
        placeholder="Mật khẩu"
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? (
        <Text testID="login-error" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button testID="login-submit" onPress={() => void handleSubmit()} loading={isSubmitting}>
        Đăng nhập
      </Button>
      <Pressable testID="login-go-register" onPress={() => navigation.navigate('Register')}>
        <Text style={[styles.link, { color: colors.primary }]}>Chưa có tài khoản? Đăng ký</Text>
      </Pressable>
      <Pressable testID="login-go-forgot-password" onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={[styles.link, { color: colors.primary }]}>Quên mật khẩu?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  input: { borderWidth: 1 },
  link: { textAlign: 'center', marginTop: 8 },
});
