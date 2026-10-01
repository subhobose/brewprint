# BrewPrint — technical documentation

## What the app does

A guest builds a coffee recipe by picking a trending drink or talking to a barista, sees it
rendered as an animated cup, and (eventually) carries a "Barista Pass" into a café that
stocks the ingredients. The MVP is discovery-only: no payments, no café contracts.

The load-bearing idea is that **the picture is a spec**. Whatever the guest sees in the cup
must be reproducible by a human behind a counter, which is why the render is deterministic
and why volumes are modelled in real fluid ounces.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Expo SDK 57, React Native 0.86 | Develop on Windows, run on iPhone via Expo Go |
| Language | TypeScript 6 | |
| Navigation | Expo Router (file-based) | Required by `AGENTS.md`; routes in `src/app/` |
| Drawing | `react-native-svg` 15 | Vector cup, bundled in Expo Go |
| Motion | `react-native-reanimated` 4 + `react-native-worklets` | Bundled in Expo Go; runs on the UI thread |
| State | One React context | The working recipe is the only cross-screen state |

Everything above ships inside Expo Go. Nothing here needs a development build, which is a
deliberate constraint — see [On-device inference](#on-device-inference).

## File map

```
src/
  app/                  Expo Router routes — every file is a screen
    _layout.tsx         Stack navigator + RecipeProvider
    index.tsx           Opening pour; replaces itself with home
    home.tsx            Greeting, trending shelf, "Curate your drink"
    curate.tsx          Barista prompt (text-first) + the curating hand-off
    drink.tsx           Hero animated cup + adjustment sheet
  coffee.ts             Recipe model, catalog, recipe → layer math. No UI.
  cup.ts                Cup geometry and wave path generation. No UI.
  barista.ts            Natural language → recipe patch. No UI.
  RecipeContext.tsx     The shared working recipe
  LiquidCup.tsx         Animated hero cup
  DrinkRender.tsx       Static SVG cup for cards and thumbnails
  CupChrome.tsx         The vessel itself, shared by both renderers
  ui.tsx                Row / Segmented / Stepper primitives and the palette
```

`coffee.ts`, `cup.ts` and `barista.ts` contain no UI on purpose. The render, the Barista
Pass, and later the café ingredient matcher all read one `Recipe` type, so the drink shown
is provably the drink ordered.

## The recipe model

```ts
type Recipe = {
  base: 'latte' | 'coldbrew' | 'macchiato' | 'americano';
  size: 12 | 16 | 20;          // fluid ounces
  iced: boolean;
  shots: number;               // 0–5
  milk: 'whole' | 'oat' | 'almond' | 'skim' | 'none';
  syrup: 'none' | 'biscoff' | 'pistachio' | 'vanilla' | 'caramel' | 'mocha';
  pumps: number;               // 1–8
  coldFoam: boolean;
  dust: 'none' | 'cinnamon' | 'cocoa' | 'pistachio';
};
```

`recipeLine(recipe)` renders the Universal Recipe string shown to the guest and, later, to
the barista: `16oz · Iced · Latte · 2 shots · Oat milk · 3 pumps Biscoff · Cold foam`.

### Volume math

- one espresso shot = 1 oz
- one syrup pump = 0.25 oz
- **milk is capped by the base's `milkShare`**, and whatever it doesn't claim is brewed coffee or
  hot water
- ice displaces 32% (regular), 17% (light) or nothing, per `ICE_FRACTION`
- cold foam takes `FOAM_FRACTION` (21%) of the cup — a real cap is a thick head, not a film
Milk used to be simply "whatever is left", and that was a real modelling bug: it made
espresso-forward drinks come out as a cup of milk and render pale. `milkShare` sets the split per
base (cold brew 0.45, matcha 0.55, americano 0.10) and the rest is the base's own `liquid`.

> **`milkShare` is a proportion of what's left, never a cap on it.**
>
> As a cap it looked equivalent and wasn't. Ice and foam come out of the cup first, so raising the
> ice level shrank the leftover volume until milk consumed all of it and the brew hit **zero** — a
> matcha at regular ice rendered as a cup of plain milk, and a cold brew's "coffee" decayed into
> pure caramel syrup as the actual coffee vanished. Ice dilutes everything equally; it does not
> preferentially remove the coffee. A proportional split holds the milk-to-brew ratio at any ice or
> foam level, which is why the coffee band now stays put when ice changes.
>
> The visible signal for *less ice means more drink* is the taller liquid column and the shorter ice
> bed, not a change in the drink's colour.

**`liquid` is per-base** because a matcha's body is green, not coffee-coloured, and the renderer
needs that without special-casing the base anywhere downstream.

Black coffee has to be **black**: americano `#33190A`, cold brew `#2B1407`. Mid-browns here render
as a latte. A black americano comes out at luma 28.

`milkShare` also has to be high enough that *adding* milk visibly changes the cup. At 0.10 an
americano looked identical with and without it; at 0.55 it clearly lightens, and it has to clear
that bar on an **iced** americano too, where ice has already claimed most of the volume. Milk's
`PIGMENT` weight is 1.3 rather than 1 for the same reason — milk is opaque and lightens coffee
strongly.

The three bases are Cold Brew, Matcha and Americano.

### The drink is mixed, not layered

**A cup is one body of stirred liquid, plus foam.** It is not a layer cake, and the earlier
version that stacked a syrup band under a milk band under an espresso band was wrong about what
a latte looks like.

`drinkColor(recipe)` blends espresso, syrup and milk by volume into a single shade, then puts
back the chroma that blending destroys.

Two corrections make it match real coffee, both tuned against colours sampled out of
`references/coffee/`:

**`PIGMENT`** — espresso counts 3.1× per ounce and syrup 1.7× against milk's 1×. A plain volume
average washes out, because two shots is only an eighth of a 16oz cup while the drink is obviously
coffee-coloured.

**`CHROMA_LIFT`** — averaging a very dark espresso with pale milk in sRGB lands on grey-brown mud,
because real pigment mixing isn't a linear average. `saturate()` pulls the channels away from their
mean to restore warmth. The lift scales with how dark the result is: a dark coffee needs it, and a
pale milk drink pushed this hard turns an unpleasant yellow.

Measured against the reference photographs, a 2-shot iced latte now runs luma 61 → 122 → 162 at
chroma 62, against the photo's 49 → 112 → 141 at chroma 49–74. Before these two corrections it was
99 → 143 → 182 — washed out and half as dark at the top.

`layersFor` therefore returns at most three entries: `body`, `foam`, and the `ice` overlay.

### Cold foam is the exception

Foam floats, so it stays a separate band.

**Foam has its own flavour**, and that flavour is where its colour comes from — not the drink's
syrup. Plain cold foam on a latte is milk foam and should look like milk foam; ube foam is purple
whatever is underneath it. `FOAMS` lists sweet cream, vanilla, salted caramel, ube, matcha,
pistachio and strawberry, and `recipe.foam` selects one.

### Making foam read as foam

Two things carry it, both measured off the photographs rather than guessed.

**Contrast against the right neighbour.** `foamColor` compares against `brewColor` — the liquid
*directly beneath the cap* — not `drinkColor`, which is the blended average of the whole cup.
Measuring against the average flattered a foam that in fact sits on something much darker, so the
guard rarely fired when it should have. The target is `FOAM_CONTRAST` = 80 luma, taken from
references that read 193–233 over liquid at 76–168, a gap of 66–129. Half that is what made the cap
look washed into the drink.

Distinctness is satisfied by **either** a big luminance gap **or** a big colour distance
(`FOAM_DISTANCE` = 150). A strongly hued foam reads apart on colour alone — ube over bright matcha is
unmistakable at almost the same brightness (gap −17, distance 192) — while a pale cream has only
brightness to work with.

**The foam has two neighbours, and the page is the other one.** The glass is clear, so a pale cap is
also seen against `COLORS.bg`, and that background is cream at luma 242 — *brighter than real cold
foam*, which photographs at 193–233. Sweet cream `#FCF4E4` is 245 and sits 6.6 from the page in RGB,
which is to say identical; it vanished. So `foamColor` imposes a **ceiling** of
`luma(COLORS.bg) − BACKDROP_CONTRAST` (28), and that ceiling wins over the contrast target. The only
direction with room in it is down, which is also the truthful one: dairy foam is creamier than paper,
not brighter.

The ceiling has to be enforced *inside* the contrast guard rather than before it. A first attempt
deepened the foam first and then ran the old guard, which on a bright matcha lifted it straight back
to `under + 80` — brighter than the page — so satisfying the liquid actively destroyed the cap
against the background. The lift is now clamped to the ceiling.

When neither direction reaches `FOAM_CONTRAST` under the ceiling, the foam takes the **best
separation available** rather than jumping below the liquid. Some pairings are inherently low
contrast — matcha foam on a matcha, pistachio foam on a matcha — and a pale green cap on bright green
is what those look like in the photographs. Demanding the full gap sent them out the dark side and
turned the cap olive: a cap that is too subtle is a worse render, but a cap that is the wrong colour
is a wrong drink. The dark branch survives for a liquid brighter than the ceiling itself, which no
current base reaches.

Deepening goes `withLuma` → `saturate` → `withLuma`. Saturating first pushes bright channels past 255
where they clamp, and clamping is what flattens the hue, so the colour comes back less warm than it
went in. The closing rescale is a uniform multiply, so it pins the target exactly while keeping the
ratios `saturate` established.

**A deepened cap needs a chroma floor, not just a proportional lift.** `withLuma` is a uniform
multiply, so it preserves chroma *in proportion* — and a third more of nearly nothing is still nearly
nothing. Sweet cream starts at a channel spread of 24, so taking it to the ceiling with only
`FOAM_CHROMA` (0.35) produced `#ded5c2`: correctly legible, and grey. `deepen` therefore takes the
larger of the proportional gain and whatever reaches `FOAM_CHROMA_FLOOR` (46), which puts sweet cream
at `#e3d5b6` — beige. It is a floor rather than a target on purpose: vanilla already carries 62 and
keeps it, so the two stay distinguishable instead of collapsing onto one cream.

This is why `COLORS` lives in `theme.ts` and not `ui.tsx`: `coffee.ts` needs the page colour, and it
is a pure model module with no React in it — it gets compiled and run under plain Node to check the
colour maths. `ui.tsx` re-exports `COLORS` so `import { COLORS } from '../ui'` still works.

**A cast shadow.** `DrinkBody` takes a `shadow` flag and lays a short dark gradient across the top of
the drink. This is the cue that reads as *a solid object resting on liquid* rather than two coloured
bands stacked up, and every reference photograph has one.

**Cold foam is a cold-drink thing.** A hot coffee's foam is steamed into the milk rather than
poured over the top, so the option doesn't apply. `hasFoam(r)` gates it centrally — on the volume
model, the recipe line and the controls — rather than each caller remembering to check `iced`.

Colour isn't enough on its own, but **"thicker foam" means viscosity, not a fatter band.** Making
the band taller was the wrong reading and it just ate the drink. Density is carried by behaviour:

- `WaveSurface` takes a `viscous` flag, set when foam is the top band. Amplitude halves and the
  period more than doubles, so the cap moves in slow shallow swells instead of rippling.
- Its response to the cup's tilt drops to about a third — thick liquid barely tips.
- The foam seam animates at low amplitude.
**Foam is poured on top of the coffee and does not mix with it.** That one sentence settles three
things that were each tried and each looked wrong:

- **Grain, not bubbles.** The cap carries a fine aerated texture, and the distinction is *size*. An
  earlier version drew ~16 circles at 8–19% of the cap's height — on a 52pt band that is a 4–10pt
  radius, large enough to resolve individually, and legible circles on a drink read as bubbles stuck
  to the glass. The grain is a quarter that size (1–3pt) and four times as many, so no speck is
  resolvable on its own and the eye takes the whole cap as whipped.
- **No blend into the drink below.** A gradient there produced a muddy band belonging to neither
  liquid. The cap's own flat colour meets the coffee at a clean edge.
- **No seam ellipse across the coffee.** Drawing a surface ellipse at every band boundary put a
  stray oval in the middle of the coffee, where there is no surface — foam rests on the coffee, it
  doesn't float on a second one. Only the **topmost** band gets a surface ellipse.

All the cap carries is a bright crest along its top edge, where foam catches the light.

**Thickness** is `FOAM_FRACTION` = 19% **of the liquid**, not of the cup. As a share of the cup it
rendered thicker the more ice you added, because ice shrank everything else; as a share of the
liquid it holds at 19% regardless. The figure is measured: reference photographs shot from above
show the foam's top face as well as its side and read 33–54%, while the one side-on photograph
reads 21%. This render is a side-on cross-section, so 21% is the number to match.

> **Keep bubbles close to the foam's own colour.** An earlier version mixed them 62% toward white
> at high opacity and laid a pale crown across the whole cap; every flavour washed out toward
> white, so ube foam came out barely purple and matcha barely green. Bubbles are tinted *versions
> of* the foam — lifted or dropped by a quarter at most — so the flavour stays dominant.

`FOAM_FRACTION` is 11.5%: a believable cap. Height is not what makes foam read as foam.

The direction flips deliberately. Against a dark drink the foam goes creamy; against a pale
0-shot drink a *lighter* foam can't contrast with anything, so the foam goes deeper and warmer
instead and reads as a caramel cap. `withLuma` rescales RGB to hit the target exactly —
luminance is linear in RGB, so one multiply does it. Mixing toward a light or dark colour in
steps only converges, which left the foam short of its target on pale drinks.

Verified across 540 milk/syrup/shot/pump combinations. Both renderers also draw a darker seam
stroke under the foam boundary, so the edge holds even where the tones are closest.

## Two vessels, two viewpoints

**Iced and hot drinks are drawn as different objects, seen from different angles.**
Reference photographs in `references/coffee/` drove this: an iced coffee is photographed
side-on as a tall clear glass with the coffee marbling down through the milk, and a hot coffee
is photographed from above as a ceramic mug whose *surface* is the subject — crema with latte
art poured into it. A hot drink in a clear tumbler is simply the wrong picture.

| | iced | hot |
|---|---|---|
| vessel | clear tapered cold cup, domed lid | ceramic mug, handle, saucer |
| view | side-on cross-section | from above, onto the surface |
| body | vertical gradient, dark into pale | crema disc with latte art |
| component | `LiquidCup` (hero), `IcedThumb` (tile) | `LatteArtCup` (both) |

`HeroCup` and `DrinkRender` are plain switches with no hooks of their own, so neither branch's
hooks ever run conditionally. Every caller therefore gets the right view automatically.

### The iced drink: two solid liquids, one soft meeting

Sampling straight down the middle of the reference photographs gives the structure exactly.
Espresso poured over milk reads as:

```
0–40%    solid coffee     #8b5429
40–60%   transition       #a27752 → #ceb491
60–100%  solid milk       #decfa8
```

**Two solid regions with a narrow soft band between them.** `icedComposition(recipe)` returns the
milk colour, the brew colour, the tone where they meet, and what fraction of the drink is brew;
`DrinkBody` draws flat regions with a 20%-tall blend band, broken up by wide faint ellipses so the
meeting never reads as a ruled line.

Three earlier attempts failed, and the lesson only landed on the third:

- **A gradient across the whole body** read as a flat wash. Nothing could be identified as milk or
  as coffee, which is the entire point.
- **Discrete drip shapes** read as blobs pasted onto a hard line.
- **Faint ellipse smears** in the blend band read as blobs too.

The rule that came out of it: **diffusion has no edges, so it cannot be drawn with shapes.** Any
shape with a boundary announces itself as a shape however soft its fill. The blend band is a
gradient and nothing else — seven stops, eased so the change is slowest at both ends, which is what
melts it into the solid regions instead of starting and stopping at two visible lines.

The regions have to be flat, and the meeting has to be soft *and narrow*.

| drink | brew | milk | band |
|---|---|---|---|
| Iced Matcha Latte | `#7fbe21` | `#EFE0C4` | 31% |
| Salted Caramel Cold Brew | `#633008` | `#EFE0C4` | 31% |
| Iced Americano | `#603415` | `#a18977` | 84% |
| Vanilla Cold Brew | `#643810` | `#F4EDDE` | 42% |

The band is biased upward from the raw volume ratio, because brew spreads further than its share
of the liquid.

**No milk means no band at all.** `icedComposition` returns `coffeeShare: 1` with milk and brew set
to the same colour, and `DrinkBody` fills flat. A black americano is black all the way down; giving
it a lighter lower region invented milk that isn't in the cup.

> **The wave surface must be the same colour as the liquid directly beneath it.**
>
> A surface is not a different material from the liquid it belongs to, so it cannot be a different
> colour. Any difference reads as a phantom layer lying across the top of the drink — and because
> the wave bands slide, that strip appears to animate independently, which is the "extra layer with
> its own animation" complaint.
>
> This went wrong twice, in two places:
>
> 1. The wave took the band's own `color`, which is `drinkColor` — the blended mid-tone — while the
>    body's gradient starts at the brew colour. It now takes `comp.coffee`, or the foam's colour
>    when there's foam.
> 2. The wave bands were mixed 40% toward white (back) and overlaid with white (front), which made
>    the surface region paler than the drink regardless. Both are now the drink's own colour, barely
>    varied.

### The mug

Proportions come from `references/coffee/`, measured rather than guessed, because the first
attempt was a tall narrow mug that looked nothing like a served coffee:

| | ours | reference | |
|---|---|---|---|
| rim width ÷ body height | 1.02 | 1.03 | the mug is **squat**, not a cylinder |
| rim ry ÷ rim rx | 0.28 | 0.28 | how open the surface ellipse reads |
| saucer rx ÷ rim rx | 1.56 | 1.56 | |

Materials matter as much as shape: a dark glazed lip that bleeds down and fades into speckled
cream stoneware, a small round handle set high, and a deep saucer with a raised rim and a visible
well. A flat ceramic colour and a plain disc read as a diagram.

### Latte art

`LatteArtCup` picks a pour from the recipe: `heart` for a macchiato, `tulip` for mocha or three
shots and up, `rosetta` otherwise, and **no art at all when there's no milk** — you can't pour art
without microfoam. Crema takes `drinkColor`, so a third shot pours a visibly darker surface, and
the art takes the foam colour.

**Art is authored in a unit box** (x and y roughly −1..1) and the group that draws it is scaled
onto the crema ellipse. Designing in surface pixels meant hand-checking that every motif fitted,
and the first rosetta didn't — it ran to ±83 units inside a surface only ±24 tall and spilled over
the rim. In unit space it can't. Nothing in the art uses strokes, because the group's scale is
non-uniform and would smear stroke weight along one axis; the rosetta's stem is a filled taper.

### Steam

Steam is drawn as **curling ribbons**, each an S-curve path that rises while it grows, leans, and
thins out, on its own period. The earlier version translated opaque rounded rectangles upward,
which reads as objects sliding rather than vapour: real steam curls, widens as it rises, drifts off
true, and dissipates. Growth and lean are what sell it, more than the path shape.

## The vessel

The cup is a clear tapered glass: rolled lip and an elliptical base. **No lid and no straw** — every reference photograph of an iced coffee is an open
glass, and a domed lid put a plastic cap over a drink that is meant to look poured. Hot drinks
don't come through this geometry at all; they get their own mug in `LatteArtCup`.

`CupChrome` skips any lid path that comes back blank, so nothing downstream needs to know a lid
ever existed.

> **Derive bottom padding from the contact shadow, not from canvas height.** The shadow sits 1.35
> base-radii below the cup and is half a radius tall, and the base radius scales with cup *width*.
> A fixed fraction of the canvas height looked equivalent and wasn't: on a wide hero box the shadow
> ran off the bottom edge and was clipped away entirely.

`CupChrome.tsx` draws everything that isn't liquid and is used by both renderers, so the
vessel can't drift between the thumbnail and the hero cup.

**No café branding.** The silhouette is generic; logos and wordmarks are not. Don't add them.

### Depth from light, never shadow

**Nothing dark is ever drawn over the drink.** Dark overlays do make a cylinder read as round,
but they desaturate the liquid, and the liquid's colour *is* the product — a Biscoff latte has
to look like Biscoff, not like Biscoff in a dim room. An earlier pass shaded with a
dark-edged cylinder gradient plus a radial vignette and it made every drink look muddy. Both
are gone. Every overlay on the interior is white.

The only dark mark anywhere is the contact shadow on the counter, which is outside the cup.

Roundness therefore has to come from geometry:

1. **Elliptical base.** The wall runs down to where the base ellipse begins and a symmetric
   cubic carries it across, with control points at 4/3 of the radius so the curve bottoms out
   exactly at `baseY`. A flat bottom edge is the strongest single tell of a 2D drawing.
2. **The rim and base ellipses**, which are where the eye reads the cup as round.

> **Only the glass gets lines.** Anything drawn *across the drink* reads as a line on it, not as
> depth in it, however faint. Three were removed for this reason and none should come back:
>
> | drawn | where it landed | read as |
> |---|---|---|
> | surface ellipse on the top band | on the liquid surface | a line across the top |
> | two molded rings on the glass | y=115 and y=142, inside a foam band spanning 92–163 | two lines across the foam |
>
> The rim already tells you where the top of the drink is, and the wall already tells you the glass
> is round. Depth in the liquid comes from colour — `DrinkBody`'s blend band, `CupChrome`'s cylinder
> gradient — never from strokes.

> **Never stroke `interior`; stroke `wall`.**
>
> The geometry returns the cup outline in two forms. `wall` is open — left wall, across the base, up
> the right wall, stopping at the rim. `interior` closes it with `Z`, which adds a straight segment
> from the right rim back to the left rim.
>
> Fills and clip paths need the closed one. A *stroked* `interior` draws that closing segment as a
> line straight across the mouth of the glass, in the same weight as the walls — which is exactly
> what it looks like. This is easy to reintroduce, because the closed path is the obvious one to
> reach for and the fill and the stroke want different things.
3. **Light wrapping the cylinder.** A white-only gradient: a broad specular band left of
   centre and a thinner catch on the right edge. There is deliberately **no separate highlight
   strip down the left wall** — as a drawn shape it read as a band stuck on the glass.
4. **A light catch along the floor**, which reads as the bottom of the cup without darkening
   the drink above it.
5. **Thickness at the lip.** The rolled rim is two ellipses, not one.

The blown highlight down the glass is a tapered quad following the wall, not a straight strip —
a straight one pokes out through the wall near the base, where the cup has narrowed.

Animation carries depth too: ice cubes squash horizontally as they rotate (`scaleX` alongside
`rotate`), which reads as tumbling in liquid rather than spinning flat against the screen.

### Ice sits in a bed

`iceBed(geo, surfaceY, count)` lays cubes two to a row from the base upward, not scattered
through the drink. Each row is inset to the taper at its own depth so no cube crosses the wall,
each row is centred on *its own* count so a short top row doesn't bunch left, alternate rows are
brick-offset so a packed bed doesn't read as a grid, and rows stop once they would break the
liquid surface. Both renderers call it, so the thumbnail and the hero cup pack ice the same way.

`ICE_COUNT` is separate from `ICE_FRACTION`: count is how it looks, fraction is how much drink
fits.

**Cafe photographs show a handful of large cubes, not a gravel bed of small ones** - each roughly a
third of the glass across. Two to a row at 34% of the base width matches that:

| | cubes | cube size | ice fills |
|---|---|---|---|
| light | 3 | 29% of glass width | 44-56% of the drink |
| regular | 6 | 29% of glass width | 57-73% of the drink |

Cube size and cube count trade directly against bed height, so when the size went up the counts had
to come *down*. Chasing a target bed height with more, smaller cubes is what made the ice stop
reading as ice.

The hero cup's cubes are positioned in cup coordinates and then shifted by their container's
offset, because they live inside the liquid View so they travel with the pour.

### Ice has to be opaque

`iceTones(under)` colours each cube against the liquid **at its own depth**, via `liquidAt`. Drawing
ice as translucent white instead lets it inherit whatever is behind it: it vanishes into pale milk
and turns muddy grey in dark coffee, which is what stopped anything in the cup being tellable apart.
Mixing toward white *before* setting the luminance keeps a trace of the liquid's hue, so ice in
coffee reads warm and ice in matcha faintly green.

Two regimes, taken from the reference illustration:

- **Against a dark liquid** the face lifts a full 82 luma. That illustration's cubes sit 83 above the
  coffee beside them.
- **Against a pale liquid** there is no headroom, so the face stays pale and the **edge** does the
  work — in the same illustration, ice in the milky top of the glass is only 11 luma off its
  surroundings and is read entirely by its outline.

**Ice is never darker than what it sits in.** A dark cube in a pale drink reads as a hole. Checked
across 225 depth samples: every cube is distinguished by face tone or by edge, none by neither.

Each cube also carries a shadowed facet, which is what makes a square read as a cube.

### Ice and sweetness

`ice: 'none' | 'light' | 'regular'` is a real `Recipe` field, because it changes volume:
`ICE_FRACTION` gives light ice 17% of the cup against regular's 32%, and milk is the remainder,
so less ice means visibly more drink. `none` on an iced drink is a real order — cold, no cubes.

Sweetness is **not** a field. `SWEETNESS` is a list of presets that set `pumps`, so the preset
control and the pumps stepper read from the same number and can never disagree. Resist adding a
`sweetness` field — it would be a second source of truth for the same thing.

Three rules keep sizes consistent:

1. **One geometry function.** `cupGeometry(w, h, { size, style })` is the only place cup
   dimensions are decided.
2. **Hot cups are sized against the cold cup's headroom**, not their own. A straw and dome
   reserve vertical space that a flat lid doesn't, so sizing each style against its own
   headroom made 16oz hot cups 14% taller than 16oz cold ones. Same volume must look like the
   same cup; only the lid differs.
3. **Every trending drink is 16oz.** Mixed sizes gave each one a different silhouette — a 20oz cup is
taller and proportionally straighter, which read as a cylinder next to a 16oz one — so the shelf and
the drink page disagreed about what the same drink looked like. Size stays a thing the guest
changes, not a thing that varies between presets.

**Thumbnails pass an explicit `size`.** The trending shelf renders every tile at 16oz
   regardless of the drink's real size, so the shelf compares drinks rather than cup sizes.
   The live preview on the drink page passes no override, because there it should show the
   actual cup being built.

Size scaling itself lives in `SIZE_SCALE`: height moves more than width (12oz is 0.87 tall and
0.93 wide against 16oz), the way real cup ranges scale.

> **SVG ids must be unique per instance.** Ids are document-global once the app runs on web, so
> five thumbnails sharing `id="cup"` would all clip to the first one. Both renderers derive ids
> from `useId()` with non-alphanumerics stripped. Any new clip path or gradient must do the same.

## The render engine

Two renderers share `cup.ts` geometry.

**`DrinkRender`** is pure static SVG, used for the trending cards and the chat header
thumbnail. Liquid bands are full-width rectangles clipped by a `<ClipPath>` of the cup
interior, so the taper comes free and no band has to know the cup narrows.

**`LiquidCup`** is the animated hero. It cannot use a clip path, because the animated parts
are plain Views driven by Reanimated and Views cannot be clipped to a tapered shape by style
alone. So it inverts the problem:

1. Liquid bands, bubbles, ice and waves are ordinary Views, freely animated.
2. A single SVG **frame** is drawn on top: one path covering the whole box with the cup
   interior punched out of it using `fillRule="evenodd"`, painted in the screen background
   colour.
3. Anything the liquid does outside the cup is simply covered over.

> **Constraint this creates:** whatever sits behind the hero cup must be a flat colour equal
> to the `frameColor` prop. A gradient or photograph behind the cup will show a visible seam.
> If a patterned background is ever needed, switch to `<Mask>` or a masked view instead.

### Motion

| Effect | Mechanism |
|---|---|
| Moving surface | Two wave bands, each two sine periods wide, translated by exactly one container width on a linear loop so the seam never shows |
| Pour on open | Body `translateY` springs up from fully below the cup |
| Slosh on change | A tweak dips the body 5.5% then springs back, instead of re-pouring |
| Continuous sway | The whole body drifts a couple of points on a slow sine, so it's never perfectly still |
| Moving layer boundaries | Each internal boundary rocks, drifts and squashes on its own phase and period |
| Currents | Three faint light bands drifting up through the body at different depths and speeds |
| Carried tilt | The wave layer rotates a few degrees on a slow sine, offset between the two bands |
| Bubbles | Seven Views rising on staggered loops with sine drift and a fade at each end |
| Ice | Cubes in a bottom bed, bobbing slightly and tumbling via `scaleX` |
| Steam | Four wisps rising and fading off the lid, only when the drink is hot |

> **Never use a reversing repeat for an oscillation.**
>
> `withRepeat(withTiming(...), -1, true)` decelerates to a dead stop at *both* ends of every swing,
> and an `inOut` easing exaggerates the dwell. With several of them running at different periods the
> drink visibly stalls and restarts, which is exactly how it looked.
>
> Instead run a **linear phase** that loops `0 → 1` forever and take the sine inside the worklet:
>
> ```ts
> phase.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
> // in useAnimatedStyle:
> const s = Math.sin(phase.value * Math.PI * 2);
> ```
>
> A sine through a linear phase has no stationary point, so the motion never pauses. One-way loops —
> bubbles rising, steam dissipating — are fine as they are, because they fade out before they
> restart.

> **Never rotate a view that is also translating.**
>
> A rotation pivots around its own view's centre. The wave bands are twice the container's width and
> travel a full width every loop, so rotating *them* dragged the pivot along with the scroll: the
> same visible point picked up a different vertical offset as the band slid, and the surface heaved
> in time with the horizontal loop.
>
> The tilt now lives on a **stationary wrapper** exactly the container's width, with the bands
> sliding inside it. Fixed pivot, clean rocking, and the bands do nothing but translate.

Everything that rocks reads from **one** `tilt` phase — the surface and the foam seam included, the
seam simply lagging it. Giving the seam its own period made it rock against the surface, which read
as two unrelated things moving rather than one drink. The body's own sway is tiny and vertical only;
sliding it sideways as well separated it from the surface again.

**Motion is drink-wise, not layer-wise, and deliberately restrained.** With the mixed body there is
only ever one internal boundary — foam against drink — so `LayerBoundary` animates that single seam
at small amplitude. The movement people read as "liquid" is the surface wave plus a slow sway of
the whole body. That's it.

Two things were removed for being visual noise rather than motion:

- **Drifting light bands through the body.** They read as a strip travelling around the cup, not as
  liquid.
- **Most of the bubbles** (seven down to four, subtler). The surface wave carries the movement;
  bubbles only hint at it.

Restraint is the point here. Every extra loop makes the cup look busy rather than alive.

Thumbnails stay static on purpose: five animated cups on the home shelf is a lot of work for a
152pt picture.

`wavePath(cw, amp, depth)` generates the sine as 48 line segments rather than Bézier curves.
It starts and ends at `y = 0` so translating by one container width is seamless.

Ice and bubble positions come from `seeded(i)`, a deterministic hash, so they never
reshuffle between renders.

## The barista

`barista.ts` exposes a `BaristaBrain` interface and one implementation, `localBrain`.

```ts
interface BaristaBrain {
  readonly label: string;
  greet(): string;
  respond(input: string, recipe: Recipe): Promise<BaristaReply>;
}
// BaristaReply = { text: string; patch: Partial<Recipe>; ready: boolean }
```

`localBrain` is a deterministic slot-filling parser, not a language model. Ordering coffee
is closed-domain: about forty vocabulary items mapping onto eight slots. Rules beat a small
quantized model here on accuracy and latency, cost nothing, work offline, and can never
offer a syrup no café stocks.

It handles three kinds of input, applied in this order so specifics win over vagueness:

1. **Moods** that set several slots at once — "something nutty" → pistachio syrup and dust.
2. **Relative nudges** — "less sweet" → pumps − 1, "stronger" → shots + 1.
3. **Absolutes** — "16oz", "3 pumps", "oat", "no foam".

When nothing parses, it rotates through the fine-tuning questions from the product plan
rather than repeating itself.

`describeChanges(patch, recipe)` turns a patch into short human fragments (`['16oz', 'oat
milk', '3 pumps']`). Both the spoken reply and the curating screen's step list are built from
it, so what the guest is told always matches what actually changed.

### The curate flow is one shot, not a chat

`curate.tsx` takes a single utterance, not a conversation. The guest types a description,
taps **Pour it**, and a curating screen narrates the real changes before handing off to the
cup. Refinement happens on the cup page instead — the adjustment sheet, or "ask the barista"
which returns here.

One case matters: if `describeChanges` comes back empty, nothing was understood, and the
screen **must not** navigate. Handing over an unchanged default cup would silently look like
the app ignored the guest. Instead it stays put, shows the barista's question, and shakes the
input. `ready` from the parser is not used to navigate in this flow.

### On-device inference

To move to a real model later, implement `BaristaBrain` again and swap `activeBrain`. Both
options need a **development build** — Expo Go carries only its own native modules — which
in turn needs an Apple Developer account for a physical iPhone.

| Option | Ships | Notes |
|---|---|---|
| Apple Foundation Models (iOS 26+) | 0 bytes | Free, private, no download. Needs Apple Intelligence hardware. iOS only. **Preferred.** |
| `react-native-executorch` | ~600MB | Llama 3.2 1B at Q4_K_M, 20–40 tok/s on an iPhone 15. Cross-platform. |
| `llama.rn` | ~600MB | llama.cpp bindings, GGUF models, more manual. |

## Screens and data flow

```
index.tsx (opening pour) ──replace──> home.tsx
                                        ├──trending drink──> reset() ──────> drink.tsx
                                        └──"Curate your drink"──> curate.tsx
                                                 │  └─nothing understood─> stay and ask
                                                 └──patch()──> Curating ──> drink.tsx
                                                                   ▲            │
                                                                   └"ask barista"┘
```

`index.tsx` is the opening screen, not the home screen. Its loading animation is `LiquidCup`
pouring a real recipe rather than a separate loader, so the first thing a guest sees is the
thing the app does. It steps through three café status lines and `router.replace`s to `/home`,
so it never sits in the back stack. Total run is about 2.6 seconds.

The recipe is the **ube matcha from the trending shelf** — the same recipe object's worth of fields,
so the first cup a guest sees is a drink they can then go and order. It is chosen for recognition:
purple foam on green reads as a specific drink at a glance, where a brown cup on the warm `COLORS.bg`
background reads as a cup of something. It is also the one cap that needs no correction to clear the
page — ube is 128 away from `COLORS.bg` in RGB, so the backdrop guard leaves it alone.

It is the menu tile's recipe exactly, ice included. An earlier version dropped the ice on the theory
that cubes moving under a pouring cup and cycling text was too much at once — wrong about the motion:
`Ice` shifts a cube 2.2pt and turns it 4°, well under the wave already running on the surface. An
iced drink with no ice in it is the stranger thing to look at.

The status lines narrate *that* drink, so changing the recipe means changing `LINES` too.

### Tile consistency

Trending tiles are laid out from constants in `home.tsx`, never from their content: fixed card
width and height, a fixed-height art well the cup sits at the bottom of, and text blocks whose
heights equal their line counts (`NAME_H` 40 = 2 × 20, `NOTE_H` 17 = 1 × 17). A one-line name
and a two-line name therefore produce identical cards. If you add a field to a tile, give it a
fixed height and add it to `CARD_H`.

Tile text is centred, because the cup above it is. Left-aligned text under a centred cup is
what made the tiles look unresolved.

**Prose does not go in a tile.** `POPULAR` carries two strings per drink: `note` is a tag line
that fits one line at 176pt (`Cookie butter · Oat`), and `detail` is the full sentence. An info
button in the corner of each tile toggles `detail` in over the cup; tapping the overlay
dismisses it. The button is its own `Pressable` inside the card's, so tapping it reads the
description instead of opening the drink.

Fitting a long description under the cup is what truncated before. Shortening the tile copy is
the fix, not squeezing the type. Drink names are kept short for the same reason and carry
`adjustsFontSizeToFit` as a backstop.

`curate.tsx` leaves with `router.replace`, not `push`, so the curating screen never sits in
the back stack — going back from the cup returns to where the guest started.

`RecipeContext` holds the one working recipe. `patch()` merges the slots the barista
understood; `reset()` replaces it outright when a trending drink is picked. Routes stay
plain links — serialising the recipe into URL params on every tweak was the alternative and
it buys nothing.

`drink.tsx` sizes the cup from `useWindowDimensions` minus the safe-area insets, the header,
and the collapsed sheet, so the cup fills as much of the screen as is left. The sheet animates
its own height between the peek and `sheetMax`.

**Open, the sheet covers the whole stage.** `sheetMax` is `height − insets.top − HEADER_H −
SHEET_TOP_GAP`, so its top edge lands 10pt under the header — above the cup's rim on every
device, since `cup.ts` leaves `h × 0.03 + lipRy + 6` of headroom above it. The previous cap of
62% of the screen left the cup half visible behind the controls, which read as neither the
drink nor the menu. The header stays out from under it deliberately: it carries the drink's
name and recipe line, which is the only text identifying what you are editing.

`SHEET_PEEK` (104) is the height of the peek's **content**, so `insets.bottom` is added to it
rather than subtracted from it. Taking the home indicator out of the 104 left the "Ask the
barista" button clipped by the sheet's `overflow: hidden` on every device with one.

### The live preview

A covered hero cup is exactly when the guest is editing and most wants to see the drink, so
`LivePreview` (local to `drink.tsx`) is the only cup on screen while the sheet is open — it is
what makes a chip tap visible at all, not a convenience.

It is a 44pt `DrinkRender` in a floating card, pinned to the **top of the sheet** and the last
child of it, so the controls scroll underneath. It used to ride above the sheet's top edge;
a full-height sheet pushes that position off the screen, which is why it moved inside.

Its box is arithmetic, not a measurement: `PREVIEW_H` is built from the cup's 250×380 viewBox
and an explicit `lineHeight` on the label, and `CONTROLS_TOP` is derived from it and `GRAB_H`
so the first control row clears the card by 10pt. Those constants are load-bearing — change
the card and `CONTROLS_TOP` has to follow, or the first row hides behind it.

It reads the same `Recipe` object as the hero cup, so the two cannot drift. It also pops in
scale on every change, keyed on `recipeLine`. That key is checked rather than assumed: across
140 single-field edits there is no change the cup draws that `recipeLine` leaves out. The hero
cup was already live — it re-renders and sloshes on each change — so nothing extra is needed to
"apply" edits when the sheet closes.

## Commands

```bash
npm start                    # dev server; scan the QR with the iPhone Camera app
npm run web                  # preview in the browser (or press `w` in a running server)
npx tsc --noEmit             # typecheck
npx expo lint                # lint
npx expo export --platform ios   # verify the bundle compiles without a device
npx expo-doctor              # diagnose dependency and config issues
npx expo install <pkg>       # ALWAYS use this, never npm install, for native modules
```

### Browser preview

`react-dom`, `react-native-web` and `@expo/metro-runtime` are installed so the app runs in a
browser for fast animation iteration without a device.

**Turn on device emulation before judging anything** (F12, then Ctrl+Shift+M, iPhone 15 Pro).
`LiquidCup` takes its size from `useWindowDimensions` and the cup is 82% of window width, so a
maximized desktop window renders a uselessly large cup.

What the browser is good for: cup geometry, band colours and proportions, wave motion, pour and
slosh timing, bubbles, steam, the curating sequence, and all parsing.

What it gets wrong: safe-area insets are zero, so vertical spacing differs and the hero cup gets
more room than on a notched phone. Shadows differ, `KeyboardAvoidingView` is inert without a
software keyboard, `autoFocus` behaves differently, and fonts are not iOS fonts. Tune motion in
the browser; confirm layout on the phone.

### Local gotchas on this machine

- Two network interfaces exist (Wi-Fi and Tailscale). Expo sometimes advertises the
  Tailscale address, which the phone cannot reach. If the bundle hangs while downloading,
  set `REACT_NATIVE_PACKAGER_HOSTNAME` to the Wi-Fi IP before `npm start`.
- Expo Go on a physical iOS device opens a project **only when Expo CLI and Expo Go are
  signed in to the same account**. Scanning the QR does not bypass this.
- `npm install` may need `--legacy-peer-deps`; an optional `react-dom` peer conflicts.

## Known gaps

- No café matching yet. Google Places exposes `rating` and `userRatingCount` but no
  popularity score, so the Rating × Review Density ranking will be ours to compute, and the
  Places terms limit how long place data may be cached.
- No ingredient inventory data. This is the hardest part of the product and it is manual:
  no API reports that a café stocks Biscoff syrup and oat milk.
- The Barista Pass card does not exist as a screen yet.
- No persistence. Recipes vanish when the app closes.
- The Barista Pass hand-off is untested with real baristas. This is the riskiest assumption
  in the product and it is a human one, not a technical one.
