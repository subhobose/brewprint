/**
 * The big cup on the drink screen, in whichever form the drink calls for.
 *
 * Iced drinks get the clear tumbler with its animated gradient body; hot drinks
 * get the mug seen from above with latte art on the crema. The two are different
 * enough — different vessel, different viewpoint — that they're separate
 * components rather than one with branches inside it.
 *
 * This is a plain switch with no hooks of its own, so neither branch's hooks ever
 * run conditionally.
 */

import React from 'react';
import { View } from 'react-native';

import LatteArtCup from './LatteArtCup';
import LiquidCup from './LiquidCup';
import { Recipe } from './coffee';

type Props = {
  recipe: Recipe;
  width: number;
  height: number;
  /** Must match the colour painted behind the cup; see LiquidCup. */
  frameColor: string;
};

export default function HeroCup({ recipe, width, height, frameColor }: Props) {
  if (!recipe.iced) {
    // The mug is drawn to its own aspect ratio, so centre it in the stage rather
    // than stretching it to fill.
    const w = Math.min(width * 0.92, height * 0.95);
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <LatteArtCup recipe={recipe} width={w} />
      </View>
    );
  }

  return (
    <LiquidCup recipe={recipe} width={width} height={height} frameColor={frameColor} />
  );
}
