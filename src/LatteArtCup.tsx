/**
 * The hot-drink view: a squat stoneware mug on a glazed saucer, seen from just
 * above, with latte art poured into the crema.
 *
 * Proportions and materials are taken from the café reference photographs in
 * `references/coffee/`, because the first attempt at this was a tall narrow mug
 * with a small heart floating on it and looked nothing like a served coffee. What
 * the photographs actually show:
 *
 *  - the mug is **wide and short** — the rim is about as wide as the body is
 *    tall, not a tall cylinder
 *  - a dark glazed lip band that bleeds down and fades into speckled cream
 *    stoneware, rather than a flat ceramic colour
 *  - a small round handle set high on the body
 *  - a deep saucer with a raised rim and a visible well, not a flat disc
 *  - a **rosetta that fills the surface** — heart at the top, feathered leaves
 *    down the middle — not a small motif in the centre
 *
 * The recipe still drives the drink: crema takes `drinkColor`, so a third shot
 * pours a darker surface, and no milk means no art, because you cannot pour art
 * without microfoam.
 */

import React, { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { Recipe, drinkColor, foamColor, milkOf, mix } from './coffee';
import { seeded } from './cup';

const VB_W = 320;
const VB_H = 310;

const CX = VB_W / 2;
const RIM_Y = 112;
const RIM_RX = 96;
const RIM_RY = 27;
const BODY_H = 94;
const BOT_Y = RIM_Y + BODY_H;
const BOT_RX = RIM_RX * 0.83;
const WALL = 9;

const SAUCER_Y = BOT_Y + 22;
const SAUCER_RX = 150;
const SAUCER_RY = 40;

const GLAZE_DARK = '#5E3A20';
const GLAZE_MID = '#A8845C';
const STONEWARE = '#E4D8C2';
const STONEWARE_EDGE = '#B7A98C';

type Art = 'rosetta' | 'tulip' | 'heart' | 'none';

function artFor(r: Recipe): Art {
  // No microfoam, no pour. An americano taken black is just a dark surface.
  if (r.milk === 'none') return 'none';
  if (r.shots >= 3) return 'tulip';
  return 'rosetta';
}

/*
 * Art is authored in a unit box, x and y both roughly -1..1, and the group that
 * draws it is scaled to the crema ellipse. Designing it in surface pixels meant
 * hand-checking that every motif fitted, and the first rosetta didn't — it ran to
 * ±83 units inside a surface only ±24 tall, so it spilled over the rim. In unit
 * space it cannot.
 *
 * Nothing here uses strokes, because the group's scale is non-uniform and would
 * smear stroke weight along one axis.
 */

/** A heart with its point at the bottom, centred on `cy`. */
function heart(s: number, cy = 0): string {
  const w = s * 0.62;
  const y0 = cy + s * 0.46;
  return [
    `M 0 ${y0}`,
    `C ${-w} ${y0 - s * 0.62} ${-w} ${y0 - s * 1.45} 0 ${y0 - s * 0.78}`,
    `C ${w} ${y0 - s * 1.45} ${w} ${y0 - s * 0.62} 0 ${y0}`,
    'Z',
  ].join(' ');
}

/** One wing of a rosetta: out from the stem and back, like a fern leaf. */
function leaf(y: number, w: number, h: number, side: 1 | -1): string {
  const x = (v: number) => side * v;
  return [
    `M 0 ${y}`,
    `C ${x(w * 0.88)} ${y + h * 0.04} ${x(w * 0.96)} ${y + h * 0.72} 0 ${y + h}`,
    `C ${x(w * 0.36)} ${y + h * 0.6} ${x(w * 0.32)} ${y + h * 0.18} 0 ${y}`,
    'Z',
  ].join(' ');
}

/** The stem, as a filled taper rather than a stroke. */
function stem(y0: number, y1: number, w: number): string {
  return `M ${-w} ${y0} L ${w} ${y0} L ${w * 0.45} ${y1} L ${-w * 0.45} ${y1} Z`;
}

export default function LatteArtCup({
  recipe,
  width,
}: {
  recipe: Recipe;
  width: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const cremaId = `crema-${uid}`;
  const glazeId = `glaze-${uid}`;
  const saucerId = `saucer-${uid}`;

  const crema = drinkColor(recipe);
  const art = artFor(recipe);
  const pour = mix(foamColor(recipe), milkOf(recipe).color, 0.3);
  const artColor = mix(pour, '#FFFFFF', 0.55);

  const cremaRx = RIM_RX - WALL;
  const cremaRy = RIM_RY - WALL * (RIM_RY / RIM_RX);
  const height = (width * VB_H) / VB_W;

  const body = [
    `M ${CX - RIM_RX} ${RIM_Y}`,
    `L ${CX - BOT_RX} ${BOT_Y - 12}`,
    `C ${CX - BOT_RX} ${BOT_Y + 14} ${CX + BOT_RX} ${BOT_Y + 14} ${CX + BOT_RX} ${BOT_Y - 12}`,
    `L ${CX + RIM_RX} ${RIM_Y}`,
    'Z',
  ].join(' ');

  return (
    <View style={{ width, height }}>
      <Steam width={width} />

      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Reactive glaze: dark at the lip, bleeding down into cream. */}
          <LinearGradient id={glazeId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={GLAZE_DARK} />
            <Stop offset="0.16" stopColor={GLAZE_MID} />
            <Stop offset="0.42" stopColor={STONEWARE} />
            <Stop offset="0.86" stopColor={STONEWARE} />
            <Stop offset="1" stopColor="#CBBCA1" />
          </LinearGradient>
          <LinearGradient id={saucerId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#8A6034" />
            <Stop offset="0.35" stopColor="#B98A4F" />
            <Stop offset="0.75" stopColor="#9A6C3A" />
            <Stop offset="1" stopColor="#7A5128" />
          </LinearGradient>
          <RadialGradient id={cremaId} cx="42%" cy="34%" rx="70%" ry="70%">
            <Stop offset="0" stopColor={mix(crema, '#FFFFFF', 0.2)} />
            <Stop offset="0.62" stopColor={crema} />
            <Stop offset="1" stopColor={mix(crema, '#000000', 0.26)} />
          </RadialGradient>
        </Defs>

        {/* Saucer: outer rim, then the well the mug sits in. */}
        <Ellipse cx={CX} cy={SAUCER_Y} rx={SAUCER_RX} ry={SAUCER_RY} fill={`url(#${saucerId})`} />
        <Ellipse
          cx={CX}
          cy={SAUCER_Y}
          rx={SAUCER_RX}
          ry={SAUCER_RY}
          fill="none"
          stroke="#E8DCC6"
          strokeOpacity={0.75}
          strokeWidth={2.4}
        />
        <Ellipse cx={CX} cy={SAUCER_Y + 3} rx={SAUCER_RX * 0.72} ry={SAUCER_RY * 0.62} fill="#7E5530" opacity={0.55} />
        <Ellipse cx={CX} cy={SAUCER_Y + 4} rx={SAUCER_RX * 0.58} ry={SAUCER_RY * 0.46} fill="#6B4526" opacity={0.5} />

        {/* Handle, small and set high, drawn behind the wall. */}
        <Path
          d={`M ${CX + RIM_RX - 14} ${RIM_Y + 22} C ${CX + RIM_RX + 46} ${RIM_Y + 10} ${CX + RIM_RX + 46} ${RIM_Y + 74} ${CX + RIM_RX - 16} ${RIM_Y + 62}`}
          fill="none"
          stroke={STONEWARE}
          strokeWidth={15}
          strokeLinecap="round"
        />
        <Path
          d={`M ${CX + RIM_RX - 14} ${RIM_Y + 22} C ${CX + RIM_RX + 46} ${RIM_Y + 10} ${CX + RIM_RX + 46} ${RIM_Y + 74} ${CX + RIM_RX - 16} ${RIM_Y + 62}`}
          fill="none"
          stroke="#B9A98C"
          strokeOpacity={0.5}
          strokeWidth={16.5}
          strokeLinecap="round"
          opacity={0.4}
        />

        {/* Mug body. */}
        <Path d={body} fill={`url(#${glazeId})`} />

        {/* Stoneware speckle. */}
        {Array.from({ length: 34 }).map((_, i) => (
          <Circle
            key={`sp-${i}`}
            cx={CX - BOT_RX + seeded(i + 2) * BOT_RX * 2}
            cy={RIM_Y + BODY_H * (0.3 + seeded(i + 40) * 0.62)}
            r={0.7 + seeded(i + 80) * 1.1}
            fill="#8A7458"
            opacity={0.35}
          />
        ))}

        <Path
          d={body}
          fill="none"
          stroke={STONEWARE_EDGE}
          strokeOpacity={0.6}
          strokeWidth={1.6}
        />

        {/* Dark glazed lip, then the drink. */}
        <Ellipse cx={CX} cy={RIM_Y} rx={RIM_RX} ry={RIM_RY} fill={GLAZE_DARK} />
        <Ellipse
          cx={CX}
          cy={RIM_Y}
          rx={RIM_RX}
          ry={RIM_RY}
          fill="none"
          stroke="#432814"
          strokeOpacity={0.55}
          strokeWidth={1.6}
        />
        <Ellipse cx={CX} cy={RIM_Y + 1} rx={cremaRx} ry={cremaRy} fill={`url(#${cremaId})`} />

        {/* The pour, scaled from unit space onto the crema ellipse. */}
        {art !== 'none' && (
          <G
            transform={`translate(${CX}, ${RIM_Y + 1}) scale(${(cremaRx * 0.88).toFixed(2)}, ${(cremaRy * 0.88).toFixed(2)})`}
          >
            {art === 'heart' && <Path d={heart(0.72, -0.05)} fill={artColor} />}

            {art === 'tulip' &&
              [0, 1, 2].map((i) => (
                <Path
                  key={`lobe-${i}`}
                  d={heart(0.6 - i * 0.14, -0.4 + i * 0.36)}
                  fill={artColor}
                />
              ))}

            {art === 'rosetta' && (
              <>
                <Path d={heart(0.52, -0.56)} fill={artColor} />
                {[0, 1, 2, 3, 4].map((i) => {
                  const y = -0.3 + i * 0.19;
                  const w = 0.62 * (1 - i * 0.17);
                  const h = 0.32 * (1 - i * 0.1);
                  return (
                    <G key={`leaf-${i}`}>
                      <Path d={leaf(y, w, h, -1)} fill={artColor} />
                      <Path d={leaf(y, w, h, 1)} fill={artColor} />
                    </G>
                  );
                })}
                <Path d={stem(0.6, 0.95, 0.05)} fill={artColor} />
              </>
            )}
          </G>
        )}

        {/* Light across the near edge of the surface. */}
        <Path
          d={`M ${CX - cremaRx * 0.66} ${RIM_Y - cremaRy * 0.38} A ${cremaRx * 0.8} ${cremaRy * 0.8} 0 0 1 ${CX + cremaRx * 0.1} ${RIM_Y - cremaRy * 0.82}`}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.2}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/* ---------------------------------------------------------------- steam --- */

/**
 * Steam as curling ribbons rather than rising bars.
 *
 * The previous version translated opaque rounded rectangles upward, which reads
 * as objects moving, not as vapour. Real steam curls, widens as it rises, drifts
 * off true, and thins out rather than simply fading. Each wisp here is a drawn
 * S-curve that rises while it grows, leans, and loses both opacity and stroke
 * weight, on its own period so they never move together.
 */
const WISPS = [
  { x: -30, delay: 0, dur: 4200, lean: 9, w: 5.5 },
  { x: 2, delay: 1300, dur: 4900, lean: -7, w: 6.5 },
  { x: 33, delay: 2500, dur: 4500, lean: 11, w: 5 },
];

function Steam({ width }: { width: number }) {
  const scale = width / VB_W;
  const top = (RIM_Y - 118) * scale;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top, height: 130 * scale }}
    >
      {WISPS.map((w, i) => (
        <Wisp key={i} spec={w} scale={scale} index={i} />
      ))}
    </View>
  );
}

function Wisp({
  spec,
  scale,
  index,
}: {
  spec: (typeof WISPS)[number];
  scale: number;
  index: number;
}) {
  const t = useSharedValue(0);
  const w = 46 * scale;
  const h = 116 * scale;

  useEffect(() => {
    t.value = withDelay(
      spec.delay,
      withRepeat(withTiming(1, { duration: spec.dur, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(t);
  }, [spec.delay, spec.dur, t]);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    return {
      // Rises, grows and leans as it goes — vapour expanding, not a bar sliding.
      transform: [
        { translateY: -p * h * 0.72 },
        { translateX: Math.sin(p * Math.PI * 1.6 + index) * 11 * scale },
        { scale: 0.55 + p * 0.85 },
        { rotate: `${spec.lean * p}deg` },
      ],
      opacity: p < 0.18 ? (p / 0.18) * 0.5 : (1 - (p - 0.18) / 0.82) * 0.5,
    };
  });

  // A doubled-back S so the ribbon reads as curling rather than as a line.
  const d = `M ${w / 2} ${h} C ${w * 0.05} ${h * 0.74} ${w * 0.95} ${h * 0.5} ${w * 0.4} ${h * 0.26} C ${w * 0.1} ${h * 0.12} ${w * 0.55} ${h * 0.06} ${w * 0.62} 0`;

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: (CX + spec.x) * scale - w / 2, top: 0, width: w, height: h },
        style,
      ]}
    >
      <Svg width={w} height={h}>
        {/* Warm grey, not white. The app's background is near-white cream, so
            white steam disappears into it — vapour has to sit *darker* than a
            light background to read at all. */}
        <Path
          d={d}
          fill="none"
          stroke="#A8927A"
          strokeWidth={spec.w * scale * 1.9}
          strokeLinecap="round"
          opacity={0.5}
        />
        <Path
          d={d}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={spec.w * scale * 0.7}
          strokeLinecap="round"
          opacity={0.5}
        />
      </Svg>
    </Animated.View>
  );
}
