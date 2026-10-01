/** Small shared controls. Nothing coffee-specific lives in here. */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from './theme';

// The palette itself lives in theme.ts, which has no React in it, so coffee.ts can
// read the page colour. Re-exported here because every screen imports it from ui.
export { COLORS };

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

type Option<T> = { value: T; label: string; swatch?: string };

export function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            {o.swatch ? (
              <View style={[styles.swatch, { backgroundColor: o.swatch }]} />
            ) : null}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => step(-1)}
        disabled={value <= min}
        style={[styles.stepBtn, value <= min && styles.stepBtnOff]}
      >
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      <Pressable
        onPress={() => step(1)}
        disabled={value >= max}
        style={[styles.stepBtn, value >= max && styles.stepBtnOff]}
      >
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 16 },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: COLORS.inkSoft,
    marginBottom: 8,
  },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
  },
  chipActive: { borderColor: COLORS.accent, backgroundColor: '#FBEEDF' },
  chipText: { fontSize: 14, color: COLORS.inkSoft, fontWeight: '600' },
  chipTextActive: { color: COLORS.accent },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#0002' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },
  stepBtnOff: { opacity: 0.4 },
  stepBtnText: { fontSize: 22, color: COLORS.accent, fontWeight: '600', marginTop: -2 },
  stepValue: { fontSize: 16, fontWeight: '700', color: COLORS.ink, minWidth: 72 },
});
