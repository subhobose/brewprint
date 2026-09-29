/**
 * The inside of an iced drink: the brew above, milk below, meeting in a soft
 * diffuse band.
 *
 * Returns SVG elements, so both renderers draw the same composition — the
 * thumbnail nests it in its own `Svg`, the hero cup gives it one inside the
 * animated body View so it travels with the pour.
 *
 * The structure comes from sampling the reference photographs down the middle of
 * the glass. Espresso poured over milk reads as:
 *
 *   0–40%   solid coffee      #8b5429
 *   40–60%  transition        #a27752 → #ceb491
 *   60–100% solid milk        #decfa8
 *
 * That is the shape to reproduce: **two solid regions with a narrow soft band
 * between them**. Two earlier attempts both failed by getting this wrong — a
 * gradient across the whole body read as a flat wash with no identifiable milk or
 * coffee, and discrete drip shapes read as blobs pasted onto a hard line. The
 * regions have to be flat and the meeting has to be soft and narrow.
 */

import React from 'react';
import { Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BLEND_ZONE as ZONE, IcedComposition, mix } from './coffee';

/**
 * The shadow a foam cap throws onto the drink it sits on.
 *
 * This is the cue that reads as "a solid object resting on liquid" rather than
 * "two coloured bands stacked up", and every reference photograph has one.
 */
function FoamShadow({ width, height, id }: { width: number; height: number; id: string }) {
  const h = Math.max(2, height * 0.09);
  return (
    <>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity="0.32" />
          <Stop offset="0.55" stopColor="#000000" stopOpacity="0.12" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={h} fill={`url(#${id})`} />
    </>
  );
}

export default function DrinkBody({
  width,
  height,
  comp,
  gradId,
  shadow = false,
}: {
  width: number;
  height: number;
  comp: IcedComposition;
  /** Must be unique per instance; SVG ids are document-global on web. */
  gradId: string;
  /** Draw the shadow cast by a foam cap sitting on top of this body. */
  shadow?: boolean;
}) {
  const { milk, coffee, blend, coffeeShare } = comp;

  // Nothing but milk in the cup, so there is no second liquid to meet.
  if (coffeeShare <= 0) {
    return (
      <G>
        <Rect x={0} y={0} width={width} height={height} fill={milk} />
        {shadow && <FoamShadow width={width} height={height} id={`${gradId}-sh`} />}
      </G>
    );
  }

  // …and the reverse: no milk, so the brew fills the cup with nothing to blend
  // into. A black americano is one flat colour, not a gradient.
  if (coffeeShare >= 1) {
    return (
      <G>
        <Rect x={0} y={0} width={width} height={height} fill={coffee} />
        {shadow && <FoamShadow width={width} height={height} id={`${gradId}-sh`} />}
      </G>
    );
  }

  const zoneH = height * ZONE;
  const zoneTop = Math.max(0, height * coffeeShare - zoneH / 2);
  const zoneBot = Math.min(height, zoneTop + zoneH);

  return (
    <G>
      <Defs>
        {/* Many stops, eased so the change is slowest at both ends: that is what
            makes the band melt into the solid regions instead of starting and
            stopping at two visible lines. */}
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={coffee} />
          <Stop offset="0.18" stopColor={mix(coffee, blend, 0.3)} />
          <Stop offset="0.36" stopColor={mix(coffee, blend, 0.72)} />
          <Stop offset="0.5" stopColor={blend} />
          <Stop offset="0.64" stopColor={mix(blend, milk, 0.45)} />
          <Stop offset="0.82" stopColor={mix(blend, milk, 0.8)} />
          <Stop offset="1" stopColor={milk} />
        </LinearGradient>
      </Defs>

      {/* Solid milk fills the cup. */}
      <Rect x={0} y={0} width={width} height={height} fill={milk} />

      {/* Solid brew down to the top of the blend band. */}
      <Rect x={0} y={0} width={width} height={zoneTop} fill={coffee} />

      {/*
        The band where they meet — a gradient and nothing else.

        Earlier versions layered drawn shapes into this zone (drips, then faint
        ellipses) to suggest diffusion. Both read as blobs: any shape with an
        edge, however soft its fill, announces itself as a shape. Diffusion has
        no edges, so it has to be done with colour alone.
      */}
      <Rect x={0} y={zoneTop} width={width} height={zoneBot - zoneTop} fill={`url(#${gradId})`} />

      {/* Drawn last so it falls across whatever is at the top of the drink. */}
      {shadow && <FoamShadow width={width} height={height} id={`${gradId}-sh`} />}
    </G>
  );
}
