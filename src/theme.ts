/**
 * The palette, on its own so that `coffee.ts` can reach it.
 *
 * It lived in `ui.tsx` until the foam needed to know what colour the page behind
 * the glass is — see `foamColor`. `coffee.ts` is a pure model module with no React
 * in it, deliberately: it gets compiled and run under plain Node to check the
 * colour maths. Importing `ui.tsx` for one constant would have dragged
 * `react-native` in and broken that.
 *
 * `ui.tsx` re-exports `COLORS`, so `import { COLORS } from '../ui'` still works.
 */

export const COLORS = {
  bg: '#F7F1E7',
  card: '#FFFFFF',
  ink: '#2B1E14',
  inkSoft: '#7A6654',
  accent: '#8A5223',
  line: '#E4D8C7',
};
