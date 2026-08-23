import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const { colors, spacing, radius, typography } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ họ tên, email và mật khẩu');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 409 ? 'Email đã được sử dụng' : 'Đăng ký thất bại, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]}
      testID="register-screen"
    >
      <Text style={[typography.title, { color: colors.foreground, marginBottom: spacing.md }]}>Đăng ký</Text>
      <TextInput
        testID="register-fullName"
        style={[styles.input, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.foreground }]}
        placeholder="Họ và tên"
        placeholderTextColor={colors.mutedForeground}
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        testID="register-email"
        style={[styles.input, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.foreground }]}
        placeholder="Email"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        testID="register-password"
        style={[styles.input, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.foreground }]}
        placeholder="Mật khẩu"
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        testID="register-phone"
        style={[styles.input, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.foreground }]}
        placeholder="Số điện thoại (không bắt buộc)"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      {error ? (
        <Text testID="register-error" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button testID="register-submit" onPress={() => void handleSubmit()} loading={isSubmitting}>
        Đăng ký
      </Button>
      <Pressable testID="register-go-login" onPress={() => navigation.navigate('Login')}>
        <Text style={[styles.link, { color: colors.primary }]}>Đã có tài khoản? Đăng nhập</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  input: { borderWidth: 1 },
  link: { textAlign: 'center', marginTop: 8 },
});
