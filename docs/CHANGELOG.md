# BrewPrint — work log

Newest first. Records what changed and, where it matters, why. Technical detail lives in
[ARCHITECTURE.md](ARCHITECTURE.md).

## 2026-10-04 (evening) — Foam texture; mound and ice changes reverted

**Reverted the foam mound.** Reading the new references as a change of silhouette was wrong — the
ask was about the cap's *texture*, nothing else. `foamDome`, `DOME_RISE` and the `foam` headroom flag
on `cupGeometry` are gone, and cup heights are back to their plain figures.

**Reverted the ice cubes** to translucent white. `iceTones` and `liquidAt` removed; `BLEND_ZONE`
stayed, since `DrinkBody` uses it.

**Gave the cap a fine aerated grain.** The distinction from the bubbles removed earlier is *size*,
and it is the whole point: that version drew ~16 circles at 8–19% of the cap's height, which on a
52pt band is a 4–10pt radius — large enough to resolve individually, and legible circles on a drink
read as bubbles stuck to the glass. The grain is a quarter the size (1–3pt) and four times as many,
so no speck resolves on its own and the eye takes the whole cap as whipped. Applied in both
renderers, with the light crest along the top edge kept.

**Verified:** typecheck clean, lint clean, both bundles compile, cup geometry confirmed back to its
pre-mound figures.

## 2026-10-04 (later) — Cold foam mounds above the rim; ice reverted

**Reverted the ice cubes** to translucent white, at the user's request. `iceTones` and `liquidAt`
removed; `BLEND_ZONE` stayed in `coffee.ts` since `DrinkBody` uses it.

**Cold foam now rises above the rim.** New references — a whipped-coffee illustration and a cold foam
photograph — both show the same silhouette, and it's the one thing a flat band inside the glass can
never do: an opaque cap standing over the lip with an irregular, slightly off-centre peak, seated
into the glass rather than ruled flat.

`foamDome(geo)` draws it and both renderers lay it down last, after the frame and the glass, so it
sits over the rim rather than being painted out by the cup's own outline.

`cupGeometry` takes a `foam` flag and reserves headroom for the mound, so a foamed drink's glass is
shorter while cup-plus-foam still fills the frame. Without that the mound ran off the top of the
canvas at 20oz, where the rim already sits high — caught by extracting the dome path's bounding box
and checking it against the canvas at every size.

**Verified:** typecheck clean, lint clean, both bundles compile, dome on-canvas at all nine
size/canvas combinations, and ice still fully placed in the shorter foamed cup.

## 2026-10-04 — Ice made opaque, so everything in the cup can be told apart

Working from `download.jpg`, a flat vector illustration in the same medium as our render. Sampling it
showed its ice sits ~83 luma off the coffee beside it, with a lit face and a shadowed facet.

**Ice was translucent white**, so it inherited whatever was behind it — invisible against pale milk,
muddy grey in dark coffee. It is now opaque and toned against the liquid at its own depth via new
`liquidAt` and `iceTones`, with a shadowed facet and a drawn edge. Mixing toward white before setting
luminance keeps a trace of the liquid's hue, so ice in coffee reads warm and ice in matcha faintly
green.

Two regimes, both from the reference: against a **dark** liquid the face lifts the full 82; against a
**pale** one there's no headroom, so the face stays pale and the edge outlines it — the illustration
does exactly this, its cubes in the milky top being only 11 luma off their surroundings.

A first attempt applied the 82 lift unconditionally, which made cubes *darker* than a bright matcha.
Ice is never darker than what it sits in; a dark cube in a pale drink reads as a hole. Checked across
225 depth samples: 169 cubes are distinguished by face tone, 56 by edge, none by neither.

`BLEND_ZONE` moved to `coffee.ts` so the ice and the body agree on where the blend band sits.

**Verified:** typecheck clean, lint clean, both bundles compile.

## 2026-10-03 (evening) — The line across the mouth of the glass

The cup outline was being **stroked from its closed path**. `interior` ends in `Z`, which adds a
straight segment from the right rim back to the left rim, so stroking it drew a line straight across
the top of the glass in the same weight as the walls. The previous three removals were all real, but
none of them was this.

The geometry now returns the outline in two forms: `wall`, open and stopping at the rim, and
`interior`, closed. Fills and clip paths take `interior`; strokes take `wall`. Audited every use —
the only stroked one was the cup wall, and the rest are fills, clips or the frame, which all need the
closed form.

Written up in ARCHITECTURE.md, because the closed path is the obvious one to reach for and the fill
and the stroke genuinely want different things.

**Verified:** typecheck clean, lint clean, both bundles compile.

## 2026-10-03 (later) — Removed the second rim ellipse

The rim was drawn as two stacked ellipses: the outer edge, and an inner one 0.42 lip-radii below it
meant to suggest the inside wall of the rolled lip. It read as an extra line hanging under the mouth
of the glass rather than as thickness.

Four ellipses remain in the whole cup, and each is the glass or the counter rather than a mark on
the drink: the contact shadow, the glass floor, a light catch on the base, and the rim.

**Verified:** typecheck clean, lint clean, both bundles compile.

## 2026-10-03 — Removed three stray lines from the cup

**The two molded rings are gone.** They were positioned at 10% and 17% of the body height, which on
a 16oz hero puts them at y=115 and y=142 — inside a foam band spanning y=92–163. Both were being
drawn straight across the cold foam, which is what they looked like: two lines on the foam, not
moulding in the glass.

**The liquid surface ellipse is gone.** It sat exactly on the surface and read as a line across the
top of the drink. The rim of the glass already says where the top is.

Rule added to ARCHITECTURE.md: only the glass gets lines. Anything drawn across the drink reads as a
line on it rather than depth in it, however faint — depth comes from colour, never strokes. The rim,
wall and base outlines stay, since those are the glass itself.

**Verified:** typecheck clean, lint clean, both bundles compile.

## 2026-10-02 (night) — Foam made distinct, measured against the references

