import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import { matchesApi } from '../../api/client';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import type { MyBookingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MyBookingsStackParamList, 'CreateMatch'>;

export function CreateMatchScreen({ route, navigation }: Props) {
  const { bookingId, courtName, bookingDate, startTime, endTime } = route.params;
  const { colors, spacing } = useTheme();
  const [slotsTotal, setSlotsTotal] = useState('4');
  const [skillLevel, setSkillLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsedSlots = Number(slotsTotal);
    if (!Number.isInteger(parsedSlots) || parsedSlots < 1) {
      setError('Số chỗ cần tuyển phải là số nguyên từ 1 trở lên');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await matchesApi.matchingControllerCreate({
        bookingId,
        slotsTotal: parsedSlots,
        ...(skillLevel.trim() ? { skillLevel: skillLevel.trim() } : {}),
      });
      navigation.goBack();
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      setError(status === 409 ? 'Booking này đã có kèo rồi' : 'Tạo kèo thất bại, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, gap: spacing.md }]} testID="create-match-screen">
      <Text style={[styles.title, { color: colors.foreground }]}>Tạo kèo</Text>
      <Text style={{ color: colors.mutedForeground, marginBottom: spacing.sm }}>
        {courtName} — {bookingDate} {startTime}-{endTime}
      </Text>
      <Input
        testID="create-match-slots"
        placeholder="Số chỗ cần tuyển"
        keyboardType="number-pad"
        value={slotsTotal}
        onChangeText={setSlotsTotal}
      />
      <Input
        testID="create-match-skill"
        placeholder="Trình độ (không bắt buộc)"
        value={skillLevel}
        onChangeText={setSkillLevel}
      />
      {error ? (
        <Text testID="create-match-error" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button testID="create-match-submit" onPress={() => void handleSubmit()} loading={isSubmitting}>
        Tạo kèo
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 20, fontWeight: '700' },
});
