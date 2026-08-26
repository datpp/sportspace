import React from 'react';
import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';

export type InputProps = TextInputProps & { ref?: React.Ref<TextInput> };

export function Input({ style, ...props }: InputProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      {...props}
      style={[
        styles.base,
        {
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          color: colors.foreground,
          backgroundColor: colors.card,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
});
