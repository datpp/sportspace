import React from 'react';
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface CardProps {
  testID?: string;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ testID, onPress, children, style }: CardProps) {
  const { colors, radius, spacing } = useTheme();
  const cardStyle = [
    styles.base,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={cardStyle}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, gap: 4 },
});
