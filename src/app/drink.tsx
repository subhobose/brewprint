import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DrinkRender from '../DrinkRender';
import HeroCup from '../HeroCup';
import { useRecipe } from '../RecipeContext';
import {
  BASES,
  FOAMS,
  ICE_LEVELS,
  MILKS,
  Recipe,
  SIZES,
  SWEETNESS,
  SYRUPS,
  recipeLine,
} from '../coffee';
import { COLORS, Row, Segmented, Stepper } from '../ui';

const HEADER_H = 74;
const SHEET_PEEK = 104;

export default function Drink() {
  const router = useRouter();
  const { recipe, name, patch, reset } = useRecipe();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const sheet = useSharedValue(0);

  const stageH = Math.max(
    300,
    height - insets.top - insets.bottom - HEADER_H - SHEET_PEEK,
  );
  const sheetMax = Math.min(height * 0.62, stageH + SHEET_PEEK - 40);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    sheet.value = withSpring(next ? 1 : 0, { damping: 18, stiffness: 140, mass: 0.9 });
  };

  const sheetStyle = useAnimatedStyle(() => ({
    height: SHEET_PEEK + sheet.value * (sheetMax - SHEET_PEEK),
  }));

  const set = <K extends keyof Recipe>(key: K, value: Recipe[K]) => patch({ [key]: value });

  const pickBase = (id: Recipe['base']) => {
    const b = BASES.find((x) => x.id === id)!;
    reset({ ...recipe, base: id, iced: b.iced, shots: b.shots, milk: b.milk });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.header, { height: HEADER_H }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Animated.View entering={FadeIn.duration(400)} style={styles.headerMid}>
          <Text style={styles.headerName} numberOfLines={1}>
            {name ?? 'Your drink'}
          </Text>
          <Text style={styles.headerLine} numberOfLines={2}>
            {recipeLine(recipe)}
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.stage, { height: stageH }]}>
        <HeroCup recipe={recipe} width={width} height={stageH} frameColor={COLORS.bg} />
      </View>

      <Animated.View
        entering={FadeInDown.delay(380).duration(520)}
        style={[styles.sheet, { paddingBottom: insets.bottom + 8 }, sheetStyle]}
      >
        <Pressable onPress={toggle} style={styles.grabRow} hitSlop={8}>
          <View style={styles.grabber} />
          <Text style={styles.grabLabel}>{open ? 'Done adjusting' : 'Adjust this drink'}</Text>
        </Pressable>

        {open ? (
          <ScrollView
            contentContainerStyle={styles.controls}
            showsVerticalScrollIndicator={false}
          >
            <Row label="Base">
              <Segmented
                options={BASES.map((b) => ({ value: b.id, label: b.label }))}
                value={recipe.base}
                onChange={pickBase}
              />
            </Row>
            <Row label="Size">
              <Segmented
                options={SIZES.map((s) => ({ value: s, label: `${s} oz` }))}
                value={recipe.size}
                onChange={(v) => set('size', v)}
              />
            </Row>
            <Row label="Temperature">
              <Segmented
                options={[
                  { value: true, label: 'Iced' },
                  { value: false, label: 'Hot' },
                ]}
                value={recipe.iced}
                onChange={(v) => set('iced', v)}
              />
            </Row>
            <Row label="Espresso">
              <Stepper
                value={recipe.shots}
                min={0}
                max={5}
                onChange={(v) => set('shots', v)}
                suffix={recipe.shots === 1 ? 'shot' : 'shots'}
              />
            </Row>
            <Row label="Milk">
              <Segmented
                options={MILKS.map((m) => ({
                  value: m.id,
                  label: m.label,
                  swatch: m.id === 'none' ? undefined : m.color,
                }))}
                value={recipe.milk}
                onChange={(v) => set('milk', v)}
              />
            </Row>
            <Row label="Syrup">
              <Segmented
                options={SYRUPS.map((s) => ({
                  value: s.id,
                  label: s.label,
                  swatch: s.id === 'none' ? undefined : s.color,
                }))}
                value={recipe.syrup}
                onChange={(v) => set('syrup', v)}
              />
            </Row>
            {recipe.syrup !== 'none' && (
              <>
                {/* Presets set pumps rather than holding their own state, so this
                    and the stepper below can never disagree. */}
                <Row label="Sweetness">
                  <Segmented
                    options={SWEETNESS.map((s) => ({ value: s.pumps, label: s.label }))}
                    value={recipe.pumps}
                    onChange={(v) => set('pumps', v)}
                  />
                </Row>
                <Row label="Pumps">
                  <Stepper
                    value={recipe.pumps}
                    min={1}
                    max={8}
                    onChange={(v) => set('pumps', v)}
                    suffix={recipe.pumps === 1 ? 'pump' : 'pumps'}
                  />
                </Row>
              </>
            )}

            {recipe.iced && (
              <Row label="Ice">
                <Segmented
                  options={ICE_LEVELS.map((l) => ({ value: l.id, label: l.label }))}
                  value={recipe.ice}
                  onChange={(v) => set('ice', v)}
                />
              </Row>
            )}
            {/* Cold foam is a cold-drink thing; a hot coffee's foam is steamed
                into the milk rather than poured on top. */}
            {recipe.iced && (
              <Row label="Cold foam">
                <Segmented
                  options={[
                    { value: true, label: 'Yes' },
                    { value: false, label: 'No' },
                  ]}
                  value={recipe.coldFoam}
                  onChange={(v) => set('coldFoam', v)}
                />
              </Row>
            )}

            {recipe.iced && recipe.coldFoam && (
              <Row label="Foam flavour">
                <Segmented
                  options={FOAMS.map((f) => ({
                    value: f.id,
                    label: f.label,
                    swatch: f.color,
                  }))}
                  value={recipe.foam}
                  onChange={(v) => set('foam', v)}
                />
              </Row>
            )}
          </ScrollView>
        ) : (
          <Pressable onPress={() => router.push('/curate')} style={styles.tweakCta}>
            <Text style={styles.tweakText}>Ask the barista to change something</Text>
            <Text style={styles.tweakArrow}>→</Text>
          </Pressable>
        )}
      </Animated.View>

      {/* Rendered after the sheet so it floats above it. */}
      <LivePreview recipe={recipe} sheet={sheet} peek={SHEET_PEEK} max={sheetMax} />
    </View>
  );
}