Sampling the foam photographs gave two concrete gaps.

**Contrast was measured against the wrong neighbour.** `foamColor` compared against `drinkColor` —
the blended average of the whole cup — when what actually sits under the cap is the brew at the top
of the drink. Extracted `brewColor` so the composition and the foam guard read one definition, and
the guard now compares against it.

**The target was about half the references.** They show foam at 193–233 over liquid at 76–168, a gap
of 66–129; ours asked for 34–40. `FOAM_CONTRAST` is now 80, and distinctness is satisfied by either
a large luminance gap **or** a large colour distance — a hued foam reads apart on colour alone (ube
over matcha: gap −15, distance 198) while a pale cream has only brightness. Lifting can hit the
channel ceiling on a bright drink, so when it does the foam drops instead.

**Added the shadow the foam casts onto the drink.** Every reference photograph has one, and it's the
cue that reads as a solid object resting on liquid rather than two stacked bands. `DrinkBody` takes a
`shadow` flag and lays a short dark gradient across the top of the drink, in both renderers.

**Verified:** typecheck clean, lint clean, both bundles compile, and foam separation checked across
252 base/milk/flavour/shot combinations — the weakest case sits at 116% of the required separation.

## 2026-10-02 (evening) — Lid removed from iced glasses

**The dome is gone.** Every reference photograph of an iced coffee is an open glass; the domed lid
put a plastic cap over a drink that's meant to look poured. `lidH` is 0, the lid paths come back
blank, and `CupChrome` skips any blank path — so nothing downstream needs to know a lid existed. Hot
drinks were already routed to `LatteArtCup` and never used this geometry.

The glass reclaims the headroom the dome was taking and stands taller in its frame: a 16oz cup now
fills 75% of the box against roughly 58% before.

**Fixed a latent clipping bug found while re-checking bounds.** The contact shadow was moved lower
several changes ago and never re-verified — it sits 1.35 base-radii below the cup, and at the old
bottom padding it was being drawn off the canvas and clipped away entirely at every size. Bottom
padding is now derived from the shadow's own size rather than from canvas height, which matters
because the base radius scales with cup *width*: a fixed height fraction held on the narrow
thumbnail box and failed on the wide hero one.

**Verified:** typecheck clean, lint clean, both bundles compile, and geometry re-checked across four
canvas shapes and three sizes for rim, shadow, width, liquid room and ice containment.

## 2026-10-02 (later) — Foam simplified: no bubbles, no blend, no oval, thinner

More cold-foam references added, and they settle it: **foam is poured on top of the coffee and does
not mix with it.** Three things came out of the cup as a result.

- **Bubbles removed.** Every photograph shows a smooth cream surface; the scattered bubbles read as
  speckle floating on the drink rather than as foam.
- **The foam-to-drink blend removed** — reversing the previous change. "Consistency" meant the
  coffee-into-milk gradient, not foam mixing into coffee. The gradient produced a muddy band above
  the coffee belonging to neither liquid. Foam now meets the coffee at a clean edge.
- **The stray oval removed.** A surface ellipse was drawn at *every* band boundary, which put one in
  the middle of the coffee under the foam — where there is no surface. Only the topmost band gets
  one now.

All the cap keeps is a bright crest along its top edge.

**Foam is thinner, and no longer moves with ice.** `FOAM_FRACTION` is now a share of the **liquid**
rather than of the cup, so it holds at 19% at every ice level instead of thickening as ice grew. The
number is measured: references shot from above show the foam's top face as well as its side and read
33–54%, while the one side-on shot reads 21% — and this render is a side-on cross-section.

**Verified:** typecheck clean, lint clean, both bundles compile, foam share checked at 19% across
every size and ice level with zero spread.

## 2026-10-02 — Phantom layer (the real cause), black coffee, cup consistency, drink name

**Found the actual cause of the phantom layer.** Last round's fix was correct but incomplete: the
wave bands were *also* mixed 40% toward white (back) and overlaid with white (front), so the surface
region was paler than the drink no matter what colour it was handed. Both bands are now the drink's
own colour, barely varied. A surface isn't a different material from its liquid, so it can't be a
different colour — and because the bands slide, any difference reads as a layer with its own
animation.

**Black coffee is black now.** The americano's `liquid` was `#6E4A2E`, a mid-brown that rendered as
a latte. Americano is `#33190A` and cold brew `#2B1407`; a black americano comes out at luma 28.

**Adding milk to an americano actually changes it.** `milkShare` was 0.10, so milk was a rounding
error — now 0.55, and milk's `PIGMENT` weight went 1 → 1.3 since milk is opaque and lightens coffee
strongly. Verified the change clears a visible threshold on hot *and* iced (where ice has already
taken most of the volume), without disturbing the tuned matcha, cold brew or foam contrasts.

**One cup silhouette across the shelf.** Trending drinks were 16/20/16/16/12oz, and a 20oz cup is
taller and proportionally straighter — the "cylinder" next to the matcha. All trending recipes are
16oz; size remains something the guest changes.

**The drink page names the drink.** `RecipeContext` carries the name the guest picked, shown where
"Universal Recipe" used to be, with the recipe line beneath it. Tweaking a named drink keeps the
name, but changing the base drops it — a matcha turned into an americano is no longer "Iced Matcha
Latte". Curating from scratch shows "Your drink".

**Verified:** typecheck clean, lint clean, both bundles compile, plus checks on blackness, milk
response, trending size consistency, matcha hue and foam contrast across 105 combinations.

## 2026-10-01 (night) — Phantom surface layer, foam consistency, black americano

**Fixed the phantom layer on top of the matcha.** The wave surface was painted with the band's own
`color`, which is `drinkColor` — the blended mid-tone. But the body is drawn as a gradient starting
at the *brew* colour, so on a matcha a dull strip sat over bright green. And because the wave
slides, that strip appeared to move out of step with the drink beneath it, which is the
out-of-sync look. The surface now takes `comp.coffee` when there's no foam, the foam's colour when
there is.

