/**
 * The recipe model and the rules that turn a recipe into drawable layers.
 *
 * This file has no UI in it on purpose. The render, the Barista Pass card, and
 * (later) cafe ingredient matching all read from the same Recipe shape, so the
 * drink you see is provably the drink the barista is handed.
 *
 * The one import is the palette, from `theme.ts` rather than `ui.tsx`, because the
 * foam has to know what colour shows through the clear glass around it. Keep it
 * that way: this module is compiled and run under plain Node to check the colour
 * maths, so it must not pull in React or react-native.
 */

import { COLORS } from './theme';

export type SizeOz = 12 | 16 | 20;
export type BaseId = 'americano' | 'coldbrew' | 'matcha';
export type MilkId = 'whole' | 'oat' | 'almond' | 'skim' | 'none';
export type SyrupId = 'none' | 'biscoff' | 'pistachio' | 'vanilla' | 'caramel' | 'mocha';
export type IceLevel = 'none' | 'light' | 'regular';
export type FoamId =
  | 'sweetcream'
  | 'vanilla'
  | 'caramel'
  | 'ube'
  | 'matcha'
  | 'pistachio'
  | 'strawberry';

export type Recipe = {
  base: BaseId;
  size: SizeOz;
  iced: boolean;
  shots: number;
  milk: MilkId;
  syrup: SyrupId;
  pumps: number;
  coldFoam: boolean;
  /** The foam's own flavour, which is what gives it its colour. */
  foam: FoamId;
  /** Only meaningful when `iced`. Light ice leaves more room for the drink. */
  ice: IceLevel;
};

/** Catalog ------------------------------------------------------------- */

/**
 * `milkShare` is the largest fraction of the cup that milk may take on this base.
 *
 * Without it, milk was simply "whatever is left", which made a macchiato — two
 * shots marked with a spoon of foam — come out as a cup of milk and render pale.
 * A macchiato is espresso-forward and has to look it. Whatever milk doesn't claim
 * is brewed coffee or hot water, both dark.
 */
/**
 * `liquid` is what fills the cup besides espresso and milk — the brew itself.
 * It's per-base because a matcha's body is green, not coffee-coloured, and the
 * renderer needs to know that without special-casing.
 */
export const BASES: {
  id: BaseId;
  label: string;
  iced: boolean;
  shots: number;
  milk: MilkId;
  milkShare: number;
  liquid: string;
}[] = [
  {
    id: 'coldbrew',
    label: 'Cold Brew',
    iced: true,
    shots: 0,
    milk: 'oat',
    milkShare: 0.45,
    liquid: '#2B1407',
  },
  {
    id: 'matcha',
    label: 'Matcha',
    iced: true,
    shots: 0,
    milk: 'oat',
    milkShare: 0.55,
    liquid: '#7CA83A',
  },
  {
    id: 'americano',
    label: 'Americano',
    iced: false,
    shots: 3,
    milk: 'none',
    // Enough milk that adding it visibly lightens the cup — a white americano is
    // a real order, and at 0.10 the change was invisible. It has to clear the bar
    // on an *iced* americano too, where ice has already taken most of the volume.
    milkShare: 0.55,
    // Black coffee, not milky brown. An americano is espresso let down with water:
    // still very dark. `#6E4A2E` here was reading as a latte.
    liquid: '#33190A',
  },
];

/** Cold foam carries its own flavour, and its own colour with it. */
export const FOAMS: { id: FoamId; label: string; color: string }[] = [
  { id: 'sweetcream', label: 'Sweet cream', color: '#FCF4E4' },
  { id: 'vanilla', label: 'Vanilla', color: '#F8EAC6' },
  { id: 'caramel', label: 'Salted caramel', color: '#E9C288' },
  { id: 'ube', label: 'Ube', color: '#B187D8' },
  { id: 'matcha', label: 'Matcha', color: '#A6C583' },
  { id: 'pistachio', label: 'Pistachio', color: '#C6D79B' },
  { id: 'strawberry', label: 'Strawberry', color: '#F3B0B6' },
];

