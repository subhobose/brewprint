/**
 * Everything about the cup that isn't liquid: contact shadow, cylindrical
 * shading, wall, molded rings, rolled lip, base and lid.
 *
 * Both renderers draw this last, on top of their liquid, so the vessel looks the
 * same whether the drink behind it is static SVG or animated Views.
 *
 * Depth here is built from **light only — never shadow over the drink.** Dark
 * overlays do make a cylinder read as round, but they also desaturate and muddy
 * the liquid underneath, and the liquid's colour is the product. So every overlay
 * on the interior is white; roundness comes from the geometry instead (elliptical
 * base, curved layer surfaces, a rim drawn as two ellipses for thickness).
 *
 * The only dark mark is the contact shadow on the counter, which is outside the
 * cup and doesn't touch the drink.
 *
 * Gradient ids are per-instance because SVG ids are document-global on web.
 */

import React, { useId } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { CupGeometry } from './cup';

const GLASS = '#3B2A1C';

export default function CupChrome({ geo }: { geo: CupGeometry }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const cylId = `cyl-${uid}`;
  const lidId = `lid-${uid}`;

  const { cx, rimY, baseY, topW, botW, lipRy, baseRy, w } = geo;
  const stroke = Math.max(1.4, w * 0.008);
  const hair = Math.max(0.9, w * 0.004);

  return (
    <G>
      <Defs>
        {/* Light wrapping a clear cylinder. White throughout: a bright specular
            band left of centre and a thinner catch on the right edge. No dark
            stops, so the drink keeps its own colour. */}
        <LinearGradient id={cylId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
          <Stop offset="0.14" stopColor="#FFFFFF" stopOpacity="0.3" />
          <Stop offset="0.28" stopColor="#FFFFFF" stopOpacity="0.07" />
          <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="0.88" stopColor="#FFFFFF" stopOpacity="0.1" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.22" />
        </LinearGradient>

        <LinearGradient id={lidId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.66" />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.34" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.16" />
        </LinearGradient>
      </Defs>

      {/* Contact shadow, set low enough to read as the counter rather than as
          part of the cup. */}
      <Ellipse
        cx={cx}
        cy={baseY + baseRy * 1.35}
        rx={botW * 0.58}
        ry={baseRy * 0.5}
        fill="#2A1B10"
        opacity={0.12}
      />

      {/* Light across the drink. Never a dark fill — see the note at the top. */}
      <Path d={geo.interior} fill={`url(#${cylId})`} />

      {/* Base: its own ellipse outline plus a light catch along the floor, which
          reads as the bottom of the cup without darkening the drink above it. */}
      <Ellipse
        cx={cx}
        cy={baseY - baseRy}
        rx={botW / 2}
        ry={baseRy}
        fill="none"
        stroke={GLASS}
        strokeOpacity={0.18}
        strokeWidth={hair}
      />
      <Ellipse
        cx={cx}
        cy={baseY - baseRy * 0.55}
        rx={botW * 0.4}
        ry={baseRy * 0.5}
        fill="#FFFFFF"
        opacity={0.16}
      />

      {/* Wall. */}
      <Path d={geo.interior} fill="none" stroke={GLASS} strokeOpacity={0.32} strokeWidth={stroke} />

      {/* Molded rings. */}
      {geo.ribs.map((d, i) => (
        <Path
          key={`rib-${i}`}
          d={d}
          fill="none"
          stroke={GLASS}
          strokeOpacity={0.15}
          strokeWidth={hair}
        />
      ))}

      {/* Rolled lip: outer edge, then the inner wall of the roll under it. */}
      <Ellipse
        cx={cx}
        cy={rimY}
        rx={topW / 2}
        ry={lipRy}
        fill="none"
        stroke={GLASS}
        strokeOpacity={0.32}
        strokeWidth={stroke}
      />
      <Ellipse
        cx={cx}
        cy={rimY + lipRy * 0.42}
        rx={topW / 2 - stroke * 1.3}
        ry={lipRy * 0.72}
        fill="none"
        stroke={GLASS}
        strokeOpacity={0.16}
        strokeWidth={hair}
      />

      {/* The lid, when there is one. Iced glasses are open, so `geo.lid` is blank
          and nothing here draws. */}
      {geo.lid !== '' && (
        <>
          <Path d={geo.lidFlange} fill="#FFFFFF" opacity={0.44} />
          <Path
            d={geo.lidFlange}
            fill="none"
            stroke={GLASS}
            strokeOpacity={0.22}
            strokeWidth={hair}
          />
          <Path d={geo.lid} fill={`url(#${lidId})`} />
          <Path
            d={geo.lid}
            fill="none"
            stroke={GLASS}
            strokeOpacity={0.26}
            strokeWidth={stroke * 0.8}
          />
        </>
      )}
    </G>
  );
}
