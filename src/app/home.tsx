import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import DrinkRender from '../DrinkRender';
import { useRecipe } from '../RecipeContext';
import { POPULAR, Recipe } from '../coffee';
import { COLORS } from '../ui';

/**
 * Every tile is laid out from these constants rather than from its content, so a
 * one-line name and a two-line name produce identical cards. Text blocks get
 * fixed heights equal to their line count, and the art well is a fixed box the
 * cup sits at the bottom of.
 */
const CARD_W = 176;
const ART_H = 150;
const NAME_H = 42; // 2 lines at 21
const NOTE_H = 17; // 1 line at 17 — notes are tag lines, never prose
const CARD_PAD = 12;
const CARD_H = CARD_PAD * 2 + ART_H + NAME_H + NOTE_H + 4;

/** Thumbnails always draw the regular 16oz cup, whatever the recipe's own size. */
const REFERENCE_SIZE = 16;
const CUP_W = 98;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const { reset } = useRecipe();
  const [shown, setShown] = useState<string | null>(null);

  const open = (recipe: Recipe, name: string) => {
    reset(recipe, name);
    router.push('/drink');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(480)}>
          <Text style={styles.eyebrow}>{greeting()}</Text>
          <Text style={styles.headline}>What would you like to drink today?</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.shelfHead}>
          <Text style={styles.shelfLabel}>Trending near you</Text>
        </Animated.View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelf}
          snapToInterval={CARD_W + 14}
          decelerationRate="fast"
        >
          {POPULAR.map((p, i) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(200 + i * 70).duration(440)}>
              <Pressable
                onPress={() => open(p.recipe, p.name)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardArt}>
                  <DrinkRender recipe={p.recipe} width={CUP_W} size={REFERENCE_SIZE} />
                  {shown === p.id && (
                    <Pressable style={styles.detailHit} onPress={() => setShown(null)}>
                      <Detail text={p.detail} />
                    </Pressable>
                  )}
                </View>

                {/* Its own Pressable, so tapping it reads the description instead
                    of opening the drink. */}
                <Pressable
                  onPress={() => setShown((cur) => (cur === p.id ? null : p.id))}
                  hitSlop={8}
                  style={styles.info}
                >
                  <Text style={styles.infoGlyph}>i</Text>
                </Pressable>

                <Text style={styles.cardName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {p.name}
                </Text>
                <Text style={styles.cardNote} numberOfLines={1}>
                  {p.note}
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>

        <Animated.View entering={FadeInDown.delay(560).duration(480)} style={styles.curateWrap}>
          <Text style={styles.orLabel}>or build it from scratch</Text>
          <Pressable
            onPress={() => router.push('/curate')}
            style={({ pressed }) => [styles.curate, pressed && styles.curatePressed]}
          >
            <View style={styles.curateCopy}>
              <Text style={styles.curateTitle}>Curate your drink</Text>
              <Text style={styles.curateNote}>
                Tell the barista what you want and watch it pour
              </Text>
            </View>
            <Text style={styles.curateArrow}>→</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The full description, over the cup, toggled by the tile's info button. Keeps
 * prose out of a 176pt tile instead of truncating it there. Tapping the overlay
 * dismisses it.
 */
function Detail({ text }: { text: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 0.94 + t.value * 0.06 }],
  }));

  return (
    <Animated.View style={[styles.detail, style]} pointerEvents="none">
      <Text style={styles.detailText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingTop: 18, paddingBottom: 34 },
  eyebrow: {
    paddingHorizontal: 22,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: COLORS.inkSoft,
  },
  headline: {
    paddingHorizontal: 22,
    marginTop: 6,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: COLORS.ink,
  },
  shelfHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginTop: 28,
    marginBottom: 12,
  },
  shelfLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.inkSoft,
  },
  shelf: { paddingHorizontal: 22, gap: 14, paddingVertical: 4 },

  card: {
    width: CARD_W,
    height: CARD_H,
    padding: CARD_PAD,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },
  cardPressed: { borderColor: COLORS.accent, transform: [{ scale: 0.975 }] },
  // Cups sit on the floor of the well, so every tile shares one baseline.
  cardArt: {
    height: ART_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 12,
  },
  // Centred to match the cup above it; left-aligned text under a centred cup is
  // what made the tiles look unresolved.
  cardName: {
    height: NAME_H,
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'center',
  },
  info: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoGlyph: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accent,
    lineHeight: 16,
  },
  detailHit: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  cardNote: {
    height: NOTE_H,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLORS.inkSoft,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  detail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(43,30,20,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  detailText: {
    color: '#F6E9D8',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },

  curateWrap: { paddingHorizontal: 22, marginTop: 32 },
  orLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.inkSoft,
    marginBottom: 12,
  },
  curate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.ink,
    borderRadius: 22,
    padding: 20,
  },
  curatePressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  curateCopy: { flex: 1 },
  curateTitle: { color: '#FFF8EE', fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  curateNote: { color: '#D9C6B0', fontSize: 13, marginTop: 4, lineHeight: 18 },
  curateArrow: { color: '#FFF8EE', fontSize: 24, fontWeight: '600' },
});
