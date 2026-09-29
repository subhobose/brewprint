/**
 * Cup geometry, shared by the animated hero cup and the static thumbnail.
 *
 * The vessel is a clear tapered cold cup: rolled lip, a couple of molded rings
 * near the top, an elliptical base and a domed lid. Hot drinks use the same body
 * with a lower, flatter lid, so the layers stay visible either way.
 *
 * Depth comes from three things, all decided here: the base is an ellipse rather
 * than a flat edge, `capRy` curves the liquid surface and every layer boundary,
 * and `halfAt` lets callers size those curves to the taper at any depth.
 *
 * Both renderers call this so a 16oz cup is the same cup everywhere. The only
 * difference between them is how they clip:
 *
 *  - `interior` is an SVG clip path, used by the all-SVG thumbnail.
 *  - `frame` is the whole box with the interior punched out (even-odd), painted
 *    in the background colour over animated Views, which cannot be clipped to a
 *    tapered shape by style alone.
 */

import { SizeOz } from './coffee';

export type CupStyle = 'cold' | 'hot';

export type CupGeometry = {
  w: number;
  h: number;
  cx: number;
  style: CupStyle;
  /** Rim of the cup body. The lid sits above this. */
  rimY: number;
  baseY: number;
  topW: number;
  botW: number;
  bodyH: number;
  /** Liquid height available below the rim headroom. */
  innerH: number;
  /** Vertical radius of the rim ellipse. */
  lipRy: number;
  /** Vertical radius of the rounded base, seen slightly from above. */
  baseRy: number;
  /** Vertical radius for liquid surface and layer-boundary ellipses. */
  capRy: number;
  /** Height of the lid dome above the rim. Zero: iced glasses have no lid. */
  lidH: number;
  interior: string;
  frame: string;
  lid: string;
  lidFlange: string;
  /** Molded rings around the upper body. */
  ribs: string[];
  /** Half the body width at a fraction `t` of the way down from the rim. */
  halfAt: (t: number) => number;
};

/**
 * How much bigger a 20oz cup looks than a 12oz one. Height moves more than
 * width, the way real cup ranges scale.
 */
const SIZE_SCALE: Record<SizeOz, { h: number; w: number }> = {
  12: { h: 0.87, w: 0.93 },
  16: { h: 1, w: 1 },
  20: { h: 1.09, w: 1.06 },
};

export function cupGeometry(
  w: number,
  h: number,
  opts?: { size?: SizeOz; style?: CupStyle },
): CupGeometry {
  const size = opts?.size ?? 16;
  const style = opts?.style ?? 'cold';
  const scale = SIZE_SCALE[size];

  const cx = w / 2;
  const lipRy = Math.max(5, w * 0.03);

  // No lid. Every reference photograph of an iced coffee is an open glass, and a
  // domed lid put a plastic cap over a drink that is meant to look poured. Hot
  // drinks don't come through here at all any more — they get their own mug in
  // LatteArtCup — so nothing needs one.
  const lidH = 0;

  const topW = w * 0.72 * scale.w;
  const botW = topW * 0.74;
  const baseRy = botW * 0.13;

  // Bottom padding is derived from the contact shadow's own size, which sits 1.35
  // base-radii below the cup and is half a radius tall. A fixed fraction of the
  // canvas height looked equivalent but isn't: the base radius scales with cup
  // *width*, so on a wide hero box the shadow ran off the bottom and was clipped.
  const baseY = h - (baseRy * 1.85 + 6);

  // Headroom is now just the rim, so the glass reclaims the space the dome used
  // to take and stands taller in its box.
  const pad = h * 0.03 + lipRy + 6;
  const bodyH = (baseY - pad) * 0.9 * scale.h;
  const rimY = baseY - bodyH;

  const lT = cx - topW / 2;
  const rT = cx + topW / 2;
  const lB = cx - botW / 2;
  const rB = cx + botW / 2;

  // The base is an ellipse seen slightly from above, not a flat edge with rounded
  // corners. A flat bottom is the single strongest cue that a cup is a flat
  // drawing, so the wall runs down to where the ellipse starts and a symmetric
  // cubic carries it across. Control points at 4/3 of the radius put the curve's
  // lowest point at `baseY`.
  const bowlTop = baseY - baseRy;
  const bowlPull = bowlTop + baseRy * (4 / 3);

  const interior = [
    `M ${lT} ${rimY}`,
    `L ${lB} ${bowlTop}`,
    `C ${lB} ${bowlPull} ${rB} ${bowlPull} ${rB} ${bowlTop}`,
    `L ${rT} ${rimY}`,
    'Z',
  ].join(' ');

  // Outer box first, interior second; even-odd makes the interior a hole.
  const frame = `M 0 0 H ${w} V ${h} H 0 Z ${interior}`;

  // Empty: the glass is open. CupChrome skips any path that is blank, so nothing
  // downstream needs to know a lid ever existed.
  const lid = '';
  const lidFlange = '';

  // Body half-width at a fraction of the way down, for the molded rings.
  const halfAt = (t: number) => topW / 2 + (botW / 2 - topW / 2) * t;
  const rib = (t: number) => {
    const y = rimY + bodyH * t;
    const hw = halfAt(t);
    return `M ${cx - hw} ${y} Q ${cx} ${y + lipRy * 0.6} ${cx + hw} ${y}`;
  };
  const ribs = style === 'cold' ? [rib(0.1), rib(0.17)] : [rib(0.12)];

  return {
    w,
    h,
    cx,
    style,
    rimY,
    baseY,
    topW,
    botW,
    bodyH,
    innerH: bodyH - lipRy * 1.4,
    lipRy,
    baseRy,
    capRy: lipRy * 0.72,
    lidH,
    interior,
    frame,
    lid,
    lidFlange,
    ribs,
    halfAt,
  };
}

