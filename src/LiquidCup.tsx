/**
 * The hero cup: a full-bleed animated drink.
 *
 * Motion breakdown, in the spirit of WaterLlama's bottle:
 *  - two sine wave bands slide across the surface at different speeds, which
 *    reads as moving liquid without any per-frame path math
 *  - the whole body pours up on mount and dips when the recipe changes
 *  - the surface tilts back and forth a couple of degrees, like a carried cup
 *  - bubbles rise through the body, ice bobs, hot drinks give off steam
 *
 * Everything animated is a plain View driven by Reanimated. The tapered cup
 * shape comes from an even-odd frame drawn over the top; see src/cup.ts.
 */

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import CupChrome from './CupChrome';
import DrinkBody from './DrinkBody';
import { ICE_COUNT, Recipe, icedComposition, layersFor, mix, recipeLine } from './coffee';
import { IceCube, cupGeometry, iceBed, seeded, wavePath } from './cup';

type Props = {
  recipe: Recipe;
  width: number;
  height: number;
  /** Must match the color painted behind the cup. */
  frameColor: string;
};

/** Kept low: the surface wave carries the movement, bubbles only hint at it. */
const BUBBLE_COUNT = 4;

export default function LiquidCup({ recipe, width, height, frameColor }: Props) {
  const geo = useMemo(
    () =>
      cupGeometry(width, height, {
        size: recipe.size,
        style: recipe.iced ? 'cold' : 'hot',
      }),
    [width, height, recipe],
  );
  const bands = useMemo(() => layersFor(recipe), [recipe]);

  const liquid = bands.filter((b) => !b.overlay);
  const hasIce = bands.some((b) => b.overlay);
  // Liquid only: ice is drawn over the drink, not as a band, so counting its
  // volume here would leave the cup part-empty.
  const liquidOz = liquid.reduce((s, b) => s + b.oz, 0) || 1;

  const fillH = geo.innerH;
  const surfaceTop = geo.baseY - fillH;

  // Bottom-up volumes, rendered top-down so flex stacking matches the cup. `t` is
  // each band's top edge as a fraction of the body, used to size its surface
  // ellipse to the taper at that depth.
  const stacked = useMemo(() => {
    const topDown = liquid.slice().reverse();
    const out: { id: string; color: string; h: number; t: number }[] = [];
    for (let i = 0, y = surfaceTop; i < topDown.length; i++) {
      const b = topDown[i];
      const h = (b.oz / liquidOz) * fillH;
      out.push({ id: b.id, color: b.color, h, t: (y - geo.rimY) / geo.bodyH });
      y += h;
    }
    return out;
  }, [liquid, liquidOz, fillH, surfaceTop, geo.rimY, geo.bodyH]);

  const comp = useMemo(() => icedComposition(recipe), [recipe]);

  // The surface has to be the colour of the liquid *immediately beneath it*.
  //
  // Using the band's own `color` painted the wave in `drinkColor` — the blended
  // mid-tone — while the body's gradient starts at the brew colour at its top. On
  // a matcha that put a dull strip over bright green and read as a phantom extra
  // layer, sliding out of step with the drink under it.
  const foamBand = stacked.find((b) => b.id === 'foam');
  const topColor = foamBand ? foamBand.color : comp.coffee;

  // When foam is on top, the surface belongs to a thick liquid and has to move
  // like one.
  const foamOnTop = stacked[0]?.id === 'foam';
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const bodyId = `body-${uid}`;

  /* ---- Pour and settle ---- */
  const pour = useSharedValue(1);
  const firstRender = useRef(true);
  const recipeKey = recipeLine(recipe);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      pour.value = 1;
      pour.value = withDelay(90, withSpring(0, { damping: 13, stiffness: 78, mass: 1.15 }));
    } else {
      // A tweak shouldn't empty the cup; just knock it so the surface sloshes.
      pour.value = withSequence(
        withTiming(0.055, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 9, stiffness: 120 }),
      );
    }
    return () => cancelAnimation(pour);
  }, [recipeKey, pour]);

  /*
   * Oscillations run on a **linear phase** that loops 0 → 1 forever, with the
   * sine taken inside the worklet.
   *
   * The obvious spelling — `withRepeat(withTiming(...), -1, true)` with an
   * `inOut` easing — is what made the drink look like it stopped and restarted:
   * a reversing repeat decelerates to a dead stop at both ends of every swing,
   * and `inOut` easing exaggerates the dwell. A linear phase through a sine has
   * no stationary point at all, so the motion is genuinely continuous.
   */
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(
      withTiming(1, { duration: 7600, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(sway);
  }, [sway]);

  // Kept very small, and vertical only. The surface carries the movement; the
  // body just breathes under it. Sliding the body sideways as well made the two
  // read as separate things.
  const bodyStyle = useAnimatedStyle(() => {
    const s = Math.sin(sway.value * Math.PI * 2);
    return {
      transform: [{ translateY: pour.value * fillH + s * 1.2 }],
    };
  });

  /* ---- Surface tilt, same continuous phase ---- */
  const tilt = useSharedValue(0);
  useEffect(() => {
    tilt.value = withRepeat(
      withTiming(1, { duration: 6400, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(tilt);
  }, [tilt]);

  return (
    <View style={{ width, height }}>
      {/*
        Everything liquid is clipped to the cup's box.

        The frame drawn further down only covers the box minus the cup interior,
        so anything reaching *outside* the box isn't covered by it — and the wave
        band is deliberately twice the container's width so it can loop. On a
        full-width hero that overflow runs off-screen harmlessly, but on the
        loading screen, where the cup is 64% of the screen, it spilled colour out
        beside the cup. Steam is rendered outside this wrapper, since it belongs
        above the rim.
      */}
      <View
        style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}
      >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: surfaceTop,
            height: fillH,
          },
          bodyStyle,
        ]}
      >
        {stacked.map((b, i) => (
          <View key={b.id} style={{ height: b.h, backgroundColor: b.color }}>
            {/* The drink itself is a gradient, dark near the top drifting into
                pale milk — how an iced coffee actually looks before it's stirred.
                Foam keeps a flat fill; it's aerated, not marbled. */}
            {b.id === 'body' && (
              <Svg width={width} height={b.h} style={StyleSheet.absoluteFill}>
                <DrinkBody
                  width={width}
                  height={b.h}
                  comp={comp}
                  gradId={bodyId}
                  shadow={foamOnTop}
                />
              </Svg>
            )}

            {/*
              Foam is a smooth, opaque cap poured on top of the coffee. It does
              not mix with it, so there is no blend between the two and no seam
              ellipse drawn across the coffee below — that oval was the "thing in
              the coffee layer". The band's own flat colour does the work, with a
              single crest where it catches the light.

              It also carries no bubble texture. Every reference photograph shows
              a smooth cream surface; scattered bubbles read as speckle on the
              drink rather than as foam.
            */}
            {b.id === 'foam' && <FoamCrest width={width} height={b.h} color={b.color} />}
          </View>
        ))}


        {/* Packed at the bottom. Positions come back in cup coordinates, so they
            shift up by the container's own offset. */}
        {hasIce &&
          iceBed(geo, surfaceTop, ICE_COUNT[recipe.ice]).map((c, i) => (
            <Ice key={`ice-${i}`} index={i} cube={c} containerTop={surfaceTop} />
          ))}

        {Array.from({ length: BUBBLE_COUNT }).map((_, i) => (
          <Bubble key={`b-${i}`} index={i} width={width} fillH={fillH} />
        ))}

        <WaveSurface width={width} color={topColor} tilt={tilt} viscous={foamOnTop} />
      </Animated.View>
      </View>

      {!recipe.iced && <Steam cx={geo.cx} y={geo.rimY - geo.lidH} width={geo.topW} />}

      {/* Sheen inside the cup, the frame that carves the cup out, then glass. */}
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {/* Carves the cup out of the animated Views behind it. CupChrome then
            lays the cylinder shading over the drink, so no clip is needed here. */}
        <Path d={geo.frame} fill={frameColor} fillRule="evenodd" />

        <CupChrome geo={geo} />

      </Svg>
    </View>
  );
}

