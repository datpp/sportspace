import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { StatusVariant } from '../theme';

export interface StatusPillProps {
  testID?: string;
  variant: StatusVariant;
  /**
   * Đa số variant hiện có (trạng thái booking...) là enum cố định, viết hoa là
   * lựa chọn kiểu chữ hợp lý. Nhưng có nội dung tự do do người dùng nhập (vd bộ
   * môn) mà viết hoa sẽ làm sai lệch dữ liệu gốc — set false để giữ nguyên chữ.
   * Mặc định true để không đổi giao diện các pill enum đã có.
   */
  uppercase?: boolean;
  children: React.ReactNode;
}

export function StatusPill({ testID, variant, uppercase = true, children }: StatusPillProps) {
  const { statusColors, radius, spacing } = useTheme();
  const { bg, text } = statusColors[variant];

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
      ]}
    >
      <Text style={[styles.label, { color: text }, uppercase && styles.uppercase]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
  label: { fontSize: 11, fontWeight: '700' },
  uppercase: { textTransform: 'uppercase' },
});
