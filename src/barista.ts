/**
 * The barista brain: natural language in, a recipe patch and a spoken reply out.
 *
 * This is deliberately not a language model. Ordering a coffee is closed-domain
 * slot filling over about forty words: size, temperature, milk, syrup, pumps,
 * shots, foam, ice. Rules beat a small quantized model here on accuracy and
 * latency, cost nothing, run offline, and can never offer a syrup that no cafe
 * in Frisco stocks.
 *
 * `BaristaBrain` is the seam. To move inference on-device later, implement the
 * same interface over Apple's Foundation Models framework (iOS 26+, no model to
 * ship) or react-native-executorch, and swap `activeBrain`. Either one needs a
 * development build, because Expo Go carries only its own native modules.
 */

import { BASES, FOAMS, MILKS, Recipe, SYRUPS, baseOf, syrupOf } from './coffee';

export type Turn = { id: string; role: 'barista' | 'guest'; text: string };

export type BaristaReply = {
  /** What the barista says back. */
  text: string;
  /** Fields to merge into the working recipe. */
  patch: Partial<Recipe>;
  /** The guest signalled they're happy; the caller can move to the render. */
  ready: boolean;
};

export interface BaristaBrain {
  readonly label: string;
  greet(): string;
  respond(input: string, recipe: Recipe): Promise<BaristaReply>;
}

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Questions the barista falls back to when nothing was recognised. */
const PROBES = [
  'What size are we building in — 12, 16 or 20?',
  'Dairy, or should I swap in oat or almond?',
  'How sweet do you want it? Standard is three pumps.',
  'Iced or hot today?',
  'Want cold foam on top?',
];

/**
 * Turn a patch into short human fragments, e.g. ['16oz', 'oat milk', '3 pumps'].
 * Used both for the barista's spoken reply and for the curating screen's steps,
 * so what the guest is told matches what actually changed.
 */
export function describeChanges(raw: Partial<Recipe>, recipe: Recipe): string[] {
  // Only mention fields that genuinely moved. A mood or an ice request sets
  // several slots at once, some of which already held that value, and "over ice"
  // on a drink that was already iced is noise.
  const patch: Partial<Recipe> = {};
  for (const key of Object.keys(raw) as (keyof Recipe)[]) {
    if (raw[key] !== undefined && raw[key] !== recipe[key]) {
      Object.assign(patch, { [key]: raw[key] });
    }
  }

  const said: string[] = [];
  const next = { ...recipe, ...patch };
  if (patch.base !== undefined) said.push(baseOf(next).label.toLowerCase());
  if (patch.size !== undefined) said.push(`${patch.size}oz`);
  if (patch.iced !== undefined) said.push(patch.iced ? 'over ice' : 'hot');
  if (patch.shots !== undefined) {
    said.push(patch.shots === 0 ? 'no espresso' : `${patch.shots} shot${patch.shots === 1 ? '' : 's'}`);
  }
  if (patch.milk !== undefined) {
    said.push(patch.milk === 'none' ? 'no milk' : `${MILKS.find((m) => m.id === patch.milk)!.label.toLowerCase()} milk`);
  }
  if (patch.syrup !== undefined && patch.syrup !== 'none') {
    said.push(`${syrupOf(next).label.toLowerCase()}`);
  }
  if (patch.syrup === 'none') said.push('unsweetened');
  if (patch.pumps !== undefined && next.syrup !== 'none') {
    said.push(`${patch.pumps} pump${patch.pumps === 1 ? '' : 's'}`);
  }
  if (patch.ice !== undefined && next.iced) {
    said.push(
      patch.ice === 'none' ? 'no ice' : patch.ice === 'light' ? 'light ice' : 'regular ice',
    );
  }
  if (patch.foam !== undefined) {
    said.push(`${FOAMS.find((f) => f.id === patch.foam)!.label.toLowerCase()} foam`);
  } else if (patch.coldFoam !== undefined) {
    said.push(patch.coldFoam ? 'cold foam' : 'no foam');
  }
  return said;
}

/**
 * Pull every recognisable slot out of one utterance.
 *
 * Order matters in places: an explicit "2 pumps" should win over a vague
 * "sweeter", so relative nudges are applied first and absolutes second.
 */