**Foam now blends into the drink** instead of ending at a hard dark line. Solid down to about two
thirds, then a gradient into the liquid below — the same treatment the brew gets where it meets the
milk. Consistency between the two boundaries is what makes the cup read as one object; the crisp
underside added earlier made the cap look stuck on. Applied in both renderers.

**A black americano is black all the way down.** With no milk, `icedComposition` now returns
`coffeeShare: 1` and one flat colour. It was still drawing a lighter lower region, which invented
milk that isn't in the cup.

**Verified:** typecheck clean, lint clean, both bundles compile, plus checks that milkless drinks
render flat at every ice level, that drinks with milk still show two regions, and that a
no-foam matcha has no foam band.

## 2026-10-01 (evening) — Fixed the base liquid vanishing at higher ice levels

Raising `ICE_FRACTION` in the previous change exposed a latent modelling bug rather than creating a
new one, but it broke real drinks so it amounts to the same thing.

`milkShare` was applied as a **cap on the leftover volume**. Ice and foam come out of the cup first,
so raising the ice level shrank that leftover until milk consumed all of it and the brew hit zero:

- **Iced Matcha Latte** at regular ice rendered as a cup of plain milk — coffee band 0%, no matcha.
- **Ube Matcha** lost its matcha at *light* ice too.
- **Salted Caramel Cold Brew**'s brew colour decayed from `#522607` to `#c16710` as ice rose, because
  the actual coffee vanished and only the caramel syrup was left to colour it.

`milkShare` is now a **proportion** of what's left, not a cap. Ice dilutes everything equally; it
does not preferentially remove the coffee. The milk-to-brew ratio now holds at any ice or foam
level: matcha stays `#7fbe21` at a 48% band whatever the ice, and the cold brew stays dark.

Added a check that walks every trending drink at every ice level and asserts the base liquid is
still present and hasn't drifted in colour — this is a failure mode that typechecks cleanly and only
shows up on screen.

**Verified:** typecheck clean, lint clean, both bundles compile.

## 2026-10-01 (later) — Ice levels stepped up, surface tilt made smooth

**Ice levels shifted up a notch**, as asked: what regular used to be is now light (6 cubes, filling
57–73% of the drink), and regular went up to 8 cubes filling 70–82%. `ICE_FRACTION` moved with it
(light 0.32, regular 0.44).

Ten cubes was too many — on a 16oz hero the ice filled the entire drink and buried the milk/coffee
blend, and a 12oz hero silently dropped one because the bed hit the surface. `iceBed` now shrinks
cubes just enough to keep the bed under `MAX_FILL` (82%), so every cube is always placed and the
drink stays visible. Cubes still read large, at 26–29% of the glass width.

**Fixed the remaining awkwardness in the liquid.** The surface tilt was applied to the *sliding*
wave bands. A rotation pivots on its own view's centre, and those bands are twice the container's
width and travel a full width every loop — so the pivot was dragged along with the scroll and the
surface heaved up and down in time with the horizontal loop.

The tilt now sits on a stationary wrapper exactly the container's width, with the bands sliding
inside it: fixed pivot, clean rocking, bands that only translate. The foam seam was also given its
own unrelated period, which made it rock against the surface; it now reads from the same `tilt`
phase, just lagging. Body sway is smaller, slower and vertical only.

**Verified:** typecheck clean, lint clean, both bundles compile, and ice re-checked for placement,
cube size, containment and fill ratio at every size and level.

## 2026-10-01 — Animation stall fixed, ice resized, blend band simplified, foam made opaque

**Fixed the liquid stopping and starting.** Every oscillation used
`withRepeat(withTiming(...), -1, true)` with an `inOut` easing. A reversing repeat decelerates to a
dead stop at *both* ends of every swing, and `inOut` exaggerates the dwell — with the sway, tilt,
foam seam and ice all doing it at different periods, the drink visibly stalled and restarted.

All of them now run a **linear phase looping 0 → 1** with the sine taken inside the worklet. A sine
through a linear phase has no stationary point, so nothing ever pauses; phase offsets per element
stop them swinging in unison. One-way loops (bubbles, steam) were already fine, since they fade out
before restarting. Written up as a rule in ARCHITECTURE.md — it's an easy mistake to repeat.

**Ice resized to match the photographs.** They show a handful of large cubes, each about a third of
the glass across, not a gravel bed. Cubes went to 34% of base width, two to a row, and counts came
*down* to 6 regular / 3 light — size and count trade directly against bed height, and chasing a
height target with more, smaller cubes is what made the ice stop reading as ice. Ice now fills
57–73% of the drink at regular, 44–56% at light.

**Blend band is now a gradient and nothing else.** The faint ellipse smears went the same way as the
drips before them: any shape with a boundary announces itself as a shape, however soft its fill.
Diffusion has no edges, so it can't be drawn with shapes. The band is seven eased stops across 26%
of the drink, which melts it into the solid regions instead of starting and stopping at two visible
lines.

**Cold foam reads as foam, and keeps its flavour.** The froth was mixing bubbles 62% toward white at
high opacity under a pale crown — every flavour washed toward white, so ube came out barely purple
and matcha barely green. Bubbles are now tinted versions of the foam itself, with a bright crest
along the top edge and a **crisp dark underside**, which is what the photographs show: an opaque cap
meeting a much darker drink at a definite line. `FOAM_FRACTION` back up slightly to 15%.

**Verified:** typecheck clean, lint clean, both bundles compile, no reversing repeats remain, and
ice checked for cube size, wall/floor/surface containment and fill ratio at every size and level.

## 2026-09-30 (evening) — Iced body rebuilt from sampled photos, bases cut to three

**The iced body now matches the reference structure.** Sampling straight down the middle of the new
photographs gave it exactly: espresso over milk is solid coffee `#8b5429` for the top 40%, a
transition from 40–60%, then solid milk `#decfa8`. Two solid regions, one narrow soft band.