/** Stable jitter, so ice never reshuffles between renders. */
export function seeded(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export type IceCube = { x: number; y: number; size: number; rotate: number };

/** The most of the drink's height the ice bed may occupy. */
const MAX_FILL = 0.82;

/**
 * Cubes packed in a bed at the bottom of the cup, in rows from the base upward,
 * rather than scattered through the drink.
 *
 * Each row is inset to the taper at its own depth, so no cube overlaps the wall.
 * Rows stop once they would break the liquid surface, which means light ice fills
 * one layer and regular ice stacks two or three.
 */
export function iceBed(geo: CupGeometry, surfaceY: number, count: number): IceCube[] {
  if (count <= 0) return [];

  // Café photographs show a handful of **large** cubes, each roughly a third of
  // the glass across, not a gravel bed of small ones. Two to a row at a third of
  // the base width matches that.
  const perRow = 2;
  const rows = Math.ceil(count / perRow);

  // Cube width scales with the cup, but the drink's *height* shrinks faster on a
  // small cup, so a fixed fraction of the base width buried a 12oz drink while
  // looking right at 20oz. Shrink the cubes just enough that the bed always stops
  // short of MAX_FILL, which keeps every cube placed and leaves the drink visible.
  const drinkH = Math.max(1, geo.baseY - surfaceY);
  const floorGap = geo.baseRy * 0.9; // the bed starts above the cup's floor curve
  const stack = 1.45 + (rows - 1) * 0.78; // bed height in multiples of the cube
  const size = Math.min(geo.botW * 0.34, Math.max(4, (drinkH * MAX_FILL - floorGap) / stack));
  const rowGap = size * 0.78;
  const out: IceCube[] = [];

  for (let row = 0, placed = 0; row < rows; row++) {
    const inRow = Math.min(perRow, count - placed);
    const y = geo.baseY - geo.baseRy * 0.9 - size * 0.95 - row * rowGap;

    // Don't let the bed push up through the surface of the drink.
    if (y < surfaceY + size * 0.2) break;

    const t = Math.max(0, Math.min(1, (y - geo.rimY) / geo.bodyH));
    const half = Math.max(size * 0.6, geo.halfAt(t) - size * 0.62);

    // Lay each row out centred on its own count, so a short top row doesn't
    // bunch to the left.
    const step = (half * 2) / inRow;
    // Brick-offset alternate rows, so a packed bed doesn't read as a grid.
    const stagger = row % 2 === 1 ? step * 0.35 : 0;
    for (let col = 0; col < inRow; col++) {
      const i = placed + col;
      const jitter = (seeded(i * 3.7 + row) - 0.5) * step * 0.3;
      const cx = geo.cx - half + step * (col + 0.5) + jitter + stagger;
      out.push({
        x: cx - size / 2,
        y: y - size / 2,
        size,
        rotate: seeded(i + 11) * 36 - 18,
      });
    }
    placed += inRow;
  }
  return out;
}

/**
 * A horizontal wave band two periods wide, so translating it by exactly one
 * container width loops seamlessly.
 *
 * `cw` is the container width (one period). The curve starts and ends at y=0,
 * which is where the liquid surface sits.
 */
export function wavePath(cw: number, amp: number, depth: number): string {
  const span = cw * 2;
  const steps = 48;
  let d = `M 0 0`;
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * span;
    const y = amp - amp * Math.cos((x / cw) * Math.PI * 2);
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d + ` L ${span} ${depth} L 0 ${depth} Z`;
}
