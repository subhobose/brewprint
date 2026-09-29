/**
 * The static cup, for thumbnails: trending tiles, the live preview, list rows.
 *
 * All SVG, so the liquid is clipped to the cup interior by a clip path and the
 * taper comes free. The animated hero cup in LiquidCup.tsx can't do that, but
 * both take their geometry from cup.ts and their vessel from CupChrome, so a
 * 16oz cup looks identical in both.
 */

import React, { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import CupChrome from './CupChrome';
import DrinkBody from './DrinkBody';
import LatteArtCup from './LatteArtCup';
import { ICE_COUNT, Recipe, SizeOz, icedComposition, layersFor, mix } from './coffee';
import { CupStyle, cupGeometry, iceBed, seeded } from './cup';

const VB_W = 250;
const VB_H = 380;

type Props = {
  recipe: Recipe;
  width: number;
  /**
   * Draw the cup at this size instead of the recipe's own. The trending shelf
   * passes 16 so every tile shows the same reference vessel.
   */
  size?: SizeOz;
  style?: CupStyle;
};

/**
 * Hot drinks get a different vessel and viewpoint entirely — see LatteArtCup.
 * Split as a switch with no hooks of its own, so neither branch's hooks run
 * conditionally.
 */
export default function DrinkRender(props: Props) {
  const hot = props.style ? props.style === 'hot' : !props.recipe.iced;
  return hot ? (
    <LatteArtCup recipe={props.recipe} width={props.width} />
  ) : (
    <IcedThumb {...props} />
  );
}

function IcedThumb({ recipe, width, size, style }: Props) {
  // SVG ids are document-global on web, so scope them per instance.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `cup-${uid}`;
  const bodyId = `body-${uid}`;
  const comp = icedComposition(recipe);

  const geo = cupGeometry(VB_W, VB_H, {
    size: size ?? recipe.size,
    style: style ?? (recipe.iced ? 'cold' : 'hot'),
  });

  const bands = layersFor(recipe);
  const liquid = bands.filter((b) => !b.overlay);
  const ice = bands.find((b) => b.overlay);
  // Normalise on the *liquid* only. Ice is drawn over the drink rather than as a
  // band, so counting its volume here left the cup part-empty with the glass
  // colour showing through. Ice and liquid together fill the cup.
  const liquidOz = liquid.reduce((s, b) => s + b.oz, 0);
  const ozToPx = liquidOz > 0 ? geo.innerH / liquidOz : 0;

  // Stack the bands upward from the base. A plain loop, so the running offset is
  // never captured and reassigned inside a callback.
  const drawn: { id: string; color: string; y: number; h: number }[] = [];
  for (let i = 0, y = geo.baseY; i < liquid.length; i++) {
    const b = liquid[i];
    const h = Math.max(b.oz * ozToPx, b.oz > 0 ? 3 : 0);
    y -= h;
    drawn.push({ id: b.id, color: b.color, y, h });
  }

  const surfaceY = drawn.length ? drawn[drawn.length - 1].y : geo.baseY;

  return (
    <Svg width={width} height={(width * VB_H) / VB_W} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={geo.interior} />
        </ClipPath>
      </Defs>

      <G clipPath={`url(#${clipId})`}>
        <Rect x={0} y={0} width={VB_W} height={VB_H} fill="#F3EADB" />

        {/* Foam is a flat fill — it's aerated, not marbled. The drink itself is
            milk with coffee trickling down into it. */}
        {drawn.map((b) =>
          b.id === 'body' ? (
            <G key={b.id} transform={`translate(0, ${b.y})`}>
              <DrinkBody
                width={VB_W}
                height={b.h}
                comp={comp}
                gradId={bodyId}
                shadow={drawn.some((x) => x.id === 'foam')}
              />
            </G>
          ) : (
            // Foam is flat and opaque, poured on top of the coffee. It does not
            // blend into it — an earlier gradient here made a muddy band above
            // the coffee that belonged to neither.
            <Rect key={b.id} x={0} y={b.y} width={VB_W} height={b.h} fill={b.color} />
          ),
        )}

        {/* No ellipse on the liquid surface. Lightening it to suggest a surface
            seen from above just drew a line across the top of the drink; the
            rim of the glass already tells you where the top is. */}

        {/* Fine grain, matching the hero cup's FoamCrest. Specks too small to
            resolve individually, so the cap reads as whipped rather than as a
            handful of bubbles stuck to the glass. */}
        {drawn
          .filter((b) => b.id === 'foam')
          .flatMap((b) => [
            ...Array.from({ length: 60 }).map((_, i) => {
              const r = b.h * (0.022 + seeded(i * 2.3) * 0.035);
              return (
                <Circle
                  key={`grain-${i}`}
                  cx={geo.cx - geo.topW / 2 + seeded(i + 1) * geo.topW}
                  cy={b.y + b.h * (0.08 + seeded(i + 60) * 0.82)}
                  r={r}
                  fill={i % 3 === 0 ? mix(b.color, '#000000', 0.14) : mix(b.color, '#FFFFFF', 0.5)}
                  opacity={i % 3 === 0 ? 0.3 : 0.45}
                />
              );
            }),
            <Rect
              key="crest"
              x={0}
              y={b.y}
              width={VB_W}
              height={Math.max(1.5, b.h * 0.14)}
              fill={mix(b.color, '#FFFFFF', 0.5)}
              opacity={0.5}
            />,
          ])}

        {/* Ice sits in a bed at the bottom of the cup, not scattered through it. */}
        {ice &&
          iceBed(geo, surfaceY, ICE_COUNT[recipe.ice]).map((c, i) => (
            <Rect
              key={`ice-${i}`}
              x={c.x}
              y={c.y}
              width={c.size}
              height={c.size}
              rx={c.size * 0.2}
              fill="#FFFFFF"
              opacity={0.34}
              stroke="#FFFFFF"
              strokeOpacity={0.55}
              strokeWidth={1.1}
              transform={`rotate(${c.rotate} ${c.x + c.size / 2} ${c.y + c.size / 2})`}
            />
          ))}

      </G>

      <CupChrome geo={geo} />

    </Svg>
  );
}
