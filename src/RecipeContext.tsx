/**
 * One working recipe, shared across the home, chat and render screens.
 *
 * Expo Router params would mean serialising the recipe into the URL on every
 * tweak, so the live drink lives here instead and routes stay plain links.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { DEFAULT_RECIPE, Recipe } from './coffee';

type RecipeStore = {
  recipe: Recipe;
  /** What the guest picked, when they picked something with a name. */
  name: string | null;
  /** Merge a subset of fields, e.g. one slot the barista understood. */
  patch: (fields: Partial<Recipe>) => void;
  /** Replace outright, e.g. picking a drink off the trending shelf. */
  reset: (next: Recipe, name?: string) => void;
};

const Ctx = createContext<RecipeStore | null>(null);

export function RecipeProvider({ children }: { children: React.ReactNode }) {
  const [recipe, setRecipe] = useState<Recipe>(DEFAULT_RECIPE);
  const [name, setName] = useState<string | null>(null);

  const patch = useCallback((fields: Partial<Recipe>) => {
    setRecipe((r) => ({ ...r, ...fields }));
    // Tweaking a named drink leaves it recognisably that drink, but swapping the
    // base doesn't — a matcha turned into an americano is no longer "Iced Matcha
    // Latte", so the name is dropped rather than left lying about it.
    if (fields.base !== undefined) setName(null);
  }, []);

  const reset = useCallback((next: Recipe, label?: string) => {
    setRecipe(next);
    setName(label ?? null);
  }, []);

  const value = useMemo(() => ({ recipe, name, patch, reset }), [recipe, name, patch, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecipe(): RecipeStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useRecipe must be used inside a RecipeProvider');
  return store;
}