export const MILKS: { id: MilkId; label: string; color: string }[] = [
  { id: 'whole', label: 'Whole', color: '#FAF3E4' },
  { id: 'oat', label: 'Oat', color: '#EFE0C4' },
  { id: 'almond', label: 'Almond', color: '#F4EDDE' },
  { id: 'skim', label: 'Skim', color: '#FBF8F0' },
  { id: 'none', label: 'None', color: '#6B4A32' },
];

export const SYRUPS: { id: SyrupId; label: string; color: string }[] = [
  { id: 'none', label: 'None', color: '#00000000' },
  { id: 'biscoff', label: 'Biscoff', color: '#B4763C' },
  { id: 'pistachio', label: 'Pistachio', color: '#8CA857' },
  { id: 'vanilla', label: 'Vanilla', color: '#D8B269' },
  { id: 'caramel', label: 'Caramel', color: '#A7672A' },
  { id: 'mocha', label: 'Mocha', color: '#4B2A1D' },
];

export const SIZES: SizeOz[] = [12, 16, 20];

export const ICE_LEVELS: { id: IceLevel; label: string }[] = [
  { id: 'none', label: 'No ice' },
  { id: 'light', label: 'Light ice' },
  { id: 'regular', label: 'Regular ice' },
];

/** How much of the cup the ice takes up. Less ice leaves more room for drink. */
export const ICE_FRACTION: Record<IceLevel, number> = { none: 0, light: 0.32, regular: 0.44 };

/** Cubes to draw. Volume comes from ICE_FRACTION; this is just how it looks. */
/**
 * Cubes to draw. Volume comes from ICE_FRACTION; this is just how it looks.
 *
 * Capped so the bed never buries the drink — at ten cubes the ice filled the
 * whole glass on a 16oz hero and the milk/coffee blend disappeared behind it.
 */
export const ICE_COUNT: Record<IceLevel, number> = { none: 0, light: 6, regular: 8 };

/**
 * How much of the **liquid** cold foam takes.
 *
 * Measured off the reference photographs. Most of them are shot from above, where
 * perspective shows the foam's top face as well as its side and inflates it to
 * 33–54%; the one side-on photograph puts it at 21%. Our render is a side-on
 * cross-section, so the side-on number is the one to match.
 *
 * "Thicker" foam is about **viscosity, not band height** — a denser liquid that
 * moves slowly. The heaviness is carried by the animation, not by making the cap
 * taller.
 */
export const FOAM_FRACTION = 0.19;

/**
 * Quick sweetness presets. Pumps stay the single source of truth — these only
 * set it — so the stepper and this control can never disagree.
 */
export const SWEETNESS: { label: string; pumps: number }[] = [
  { label: 'Less sweet', pumps: 2 },
  { label: 'Regular', pumps: 3 },
  { label: 'Extra', pumps: 5 },
];

const byId = <T extends { id: string }>(list: T[], id: string) =>
  list.find((x) => x.id === id) ?? list[0];

export const milkOf = (r: Recipe) => byId(MILKS, r.milk);
export const syrupOf = (r: Recipe) => byId(SYRUPS, r.syrup);
export const foamOf = (r: Recipe) => byId(FOAMS, r.foam);

/**
 * Cold foam is a cold-drink thing. A hot coffee gets steamed milk foam, which is
 * part of the drink rather than a cap poured over it, so the option doesn't apply
 * and is gated here rather than in each caller.
 */
export const hasFoam = (r: Recipe) => r.coldFoam && r.iced;
export const baseOf = (r: Recipe) => byId(BASES, r.base);

/** Color math ---------------------------------------------------------- */