`DrinkBody` was rewritten to that shape — flat regions with a 20%-tall blend band, broken up by wide
faint ellipses so the meeting isn't a ruled line. Both previous attempts were wrong in instructive
ways: a gradient across the whole body read as a flat wash with nothing identifiable as milk or
coffee, and discrete drip shapes read as blobs pasted on a hard line. The photographs show
diffusion, not drips, and the regions either side have to stay flat.

**Bases cut to Cold Brew, Matcha and Americano.** Latte and macchiato removed. Bases now carry their
own `liquid` colour, because a matcha's body is green rather than coffee-coloured and nothing
downstream should special-case that. Verified: matcha renders green (`#82ba20`), americano and cold
brew dark.

`POPULAR` rebuilt around the three — Iced Matcha Latte, Salted Caramel Cold Brew, Iced Americano,
Ube Matcha, Vanilla Cold Brew — and the default and splash recipes repointed.

**Hot drinks no longer offer cold foam.** A hot coffee's foam is steamed into the milk rather than
poured over it. Gated centrally through `hasFoam(r)` — volume model, recipe line and controls — so
no caller has to remember to check `iced`.

**Steam left alone** at the user's request.

Note: a scripted edit to `coffee.ts` matched `id: 'vanilla'` in the syrups list instead of in
`POPULAR` and duplicated ~390 lines. Caught by checking that each top-level export appeared exactly
once. Worth anchoring such edits on something unique.

**Verified:** typecheck clean, lint clean, both bundles compile, and checks over base count, brew
hues, milk/brew separation per trending drink, and foam gating by temperature.

## 2026-09-30 (later) — Milk/coffee legibility, foam flavours, macchiato fixed

**Fixed a real modelling bug behind the odd macchiato colour.** Milk was "whatever volume is left",
so a macchiato — two shots marked with a spoon of foam — came out as a cup of milk and rendered
pale. `BASES` now carries `milkShare`, capping milk per base (latte 0.74, cold brew 0.30, macchiato
0.14, americano 0.10); whatever milk doesn't claim is brewed coffee or hot water, both dark.
Espresso-forward drinks now read dark: macchiato luma 84, americano 65, cold brew 84, against a
latte's 127.

**Iced drinks show milk, coffee and foam as three legible things.** The smooth gradient read as a
flat wash. New `icedComposition` + `DrinkBody`: milk fills the cup, coffee is laid over the top with
an irregular trickling boundary, and tongues of coffee run down into the milk — which is what the
reference photographs show. A 2-shot oat biscoff gives milk `#EFE0C4` against coffee `#4e2507` with
a 38% coffee band; a milkless drink goes to 84%.

This is not a return to the old layer cake: those were hard-edged bands in the wrong order, this is
two liquids with an organic boundary.

**Cold foam has its own flavour.** `FOAMS` — sweet cream, vanilla, salted caramel, ube, matcha,
pistachio, strawberry — with `recipe.foam` selecting one, a control on the drink sheet, and barista
parsing. Colour now comes from the foam's flavour, **not the drink's syrup**: plain foam on a latte
is milk foam and should look like it, while ube foam is purple whatever is underneath. Only sweet
cream keeps a contrast guard, since a flavoured foam already differs in hue.

**Foam reads as foam.** `FOAM_FRACTION` 16% → 11.5% (narrower, as asked — height was never what
made it read as foam), and the froth rebuilt as densely packed micro-bubbles with a bright crown at
the top thinning downward, plus a drawn underside so the cap visibly sits *on* the drink instead of
fading into it.

**Steam now has contrast.** It was white on a near-white cream background and vanished. Each wisp is
now a warm grey ribbon with a thin white core — against a light background, vapour has to sit
*darker* to read at all.

**Verified:** typecheck clean, lint clean, both bundles compile, and checks over espresso-forward
darkness, milk/coffee separation (311 for a 2-shot latte) and every foam flavour's distance from the
drink.

## 2026-09-30 — Colours matched to the reference photos, mug rebuilt, steam redone

**Colour mixing corrected against sampled reference colours.** Pulling pixels out of
`references/coffee/` showed our drinks were washed out and far too light: a real iced latte runs
`#522b11` → `#a08a6f` (luma 49 → 141, chroma 49–74), while we produced `#76604a` → `#c7b499`
(99 → 182, chroma 52) — twice as bright at the top and noticeably greyer.

Two fixes. `PIGMENT` espresso 1.9 → 3.1 and syrup 1.4 → 1.7, so the coffee actually darkens the
cup. And a new `CHROMA_LIFT`: averaging dark espresso with pale milk in sRGB produces grey-brown
mud because pigment mixing isn't a linear average, so `saturate()` restores the warmth afterward.
The lift scales with darkness — a pale milk drink pushed as hard as a dark one turns an unpleasant
yellow.

A 2-shot latte now runs luma 61 → 122 → 162 at chroma 62, sitting inside the reference band. Foam
contrast re-verified across all 90 milk/syrup/shot combinations.

**Rebuilt the hot mug from the new reference photo.** The previous one was a tall narrow cylinder
with a small heart floating on it. Measured proportions now match the photograph within 1%: rim
width ÷ body height 1.02 (ref 1.03), rim ry ÷ rx 0.28 (ref 0.28), saucer rx ÷ rim rx 1.56 (ref
1.56). Materials too — a dark glazed lip bleeding down into speckled cream stoneware, a small round
handle set high, and a deep saucer with a raised rim and well, instead of flat ceramic on a disc.

**Latte art rewritten in unit space.** It's now authored in a −1..1 box and scaled onto the crema
ellipse, so it cannot escape the surface. The previous rosetta ran to ±83 units inside a surface
only ±24 tall — it would have spilled over the rim. The default pour is a full rosetta (heart plus
five feathered leaf pairs) rather than a lone heart. No strokes in the art: the group's scale is
non-uniform and would smear stroke weight along one axis, so the stem is a filled taper.

