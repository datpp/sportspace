import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.sidebar, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
      ]}
    >
      <Text style={[styles.title, { color: colors.sidebarForeground }]}>{title}</Text>
      {subtitle ? (
        <Text testID="screen-header-subtitle" style={[styles.subtitle, { color: colors.sidebarMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
});