function parse(raw: string, recipe: Recipe): { patch: Partial<Recipe>; ready: boolean } {
  const s = ` ${raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `;
  const patch: Partial<Recipe> = {};

  /* -- moods, which set several slots at once -- */
  if (has(s, 'nutty', 'nut ')) {
    patch.syrup = 'pistachio';
  }
  if (has(s, 'dessert', 'treat', 'indulgent', 'cookie')) {
    patch.syrup = 'biscoff';
    patch.coldFoam = true;
  }
  if (has(s, 'cozy', 'cosy', 'comfort', 'rainy')) {
    patch.iced = false;
  }
  // Not a bare 'light ' — that collides with "light ice", which turned a request
  // for less ice into a cold brew with no espresso.
  if (has(s, 'refreshing', 'something light', 'light drink', 'crisp', 'summer')) {
    patch.iced = true;
    patch.base = 'coldbrew';
    patch.shots = 0;
  }
  if (has(s, 'chocolate', 'chocolatey')) {
    patch.syrup = 'mocha';
  }

  /* -- relative nudges -- */
  if (has(s, 'sweeter', 'extra sweet', 'more syrup')) {
    patch.pumps = clamp(recipe.pumps + (has(s, 'extra sweet') ? 2 : 1), 1, 8);
  }
  if (has(s, 'less sweet', 'not too sweet', 'less syrup', 'half sweet')) {
    patch.pumps = clamp(recipe.pumps - 1, 1, 8);
  }
  if (has(s, 'stronger', 'more espresso', 'more caffeine', 'extra shot')) {
    patch.shots = clamp(recipe.shots + 1, 0, 5);
  }
  if (has(s, 'weaker', 'less espresso', 'less caffeine', 'decaf')) {
    patch.shots = clamp(recipe.shots - 1, 0, 5);
  }

  /* -- absolutes -- */
  const ozMatch = s.match(/\b(12|16|20)\s*(oz|ounce|ounces)?\b/);
  if (ozMatch) patch.size = Number(ozMatch[1]) as Recipe['size'];
  else if (has(s, 'small', 'short')) patch.size = 12;
  else if (has(s, 'large', 'big', 'venti')) patch.size = 20;
  else if (has(s, 'medium', 'regular size')) patch.size = 16;

  if (has(s, 'iced', 'ice ', 'cold ', 'over ice')) patch.iced = true;
  if (has(s, 'hot ', 'warm', 'steamed')) patch.iced = false;

  const shotMatch = s.match(/\b(\d)\s*(shot|shots)\b/);
  if (shotMatch) patch.shots = clamp(Number(shotMatch[1]), 0, 5);

  if (has(s, 'oat', 'oatly')) patch.milk = 'oat';
  else if (has(s, 'almond')) patch.milk = 'almond';
  else if (has(s, 'skim', 'nonfat', 'non fat')) patch.milk = 'skim';
  else if (has(s, 'no milk', 'without milk', 'black', 'dairy free')) patch.milk = 'none';
  else if (has(s, 'whole milk', 'dairy', 'regular milk', 'normal milk')) patch.milk = 'whole';

  const base = BASES.find((b) => s.includes(b.id) || s.includes(b.label.toLowerCase()));
  if (base) {
    patch.base = base.id;
    if (base.id === 'matcha') patch.shots = 0;
  }

  const syrup = SYRUPS.find((x) => x.id !== 'none' && s.includes(x.id));
  if (syrup) patch.syrup = syrup.id;
  if (has(s, 'cookie butter', 'speculoos')) patch.syrup = 'biscoff';
  if (has(s, 'no syrup', 'unsweet', 'no sugar', 'plain')) patch.syrup = 'none';

  const pumpMatch = s.match(/\b(\d)\s*(pump|pumps)\b/);
  if (pumpMatch) patch.pumps = clamp(Number(pumpMatch[1]), 1, 8);

  if (has(s, 'cold foam', 'foam', 'froth')) patch.coldFoam = true;
  if (has(s, 'no foam', 'without foam', 'skip the foam')) patch.coldFoam = false;

  // Foam carries its own flavour, so naming one also asks for foam.
  const foam = FOAMS.find((f) => s.includes(f.id));
  if (foam) {
    patch.foam = foam.id;
    patch.coldFoam = true;
  } else if (has(s, 'salted caramel foam', 'caramel foam')) {
    patch.foam = 'caramel';
    patch.coldFoam = true;
  } else if (has(s, 'sweet cream')) {
    patch.foam = 'sweetcream';
    patch.coldFoam = true;
  }

  if (has(s, 'no ice', 'without ice', 'hold the ice', 'skip the ice')) {
    patch.ice = 'none';
  } else if (has(s, 'light ice', 'less ice', 'easy ice', 'not much ice')) {
    patch.ice = 'light';
    patch.iced = true;
  } else if (has(s, 'extra ice', 'lots of ice', 'regular ice', 'full ice')) {
    patch.ice = 'regular';
    patch.iced = true;
  }


  const ready = has(
    s,
    'that s it',
    'thats it',
    'sounds good',
    'perfect',
    'make it',
    'let s go',
    'lets go',
    'done',
    'order it',
    'show me',
    'build it',
  );

  return { patch, ready };
}

let probeIndex = 0;

export const localBrain: BaristaBrain = {
  label: 'On-device rules',

  greet() {
    return "I'm your barista. Tell me what you're in the mood for, or just describe the drink and I'll build it.";
  },

  async respond(input: string, recipe: Recipe): Promise<BaristaReply> {
    const { patch, ready } = parse(input, recipe);
    const changes = describeChanges(patch, recipe);

    if (changes.length === 0) {
      if (ready) {
        return { text: "Locked in. Here's your blueprint.", patch: {}, ready: true };
      }
      const probe = PROBES[probeIndex % PROBES.length];
      probeIndex += 1;
      return {
        text: `I didn't catch a change in that. ${probe}`,
        patch: {},
        ready: false,
      };
    }

    const list =
      changes.length === 1
        ? changes[0]
        : `${changes.slice(0, -1).join(', ')} and ${changes[changes.length - 1]}`;

    return {
      text: ready ? `${cap(list)} — locked in.` : `${cap(list)}. Anything else?`,
      patch,
      ready,
    };
  },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Swap this to move inference on-device. See the note at the top of the file. */
export const activeBrain: BaristaBrain = localBrain;