**Steam redone as curling ribbons.** It was opaque rounded rectangles translating upward, which
reads as objects sliding, not vapour. Each wisp is now an S-curve path that rises while it grows,
leans, and thins out, on its own period. The growth and lean are what sell it.

**Verified:** typecheck clean, lint clean, both bundles compile, colours compared against sampled
reference values, mug proportions checked against measured photo ratios, and every art motif
checked for containment within the crema ellipse.

## 2026-09-29 (evening) — Hot drinks get latte art, iced drinks get a gradient

Driven by the photographs now in `references/coffee/`. An iced coffee is shot side-on with the
espresso marbling down through the milk; a hot coffee is shot from above, where the subject is the
crema surface and the art poured into it.

**Hot drinks have their own view.** New `LatteArtCup`: a ceramic mug with handle and saucer seen
from above, a crema disc, latte art, and steam. The pour is picked from the recipe — `dot` for a
macchiato, `tulip` for mocha or 3+ shots, `heart` otherwise, and none at all without milk, since
you can't pour art without microfoam. Crema takes `drinkColor`, so a third shot pours a darker
surface. Art is drawn inside a `G` scaled to the surface ellipse's ratio so it sits in perspective.

`HeroCup` and `DrinkRender` are now plain switches with no hooks of their own, so hot and iced
branches never run each other's hooks conditionally, and every caller gets the right view.

**Iced drinks are a gradient, not a flat fill.** `drinkGradient` returns three stops around
`drinkColor` — darker at top, mixed in the middle, milk-ward at the bottom — with the spread scaled
to how much espresso is in the cup. A 2-shot biscoff latte spans `#76604a` → `#c7b499` (83 luma); a
shot-free drink or a milkless cold brew comes out flat, which is right, because there's nothing to
separate. Added `expo-linear-gradient` for the animated body; the thumbnail uses an SVG gradient.

**"Thicker" foam was the wrong reading.** It meant viscosity, not band height — making the band
taller just ate the drink. `FOAM_FRACTION` back to 16%, and density moved into behaviour:
`WaveSurface` takes a `viscous` flag that halves the amplitude, more than doubles the period, and
cuts tilt response to a third, so the cap moves in slow shallow swells while the drink ripples
under it.

**Fixed colour leaking out of the loading-screen cup.** The wave band is deliberately twice the
container width so it can loop, and the frame only covers the box *minus* the cup interior — so
anything reaching outside the box was never covered. On a full-width hero that overflow ran
off-screen harmlessly, but on the splash, where the cup is 64% of the screen, it spilled beside the
cup. The liquid is now clipped to the cup's box, with steam rendered outside that wrapper since it
belongs above the rim.

**Removed the left vertical highlight band** on the glass. As a drawn shape it read as a band stuck
on the cup rather than as light.

**Verified:** typecheck clean, lint clean, both bundles compile, gradient stop order and spread
checked across drinks.

## 2026-09-29 (later) — Cup fills properly, calmer motion, thick foam, bigger ice

**Fixed the cup being part-empty.** Height normalisation divided by *total* volume including ice,
but ice is drawn as an overlay rather than a band — so with regular ice the liquid filled only 68%
of the cup and the empty-glass colour showed through the rest. Both renderers now normalise on
liquid volume only, so ice and drink together fill the cup. This was almost certainly the odd
"bottom area".

**Removed the drifting light bands.** They read as a strip travelling around the cup, not as liquid.
Bubbles went from seven to four and subtler, and the foam seam's amplitude came down. What's left is
the surface wave plus a slow sway of the whole body — enough to feel like liquid without looking
busy. Restraint is the point; every extra loop made it worse.

**Cold foam is thick now** — `FOAM_FRACTION` 13% → 21%, so it's a head rather than a film — and it
has **froth**: a scatter of light and dark bubbles inside the cap, in both renderers. Static on
purpose, because foam sitting still while the drink moves under it is part of reading it as foam.

**Ice cubes are bigger and the bed reaches halfway.** Regular (10 cubes) now fills 42–54% of the
drink's height and light (5) fills 33–42%. Cube size and row count fight each other here: three to a
row sent the bed to 83%, and shrinking cubes to fix the height stopped them reading as ice. Four to a
row with a tight row gap satisfies both. Alternate rows are brick-offset so a packed bed doesn't look
like a grid. Cubes overlap at this size, which is intended — packed ice is jumbled.

**Calmer loading screen.** Four status lines down to three at a slower cadence, one entrance for the
title block instead of per-line, and the splash cup now pours with **no ice** — ten cubes bobbing
while the cup fills and the text cycles was the "all over the place" problem. The pour is the only
thing moving.

**Verified:** typecheck clean, lint clean, both bundles compile. Fill confirmed exact (347.4/347.4 px)
at every ice/foam combination, and the ice bed re-measured across every size and level for wall,
floor, surface and bed-height bounds.

## 2026-09-29 — Drinks are mixed, not layered; foam made visible; ice counts

**The cup is one mixed drink now, not a layer cake.** The old model stacked a syrup band under a
milk band under an espresso band, which isn't what a latte looks like. `drinkColor(recipe)` blends
espresso, syrup and milk by volume into a single shade, and `layersFor` returns at most `body`,
`foam` and the `ice` overlay.

The part that makes it work is `PIGMENT`: espresso counts 1.9× per ounce and syrup 1.4× against
milk's 1×. A plain volume average washes out, because two shots is only an eighth of a 16oz cup
while the drink is obviously coffee-coloured. With the multipliers, shot count reads directly:
0 shots `#e8d4b4`, 2 shots `#a58f75`, 3 shots `#8c755d`, 5 shots `#624b36`.

**Cold foam is visible.** It was plain white against near-white milk. `foamColor` now builds from
the milk over a warm cream floor, tints toward the syrup (pistachio foam green, biscoff gold), and
sets luminance to sit at least 40 from the body.

Two things went wrong on the way and are worth remembering:

