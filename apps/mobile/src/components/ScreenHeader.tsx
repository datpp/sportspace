import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="screen-header"
      style={{
        backgroundColor: colors.sidebar,
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.lg,
      }}
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
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
});