const hex = (c: string) => {
  const n = parseInt(c.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Blend two hex colors. `t` of 0 returns `a`, 1 returns `b`. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const p = (x: number, y: number) => Math.round(x + (y - x) * t);
  return (
    '#' +
    [p(r1, r2), p(g1, g2), p(b1, b2)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Layers -------------------------------------------------------------- */

export type Layer = {
  id: string;
  /** Fluid ounces this layer occupies. Drives its height in the render. */
  oz: number;
  color: string;
  /** Rendered on top of the liquid rather than as its own band. */
  overlay?: boolean;
};

const ESPRESSO_DARK = '#2C1608';
const BREWED = '#6E4A2E';

/** Relative luminance, 0–255, for checking that two colours read apart. */
function luma(c: string): number {
  const [r, g, b] = hex(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Push a colour's chroma back up, around its own luminance.
 *
 * Averaging a very dark espresso with pale milk in sRGB lands on grey-brown mud:
 * real pigment mixing isn't a linear average. Sampling the reference photographs
 * makes the gap obvious — a real iced latte runs `#522b11` to `#a08a6f`, deep and
 * warm, where a plain average gives washed-out `#76604a`. This pulls the channels
 * away from the mean to put the warmth back.
 */
function saturate(c: string, amount: number): string {
  const [r, g, b] = hex(c);
  const mean = (r + g + b) / 3;
  const out = [r, g, b].map((v) =>
    Math.max(0, Math.min(255, Math.round(mean + (v - mean) * (1 + amount)))),
  );
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Rescale a colour to an exact luminance, keeping its hue.
 *
 * Luminance is linear in RGB, so one multiply hits the target precisely. Mixing
 * toward a light or dark colour in steps only converges on it, which left the
 * foam short of the contrast it needed on pale drinks.
 */
function withLuma(c: string, target: number): string {
  const L = luma(c);
  if (L <= 1) return c;
  const k = target / L;
  return (
    '#' +
    hex(c)
      .map((v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * How strongly each ingredient pigments the mix, per fluid ounce.
 *
 * Espresso and syrup are far more pigmented than milk, so a plain volume average
 * comes out washed out — two shots in a 16oz latte is only an eighth of the cup
 * but the drink is clearly coffee-coloured. These multipliers are what make a
 * third shot visibly darken the drink.
 */
// Milk is opaque and lightens coffee strongly, so it carries more weight than a
// neutral 1 — at 1 it barely registered against espresso and brew.
const PIGMENT = { espresso: 3.1, syrup: 1.7, brew: 1.8, filler: 1.3 };

/** How much chroma to restore after mixing. Tuned against the reference photos. */
const CHROMA_LIFT = 0.42;

/**
 * Volumes in the cup, before anything is coloured.
 *
 * Milk is capped by the base's `milkShare` rather than taking everything left
 * over, and whatever it doesn't claim is brewed coffee or hot water. That cap is
 * what keeps a macchiato espresso-forward and dark instead of a cup of milk.
 */
function volumes(r: Recipe) {
  const espressoOz = r.shots * 1;
  const syrupOz = r.syrup === 'none' ? 0 : r.pumps * 0.25;
  const iceOz = r.iced ? r.size * ICE_FRACTION[r.ice] : 0;
  // Foam is a share of the **liquid**, not of the cup. As a share of the cup it
  // rendered thicker the more ice you added, because ice shrank everything else.
  const foamOz = hasFoam(r) ? (r.size - iceOz) * FOAM_FRACTION : 0;

  // Milk and brew split what's left **proportionally**, never as a cap.
  //
  // Capping milk at a share of the whole cup meant that as ice grew, the leftover
  // volume shrank until milk consumed all of it and the brew hit zero — a matcha
  // at regular ice rendered as a cup of plain milk, and a cold brew's "coffee"
  // decayed into pure syrup. Ice dilutes everything equally; it does not
  // preferentially remove the coffee. A proportional split holds the milk-to-brew
  // ratio at any ice or foam level.
  const rest = Math.max(0, r.size - espressoOz - syrupOz - iceOz - foamOz);
  const share = r.milk === 'none' ? 0 : baseOf(r).milkShare;
  const milkOz = rest * share;
  const brewOz = rest - milkOz;

  return { espressoOz, syrupOz, iceOz, foamOz, milkOz, brewOz, fillerOz: rest };
}

/**
 * The colour of the drink once it's stirred.
 *
 * The cup is not a layer cake: a latte is one body of mixed liquid whose shade
 * comes from how much espresso and syrup went into how much milk. Three shots is
 * darker than two, oat is darker than skim, and eight pumps of mocha pulls the
 * whole cup brown.
 */
export function drinkColor(r: Recipe): string {
  const { espressoOz, syrupOz, milkOz, brewOz } = volumes(r);
  const fillerColor = r.milk === 'none' ? BREWED : milkOf(r).color;

  const parts: { color: string; weight: number }[] = [
    { color: ESPRESSO_DARK, weight: espressoOz * PIGMENT.espresso },
    { color: syrupOf(r).color, weight: r.syrup === 'none' ? 0 : syrupOz * PIGMENT.syrup },
    { color: baseOf(r).liquid, weight: brewOz * PIGMENT.brew },
    { color: milkOf(r).color, weight: milkOz * PIGMENT.filler },
  ].filter((p) => p.weight > 0);

  if (parts.length === 0) return fillerColor;

  const total = parts.reduce((s, p) => s + p.weight, 0);
  const acc = [0, 0, 0];
  for (const p of parts) {
    const [pr, pg, pb] = hex(p.color);
    acc[0] += pr * p.weight;
    acc[1] += pg * p.weight;
    acc[2] += pb * p.weight;
  }
  const mixed =
    '#' +
    acc.map((v) => Math.round(v / total).toString(16).padStart(2, '0')).join('');

  // Averaging desaturates; put the warmth back. Scaled by how dark the result is,
  // because a dark coffee needs the lift and a pale milk drink pushed this hard
  // turns an unpleasant yellow.
  const t = 1 - luma(mixed) / 255;
  return saturate(mixed, CHROMA_LIFT * (0.3 + 0.7 * t));
}

/**
 * Cold foam, which is the one thing that stays separate — it floats.
 *
 * It has to read clearly against both the drink below it and plain milk, so it's
 * built from the milk, lightened, warmed, and tinted toward the syrup (pistachio
 * foam is green, biscoff foam is gold). If it still lands too close in luminance
 * to the body it gets lightened until it doesn't.
 */
/** How far apart in luminance the foam has to sit from the liquid under it. */
const FOAM_CONTRAST = 80;

/**
 * How far from the liquid in RGB counts as distinct regardless of brightness. A
 * cream cap on a green matcha is unmistakable at almost the same luminance.
 */
const FOAM_DISTANCE = 150;

/**
 * How far *below* the page the foam has to sit.
 *
 * The glass is clear, so a pale cap is seen against the app's own background, and
 * that background is cream: `COLORS.bg` is luma 242, while cold foam in the
 * reference photographs reads 193–233. The page is brighter than real foam. Sweet
 * cream at `#FCF4E4` is 245 — brighter still, and 6.6 from the page in RGB, which
 * is to say identical. It disappeared.
 *
 * So the only direction with any room in it is *down*, and that also happens to be
 * the truthful one: dairy foam photographs as creamier than paper, not brighter.
 * 28 is a step you can see across a flat band without the cream going grey.
 */
const BACKDROP_CONTRAST = 28;

/**
 * How far a foam may be from the page in RGB and still count as legible on hue
 * alone. Ube and strawberry are nowhere near cream; they need no help.
 */
const BACKDROP_DISTANCE = 60;

/** Chroma put back after deepening, as a fraction of what the colour already has. */
const FOAM_CHROMA = 0.35;

/**
 * The least chroma a deepened cap may end up with — max channel minus min.
 *
 * A proportional lift is not enough on its own, because `withLuma` is a uniform
 * multiply and so preserves chroma *in proportion*: sweet cream starts nearly
 * neutral at a spread of 24, and a third more of nearly nothing is still nearly
 * nothing. Taken down to the page's ceiling it came out `#ded5c2` — grey.
 *
 * 46 is a beige: at a luminance of 214 it puts the cap at `#e4d5b6`, which is the
 * colour of cream rather than of a grey card. This is a floor and not a target, so
 * a foam that is already warmer than this — vanilla, at 62 — keeps its own chroma
 * and stays distinguishable.
 */
const FOAM_CHROMA_FLOOR = 46;

/** How much of the drink's height the brew and the milk blend across. */
export const BLEND_ZONE = 0.26;

/** Straight-line distance between two colours in RGB. */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/**
 * Take a colour to an exact luminance and put its warmth back.
 *
 * Deepen first, then saturate, then pin the luminance again. Saturating first
 * pushes the bright channels past 255 where they clamp, and clamping is what
 * flattens the hue — the colour comes back out less warm than it went in. The
 * closing rescale is a uniform multiply, so it holds the target exactly while
 * keeping the channel ratios `saturate` just established.
 *
 * The gain is whichever is larger: the proportional lift, or enough to reach
 * `FOAM_CHROMA_FLOOR`. A near-neutral cream needs the floor — see the note there.
 */
function deepen(c: string, target: number): string {
  const sunk = withLuma(c, target);
  const [r, g, b] = hex(sunk);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  // `saturate` scales each channel's distance from the mean by `1 + amount`, so
  // the chroma scales by the same factor.
  const gain = Math.max(1 + FOAM_CHROMA, chroma > 0 ? FOAM_CHROMA_FLOOR / chroma : 1);
  return withLuma(saturate(sunk, gain - 1), target);
}

export function foamColor(r: Recipe): string {
  // Colour comes from the foam's own flavour, not the drink's syrup. Plain cold
  // foam on a latte is milk foam and should look like milk foam; ube foam is
  // purple whatever is underneath it.
  const nominal = foamOf(r).color;

  /*
   * Contrast is measured against the liquid **directly beneath the foam**, which
   * is the brew at the top of the drink — not `drinkColor`, the blended average
   * of the whole cup. Measuring against the average flattered a foam that in fact
   * sits on something much darker, so the guard rarely fired when it should have.
   *
   * The target comes from the photographs: foam reads 193–233 over liquid at
   * 76–168, a gap of 66–129. Half that is what made the cap look washed into the
   * drink.
   */
  const underHex = brewColor(r);
  const under = luma(underHex);

  // Two ways to be distinct, and either is enough. A strongly hued foam reads
  // apart on colour alone — ube on bright matcha is unmistakable at almost the
  // same brightness — while a pale cream has only brightness to work with.
  const apart = (c: string) =>
    distance(c, underHex) >= FOAM_DISTANCE || luma(c) - under >= FOAM_CONTRAST;

  /*
   * The page sets a ceiling, and the ceiling wins.
   *
   * The foam has two neighbours, not one: the liquid under it and the page seen
   * through the clear glass around it. Checking only the liquid is what let a sweet
   * cream cap pass every test and still leave the top of the cup looking empty —
   * and worse, on a bright drink like matcha the lift below used to *reach* for
   * `under + FOAM_CONTRAST`, which is brighter than the page, so satisfying the
   * liquid actively destroyed the cap against the background.
   *
   * So brightness is capped here, and the foam gets as far from the liquid as it
   * can underneath that cap. A smaller gap to the liquid is the right trade: a cream
   * cap on a green drink is already unmistakable on hue, which `apart` allows for.
   */
  const ceiling = luma(COLORS.bg) - BACKDROP_CONTRAST;
  const tooPale = luma(nominal) > ceiling && distance(nominal, COLORS.bg) < BACKDROP_DISTANCE;
  const foam = tooPale ? deepen(nominal, ceiling) : nominal;

  if (apart(foam)) return foam;

  // Room left to lift, but never past the ceiling.
  const lifted = withLuma(foam, Math.min(ceiling, under + FOAM_CONTRAST));
  if (apart(lifted)) return lifted;

  // The liquid is brighter than the page will let the foam be, so there is no room
  // above it at all and the cap has to go below instead. No current base is pale
  // enough to reach this — it guards a future milk-forward one.
  if (under >= ceiling) return deepen(nominal, Math.max(under - FOAM_CONTRAST, 70));

  /*
   * Otherwise take the best separation the ceiling allows, and accept that it is
   * under FOAM_CONTRAST.
   *
   * Some pairings are inherently low contrast — matcha foam on a matcha, pistachio
   * foam on a matcha — and a pale green cap on bright green is exactly what those
   * look like in the photographs. Insisting on the full gap sent them out the dark
   * side of this function instead, which turned the cap olive and read as a
   * different drink rather than as foam. A cap that is too subtle is a worse render;
   * a cap that is the wrong colour is a wrong drink.
   */
  return lifted;
}

/**
 * The iced drink as a gradient, top to bottom.
 *
 * Reference photographs of iced lattes don't show a flat colour: espresso sits
 * dark near the top and drifts down into pale milk, with the mixed shade through
 * the middle. That marbling is the whole aesthetic of an iced coffee, so the body
 * is drawn as a gradient built around `drinkColor` rather than filled with it.
 *
 * The spread scales with how much espresso is in the cup: a milk-heavy drink
 * barely separates, a three-shot drink separates a lot. With no espresso at all
 * (a straight cold brew) the stops collapse to near-flat, which is correct.
 */
export type IcedComposition = {
  /** The milk the coffee was poured over, filling the lower cup. */
  milk: string;
  /** The coffee sitting above it. */
  coffee: string;
  /** The tone where the two meet. */
  blend: string;
  /** Fraction of the drink, from the top, that is coffee. 0 when there's none. */
  coffeeShare: number;
};

/**
 * An iced coffee as three readable parts rather than one blended shade.
 *
 * The reference photographs are the argument: you can see the milk *as milk*,
 * the coffee *as coffee*, and the foam on top, with the coffee trickling down
 * into the milk rather than being stirred through it. A single mixed colour —
 * even as a smooth gradient — throws that away, and a smooth gradient is what
 * made the last attempt read as a flat wash instead of a drink.
 *
 * Note this does not bring back the old layer cake. Those were hard-edged bands
 * in the wrong order; this is two liquids with an irregular, trickling boundary,
 * which is what the photographs actually show.
 */
/**
 * The brew alone — espresso, syrup and the base's own liquid, without any milk.
 *
 * This is what sits at the top of an iced drink, and therefore what the foam
 * rests on, so both the composition and the foam's contrast guard read it from
 * here rather than each deciding for themselves.
 */
export function brewColor(r: Recipe): string {
  const { espressoOz, syrupOz, brewOz } = volumes(r);

  const parts: { color: string; weight: number }[] = [
    { color: ESPRESSO_DARK, weight: espressoOz * PIGMENT.espresso },
    { color: baseOf(r).liquid, weight: brewOz * PIGMENT.brew },
    { color: syrupOf(r).color, weight: r.syrup === 'none' ? 0 : syrupOz * PIGMENT.syrup },
  ].filter((p) => p.weight > 0);

  if (!parts.length) return baseOf(r).liquid;

  const total = parts.reduce((s, p) => s + p.weight, 0);
  const acc = [0, 0, 0];
  for (const p of parts) {
    const [pr, pg, pb] = hex(p.color);
    acc[0] += pr * p.weight;
    acc[1] += pg * p.weight;
    acc[2] += pb * p.weight;
  }
  return saturate(
    '#' + acc.map((v) => Math.round(v / total).toString(16).padStart(2, '0')).join(''),
    CHROMA_LIFT,
  );
}

export function icedComposition(r: Recipe): IcedComposition {
  const { espressoOz, syrupOz, brewOz, milkOz } = volumes(r);

  const coffeeOz = espressoOz + syrupOz + brewOz;
  const coffee = brewColor(r);

  // No milk means no second liquid, so there is nothing to blend into: the cup is
  // brew top to bottom. An americano taken black is black all the way down, not a
  // dark top over a lighter bottom.
  if (milkOz <= 0.01) {
    return { milk: coffee, coffee, blend: coffee, coffeeShare: 1 };
  }

  const milk = milkOf(r).color;

  // Coffee spreads further than its share of the volume, so the visible band is
  // biased upward from the raw ratio.
  const raw = coffeeOz / Math.max(0.001, coffeeOz + milkOz);
  const coffeeShare = coffeeOz < 0.2 ? 0 : Math.max(0.2, Math.min(0.88, 0.18 + raw * 0.66));

  return { milk, coffee, blend: drinkColor(r), coffeeShare };
}

/** Layers: the mixed body, the foam that floats on it, and the ice. */
export function layersFor(r: Recipe): Layer[] {
  const { iceOz, foamOz, fillerOz, espressoOz, syrupOz } = volumes(r);
  const bodyOz = fillerOz + espressoOz + syrupOz;

  const bands: Layer[] = [];
  if (bodyOz > 0) bands.push({ id: 'body', oz: bodyOz, color: drinkColor(r) });
  if (foamOz > 0) bands.push({ id: 'foam', oz: foamOz, color: foamColor(r) });
  if (iceOz > 0) bands.push({ id: 'ice', oz: iceOz, color: '#FFFFFF', overlay: true });

  return bands;
}

/** The Universal Coffee Recipe string shown on the Barista Pass. */
export function recipeLine(r: Recipe): string {
  const parts: string[] = [
    `${r.size}oz`,
    r.iced ? 'Iced' : 'Hot',
    baseOf(r).label,
  ];
  if (r.iced && r.ice !== 'regular') parts.push(r.ice === 'none' ? 'No ice' : 'Light ice');
  if (r.shots > 0) parts.push(`${r.shots} shot${r.shots === 1 ? '' : 's'}`);
  if (r.milk !== 'none') parts.push(`${milkOf(r).label} milk`);
  if (r.syrup !== 'none') parts.push(`${r.pumps} pump${r.pumps === 1 ? '' : 's'} ${syrupOf(r).label}`);
  if (hasFoam(r)) parts.push(`${foamOf(r).label} cold foam`);
  return parts.join(' · ');
}

/**
 * The trending shelf on the home screen. These are the drinks a guest can pick
 * without saying a word, and the starting points the barista chat tunes from.
 *
 * `note` is a tag line short enough to fit a tile on one line without
 * truncating. `detail` is the full sentence, shown over the cup on a long press.
 * Keep prose out of `note` — a tile is 168pt wide.
 */
export const POPULAR: {
  id: string;
  name: string;
  note: string;
  detail: string;
  recipe: Recipe;
}[] = [
  {
    id: 'matcha',
    name: 'Iced Matcha Latte',
    note: 'Matcha · Oat',
    detail: 'Stone-ground matcha poured over oat milk, so the green settles across the top and the milk stays visible beneath it.',
    recipe: { base: 'matcha', size: 16, iced: true, shots: 0, milk: 'oat', syrup: 'none', pumps: 1, coldFoam: false, foam: 'sweetcream', ice: 'regular' },
  },
  {
    id: 'saltedcoldbrew',
    name: 'Salted Caramel Cold Brew',
    note: 'Cold brew · Caramel foam',
    detail: 'Slow-steeped cold brew under a salted caramel cold foam cap, over oat milk.',
    recipe: { base: 'coldbrew', size: 16, iced: true, shots: 0, milk: 'oat', syrup: 'caramel', pumps: 2, coldFoam: true, foam: 'caramel', ice: 'regular' },
  },
  {
    id: 'icedamericano',
    name: 'Iced Americano',
    note: 'Three shots · Black',
    detail: 'Three shots over ice and water. No milk, no syrup — the whole cup stays dark.',
    recipe: { base: 'americano', size: 16, iced: true, shots: 3, milk: 'none', syrup: 'none', pumps: 1, coldFoam: false, foam: 'sweetcream', ice: 'regular' },
  },
  {
    id: 'ubematcha',
    name: 'Ube Matcha',
    note: 'Matcha · Ube foam',
    detail: 'Iced matcha on almond milk under a purple ube cold foam, for the colour as much as the flavour.',
    recipe: { base: 'matcha', size: 16, iced: true, shots: 0, milk: 'almond', syrup: 'none', pumps: 1, coldFoam: true, foam: 'ube', ice: 'light' },
  },
  {
    id: 'vanillacoldbrew',
    name: 'Vanilla Cold Brew',
    note: 'Cold brew · Vanilla',
    detail: 'Cold brew with two pumps of vanilla over almond milk, light on ice.',
    recipe: { base: 'coldbrew', size: 16, iced: true, shots: 0, milk: 'almond', syrup: 'vanilla', pumps: 2, coldFoam: true, foam: 'vanilla', ice: 'light' },
  },
];

export const DEFAULT_RECIPE: Recipe = {
  base: 'coldbrew',
  size: 16,
  iced: true,
  shots: 0,
  milk: 'oat',
  syrup: 'caramel',
  pumps: 2,
  coldFoam: true,
  foam: 'caramel',
  ice: 'regular',
};
