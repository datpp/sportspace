import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { StatusVariant } from '../theme';

export interface StatusPillProps {
  testID?: string;
  variant: StatusVariant;
  children: React.ReactNode;
}

export function StatusPill({ testID, variant, children }: StatusPillProps) {
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
      <Text style={[styles.label, { color: text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