/* ----------------------------------------------------------------- foam --- */

/**
 * The light catching the top of the foam cap.
 *
 * That is the whole of it. Foam is opaque and smooth, poured on top of the
 * coffee rather than stirred into it, so it needs no bubble texture, no blend
 * into the drink below, and no seam ellipse drawn across the coffee. Each of
 * those was tried and each read as something sitting *in* the drink: speckle,
 * a muddy band, and a stray oval.
 */
const GRAIN = 70;

function FoamCrest({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const light = mix(color, '#FFFFFF', 0.5);
  const dark = mix(color, '#000000', 0.14);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width, height }}
    >
      {/*
        Fine grain, not bubbles.

        An earlier version drew ~16 circles at 8–19% of the cap's height. At that
        size individual shapes are legible, and legible circles on a drink read as
        bubbles stuck to the glass. Aerated foam is a *texture*: many specks, each
        far too small to resolve on its own, so the eye takes the whole cap as
        whipped rather than counting marks on it. These are a quarter the size and
        four times as many.
      */}
      {Array.from({ length: GRAIN }).map((_, i) => {
        const r = height * (0.022 + seeded(i * 2.3) * 0.035);
        return (
          <View
            key={`g-${i}`}
            style={{
              position: 'absolute',
              left: seeded(i + 1) * width,
              top: height * (0.06 + seeded(i + 60) * 0.86),
              width: r,
              height: r,
              borderRadius: r / 2,
              backgroundColor: i % 3 === 0 ? dark : light,
              opacity: i % 3 === 0 ? 0.3 : 0.45,
            }}
          />
        );
      })}

      {/* Light along the top edge, where the cap meets the air. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height: Math.max(1.5, height * 0.14),
          backgroundColor: light,
          opacity: 0.5,
        }}
      />
    </View>
  );
}


/* ---------------------------------------------------------------- waves --- */

/**
 * The liquid surface.
 *
 * `viscous` is set when cold foam is the top band. Thick liquid doesn't ripple:
 * it moves in shallow, slow swells. Halving the amplitude and more than doubling
 * the period is what makes foam read as denser than the drink under it — the cap
 * isn't a wider band, it's a heavier one.
 */
function WaveSurface({
  width,
  color,
  tilt,
  viscous,
}: {
  width: number;
  color: string;
  tilt: SharedValue<number>;
  viscous: boolean;
}) {
  const amp = Math.max(6, width * (viscous ? 0.01 : 0.022));
  const depth = amp * 2 + 30;
  const period = viscous ? 8200 : 3600;
  const slowPeriod = viscous ? 12000 : 5600;
  const d = useMemo(() => wavePath(width, amp, depth), [width, amp, depth]);
  const backD = useMemo(() => wavePath(width, amp * 0.62, depth), [width, amp, depth]);

  const front = useSharedValue(0);
  const back = useSharedValue(0);

  useEffect(() => {
    front.value = withRepeat(
      withTiming(-width, { duration: period, easing: Easing.linear }),
      -1,
      false,
    );
    back.value = withRepeat(
      withTiming(-width, { duration: slowPeriod, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(front);
      cancelAnimation(back);
    };
  }, [width, period, slowPeriod, front, back]);

  // Thick liquid barely tips when the cup moves.
  const tip = viscous ? 0.35 : 1;

  /*
   * The tilt lives on a **stationary wrapper**, never on the sliding bands.
   *
   * A rotation pivots around its own view's centre. The bands are twice the
   * container's width and travel a full width each loop, so rotating *them* drags
   * the pivot along with the scroll: the same visible point picks up a different
   * vertical offset as the band slides, and the whole surface heaves in time with
   * the horizontal loop. That was the awkwardness.
   *
   * With the rotation on a wrapper that is exactly the container's width and
   * never moves, the pivot is fixed, the tilt is a clean rocking of the surface,
   * and the bands underneath do nothing but slide.
   */
  const tiltStyle = useAnimatedStyle(() => {
    const t = Math.sin(tilt.value * Math.PI * 2);
    return {
      transform: [{ rotate: `${t * 1.5 * tip}deg` }, { translateY: t * 2 * tip }],
    };
  });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: front.value }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: back.value }],
  }));

  const band = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: width * 2,
    height: depth,
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: -amp * 2, left: 0, width, height: depth },
        tiltStyle,
      ]}
    >
      {/*
        Both bands are the drink's own colour, barely varied.

        They used to be mixed 40% toward white (back) and overlaid with white
        (front), which made the whole surface region visibly paler than the liquid
        under it — a phantom layer lying across the top of the drink. Because the
        bands slide, that pale strip appeared to animate independently, which is
        what read as "a layer on top with a different animation". A surface is not
        a different material from the liquid it belongs to, so it cannot be a
        different colour.
      */}
      <Animated.View style={[band, backStyle]} pointerEvents="none">
        <Svg width={width * 2} height={depth}>
          <Path d={backD} fill={mix(color, '#FFFFFF', 0.1)} opacity={0.5} />
        </Svg>
      </Animated.View>
      <Animated.View style={[band, frontStyle]} pointerEvents="none">
        <Svg width={width * 2} height={depth}>
          <Path d={d} fill={color} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------- bubbles --- */

