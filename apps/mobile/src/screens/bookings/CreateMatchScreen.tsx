import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import { matchesApi } from '../../api/client';
import type { MyBookingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MyBookingsStackParamList, 'CreateMatch'>;

export function CreateMatchScreen({ route, navigation }: Props) {
  const { bookingId, courtName, bookingDate, startTime, endTime } = route.params;
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
    <View style={styles.container} testID="create-match-screen">
      <Text style={styles.title}>Tạo kèo</Text>
      <Text style={styles.subtitle}>
        {courtName} — {bookingDate} {startTime}-{endTime}
      </Text>
      <TextInput
        testID="create-match-slots"
        style={styles.input}
        placeholder="Số chỗ cần tuyển"
        keyboardType="number-pad"
        value={slotsTotal}
        onChangeText={setSlotsTotal}
      />
      <TextInput
        testID="create-match-skill"
        style={styles.input}
        placeholder="Trình độ (không bắt buộc)"
        value={skillLevel}
        onChangeText={setSkillLevel}
      />
      {error ? (
        <Text testID="create-match-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      <Pressable
        testID="create-match-submit"
        style={styles.button}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Tạo kèo</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#555', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  errorText: { color: '#dc2626' },
  button: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
