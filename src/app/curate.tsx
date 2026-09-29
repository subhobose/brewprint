import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRecipe } from '../RecipeContext';
import { activeBrain, describeChanges } from '../barista';
import { COLORS } from '../ui';

/** Tapping one of these fills the box rather than sending, so it can be edited. */
const SUGGESTIONS = [
  'Something nutty',
  'A cozy dessert drink',
  'Tall, iced, oat milk',
  'Less sweet',
  'Stronger — three shots',
  'Chocolate, hot',
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Curate() {
  const router = useRouter();
  const { recipe, patch } = useRecipe();

  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  // A bump counter rather than a direct write: the shared value is only touched
  // from an effect, which keeps the React Compiler's immutability rule happy.
  const [shake, setShake] = useState(0);
  const nudge = useSharedValue(0);

  useEffect(() => {
    if (shake === 0) return;
    nudge.value = withSpring(0, { damping: 4, stiffness: 320, velocity: 900 });
  }, [shake, nudge]);

  const nudgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }],
  }));

  const addSuggestion = (s: string) => {
    setHint(null);
    setDraft((d) => (d.trim() ? `${d.trim()}, ${s.toLowerCase()}` : s));
  };

  const submit = async () => {
    const said = draft.trim();
    if (!said || busy) return;

    setBusy(true);
    setHint(null);
    const reply = await activeBrain.respond(said, recipe);
    const changes = describeChanges(reply.patch, recipe);

    if (changes.length === 0) {
      // Nothing understood. Don't hand over a default cup — ask instead.
      setBusy(false);
      setHint(reply.text);
      setShake((n) => n + 1);
      return;
    }

    patch(reply.patch);
    setSteps(['Reading your order', ...changes.map(cap), 'Pouring your cup']);
  };

  const finish = useCallback(() => router.replace('/drink'), [router]);

  if (steps) return <Curating steps={steps} onDone={finish} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.headerSub}>{activeBrain.label}</Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>Your barista is listening</Text>
          <Text style={styles.headline}>Tell me what you{'’'}re in the mood for.</Text>

          <Animated.View style={nudgeStyle}>
            <TextInput
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                if (hint) setHint(null);
              }}
              placeholder={'e.g. a tall iced latte with oat milk,\nnot too sweet'}
              placeholderTextColor={COLORS.inkSoft}
              style={styles.input}
              multiline
              autoFocus
              editable={!busy}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={submit}
            />
          </Animated.View>

          {hint && <Text style={styles.hint}>{hint}</Text>}

          <Text style={styles.chipsLabel}>Need a nudge?</Text>
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => addSuggestion(s)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={submit}
            disabled={!draft.trim() || busy}
            style={({ pressed }) => [
              styles.pour,
              (!draft.trim() || busy) && styles.pourOff,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text style={styles.pourText}>Pour it</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------- curating --- */

const METER_H = 132;

/**
 * The hand-off screen. Its lines come from the real recipe patch, so it narrates
 * what actually changed instead of showing a decorative loader.
 */
function Curating({ steps, onDone }: { steps: string[]; onDone: () => void }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= steps.length) {
      const t = setTimeout(onDone, 540);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 240 : 330);
    return () => clearTimeout(t);
  }, [shown, steps.length, onDone]);

  const progress = shown / steps.length;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(progress, { duration: 330, easing: Easing.out(Easing.quad) });
  }, [progress, fill]);

  const fillStyle = useAnimatedStyle(() => ({ height: fill.value * METER_H }));

  return (
    <SafeAreaView style={[styles.safe, styles.curatingSafe]} edges={['top', 'bottom']}>
      <View style={styles.meter}>
        <Animated.View style={[styles.meterFill, fillStyle]} />
      </View>

      <Text style={styles.curatingTitle}>Curating your drink</Text>

      <View style={styles.stepList}>
        {steps.map((s, i) => (
          <StepLine key={s + i} text={s} active={i < shown} />
        ))}
      </View>
    </SafeAreaView>
  );
}

/**
 * Animated from a useEffect rather than a layout `entering` prop, so the line is
 * guaranteed to finish visible.
 */
function StepLine({ text, active }: { text: string; active: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(active ? 1 : 0, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [active, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + t.value * 0.75,
    transform: [{ translateY: (1 - t.value) * 7 }],
  }));

  return (
    <Animated.View style={[styles.step, style]}>
      <Text style={[styles.stepTick, active && styles.stepTickOn]}>{active ? '✓' : '·'}</Text>
      <Text style={[styles.stepText, active && styles.stepTextOn]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  back: { width: 36, height: 36, justifyContent: 'center' },
  backText: { fontSize: 26, color: COLORS.ink },
  headerSub: { fontSize: 11, color: COLORS.inkSoft, fontWeight: '600' },

  body: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 24 },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.inkSoft,
  },
  headline: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: COLORS.ink,
  },
  input: {
    minHeight: 132,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: 18,
    lineHeight: 25,
    color: COLORS.ink,
    textAlignVertical: 'top',
  },
  hint: {
    marginTop: 12,
    fontSize: 14.5,
    lineHeight: 20,
    color: COLORS.accent,
    fontWeight: '600',
  },
  chipsLabel: {
    marginTop: 26,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.inkSoft,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  chipPressed: { borderColor: COLORS.accent, backgroundColor: '#FBEEDF' },
  chipText: { fontSize: 14, color: COLORS.inkSoft, fontWeight: '600' },

  footer: { paddingHorizontal: 22, paddingBottom: 8, paddingTop: 6 },
  pour: {
    backgroundColor: COLORS.ink,
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: 'center',
  },
  pourOff: { opacity: 0.3 },
  pourText: { color: '#FFF8EE', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },

  curatingSafe: { alignItems: 'center', justifyContent: 'center', gap: 26 },
  meter: {
    width: 76,
    height: METER_H,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  meterFill: { backgroundColor: COLORS.accent, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  curatingTitle: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: COLORS.ink,
  },
  stepList: { gap: 9, minWidth: 220 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepTick: { width: 16, textAlign: 'center', fontSize: 15, color: COLORS.inkSoft },
  stepTickOn: { color: COLORS.accent, fontWeight: '800' },
  stepText: { fontSize: 15.5, color: COLORS.inkSoft },
  stepTextOn: { color: COLORS.ink, fontWeight: '600' },
});
