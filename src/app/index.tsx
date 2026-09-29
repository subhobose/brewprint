/**
 * Opening screen. The loading animation is the real pour engine rather than a
 * one-off loader, so the first thing a guest sees is the thing the app does.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import LiquidCup from '../LiquidCup';
import { Recipe } from '../coffee';
import { COLORS } from '../ui';

/** Café noises, in the order a drink actually gets made. */
const LINES = ['Grinding the beans', 'Steaming the milk', 'Ready when you are'];

/**
 * No ice on purpose. Ten cubes bobbing while the cup pours and the text cycles is
 * too much happening at once on a loading screen — the pour should be the only
 * thing moving.
 */
const HERO: Recipe = {
  base: 'coldbrew',
  size: 16,
  iced: true,
  shots: 0,
  milk: 'oat',
  syrup: 'caramel',
  pumps: 3,
  coldFoam: true,
  foam: 'sweetcream',
  ice: 'none',
};

export default function Splash() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);

  const cupW = Math.min(width * 0.64, 250);

  useEffect(() => {
    if (step >= LINES.length - 1) {
      const t = setTimeout(() => router.replace('/home'), 800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [step, router]);

  return (
    <View style={styles.root}>
      {/* One entrance for the whole title block, not one per line. */}
      <Rise delay={120}>
        <Text style={styles.wordmark}>BrewPrint</Text>
        <Text style={styles.tagline}>Build it here. Order it anywhere.</Text>
      </Rise>

      <View style={styles.stage}>
        <LiquidCup recipe={HERO} width={cupW} height={cupW * 1.5} frameColor={COLORS.bg} />
      </View>

      <View style={styles.status}>
        <Line key={step} text={LINES[step]} />
        <Progress step={step} total={LINES.length} />
      </View>
    </View>
  );
}

/** Mount animation driven from an effect, so the content always ends visible. */
function Rise({ children, delay }: { children: React.ReactNode; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
  }, [delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * 14 }],
  }));

  return <Animated.View style={[styles.center, style]}>{children}</Animated.View>;
}

function Line({ text }: { text: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * 6 }],
  }));

  return <Animated.Text style={[styles.statusText, style]}>{text}</Animated.Text>;
}

const TRACK_W = 148;

function Progress({ step, total }: { step: number; total: number }) {
  const t = useSharedValue(0);
  const target = (step + 1) / total;

  useEffect(() => {
    t.value = withTiming(target, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [target, t]);

  const style = useAnimatedStyle(() => ({ width: t.value * TRACK_W }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 4,
  },
  center: { alignItems: 'center' },
  wordmark: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    color: COLORS.ink,
  },
  tagline: { marginTop: 4, fontSize: 13.5, color: COLORS.inkSoft, letterSpacing: 0.2 },
  stage: { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  status: { alignItems: 'center', gap: 14, marginTop: 6 },
  statusText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.inkSoft,
    letterSpacing: 0.2,
  },
  track: {
    width: TRACK_W,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    overflow: 'hidden',
  },
  fill: { height: 4, backgroundColor: COLORS.accent, borderRadius: 2 },
});