- Iteratively mixing toward a light or dark target only *converges* on it, so on pale drinks the
  foam ran out of loop iterations 6 luma short of its threshold. Replaced with `withLuma`, which
  rescales RGB to hit the target exactly — luminance is linear in RGB, so one multiply does it.
- A *lighter* foam can't contrast with an already-pale 0-shot drink. The direction now flips:
  creamy against dark drinks, deeper and warmer against pale ones, where it reads as a caramel cap.

Verified across 540 milk/syrup/shot/pump combinations, all ≥40 luma apart. Both renderers also
draw a darker seam stroke under the foam boundary so the edge holds where tones are closest.

**Motion is drink-wise now.** With one body there's only one internal boundary (foam against
drink), so `LayerBoundary` animates that single seam instead of a stack. Currents are confined
below the foam — foam floats, it doesn't move with the drink. The layer-wise wobble was a symptom
of the layer-cake model, so fixing the model fixed the motion.

**Ice:** regular is 10 cubes, light is 5, and **No ice** is a new option (a real order on an iced
drink — cold, no cubes). `iceBed` now lays rows of four, each row centred on its own count so a
short top row doesn't bunch to the left, with cubes at 21% of base width so ten still fit below
the halfway line. The barista understands "no ice", "hold the ice", "skip the ice".

**Cup shadow** moved lower, from `baseRy × 0.55` to `× 1.35` below the base, so it reads as the
counter rather than as part of the cup.

**Verified:** typecheck clean, lint clean, both bundles compile, colour model checked over 540
combos, ice bed checked over every size/level for wall, floor, surface and bed-height bounds.

## 2026-09-28 (night) — Dusting removed, the whole liquid body animates

**Removed dusting entirely** — the field, the control, the rendering, the catalog and its parsing.
Removed end to end rather than just hiding the control, because a `Recipe` field nothing can change
is worse than no field. Tile copy that mentioned cinnamon/cocoa dusting was rewritten.

**The liquid body animates, not just the surface.** Previously only the top wave moved, so the
drink looked like a stack of blocks with a wavy lid while ice bobbed around inside it. Added:

- `LayerBoundary` — every internal layer boundary now rocks, drifts and squashes on its own phase
  and period. Distinct periods per layer is the part that matters; identical timing makes the bands
  look bolted together.
- `Current` — three faint light bands drifting up through the body at different depths and speeds.
- A continuous slow sway on the whole body, so it's never perfectly still between slosh events.

Thumbnails stay static deliberately: five animated cups on the home shelf is a lot of work for a
152pt picture.

**Two barista bugs found by testing the parser outside the app.**

- "light ice please" was returning a cold brew with no espresso. The "something light /
  refreshing" mood rule matched on a bare `'light '`, which collides with "light ice". Narrowed to
  `'something light'` / `'light drink'`.
- Replies listed slots that hadn't actually changed — "Over ice and light ice" on a drink that was
  already iced. `describeChanges` now filters the patch to fields whose value genuinely moved, so
  a mood setting five slots only reports the ones that differ. A consequence worth knowing: asking
  for something the drink already is now returns no changes, so curate stays put and asks rather
  than claiming it did something.
- Also added base changes to the reply, which were silently omitted before.

**Verified:** typecheck clean, lint clean, both bundles compile, and the parser re-run over the ice
and mood phrases.

## 2026-09-28 (evening) — Shadows reverted, ice bed, ice/sweetness options, info button

**Reverted the shadows.** The dark-edged cylinder gradient and the radial vignette added earlier
were desaturating every drink — a Biscoff latte looked like Biscoff in a dim room. Both removed.
Nothing dark is drawn over the interior any more; every overlay is white, and roundness comes
from the geometry instead. The only dark mark left is the contact shadow on the counter, which
is outside the cup. The base ellipse lost its dark fill and gained a light catch along the floor.

Rule going forward: **depth from light, never shadow over the drink.** The liquid's colour is
the product.

**Ice sits in a bed at the bottom** instead of floating through the drink. New
`iceBed(geo, surfaceY, count)` in `cup.ts` lays cubes in rows from the base up, each row inset to
the taper at its own depth so none crosses the wall, stopping before it breaks the surface. Used
by both renderers. Cube size ended at 26% of the base width — at 29% six cubes in a 12oz hero cup
stacked to exactly the drink's midpoint, which was chunkier than a bed should look.

**Ice level is a new `Recipe` field** (`light` | `regular`), because it changes volume: 17% of the
cup against 32%, and milk is the remainder, so light ice means visibly more drink. The barista
understands "light ice", "less ice", "extra ice".

**Sweetness presets** (Less sweet / Regular / Extra) added to the drink sheet. Deliberately *not*
a new field — they set `pumps`, so the presets and the stepper share one number and can't
disagree.

**Hot drinks read hot.** Steam went from three wisps to four, taller and slower, rising off the
lid and scaled to the cup. The static thumbnail now draws steam curls too, so a hot drink is
recognisable in a tile.

**Bigger dome.** Lid height went from 10% of cup width to 14.5% (cold) and 5% to 8.5% (hot). The
body's reference headroom moved with it so cup bodies stayed the same size.

**Info button replaces hold-to-read.** A tapped `i` in the tile corner toggles the description
over the cup; tapping the overlay dismisses. It's a nested `Pressable`, so it doesn't open the
drink.