/**
 * A small live cup that rides just above the sheet while it's open.
 *
 * The hero cup already tracks the recipe, but an expanded sheet hides most of it,
 * so this keeps the drink visible exactly while it's being edited. It reads the
 * same `Recipe`, so it can't drift from the big cup — and it pops on each change
 * so a tap on a chip is visibly acknowledged.
 */
function LivePreview({
  recipe,
  sheet,
  peek,
  max,
}: {
  recipe: Recipe;
  sheet: SharedValue<number>;
  peek: number;
  max: number;
}) {
  const pop = useSharedValue(1);
  const key = recipeLine(recipe);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.value = withSequence(
      withTiming(1.12, { duration: 130, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 240 }),
    );
  }, [key, pop]);

  const style = useAnimatedStyle(() => ({
    bottom: peek + sheet.value * (max - peek) + 14,
    opacity: sheet.value,
    transform: [{ scale: (0.8 + sheet.value * 0.2) * pop.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.preview, style]}>
      <DrinkRender recipe={recipe} width={58} />
      <Text style={styles.previewLabel}>
        {recipe.size}oz {recipe.iced ? 'Iced' : 'Hot'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  back: { width: 34, height: 34, justifyContent: 'center' },
  backText: { fontSize: 26, color: COLORS.ink },
  headerMid: { flex: 1 },
  headerName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: COLORS.ink,
  },
  headerLine: { fontSize: 12, color: COLORS.inkSoft, lineHeight: 16, marginTop: 2 },

  stage: { width: '100%' },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  grabRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 8, gap: 8 },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.line },
  grabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: COLORS.inkSoft,
  },
  controls: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  tweakCta: {
    marginHorizontal: 20,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  tweakText: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  tweakArrow: { fontSize: 17, color: COLORS.accent, fontWeight: '700' },

  preview: {
    position: 'absolute',
    right: 18,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 7,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    shadowColor: '#2A1B10',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: COLORS.inkSoft,
  },
});