function Bubble({ index, width, fillH }: { index: number; width: number; fillH: number }) {
  const t = useSharedValue(0);
  const size = 4 + seeded(index + 11) * 7;
  const left = width * (0.18 + seeded(index) * 0.64);
  const travel = fillH * (0.55 + seeded(index + 5) * 0.4);

  useEffect(() => {
    t.value = withDelay(
      index * 480,
      withRepeat(
        withTiming(1, { duration: 2700 + seeded(index + 2) * 1900, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(t);
  }, [index, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - t.value) * travel },
      { translateX: Math.sin(t.value * Math.PI * 3) * 6 },
    ],
    opacity: t.value < 0.12 ? t.value * 4 : (1 - t.value) * 0.5,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.7)',
        },
        style,
      ]}
    />
  );
}

/* ------------------------------------------------------------------ ice --- */

function Ice({
  index,
  cube,
  containerTop,
}: {
  index: number;
  cube: IceCube;
  containerTop: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 6200 + index * 700, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [index, t]);

  // A small shift only: these cubes are wedged against each other, not drifting.
  // Squashing the width as it turns reads as a cube tumbling rather than a square
  // spinning flat against the screen.
  const style = useAnimatedStyle(() => {
    const s = Math.sin(t.value * Math.PI * 2 + index * 1.4);
    return {
      transform: [
        { translateY: s * 2.2 },
        { rotate: `${cube.rotate + s * 4}deg` },
        { scaleX: 0.92 + s * 0.08 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: cube.x,
          top: cube.y - containerTop,
          width: cube.size,
          height: cube.size,
          borderRadius: cube.size * 0.2,
          backgroundColor: 'rgba(255,255,255,0.34)',
          borderWidth: 1.4,
          borderColor: 'rgba(255,255,255,0.55)',
        },
        style,
      ]}
    />
  );
}

/* ---------------------------------------------------------------- steam --- */

/** Four wisps off the lid, so a hot drink reads hot without a label. */
function Steam({ cx, y, width }: { cx: number; y: number; width: number }) {
  const rise = width * 0.62;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: y - rise }}
    >
      {[0, 1, 2, 3].map((i) => (
        <Wisp key={i} index={i} cx={cx} width={width} rise={rise} />
      ))}
    </View>
  );
}

function Wisp({
  index,
  cx,
  width,
  rise,
}: {
  index: number;
  cx: number;
  width: number;
  rise: number;
}) {
  const t = useSharedValue(0);
  const w = width * 0.055;
  const lane = (index - 1.5) * width * 0.15;

  useEffect(() => {
    t.value = withDelay(
      index * 780,
      withRepeat(withTiming(1, { duration: 3600, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(t);
  }, [index, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -t.value * rise * 0.85 },
      { translateX: Math.sin(t.value * Math.PI * 2 + index) * width * 0.045 },
      { scale: 0.65 + t.value * 0.9 },
    ],
    opacity: t.value < 0.2 ? t.value * 2.4 : (1 - t.value) * 0.6,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cx + lane - w / 2,
          top: rise * 0.35,
          width: w,
          height: rise * 0.72,
          borderRadius: w,
          backgroundColor: '#FFFFFF',
        },
        style,
      ]}
    />
  );
}