**Drink titles no longer truncate.** Cards widened to 176pt, names shortened ("Pistachio Cold
Foam Brew" → "Pistachio Cold Brew", "Traditional Macchiato" → "Classic Macchiato"), line height
raised to 21, and `adjustsFontSizeToFit` added as a backstop.

**Verified:** typecheck clean, lint clean, both bundles compile, and every size/level combination
checked for cubes staying inside the tapered wall, above the floor, below the surface, and in the
lower half of the drink — plus the bigger dome's apex staying on canvas.

## 2026-09-28 (later still) — Cups read as solid, straws removed, tile copy fixed

**Removed the straw** from the geometry and the vessel.

**Made the cup look like an object rather than a diagram.** The flat read came from three
things, none of them about detail level: a flat bottom edge, straight layer boundaries, and flat
shading. Fixed in that order of importance.

- The base is now an ellipse. The wall runs down to where it starts and a symmetric cubic
  carries it across, control points at 4/3 of the radius so the curve bottoms out at `baseY`.
- Every layer boundary is an ellipse sized to the taper at its depth, via new `capRy` and
  `halfAt(t)` on the geometry. In the thumbnail they're a second pass after the rectangles so a
  surface can bulge into the band above; in the hero cup each ellipse lives inside its own
  band's View so it travels with the pour rather than sitting still while the liquid moves.
- Added cylinder shading across the width, an inner vignette hugging the walls, and a second
  ellipse at the rim so the plastic has thickness. The lid got its own gradient, seam and
  highlight.

The blown highlight had to become a tapered quad following the wall. As a straight strip its
lower end poked out through the wall, where the cup has narrowed.

**Ice now tumbles.** `scaleX` oscillates alongside the rotation, which reads as a cube turning
in liquid instead of a square spinning flat against the screen.

**Tile copy.** Descriptions were prose in a 168pt box, so they truncated. `POPULAR` now carries
`note` (a tag line that fits one line) and `detail` (the full sentence). Holding a tile fades
`detail` in over the cup — touch has no hover, so a long press is the equivalent gesture — with
a "Hold to read" hint in the shelf header. Tile text is also centred now; left-aligned text
under a centred cup is what made the tiles look unresolved.

**Verified:** typecheck clean, lint clean, iOS and web bundles compile, and every size/style
combination re-checked against canvas bounds plus taper direction, base-ellipse placement and
cap plausibility.

## 2026-09-28 (later) — Cold cup redesign, opening pour, consistent tiles

**New vessel.** The cup is now a clear tapered cold cup with a rolled lip, molded rings, a domed
lid and a kraft straw, instead of a generic tumbler. Hot drinks reuse the same body with a low
flat lid and no straw — an opaque paper cup would hide the layers.

No café branding: the silhouette is generic, logos and trademarked straw colours are not.

**Extracted `CupChrome.tsx`.** Everything that isn't liquid now lives in one component used by
both renderers, so the thumbnail and the hero cup cannot draw different vessels.

**Fixed three sources of size inconsistency.**

1. `DrinkRender` now takes an optional `size`, and the trending shelf passes 16 so every tile
   shows the same reference cup. Previously a 20oz cold brew tile drew a visibly bigger cup than
   a 12oz macchiato beside it.
2. Hot cups were coming out **14% taller than cold cups at the same size**, because a straw and
   dome reserve headroom a flat lid doesn't, and each style was sized against its own. Bodies are
   now sized against the cold cup's headroom whatever the style. Caught by checking the geometry
   numerically rather than by eye — same volume has to look like the same cup.
3. Tiles are laid out from constants, not content. Fixed card height, a fixed art well the cups
   bottom-align in, and text blocks whose heights equal their line counts. A one-line name and a
   two-line name now produce identical cards.

**Opening screen.** `index.tsx` is now the loading pour and `home.tsx` is the home screen. The
loader is `LiquidCup` pouring a real recipe, not a separate animation, so the first thing a guest
sees is the thing the app does. Four café status lines, a progress track, then `router.replace`
to `/home` so it never lands in the back stack. About 2.8 seconds.

**SVG ids are now per-instance.** Ids are document-global on web, so five thumbnails sharing
`id="cup"` would all clip to the first one. Both renderers derive ids from `useId()`. This was
latent before web support existed and would have broken the shelf in the browser.

**Verified:** typecheck clean, lint clean, iOS and web bundles both compile, and every
size/style combination checked against its canvas bounds (straw tip, lid width, positive fill
height, straw staying inside the tapered wall).

## 2026-09-28 — Browser preview for faster iteration

**Added web support** so the render can be judged on the PC without scanning a QR each time:
`npx expo install react-dom react-native-web @expo/metro-runtime`. Verified with
`npx expo export --platform web`; Reanimated and `react-native-svg` both support web on SDK 57.

Run with `npm run web`, or press `w` in an already-running dev server.

The gotcha worth remembering: **enable browser device emulation first.** `LiquidCup` sizes from
`useWindowDimensions` at 82% of window width, so a maximized desktop window draws a cup wide
enough to be meaningless. See [ARCHITECTURE.md](ARCHITECTURE.md) for what the browser is and
isn't trustworthy for.

## 2026-09-25 (later still) — Live preview while editing

**Added a floating live cup to the drink page.** The hero cup always tracked the recipe, but
an expanded adjustment sheet covers most of it, so edits happened blind. `LivePreview` is a
small `DrinkRender` in a floating card pinned just above the sheet's top edge; it rides the
same animated value as the sheet, fades in as it opens, and pops in scale on every change so a
chip tap is acknowledged even though the big cup is hidden.

It reads the same `Recipe` as the hero cup rather than keeping its own copy, so the small and
large renders cannot disagree.

No change was needed to make edits "apply" to the main cup — it already re-renders and sloshes
on every recipe change. The problem was only that it was covered.

**Verified:** typecheck clean, lint clean, iOS bundle 1584 modules.

## 2026-09-25 (later) — Curate is text-first, and a layout bug fixed

**Fixed: nothing appeared when tapping a suggestion.** The parser was never at fault —
verified outside the app by compiling `barista.ts` to plain JS and running every suggestion
through it. The transcript `ScrollView` had no `flex: 1`, so it sized to its content instead
of the screen, grew past the bottom edge, and every new message rendered off-screen. Nothing
was scrollable, so `scrollToEnd` did nothing either.

Worth remembering: a `ScrollView` in a flex column needs an explicit `flex: 1` on its
**style**, not only on `contentContainerStyle`, or it silently stops being a viewport.

**Replaced the chat loop with a single utterance.** The guest types one description, taps
"Pour it", and a curating screen hands off to the cup. Reasons: one utterance to one drink is
a stronger first impression than a back-and-forth; refinement already has a home on the cup
page; and it removes the need for the guest to know to say "that's it" to proceed.

- Suggestion chips now **fill the input** instead of sending, so they can be edited and
  stacked ("Something nutty, less sweet").
- The curating screen's steps come from the real recipe patch via the newly exported
  `describeChanges`, so it narrates what actually changed rather than showing a decorative
  loader.
- If nothing parses, the screen stays put, shows the barista's question, and shakes the
  input. It deliberately does not navigate — handing over an unchanged cup would read as the
  app ignoring the guest.
- Leaves with `router.replace` so the curating screen never lands in the back stack.

**Lint note:** `react-hooks/immutability` rejects writing a Reanimated shared value inside an
async handler. The input shake is therefore driven by a counter in state with the actual
write in a `useEffect`.

**Verified:** typecheck clean, lint clean, iOS bundle 1584 modules.

## 2026-09-25 — Navigation, barista chat, animated hero cup

**Restructured onto Expo Router.** `AGENTS.md` requires it. `package.json` `main` is now
`expo-router/entry`, `App.tsx` and `index.ts` are gone, and screens live in `src/app/`.
Added `scheme: "brewprint"` and `experiments.typedRoutes` to `app.json`.

Installed per the SDK 57 docs: `expo-router`, `react-native-safe-area-context`,
`react-native-screens`, `expo-linking`, `expo-constants`, `react-native-reanimated`,
`react-native-worklets`. No `babel.config.js` was created — `babel-preset-expo` configures
the Reanimated plugin automatically in SDK 57.

**Three screens.**

- `index.tsx` — time-aware greeting, "What would you like to drink today?", a horizontal
  shelf of five trending drinks rendered as real cups with labels, and a "Curate your drink"
  call to action. Cards stagger in on mount.
- `curate.tsx` — the barista conversation. Message bubbles, a typing indicator, tappable
  suggestion chips, a live Universal Recipe readout, and a cup thumbnail in the header that
  updates as slots fill. Saying "that's it" sends you to the render.
- `drink.tsx` — the hero cup filling the screen, with an adjustment sheet that expands from
  a 104pt peek to 62% of the screen.

**Animated cup (`LiquidCup.tsx`).** Waves, pour-on-open, slosh-on-change, carried tilt,
rising bubbles, bobbing ice, and steam for hot drinks. Taken as direction from how
WaterLlama moves liquid.

The technique worth knowing: the animated parts are plain Views, which cannot be clipped to
a tapered shape, so the cup is carved out by an even-odd SVG frame drawn on top in the
background colour. This means the background behind the hero cup must stay a flat colour.

**Barista brain (`barista.ts`).** A `BaristaBrain` interface with one deterministic
slot-filling implementation. Handles moods ("something nutty"), relative nudges ("less
sweet", "stronger") and absolutes ("16oz", "3 pumps", "oat").

Decided against a bundled LLM for now. Ordering coffee is closed-domain slot filling over
~40 words; a quantized 1B model would be slower, ~600MB larger, less accurate at it, and
would require a development build and therefore an Apple Developer account. When a model is
warranted, Apple Foundation Models (iOS 26+) is the pick because it ships no model file.

**Shared state.** `RecipeContext` holds one working recipe across all three screens.

**Fixed a lint error** in `DrinkRender.tsx`: a running offset was reassigned inside a `.map`
callback during render, which `react-hooks/immutability` rejects. Rewritten as a plain loop.

**Verified:** `npx tsc --noEmit` clean, `npx expo lint` clean, `npx expo export --platform
ios` bundles 1584 modules.

Note: `npx expo lint` self-configures ESLint on first run and its install failed on an
optional `react-dom` peer conflict. `npm install --legacy-peer-deps` resolved it.

## 2026-09-24 — Render engine and project setup

**Scaffolded the app.** Expo SDK 57 with the blank TypeScript template, plus
`react-native-svg`. Moved `BrewPrint_App_Plan.docx` into `docs/`.

**Built the render engine** as deterministic layered SVG rather than AI image generation.
Volumes are real: 1 oz per shot, 0.25 oz per pump, ice displaces ~32%, milk is the
remainder.

The reasoning: the product promise is that the picture is an exact spec a barista can
reproduce. An image model has no concept of a pump, so it cannot draw "2 pumps" differently
from "3 pumps" on purpose, and it adds cost and seconds of latency to a control the guest
taps repeatedly. Generative imagery stays available for decorative edges — shareable social
cards, seasonal backdrops, latte art on the foam cap.

**Structural decision:** `coffee.ts` contains no UI. The render, the Barista Pass, and later
the café matcher all read one `Recipe` type.

**Environment.** Windows 11, so iOS builds can never happen locally — Xcode is macOS only.
Development runs through Expo Go on a physical iPhone; EAS will handle cloud builds later.

Resolved a chain of Expo auth problems along the way:

- `npx expo login -b` crashes on Windows. Expo CLI runs `cmd.exe /c start "" <url>` without
  quoting, and `cmd` treats `&` in the URL as a command separator.
- `EXPO_TOKEN` overrides every other login method, so a stale robot token silently won every
  attempt to log in as a personal account.
- `setx` only affects new terminals, which made the stale token look cleared when it wasn't.
- Expo's `--sso` flag is for enterprise identity providers (Okta, Entra ID, Google
  Workspace), not for accounts created with the Google sign-in button.

## Open questions

- **Test the Barista Pass on real baristas.** Write an order on paper, hand it to three
  shops in Frisco, see what happens. Costs three coffees; it is the riskiest assumption in
  the product.
- Which Frisco radius to seed? Downtown Rail District, The Star, and Legacy West in Plano
  are the denser pockets. Frisco is chain-heavy, which cuts both ways: fewer independents,
  but chains have consistent published inventories.
- Keep the name BrewPrint over "The Visual Coffee Lab"? Assumed yes.
