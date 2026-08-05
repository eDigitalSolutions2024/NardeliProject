import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

export default function Stepper({ value, onChange, min = 0 }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={() => onChange(Math.max(min, (Number(value) || 0) - 1))}
        hitSlop={8}
      >
        <Ionicons name="remove" size={16} color={colors.primary} />
      </TouchableOpacity>
      <TextInput
        style={styles.stepInput}
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => {
          const n = Number(t.replace(/[^0-9]/g, ''));
          onChange(Number.isFinite(n) ? n : min);
        }}
      />
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={() => onChange((Number(value) || 0) + 1)}
        hitSlop={8}
      >
        <Ionicons name="add" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    width: 56,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
