# BRIEF — 橘猫巡场 / F1yingCat 站点门户

> Design harness record. Source of truth for the critic in Phase 2.

## Phase 1 status — SKIPPED (deliberate)

The visual direction was already fixed by the user before the harness ran, so the Discover
phase was skipped per the skill's own rule ("If the user named a style, mood, or reference,
skip Phase 1 and start at Phase 2"). The user supplied:

- bold **pixel art** theme, "stunning graphics"
- every section must feel like **a still from a video game**
- the whole thing must **still function as a landing page**
- protagonist is a **中华田园橘猫** (Chinese domestic orange cat)

No seed was generated. Nothing random leaked into the output.

## What the product actually is

There is no separate SaaS product. The "app" is **the site itself**, presented as a
navigable world. The orange cat is the protagonist who walks between the site's pages.

Real destinations, all of which exist in this repo today:

| Zone | File | What it is |
|---|---|---|
| 主博客 | `index.html` | post list (this page replaces it) |
| 标签 / 搜索 | `tag.html` | Gmeek tag + search page |
| 文章 | `post/*.html` | 3 real posts (see Stage Select) |
| 行情看板 | `MarketViewer.html` | market dashboard app |
| 盘前速览 | `premarket.html` | daily 08:45 Beijing pre-market brief |
| 行情数据 | `data/{premarket,intraday,postmarket}/latest.json` | 3 data channels |
| RSS | `rss.xml` | feed |

**Extensibility is a requirement, not a nice-to-have.** The user said more pages will be added.
Every destination is declared once in a `PORTAL` config object at the top of the script, and the
Stage Select / World Map / Terminal all render from it. Adding a page = adding one entry. This
mirrors the pattern the repo already uses in `docs/data/manifest.json`.

## Direction

A **vertical game world** rather than a stack of marketing sections. The camera scrolls down
through five dioramas; the cat moves between them. Game UI chrome — HUD panels, dialogue boxes,
level nodes, a CRT terminal — carries all the real landing-page content, so the "video game
still" reading and the "working landing page" reading are the same thing rather than a fight
between them.

The page is **asymmetric on purpose**: full-bleed scene, then map-left/HUD-right, then an
irregular chapter-select board, then a centred CRT. It is not three identical cards, and it is
not centred-everything.

## Non-negotiables

- **Real pixel art**, not a retro filter. Sprites are authored as character grids and painted
  at 1px-per-cell to canvas, scaled up with `image-rendering: pixelated`. No smooth SVG, no
  blurred blobs, no gradient blobs standing in for artwork.
- **The cat must read as 中华田园橘猫**: ginger body, cream chest and muzzle, forehead M-stripe,
  ringed tail, small round ears. Not a generic orange cat, not a cartoon.
- **Every section does real work.** Real links, real post titles, real dates, real labels. A
  section that only looks good gets cut in Phase 3.
- **中文为主**, English only as short pixel-font accents (PRESS START / STAGE SELECT / LEVEL).
- Hard-rejected: purple gradient, glassmorphism, glow with no job, pill CTAs, three identical
  cards, centred-everything, filler copy ("赋能 / 无缝 / 释放潜力").

## Palette

### UI / semantic (12, enforced)

| Token | Hex | Job |
|---|---|---|
| `--ink` | `#14121c` | outlines, night sky top |
| `--ink-2` | `#241f31` | panel fills |
| `--dusk` | `#3b3350` | mid sky |
| `--stone` | `#6b6288` | horizon, secondary text |
| `--paper` | `#f2ece0` | body text |
| `--cream` | `#fffaf0` | headline text, cat chest |
| `--amber` | `#ffb03b` | primary accent, cat highlight |
| `--orange` | `#ef7c2a` | cat body, brand |
| `--rust` | `#bf4f1c` | cat stripes, shadows |
| `--up` | `#dd4436` | **涨** |
| `--down` | `#5fbf6a` | **跌** |
| `--azure` | `#4aa3d4` | links, 盘中 |

**Correction made in round 2 — the up/down mapping was backwards.**
Round 1 declared jade = 涨 and crimson = 跌. That is wrong for this site. The site's own
data declares `↑ 红涨 / 绿跌` in `docs/data/premarket/latest.json` (`legend` field) and its
chart colours confirm it: negative values are `#1a9e57` (green), positive are `#e23c3c` (red).
This is the A-share convention. Crimson is now 涨, jade is 跌, and the terminal renders real
quotes with that mapping. The round-1 critic independently caught the symptom (jade on 16px,
crimson on 206px — "the two semantic colours are effectively absent"); the root cause was the
mapping, not the usage.

### Terrain (6, declared — used only inside the map and stage-board artwork)

`#1e3a34` `#26483d` `#2f5648` (night ground) · `#16293f` `#1d3a55` (water) · `#6e2c08` (cat outline)

These are declared rather than improvised, and they are deliberately low-saturation teal so they
do not read as the semantic "涨绿". A tree and a road are still a tree and a road, but the
ground never competes with a number.

## Type roles

- English display / UI accents → **Press Start 2P**, embedded as base64 woff2 (12.4 KB) so the
  page is fully self-contained and does not depend on any CDN.
- Chinese → bold system sans. Chinese is *not* set in a pixel font (no practical CJK pixel face
  is small enough to ship), so the pixel read is carried by the artwork, the borders, the hard
  2px shadows, and the English accents. This is a deliberate trade, not an oversight.

## Animation (added round 3, at the user's request)

The user asked for a page that behaves like a running pixel game rather than a set of clickable
screens: "最终效果希望是那种带动画的，真的跟像素风游戏一样，猫走来走去的页面".

Chosen level: **A — ambient life with the cat as a real actor.** The cat moves on its own; the
links remain the primary interaction.

| Scene | The cat | Ambient motion |
|---|---|---|
| Title screen | Paces the rooftop left↔right, turns at the ends, pauses, blinks every ~3 s, kicks up dust pixels when moving | Stars breathe, ~300 city windows switch on and off, moon craters static |
| World map | Patrols a real route: hub → each of the four destinations → hub, hopping along the road, waiting 1.1 s at each stop | Water shimmer, destination markers pulse amber↔rust |
| Stage board | Walks the level path back and forth between the three flag platforms | Flags wave, grass is static |
| Save point | Curled up, breathing, emitting a rising Z | — |

Implementation:

- Static backgrounds are rendered **once** to an offscreen canvas; each frame only blits that and
  redraws the moving layer. Redrawing a dithered scene every frame costs far more and makes the
  ordered-dither pattern crawl.
- One `requestAnimationFrame` loop drives every scene. Scenes scrolled out of view are paused via
  `IntersectionObserver`; the loop stops entirely when the tab is hidden.
- `prefers-reduced-motion: reduce` renders exactly one settled frame and never starts the loop.
- The cat is a front-facing chibi sprite, mirrored horizontally when it walks left, and it moves by
  hopping rather than by a hand-authored side-view walk cycle. This was a deliberate call: a
  16×16 side-view walk cycle is expensive to author well and easy to get wrong, and a hopping
  front-facing cat is an established indie-game idiom that reads as "moving" immediately. The
  sprite is now validated by an automated check that every row is exactly 16 cells and every
  character exists in the palette — hand-counting produced four wrong rows before that check
  existed.
- The title canvas resolution is **derived from its container's aspect ratio** (`W = H × aspect`,
  with H re-derived when W hits a bound). A fixed 16:9 buffer under `object-fit:cover` cropped the
  cat clean off the left edge on narrow viewports.

## Hard rejection, added in round 2

A full-page CRT scanline overlay. It multiplied every third row by ~0.85, which sliced the 1px
art cells into 3px stripes and produced 22,917 unique colours on a 12-colour page. The brief
already banned "a retro filter"; the render was violating it. The overlay is gone and the page
now holds a flat, hard-edged palette.

## Copy (hand-written)

- 主标题: 橘猫巡场中
- 副标题: 一只中华田园橘猫，带你逛完这个站点的每一个角落。
- CTA: 出发 (→ World Map) / 看行情 (→ MarketViewer)
- Section heads: 猫已经走过的路 / 关卡选择 / 行情终端
- Footer: 猫在这儿打了个盹

## Deployment — how this survives Gmeek

**This is the single most important non-visual decision in the project.** `Gmeek.yml` runs
`cp -a /opt/Gmeek/docs ${{ github.workspace }}` on every run — daily at 16:00 UTC and on any
issue event — so it **replaces the entire `docs/` directory**, including `docs/index.html`. A
hand-written homepage is deleted on the next run. `STATUS.md` already records this lesson for
`premarket.html`.

The portal therefore lives at `static/index.html` (source of truth, never touched by Gmeek) and
is copied into `docs/index.html` by `market-viewer-sync.yml`, which already runs after Gmeek via
`workflow_run`. Three edits wire it up: `static/index.html` added to the push path filter, a
`cp static/index.html docs/index.html` line in the sync step, and `docs/index.html` added to
`git add`. The sync push writes only `docs/`, while the trigger watches `static/`, so it cannot
self-trigger.

Nothing is lost: the posts stay in `docs/post/*.html` and the portal links every one of them.
The Gmeek-generated article list is simply no longer the homepage.

Not pushed — the user asked for local work only.

## The protagonist

The critic's round-3 verdict was that the cat was "a generic blocky blob" — no tabby M, slot
eyes, no whiskers, and a silhouette that was a rounded square. All four were accurate at 16×16.

So the protagonist is now authored at **24×24** (`cat24`, plus a `cat24_blink` frame): inner ear,
a three-stroke tabby M across the forehead, 2×2 eyes with a single amber catchlight, cream muzzle
with a W mouth, whiskers, a cream bib, a notched paw gap, and a ringed tail that curls up the
right flank. The head is deliberately narrower than the body so the silhouette is not a box. The
old 16×16 `sit` sprite is kept only for the 20px header mark and the sleeping save-point cat,
where 24 cells would be noise.

Authoring it by hand at 24 cells produced eight rows of the wrong length. It was written instead
as run-length specs (`"4. 1K 1O 12o 1O 1K 2. 1K 1."`) expanded by a script, and a validator now
checks every sprite row's width and that every character exists in the palette. That check has
caught eleven separate mistakes; do not hand-type a sprite row without re-running it.

**A static validator cannot see the generated frames.** The eight walk/run frames are not source
literals — `mk(name, legs)` builds them at runtime as `BODY22.concat(BELLY, legs)`, so
`validate-sprites.ps1` reports 12/12 while those eight do not exist as far as it is concerned. A
second probe walks the live `SPR` object instead and is the only thing that covers them: it reports
21 sprites, `cat24_walk0-3` and `cat24_run0-3` at 28 rows x 24 cells each, and
`WIDTH/PALETTE PROBLEMS: NONE`. Two rules it taught: index sprite *names* through `SPR` (passing
the name iterates the string's characters and paints a column of letters — four identical cells),
and check that every row agrees with row 0 rather than that the sprite is 16 or 24 wide, because
`book`/`house`/`lock` are 16x16 header marks and `paw` is a 4x5 detail stamp.

## Architecture — 横向横版游戏（round 4，按用户要求重做）

The user rejected the vertical scrolling page: "我们可能整个页面不应该是纵向的一个网页，可能是一个看起来像横向的，整一个场景一样的，当我从第一个页面去到第二个页面时，直接跑过去，并且页面上的场景跟游戏一样随着猫跑动而移动显示，可能要利用h5?"

So the page is no longer a document. It is one fixed viewport containing a **single continuous
side-scrolling world**. H5 = one `<canvas>` plus one `requestAnimationFrame` loop; no page scroll
at all (`html,body{overflow:hidden}`).

| | |
|---|---|
| World | `2560 × 300` internal units, horizon at `y=190`, 4 zones of 640 |
| View | Viewport-sized canvas. Scale `S = max(1, min(vh/205, vw/330))` |
| Camera | `camX` eases toward `cat.x − CAT_SX`, clamped to the world |
| Cat | Pinned at 22–26% from the left edge; the **world** moves, not the cat |
| Controls | ←/→ or A/D walk · 1–4 teleport · drag on the canvas · wheel · nav buttons |
| Nav | Sets `cat.target`; the cat auto-runs there at 340 u/s and the camera pans with it |
| Deep links | `#z0`…`#z3` (and `?z=0`…`?z=3`) place the cat directly in that zone |
| Zones | 0 楼顶 (title) · 1 关卡草地 (posts) · 2 行情街区 (terminal) · 3 档案馆 (tags/RSS) |

**Vertical anchoring is the part that has to be got right.** The world strip is 300 units tall but
the viewport may be taller or shorter, so the horizon is pinned to the viewport (`groundY = 80% of
vh`, 55% on narrow screens) rather than to the world, and the strip is blitted at
`destY = groundY/S − GROUND`. The first version used `groundY − GROUND*S`, which mixes device
pixels with world units and lifted the whole scene off the ground. The cat and the dust particles
must additionally be offset by `destY`, since they are drawn into the same transformed space as
the strip.

**HUD panels** are real DOM (crisp text, working links, keyboard reachable) positioned each frame
in *screen* pixels rather than living inside a transformed world container. The cat is pinned
left; the panel is clamped to just past the cat's right edge and inside the viewport, and fades in
and out by the cat's distance from the zone centre — so running into an area feels like arriving.
Below 700px the panel becomes a bottom sheet and the scene keeps the top half.

A caveat worth recording: the FilePanel browser's own screenshot path intermittently drops the
panel layer when the tab is backgrounded (rAF is paused, so `positionPanels` never runs and the
panel stays at its CSS `opacity:0`). Headless captures render it correctly, and the DOM shows
correct position and opacity. It is a capture artifact, not a page defect — but verify in a
foreground tab or via `shot.ps1`.

## Critic record

- **Round 1 — 4/10.** "Neon-noir arcade HUD skin" rather than an authored game world. Named the
  full-page scanline filter (with pixel-level proof: every third row multiplied by ~0.85, 22,917
  unique colours on a 12-colour page), 59% of content pixels off-brief with 31% an invented green
  family, the stage sky as a gradient blob, the cat not reading as a 中华田园橘猫, the map as a
  placeholder X, 77% empty stage rows, identical section headers, a terminal with no real data.
  Highest-leverage call: delete the filter and the green artboards.
- **Round 2 — 5/10.** The filter was gone and the data was real, but the critic found the
  *root cause* of the missing 涨跌 colours: the mapping was inverted. The site's own data declares
  `↑ 红涨 / 绿跌`. Also named: dithered gradients as fill on the largest surfaces, no ringed tail
  on the cat, a hard black shadow slab, empty stage rows, and a 3.29:1 nav contrast.
- **Round 3 — 5/10, still FAIL.** The cat animation and the real terminal were credited. The
  genuinely actionable findings, all fixed: the **bar chart was rendering empty** (a dropped CSS
  rule left `<i>` inline, so its height was ignored — a real shipping bug the critic caught by
  looking), **icon canvases were anti-aliased** because `px/16` produced fractional scale factors,
  and therefore read as emoji, the map "trees" were stacked horizontal bars, the terrain
  ellipses had a jitter that read as a 143-row dither, and the `bug` tag was using the `up`
  token, which is crimson and semantically means "rose". Cat face improved with an eye catchlight
  and whiskers.

  One critic claim was checked and found false: a second empty chart frame named "成交额" does not
  exist in the page. One claim is recorded as a deliberate disagreement below.

## Disagreements with the critic, recorded rather than actioned

- **English kickers that translate the Chinese heading beneath them** (STAGE SELECT / 关卡选择).
  The critic calls this zero-information labelling. The user explicitly chose "中文为主 + 英文像素
  游戏点缀" — the bilingual kicker *is* the requested style device, and removing it would
  contradict the brief's own type roles. Kept.
- **The `STAGE 1-4 · RESERVED` slot.** The critic calls a dashed placeholder a shipping flaw. The
  user asked for a portal that grows as pages are added, and this is that promise made visible.
  Kept, but restyled from a dashed wireframe into a real locked-stage tile.
- **Displaying the real word counts (29 / 86 / 12 words).** The critic reads these as filler. They
  are the actual `wordCount` values from `blogBase.json`. The posts genuinely are that short —
  that is an honest property of this blog, not a design failure. Kept; the fake "READ n MIN"
  derived from them *was* removed.

## Horizontal build — defects found while finishing the parallax and run pass

Five real defects, all found by reading the code rather than by looking at a still. A static
screenshot cannot show any of them: three only exist between frames, and two only exist at
viewport widths nobody had captured.

- **Stale `puff()` call signature.** The dust emitter had been narrowed to `puff(y)` but one call
  site still passed `puff(cat.x, GROUND)`. JavaScript ignores the extra argument, so the dust was
  spawned at `y = cat.x` — up to ~160 world units above the ground — and it duplicated the correct
  emitter. Fixed, and `puff` now takes `dir` so the dust trails behind the cat instead of always
  drifting left when the cat runs right.
- **The landing squash could never render.** `sxK/syK` were switched on `hop > 0.8`, but the hop
  period is ~169 ms and `hop` peaks at 4.2·π. That threshold is true for ~94 % of the cycle and
  false for the ~6 ms around each touchdown — under one frame at 60 Hz. The cue that sells "running"
  rather than "sliding" was being dropped nearly every time. Replaced with a normalised
  `hopN` (0 at touchdown, 1 at apex) driving a continuous stretch/squash, so the squash is visible
  on every landing instead of occasionally.
- **Narrow-viewport breakpoint disagreed with the CSS.** The stylesheet switched panels to
  `width:auto; max-height:44vh` at `max-width:860px`, but the JS `narrow` test was `vw<700`. In the
  700–860 px band the panel therefore took the *desktop* positioning branch while already being
  auto-width: `offsetWidth` returned the full width, `x` clamped to the cat, and the panel covered
  the protagonist. Both are now `860`.
- **Narrow screens wasted the top third of the viewport.** `S` resolves to 1.18 at 390 px wide, so
  the 300-unit world strip is only ~354 px tall, and with the ground line at 0.55 vh roughly 280 px
  of empty flat sky sat above it. Ground line moved to 0.42 vh, which also lifts the cat clear of
  the bottom sheet instead of leaving it grazing the drawer's top edge.
- **Redundant `var DY` re-declaration** shadowed the value already bound at the top of `frame()`;
  removed.

Verification note: the in-app Browser panel cannot deliver key events to this page (two `press_key`
calls were reported `dispatched: true` and changed nothing, and two element refs went stale between
inspect and click), so the run behaviour was proved in headless Edge instead with a throwaway probe
page that called `goto(2)` and printed `cat.x` per frame. It shows `cat.x` advancing
320 → 325 → 331 with `target=1600` and `moving=1`, plus the camera panning and the sprite switching
from the sit pose to the leaning run pose — i.e. the cat traverses, it does not teleport. Headless
`--virtual-time-budget` does not drive `requestAnimationFrame` proportionally, so the probe only got
a handful of frames before the capture; that limits the test, it does not indicate a page fault.
Deep links (`#z2`, `?z=2`) are the one place a teleport is correct, and they are confined to `boot()`.

## Motion and accessibility pass

Re-reading the brief against the code turned up a requirement that had been assumed satisfied and
was not. The only `prefers-reduced-motion` rule in the file was a CSS line dropping transitions on
`.panel` and `.sprite`. That does nothing for this page, because essentially all of the motion is
painted into a canvas — a user with the reduced-motion preference still got a world that slides
sideways on its own, a cat that bounces and rocks continuously, and a camera that keeps drifting for
a beat after the cat has stopped. There was also no `visibilitychange` handling at all.

- **`prefers-reduced-motion` is now honoured in JS.** `RM.matches` disables the hop, the forward
  lean, the stretch/squash, the landing dust and the idle blink, and makes the camera snap to its
  goal instead of easing toward it. The cat still *travels* to wherever the visitor sends it —
  removing that would break the page rather than calm it, since the traversal is the navigation. What
  goes away is the decorative per-frame movement and, specifically, the camera's post-stop overshoot:
  easing means the world keeps sliding after input has ended, and that lingering drift is more likely
  to provoke vestibular discomfort than the movement the visitor actually asked for.
- **The loop stops when the tab is hidden.** Guarded by a generation counter rather than a plain
  `paused` flag. Browsers *suspend* a background tab's `requestAnimationFrame` callbacks rather than
  discarding them, so on returning, the suspended callback fires alongside the newly requested one.
  A naive `paused = false; requestAnimationFrame(frame)` therefore produces two concurrent loops and
  silently doubles the cat's speed. Each `schedule()` bumps the generation; stale callbacks see they
  are out of date and exit.
- **Frame-rate independence.** Every speed was hard-coded against an assumed 60 Hz — the run speed
  (`340*0.016`), the walk keys (`105*0.016`) and the dust integration. On a 120 or 144 Hz display the
  cat and the camera both moved at double speed. These now use a real `dt`, clamped to 50 ms so that
  a stall or a tab switch cannot produce one enormous jump. The camera's per-frame `0.14` lerp is
  converted to the equivalent `1 - (1-0.14)^(dt*60)` so its feel is unchanged at 60 Hz.
- **Copy fix.** The on-screen hint read `1-4 传送` ("teleport"). Pressing 1–4 makes the cat *run*; the
  word contradicted the entire premise of the build. Now `1-4 换区`.

Verified with a throwaway probe page under `shot.ps1`'s forced reduced-motion flag: it reports
`reducedMotion=true`, `cat.x` still advancing toward its target with `moving=1`, and `camLag=0.00`,
i.e. the camera carries the cat one-to-one with no drift. Console is clean at every level.

**Harness note:** `shot.ps1` skips its `Test-Path` check only for `file://` and `http(s)` inputs. A raw
path such as `index.html?v=10#z1` fails with "Input not found", because the query and fragment are
part of the *URL*, not the filename. Always pass the `file:///C:/...` form for a versioned or
deep-linked capture.

## Keyboard and content-reachability pass

The panels fade in and out with `opacity`, and `positionPanels` set `pointer-events:none` on the
faded ones. That handles the mouse and nothing else. A probe that walked the real DOM reported:

```
viewport 639x683, cat in zone 1
panel  opacity  scrollH  clientH  hidden  focusables
  p0    0.00      250      250       0        2
  p1    1.00      328      296      32        3   <- the only visible one
  p2    0.00      707      296     411        3
  p3    0.00      353      296      57        3

links in the tab order: 11      links actually visible: 3
```

Eight links at `opacity: 0` were still in the tab sequence. A keyboard user tabs through eight
invisible targets and activating one navigates away from a page they cannot see. `pointer-events`
does not remove anything from the tab order; only `visibility` or `inert` does.

- **Faded panels are now `visibility:hidden`.** `visibility` was added to the panel's transition
  list, so the fade-out still plays and the panel only leaves the focus tree once it is invisible.
- **Truncation is now signalled.** The market panel puts 707 px of content into 296 px — 58 %
  below the fold on a phone, where there is no visible scrollbar at all. Each panel ends with a
  `position:sticky` pixel chip reading `▾ 下滑看更多`, shown only while the panel actually
  overflows and hidden again once the visitor reaches the bottom. Hard-edged and in Press Start 2P,
  rather than a soft gradient scrim, to match the rest of the art. Overflow depends on `vh` through
  `max-height`, so the measurement is recomputed on every resize.

Two further defects surfaced while fixing the chip, both introduced by the chip itself and both
caught only by measuring geometry rather than by looking:

- **A horizontal scrollbar appeared on every panel.** `.panel` declared only `overflow-y:auto`, and
  per CSS a `visible` `overflow-x` on the other axis computes to `auto` — so the chip's `-18px`
  bleeding margins, 3 px of overflow, produced a 14.8 px horizontal scrollbar that silently ate
  vertical space. Fixed with an explicit `overflow-x:hidden`.
- **The chip floated 30.6 px above the panel's bottom edge**, leaving a gap through which the bar
  chart's category labels showed. `position:sticky` resolves against the *content* box, not the
  padding box, so `bottom:0` parks the chip above the panel's bottom padding. The panel's bottom
  padding is now a `--padb` custom property and the chip offsets by `calc(-1 * var(--padb))`; it
  had to be set on `.panel--title` as well, since its `padding` shorthand would otherwise reset it.

Measured after the fix: gap below the chip 30.6 → **2.4 px** (the border width, i.e. flush), and
panel `clientHeight` 281 → **296** once the scrollbar was gone. Re-running the tab-order probe
reports 3 of 11 — exactly the visible panel. Console clean; sprites 11/11.

## Touch input pass

`body` carried `touch-action:none`. It was there to stop the browser from panning the page while
the cat is dragged — but `html,body{overflow:hidden}` already does that, and the viewport meta
already carries `maximum-scale=1.0, user-scalable=no`, so it was redundant for its stated purpose
while doing real damage: a touch's allowed behaviour is the intersection of `touch-action` along
the ancestor chain from the hit element, so `none` on `body` made **every panel's `touch-action`
compute to `none`**. Combined with the market panel's 452 px of scrollable content, the drawer
could not be panned by touch on a phone — the 58 % of the terminal below the fold was simply
unreachable. The fix moves the declaration to the surface that actually needs it:

```
html / body / .game   = auto       gestures allowed
#cView                = none       the drag surface; the cat still drags cleanly
panel p0..p3          = pan-y      the drawer pans vertically, no horizontal flinging
```

A programmatic `scrollTop` check is supporting evidence only — programmatic scrolling is not
governed by `touch-action`. The decisive evidence is the computed chain above: with `none` on
`body`, every panel computed to `none` as well.

## Two harness lessons worth keeping

- **`shot.ps1` only skips its `Test-Path` check for `file://` and `http(s)` inputs.** Passing a raw
  path such as `index.html?v=10#z1` fails with "Input not found", because the query and fragment
  belong to the URL, not the filename. Always use the `file:///C:/...` form for a versioned or
  deep-linked capture.
- **Windows PowerShell 5.1 reads a BOM-less `.ps1` as ANSI/GBK.** A probe generator containing
  Chinese inside a here-string was silently mangled, and one mangled byte swallowed a closing quote
  so the injected probe became a `SyntaxError` with a probe div that stayed empty. The tell is
  mojibake in the page's own probe output. Probe generators are now ASCII-only, with the reason
  recorded at the top of the file.

## Independent design critique of the horizontal build — round 1

The three earlier critic rounds (4/10 → 5/10 → 5/10 FAIL) all judged the **vertical** version that
was then thrown away. The horizontal rewrite — the actual deliverable — had never been critiqued.
Two rounds were run on it, with the source withheld from the critic both times.

**Round 1 scored 6/10 with two BLOCKING findings: translucent panels, and scenery occluding the
market data. Both were artifacts of how I took the screenshots, not defects.** I had passed
`-Motion` to `shot.ps1`, which disables the forced `prefers-reduced-motion` flag — and that flag is
what disables the panel's 0.22 s entry fade. The transition was therefore frozen part-way, so the
capture showed a half-faded panel. A live probe reported `computed.opacity = 1` and
`background: rgb(36,31,49)`, fully opaque, and a recapture without `-Motion` shows every row of the
market table, all five chart bars and the macro row intact. This is the exact failure `shot.ps1`'s
own documentation warns about ("a looping or staggered entry animation is frozen part-way
through, so the capture shows a state no user would ever see"), and I had already written that
warning into this file — then walked into it while preparing the critic's material. Round 2's critic
independently re-derived the disproof rather than taking it on trust, which is the right behaviour.

**Round 2 scored 5/10 and independently confirmed the pixel work** (integer 4× scale, run lengths
all exact 4-multiples, a 5-colour flat moon, no gradient/AA/scanline/glassmorphism anywhere, and
red = up / green = down correct throughout). But a large share of its text-level findings were
misreads, and those are recorded here rather than actioned:

- *"`GMEEK` is a corrupted string."* It is the Gmeek generator credit, rendered cleanly in Press
  Start 2P. The critic did not know what Gmeek is.
- *"The secondary CTA reads 穿行僧."* It reads 看行情. The string does not exist in the page.
- *"Chart axis labels are 港股 / 纳斯达克."* They are 道指 / 标普 / 纳指 / 费半 / A50.
- *"No tabby forehead M, no muzzle, no eye catchlight, no ringed tail, ears are rectangles."* The
  sprite has all of them: brow patches at sprite row 4, `O` catchlights at row 6, cream muzzle at
  rows 8–9, chest ruff at rows 13–15, tabby bands at rows 16–18, ringed tail in columns 19–22.
- *"The bar chart is 70 % void."* The plot is 38 px and the tallest bar is 36 px.

**What it got right, and what that turned up.** It reported a regular 1 px lattice across the cat
at a constant period. That is real, and it is the most consequential finding of either round. The
critic diagnosed it as a procedural stripe texture; the actual cause was different and was only
found by taking run-length scans of the raw PNG:

```
before:  110,44,8 x7 | 176,116,42 x1 | 255,176,59 x7 | 111,57,19 x1
after:   110,44,8 x8 | 255,176,59 x8 | 110,44,8 x8
```

Seven clean pixels plus one blended seam, repeating at every 8 px block — 8 px being one sprite
pixel at `mul=2`. The cause was **not** the sprite data. `CAT_SX` was
`min(viewW*0.26, 200)` = 93.6 world units, a *fractional* device pixel once multiplied by `S`, so
nearest-neighbour `drawImage` gave every sprite-pixel boundary partial coverage. Two fixes:

- **`S` is now floored to an integer.** At 1440×900 it was 4.36, so every sprite pixel landed on
  8.72 device pixels. Measured on a 140×120 patch of flat orange fur: **301 unique colours before,
  41 after**. The remainder of the viewport is already covered by the solid `SKY_TOP` / `GND_BOT`
  fills, so flooring costs nothing.
- **`CAT_SX` is snapped to `1/S`.** This removed the seam lattice outright.

Also actioned from round 2, both small and both real:

- The operation hint is the only instructional copy on the page and was set in `--stone`
  (`#6b6288`) on a dark sky, near-illegible at 1:1. Raised to `#a49cbe` with a hard 1 px shadow.
- The 0.00 % index was drawn as a 2 px grey stub, indistinguishable from a broken bar. It now
  renders as a 17×3 px dash on the baseline, clearly reading as "no change".

**A methodological note recorded because it nearly cost two false fixes:** counting unique colours
inside a region that contains DOM text proves nothing — antialiased glyphs alone produce hundreds
of shades, and the "opaque" capture actually scored *higher* (633) than the "translucent" one
(571). Pixel-purity counts are only meaningful over regions that are pure canvas art.

## Viewport edge cases — one regression the pixel fix introduced

Flooring `S` to an integer and aligning the narrow breakpoint both changed geometry at the extremes,
so the extremes were checked explicitly: 2560×1440, 1280×400, and both sides of the 860 px
breakpoint. One real regression surfaced, and it was caused by the pixel fix.

**Two moons at 1280×400.** Flooring `S` took it from 1.95 to 1, widening the visible world from 656
to 1280 units — past the 1024-unit width of the tiling sky layer. The sky repeats, and the moon had
been baked into it, so the moon repeated with it. Widening the tile only moves that threshold; it
cannot remove it, because `viewW = vw/S` is unbounded for a very wide, very short window. The
correct fix is to not put a unique celestial body in a tiling layer at all: **the moon now lives in
the non-tiling `far` layer**, which already carries 0.45x parallax, so it is arguably better placed
there anyway. Positioned at far-x 157 so that at the zone-0 start (`camX` around 226) it sits in the
upper-left whitespace, clear of the HUD, the cat and the title panel, and drifts off as the visitor
walks right.

**Panels collapsed on short viewports.** `max-height: calc(72vh - 86px)` evaluates to 202 px at
400 px tall, so the stage panel showed one and a half rows with the scroll hint landing on the cut.
Both the desktop and narrow rules now carry a 240 px floor via `max(240px, ...)`. Below that the
panel scrolls, which is the right behaviour — a scrollable panel reads better than one clipped to a
sliver.

## Final verification sweep

Two things that had never been checked, both now confirmed rather than assumed:

- **The zone signposts really are painted.** `sp0` reads back as 1228 opaque pixels in 7 flat colours
  — a real 32×46 sign at `mul=4` with a post, a board and a zone icon, not an empty canvas. They sit
  at each zone's *left* edge (`i*ZONE_W+56`) while the cat parks at the zone *centre*
  (`i*ZONE_W+320`), so at every tested viewport they are off-screen at rest and sweep into view only
  while the visitor is walking between zones. That is the intended behaviour described in the code
  comment ("立在路边的像素木牌，跟着世界一起被镜头扫过"), not dead code — but it does mean a
  visitor who only clicks the nav never sees one.
- **The page was smoke-tested from `docs/index.html`**, which is the file that actually ships, rather
  than only from `static/`. Renders identically.

**Harness note added the hard way:** the in-app Browser's FilePanel suspends `requestAnimationFrame`
entirely when its tab is not foregrounded. A probe gated on frame 150 never produced output no matter
how long it was waited on. Probes that need to observe live state must write their output within the
first few frames, or be run through headless instead. This is the same root cause as the "canvas goes
blank in FilePanel screenshots" artefact recorded earlier in this file.

## Independent critique of the four-scene build — and the two real bugs it exposed

The horizontal city version had been critiqued twice. The four-scene rebuild had not been critiqued at
all, so it got a fresh pass: 8 images, source withheld, told to weigh the owner's explicit
requirements (bold pixel style, refined graphic design, 前后连贯性) heavily. Score: **5/10, FAIL**.

Its highest-leverage finding — *"the storm bridge renders no rain"* — was **correct, and it took
three separate bugs to explain why**:

1. **The rain strength formula was wrong.** Written as `1-zt` ("fade in over the zone"), which means
   the *centre* of the bridge — the exact place the deep link `#z2` lands — got intensity **0.5**,
   not 1. Corrected to fade by distance from the zone edges, so the middle of the bridge is full.
2. **The rain was falling upwards.** `dy = GROUND+40 - ((...) + now*0.001*sp) % span` — as `now`
   grows the modulo result grows, so `dy` *decreases*. The drops were leaving the canvas. The phase
   has to be *added* for `dy` to increase.
3. **Even once it fell, it was invisible.** The spawn band started at world y=144, so the top half of
   the screen had no rain at all, and 200 one-pixel streaks at 50 % alpha over a dark sky do not read
   as weather. Rain now starts above the viewport, the count nearly doubled, alpha went to 0.62, each
   streak got a 3-step diagonal tail, and a very faint 5.5 % desaturated curtain sits over the scene —
   sparse drops alone never read as "raining". Splash pixels now kick off the deck.

The same pass also found:

- **Two panels were double-exposed and unreadable at every zone boundary.** Each panel used to fade
  independently by distance, so at a boundary both sat near 50 % and the Chinese body text of one
  bled through the other. Only the *nearest* zone's panel is now shown, and it fades out completely
  before the next fades in — there is a short dead zone between zones where no panel shows, which is
  the correct reading of "you are between scenes".
- **A floating pillar at the street→bridge boundary.** The generic step transition filled from the
  ground down to the bottom of the strip, but the space under the bridge is *void*, so it read as an
  isolated slab rather than terrain. Replaced with a coursed stone abutment plus a proper bridge pier.
- **Zone 0's house was tonally invisible** — measured wall luminance 60.9 against sky 60.8, a
  difference of 0.1. It was only readable by hue. Added a warm rim-light along the roof edge and
  split the wall into lit and shadowed faces.

Two findings were checked and **recorded as deliberate disagreements rather than actioned**:

- *"The H1 headline breaks the pixel grid (1197 unique colours, 20.9 % rare pixels)."* The
  measurement is right, but the world art is the pixel art; the HUD is DOM text using system CJK
  fonts. There is no bitmap CJK face available (the only embedded font is Press Start 2P, which is
  Latin-only), and pixelating Chinese body copy would wreck legibility. The headline already carries
  hard 3 px / 6 px offset shadows as its pixel-art treatment. The world passes the same measurement
  at 1.9 % rare pixels.
- *"Content is a fixed HUD, never world-locked — the posts float away from the board."* Intentional.
  The panel must stay readable while the world pans, and a HUD that panned would put the text off
  screen. The notice board in the world carries the same three papers so the relationship reads
  without the panel having to track it.

The critic also reported the cat as "an orange crate with zero tabby stripes"; the sprite does carry
rust banding on the torso and a ringed tail, and the 4× crops show it. Recorded, not actioned.

### Scene differentiation — the last unaddressed finding

The critic measured that z1, z2 and z3 shared **11 of roughly 20 dominant colours**: in pixel terms
the three night scenes were nearly the same image, which undercuts the whole point of having four
scenes. The far layer was the culprit — all three used near-identical dark-navy blocks with orange
window dots. They are now separated by **colour temperature**, which is the cheapest way to make
three night scenes read as different places:

- **z1 street — warm.** Sodium light. Warmer block colour, a much denser window grid, an amber
  horizon haze so the low sky is lit by the town.
- **z2 storm bridge — cold.** Steel-blue blocks, windows sparser and mostly pale, a cold horizon
  band, plus the rain veil and the lightning.
- **z3 far shore — pale and empty.** The far layer is no longer a city at all: a low horizon line,
  a scatter of small rocks and four distant fishing lights. The overcast is breaking, so the horizon
  is grey-white. Emptiness is deliberately this zone's character — it is the one place on the route
  with no city behind it.
- **z0 house** got a warm horizon haze to match, and its far-layer town was given a dense lit
  window grid.

The z0 house was also brightened. The critic measured the wall at luminance 60.9 against a sky of
60.8 — a difference of 0.1, so the building was only readable by hue, and the moon at luminance 235
was four times brighter than anything else, making the moon the focal point instead of the cat's
home. The wall is now a warm grey-purple with a lit face, a shadowed face and a lit base, which
puts the house in front of the moon in the visual hierarchy.

## Round 5 — the storm bridge never rained

Went back to the four zone captures with fresh eyes and z2 had no rain in it at all. A 3x crop of
the sky band came back as flat dark bands: zero drops. Requirement 5 asks for rain and thunder on
the bridge, and the code plainly had a rain block with 404 drops, so this was a real defect, not a
taste call.

**Cause.** The main context is only ever `setTransform(S,0,0,S,0,0)`. Parallax offset is supplied
per layer by each `drawImage(img, -camX*k, DY)`, so **anything drawn with a direct `fillRect` in
world coordinates has to add `-camX` and `DY` itself**. The rain did not. With `camX=1477` and
`S=4` every drop landed at screen x ≈ 5900, roughly four screens to the right. Same for the
splash points on the bridge deck and the lightning bolt. The cat did not have the bug, which is
why it was in the right place the whole time and the bug hid so well: the two pieces sitting next
to each other used different coordinate conventions.

What *was* visible all along was the two screen-space pieces — the 0.055 rain veil and the 0.20
full-screen cold flash. That is exactly why the zone read as "slightly hazy" rather than "broken",
and it is why a brightness argument never found it.

Both blocks are now wrapped in `save(); translate(-camX, DY); … restore()`, with a comment saying
why, because this is the third element in the file to trip on it.

**Proof.** `out/make-probe.ps1` reports `p2=0.500 rainAmt=1.000 drops=380+24 camX=1477` — the
branch was always running. After the fix the same capture shows rain, and the drops land on the
bridge deck instead of in the void below it.

**Two follow-ups the fix exposed.**

- The rain fell to `GROUND+40`, i.e. 39 units past the deck, into the empty space under the
  bridge where "where does the rain land" has no answer. Span is now `GROUND-2`, and the splash
  points moved from `GROUND+7` to `GROUND-1` — they were under the planks.
- At 404 drops of 0.62 alpha and a fixed 6-unit length the drops read as a row of tally marks
  rather than weather. Now 560/300 drops at 0.34, length varying 4–7, tail thinned to 2 units:
  density carries the effect instead of per-drop opacity.

### Verifying the lightning

The bolt could not be captured normally: `shot.ps1` forces `prefers-reduced-motion`, which is
exactly the switch that disables it, and `light` initialises to `{t:5, flash:0, x:0, seed:1}` so
the first strike is five seconds away while headless only paints about two frames. Probing from a
separate rAF chain does not work either — that chain dies before the capture.

What works is patching the probe *copy of the source* so the state is pinned on every frame the
page draws (`out/make-probe-light.ps1`): force `RM.matches=false`, force `light.flash=0.9`, pin
`light.x`, and repaint the bolt in magenta at 24 units wide. Magenta bolt on screen, at the right
place, means the draw path is fine. This is also the general lesson: when a visual cannot be
reached from outside, patch the source and let the real code path render it.

### z2's skyline was standing on top of z3

The same capture pass showed the z2 far-layer city filling the z3 frame, which contradicts the
whole point of the shore being the one place with no city behind it. `farX` compresses the world
to 0.45x, so z3's visible far-x window is 844..1204 while z2's buildings were laid out from 516 to
1250 — the skyline crossed the zone boundary and towered over the open water.

Fixed at the source rather than with a fade: z2 now lays out four buildings ending at far-x 840,
inside the boundary, and the signal mast moved from `o+560` to `o+300` to stay with them. From the
bridge the city now visibly *ends*; from the shore only the last block is still in frame at the
left edge, receding. The trade is that the right of the z2 frame opens up, which is correct for a
view from a bridge over a river.

### Verification after round 5

- 12/12 sprites, every row width and palette char valid
- parens / braces / brackets all balance at 0
- `static/index.html` and `docs/index.html` SHA-256 identical
- 0 console errors and 0 warnings in all four zones (`out/make-probe-check.ps1`)
- 1440x900 captures of all four zones plus 390x844

## Round 6 — boundary sweep, and one thing I could not close

The round-5 far-layer change was verified by walking the camera across the zone boundary rather
than by looking at zone midpoints, which is the only way a parallax seam shows up. `?cx=<world x>`
was added to a probe copy of the page (the shipped deep link only snaps to zone centres) and the
world was captured at 1780 / 1850 / 1920 / 2060 / 2200.

**Result: no seam.** The z2 skyline now stops inside its own band, the signal mast recedes at the
left edge of the shore view, and z3 reads as open water. The ground transition at the bridge landing
steps down onto the rock beach rather than ending in a vertical cut.

### Harness lessons from this round

Two mistakes cost most of the time, both worth writing down.

**Probe self-reports are taken before layout settles.** Every probe printed `S=3 camX=1657
destY=25.3`, but the frames that actually reached the screenshot were rendered at `S=4 camX=1686
destY=-10`. Every world→screen calculation derived from the self-report was wrong, which sent three
layer dumps to the wrong place and produced a false "the layers are clean" result. Calibration has
to come from a marker drawn into the frame being inspected — a 7x7 square baked into the main layer
at a known local coordinate, then solved for scale and offset from its measured bounding box.

**`shot.ps1` reports a viewport of 1414x807 inside a 1440x900 image.** The DOM probe made this
visible: the canvas rect is 1414x807 and the image has ~26px of padding. Anything reasoning about
"device pixel" positions has to account for it.

Also: a probe generator must stay pure ASCII. PowerShell 5.1 reads a BOM-less `.ps1` as ANSI/GBK,
so a Chinese anchor inside a here-string gets mangled and the patch silently fails to match — it
failed loudly here only because the script validates that every patch target exists.

### Unresolved: a small object on the beach at the bridge landing

At world x≈1960-1968, y≈192-202 — just below the ground line, inside the `3*ZONE_W` landing patch
and just short of `SHORE_X` — there is an ~8x8 world-unit object: a dark frame, a steel-blue face
with a lighter rim, a short brown diagonal at the lower right, and a thin gold bar beneath it. At
`S=4` it is about 32x34 device pixels. It reads as a bucket or a small crate with a handle.

It is **not** the bollard and not a railing post — both of those are accounted for and sit above
the ground line (the bollard's amber cap is exactly the 11-unit gold bar width, which is what made it
look related at first).

**It is world content, and it is a harness problem, not a page bug.** Captured with
`clearRect` + far-layer-only draw + an immediate `return` from `frame()`, the object is still fully
rendered — yet the far canvas it supposedly comes from does not contain it. Re-capturing the same
probe with the cat in z1 (`cx=1200`), where the object has no business being, the frame is empty: so
it is world-anchored, not a capture artifact. Every other premise was checked individually:

- `buildWorld()` is called exactly once (boot) and `rnd=mulberry(20261002)` is a fixed seed, so the
  world is deterministic and there is no "rebuilt between inspect and capture" explanation.
- `view.ctx` appears only in `frame()` (line 1337), so `positionPanels()` and `updateScrollHints()`
  cannot be painting it either.
- The far layer's **complete** 20-colour set was enumerated and every colour attributed; the main
  layer's 105-colour set likewise, with all 27 blue blobs identified as 1-pixel water ripples plus
  `index.html:1059` verbatim; the fore layer has 2 colours.
- Blob scans at 9px and 15px type were both re-read at legible size after an earlier pass had
  misread `#3a3f47` as `#3a4a47` and `#3a5442`.

What remains is that `getImageData` on the 2552x300 far canvas is not returning the buffer that gets
composited. Until that is resolved the object's origin cannot be named, and **it was left alone**:
every candidate fix would have been a change made to fit a theory rather than to match evidence.

Practical impact is low — an ~8x8 world-unit prop near the bridge landing, visible only while walking
z2→z3, absent from all four clean zone captures.

Three harness errors invalidated earlier attempts and are worth not repeating:

1. A probe's self-reported `view.S` / `camX` / `destY` disagreed between captures (`S=3 camX=1657
   destY=25.3` versus a marker-derived `S=4 camX=1686 destY=-10`). Every world→screen calculation
   built on those numbers was wrong. Calibration has to come from a marker drawn into the frame being
   inspected, or from working in a layer's own canvas coordinates, which is transform-free.
2. The isolation probe's "cover it with black" fill was issued in the untranslated context, so it
   covered world x 0..353 while the object is at world x≈1960. It changed nothing and looked like a
   result.
3. Locating the object by scanning for its colour `#324c5f` was invalid: that colour is not unique and
   matched 165 pixels spread across most of the scene on a re-run.












## Round 5 — the six-ask pass (world widened, transitions built, panel placed, cat animated)

The user came back with six concrete complaints. All six are implemented. What follows records the
structural change plus the defects the finishing verification pass turned up, because five of those
seven defects were invisible in a still and one of them had been shipped in the previous round.

### 1. Zones are bigger, and every seam got designed

`SCENE_W` is still 640 — the artwork was not scaled. What changed is the *pitch*: a zone is now
`ZONE_W = SCENE_W + TRANS_W = 960`, so the world grew `2560 -> 3840` and each 640-wide scene is
followed by a 320-wide authored band. The rename was mechanical (`ZONE_W` -> `SCENE_W` in 91 places)
and the 40 places that genuinely meant zone pitch were then restored by a targeted patch.

The three bands are built in the pixel idiom, which means stepped terrain rather than a texture
swap — each one descends in visible steps so the join reads as ground changing:

| Band | World x | Reads as |
|---|---|---|
| T1 | 640–960 | grass -> trodden dirt -> four steps down to paving, gate posts both sides, arrow sign on the right post |
| T2 | 1600–1920 | sidewalk -> street lamp -> gravel approach -> eight stacked stone courses -> timber deck with four bollards |
| T3 | 2560–2880 | last deck -> seven fall-steps (lit tread, dark riser, so the value break carries the depth) -> bollard marked "桥到此为止" -> railing that stops -> first rocks of the beach |

### 2. The shore got long enough to actually reach

`WATER_X` moved from `3*ZONE_W+420` to `+540`, so the beach is 480 wide and the sea 420. The cat now
stops at `WATER_X-26` and can walk the whole way from the bridge head to the water's edge — the
"no road left" beat is something the cat does, not something the copy claims. Foreground props went
from 9 per zone at step 68 to 16 at step 74 so the 1200-unit fore pitch is actually covered, and
bushes got a three-step value range so they stop reading as black squares.

### 3. Where the floating card goes — the research, and why not the obvious answer

The three pieces of consensus that came back were *centre screen is for gameplay; edges are for
UI*, *rule of thirds*, and *animate appearance and changes, never the resting position*. The trap is
reading the first one as "flush it into a corner". That advice is written for **persistent small
affordances** — health bars, ammo counters. This is a body of prose with links in it, and shoving a
430x406 card into a corner hollows out the composition, especially here where the weight is already
biased left onto the cat.

What shipped instead: the card sits in the **right third**, inset `vw*0.06` from the right edge (so
deliberately not flush), top edge on the upper third line and clamped above the ground, with a
**0.72x parallax** — offset by 28 % of world travel, clamped to ±40 px. At 1.0x the card visibly
rides the prop and reads as painted on the screen; at 0 it is a dead sticker; 0.72 keeps it feeling
like it belongs to the world while staying put.

Plus **leader lines**: each zone has one, a hard-edged three-segment right-angle run from the card's
left edge to that zone's most identifiable prop, with a square dot on the prop. Without it the card
is UI floating over a picture; with it the card is stitched back into the scene. The line is drawn
in `#leaders`, a **sibling** of the panels and not a child — the panels have `overflow-x:hidden` and
would clip the segment that leaves their box. Diagonal lines were rejected: on four cards of
different heights a diagonal's length jumps, and it reads as a scratch. The line is suppressed when
the prop leaves the screen, moves right of the card, or the run would exceed `vw*0.62`.

### 4. Lightning belongs to the bridge, and to nothing else

The white flash is now gated on `rainAmt > 0.02 && !RM.matches`, reusing the rain band's
"how close to the bridge" measure. Off the bridge, `light.flash` is pinned to 0 *and* `light.t` is
held in the 2–6 s band, so the cat cannot walk onto the bridge and land inside a strike. The
full-screen cold flash dropped from alpha 0.20 to 0.13. Note this is deliberately **not** bound to
`prefers-reduced-motion` — the brief's rule there is that rain stays and full-screen white flashes
go, because a full-screen flash is the single highest-risk motion on the page.

### 5. Walk and run are now different animations, not the same lean

Eight frames were added: `cat24_walk0..3` and `cat24_run0..3`, each 28 rows — the head and body
reuse `SPR.cat24.slice(0,22)`, and only the belly row and the five leg rows are new, so the file
grows by ~170 lines instead of ~600 and a palette change is still one edit rather than nine. The
validator caught 23/25/26-cell rows in the hand-written legs; a normalising pass fixed the trailing
transparent cells only.

The distinction is **who is driving**: a nav target, an arrow key, or a drag means run (340 u/s);
unattended patrol means walk (46 u/s). Step frequency differs 2.2x (0.022 vs 0.0105), stride
nearly 2x, forward lean 0.14 vs 0.06, and dust spawns at 0.20 vs 0.05 per step. The walk cycle is
contact / passing / opposite contact / passing; the run cycle leaves its last row empty so the cat is
airborne on two of four frames. The draw offset is derived as
`footOff = SPR[nm].length >= 28 ? 56 : 44` — by row count, not a hard-coded name table, so adding a
frame cannot silently desync.

### Defects found and fixed in the verification pass

- **The leader line pointed at the sky.** The renderer maps world y to screen as `(y + destY) * S`
  — the file says so in a comment at `resize()` — but the leader code computed
  `(GROUND + ld[1] - destY) * S`. Sign error, so the line landed ~200 px *below* its prop. Fixed to
  the renderer's own convention.
- **The bench the z3 leader points at did not exist on screen.** It was behind a foreground bush,
  and where the bush was removed it turned out the bench and the shoreline railing were the same
  height in the same colour, 3 units apart, so they merged into one horizontal bar. Fixed on both
  sides: foreground props landing within the bench's footprint become slim railings instead of
  bushes, and the railing now has a gap at the bench while the bench is drawn two values lighter
  with a proud seat edge, a dark under-seat seam and lit legs. The anchor also came down from -58 to
  -46: high enough to clear the cat's 44-cell head, low enough to stop floating.
- **Rain bridge with no visible river.** The deck is 8 units thick, the piers 26, the water surface
  at `GROUND+34` — and the 26 units between them were painted by nobody, so they showed the
  near-black background and read as a rendering hole. The underside is now filled with a hard-edged
  three-tone bridge shadow, the water surface came up to `GROUND+26` (piers 18), and the river got
  rain rings, pier reflections, and a dark waterline. Visible river went from ~15 units to ~25.
- **The deepest water band was indistinguishable from unpainted.** `#122236` at night reads as a
  hole, which is exactly what it looked like under the fall-steps in T3. Lifted to `#1a2f47` / `#17293e`.
  Water is still clearly darker than the beach; it just reads as water now.
- **A transparent 60 units under the bridge landing.** `3*ZONE_W` to `SHORE_X` had a deck drawn on
  it and nothing beneath, so the main layer was transparent and the far layer's dark showed
  through — the single blackest patch in the whole transition, reading as a bridge that snapped. Now
  sits on a rock base.
- **Panel opacity went negative in the transitions.** At the midpoint of a band the distance to the
  zone centre is 480 and the formula returned `-1.813`. CSS clamps it to 0 so nothing looked wrong,
  but `style.opacity` was being written with a nonsense value. Clamped at the source.
- **A scope error of my own, worth recording because it blanked the page.** The foreground-prop fix
  reached for `bx4`, which is declared inside the z3 IIFE. `ReferenceError` inside `buildWorld()`
  killed the rest of the script and every capture came back byte-identical. A whole page rendering
  to the same file size is the tell.

### Two more harness lessons

1. `bx4` is scoped to its IIFE. Anything the layer builders share has to be hoisted, or referenced
   through a value that is genuinely in `buildWorld`'s scope (`SHORE_X` here).
2. **A headless raster cannot confirm a DOM-painted element, and pixel scans will lie to you.** The
   capture composites the probe bar's layer and the scene canvas from different frames: the panel's
   bounding box measured 927..1350 x 273..672 in the image while the DOM said 899..1329 x 216..622.
   So a full-image scan for the leader's `#ffb03b` returned **zero** pixels even with the element at
   `opacity:1`, `display:block`, `visibility:visible`, correct size, and 3.5 s of extra delay — and
   even after forcing it to 10 px solid white with a 3 px lime outline, which produced zero lime
   pixels anywhere in the frame. `document.elementsFromPoint` returned
   `[I.leader > CANVAS#cView > DIV#game > BODY > HTML]`, i.e. the browser's own hit test puts the
   leader on top of everything. For "is this element actually painted", ask the browser, do not scan
   the screenshot.
## Round 6 — the user pushed back on round 5

Seven items, and three of them were reversals of things round 5 had just added. All are in.

### 1. The walk/run frame sets are reverted

Round 5 added `cat24_walk0-3` and `cat24_run0-3` — eight 28-row sprites with real legs.
The user looked at them and said the previous version was better, so the generator IIFE and
the frame branch in `frame()` are gone; the cat is back to one 24-row `cat24` with forward
lean, hop and dust. The reason recorded in the code, so nobody re-adds it: at 28 rows the
silhouette is wider and looser, the legs are only 5 rows, and at 3x they read as a sticker
rather than a gait. `footOff` is a flat `44` again.

Walk and run are still different speeds (340 vs 46 u/s), different hop heights, different
dust rates and different lean — just not different sprites.

### 2. The foreground "black squares"

`prop(x,1)` was a 40x16 solid rectangle with a 30x8 rectangle on top, in `#0b0a12`, at 1.25x
parallax. At 3x that is 120x72 pixels of near-black sitting in front of a 95-pixel cat. It was
never going to read as a bush. It is now three stacked arcs — 44 wide, 20 tall, stepped
inward toward the top — with a moonlit crown one value up, a lit bottom edge and three 2x1
leaf gaps. The lamp post went from 56 tall to 44, the bridge pier from 14 wide to 12, and z3
now only gets a bush every third slot (the rest are slim railings) because the shore is the
most open section of the whole world.

The occluding part was not only shape. A `PG` per-prop ground offset was needed as soon as the
shore moved (item 5), and it is derived from `groundAt(fx/1.25)` rather than per zone — T3's
stairs straddle `GROUND` and `SG`, so a per-zone value left props floating 24 units in the air.

### 5. The shore is lower, because the connection is a staircase

`GROUND` was a single constant, so "the bridge arrives via stairs and the shore is at the
bottom of them" was impossible to draw: the stairs and the beach were at the same height and
the whole thing read as a staircase jammed against a floor.

There is now a height field:

    var SHORE_DROP=24, STAIR_A=2*ZONE_W+SCENE_W, STAIR_B=STAIR_A+120, STAIR_N=4;
    function groundAt(x){
      if(x<=STAIR_A) return GROUND;
      if(x>=STAIR_B) return GROUND+SHORE_DROP;
      return GROUND+Math.ceil((x-STAIR_A)/(STAIR_B-STAIR_A)*STAIR_N)*(SHORE_DROP/STAIR_N);
    }

24 is the ceiling: the visible world bottom is about `GROUND+49`, so every unit the shore drops
is a unit of sea lost off-screen. The four 6-unit steps live in the first 120 units of T3 and
then it is flat rock. Everything that needs the walking surface now asks `groundAt` — the cat's
feet, its shadow, the dust emitter, the fore props, and the leader-line baseline (which used
`GROUND` and would have pointed 24 units above the bench).

The river also had to shrink back: it was painted `SCENE_W + TRANS_W` wide, which put the new
stairs standing in the water. It is `SCENE_W` again, from the bridge's start to its end.

### 3. Both other transitions rebuilt, and a shared reason

T1 and T2 were not ugly because of their content. They were ugly because **changing ground
material was done by filling a new colour**, which leaves a hard vertical seam and a flat
slab underneath. Two helpers now carry the whole approach:

- `surf(x,w,top,face,lip,mix,deep)` — a lit top edge to separate the surface from the air,
  the surface's own material, a transition band, then stepped soil below, plus scattered
  grit so it is not a plastic slab.
- `masonry(x,w,top,courses,ch,cols)` — stacked courses with a lit top edge, a dark bed line,
  and **vertical joints offset half a course per layer**. Aligned horizontals *and* aligned
  verticals read as stripes; offset joints read as a wall.

T1 is now grass -> two stages of trodden grass -> packed dirt -> a kerb stone -> the same
sidewalk pattern z1 uses (so the seam actually matches), with gate posts and the arrow sign.
T2 is now continuous sidewalk -> a kerb -> a gravel apron -> eight offset-joint courses of
stone abutment with a lit coping -> the timber deck, with five bollards.

T3 is four stone steps with a lit tread and a dark riser per step, a timber handrail that
descends one pixel every five (which is what actually makes it read as *stairs* rather than
as slabs at different heights), the bank below in the beach's own dark tone so the foot of the
stairs does not end in a black seam, and loose rock at the bottom to hand off from built to
natural.

### 4. Stars and clouds move

The sky is a baked static canvas, so its stars never twinkled. Each frame now draws 34
bright stars and 5 clouds on top. Positions come from an index hash, never `Math.random` —
a random position per frame reads as noise, not as sky. Stars pulse through three hard-cut
brightness steps and the brightest third get a 1px cross flare. Clouds are two-value stepped
blobs with a moonlit top edge, because the shape is carried entirely by that edge; a single
dark fill on a dark sky just reads as a smear. Both sit on the sky's 0.06x drift, so they
belong to the sky rather than to the screen. Under reduced motion they are still drawn — the
speed and the pulse are zeroed, because deleting them reads as "unfinished" where stopping
reads as "calm".

### 6. No railing over the sea

The shoreline railing ran from the bollard all the way to the waterline, which put a fence
across the sea. It now runs 150 units from the bollard at the foot of the stairs and stops.

### 7. Flowers at home, a fishing pier at the shore

- z0: a window box under the lit window (seven blooms on stems in the palette's own warm
  colours — saturated real greens and reds would jump out of a night pixel scene), and a
  flower bed right of the house with nine stalks at two heights over a low hedge so the
  flowers are not floating on the grass.
- z3: a timber pier on four posts standing in the water, a lantern on a post at the outer
  end, a rod leaning off the deck with its line dropping into the sea. Its left edge is at
  `WATER_X-20` so the cat, which stops at `WATER_X-26`, stands on the pier's edge with the
  whole structure to its right rather than behind it. The panel copy changed from
  "猫在栏杆边坐下" to match, since there is no railing there any more.

### Verification

- Live browser reload of the current file: **0 console entries**.
- Probe reports `ERRORS=0` at all four zone centres, all three transition bands, and 390x844.
- Narrow: `narrow=true`, `leaders=[off x4]`, drawer at `8/526/374x272`, one panel visible.
- Sprite check, runtime, over the live `SPR` object: 13 sprites, **WIDTH/PALETTE PROBLEMS: NONE**;
  every cat sprite is 24 rows. Static validator 12/12.
- `static/index.html` and `docs/index.html` byte-identical, 125958 B,
  SHA-256 `331F1F5E81E0652B44B28C67AF30C8FF0568A0711952F2E7D2A3465C079132DC`.

One harness note from this round: the sprite probe still indexed `SPR['cat24_walk0']` after the
frames were removed, so it threw before writing its report line and the capture silently showed
a half-drawn grid. Probes that name catalogue entries have to be updated in the same commit as
whatever removed those entries.

## Round 6 verification — what the captures could and could not prove

Every zone and transition capture this round ran under `shot.ps1`, which **forces
`prefers-reduced-motion`**. That is correct for judging layout and exactly wrong for judging
motion: the star pulse, the cloud drift and the cat's hop/lean/dust are all deliberately zeroed
under reduced motion, so every "settled" screenshot of this page shows the *still* state. The
first pass therefore proved nothing about the two features it had just added.

A motion probe fixes that. It sets `RM.matches=false`, puts the cat in a driven state, and
samples. It reads the **live canvas** rather than a second copy of the drawing formula:

    RM.matches=false (forced false)  frames=16  errors=0
    Painted-pixel counts read off the live canvas (whole canvas, step 2):
    t     catX  run mv  lean  hop    dust | starHi starLo | cloudPx cloudX0@Y
     266  1805   1  1  0.14  0     1   |   19     6    |   64    109@182
     566  1805   1  1  0.14  11.57 1   |   19     6    |   64    109@182
     716  1805   1  1  0.14  1.61  1   |   19     6    |   64    109@182
    1016  1805   1  1  0.14  7.84  1   |   19     6    |   64    109@182

- Stars and clouds are **painted where intended**: 19 bright + 6 mid stars in the sky, 64
  cloud pixels with the first at screen (109, 182). An earlier attempt reported `cloudPx=0`,
  and that was the probe's fault rather than the page's: it sampled y 60-200 while the clouds
  live at world y 26-144, i.e. screen y 154-508. A measurement that reports zero is a claim
  about the probe until the sampled band is checked against where the thing actually is.
- The cat's hop is time-driven and cycles (`0 -> 11.57 -> 1.61 -> 0 -> 7.84`), the run lean is
  live at 0.14, and the dust emitter fires.

**What this still does not prove:** the star *twinkle* and the cloud *drift* were not observed
changing in that probe. Every sample reports the same `starHi/starLo/cloudX0`, because headless
produces only a couple of `requestAnimationFrame` callbacks — the canvas freezes after its last
paint, so `getImageData` keeps handing back the same frame. That is the same frame starvation
that made the leader-line pixel scan in round 5 return zero for a `display:block; opacity:1`
element that `elementsFromPoint` then confirmed was the topmost thing on screen.

**Headless cannot settle a motion question at all, but the in-app Browser can.** The FilePanel tab
is a real foreground Chromium whose rAF loop is not starved, so two screenshots 31 s apart were
diffed over the sky band (y 40-250, JPEG tolerance 16):

    frame A (14:50:41) : brightStars=0  midStars=5  cloudPx=49553
    frame B (14:51:12) : brightStars=0  midStars=3  cloudPx=48823
    sampled sky pixels differing between frames: 4270 / 42225

`midStars` going 5 -> 3 looked like the twinkle, and the 10 % band diff confirmed the sky animates.

**Cloud drift is now measured properly.** Three live frames 16 s and 61 s apart, cat asleep, camera
settled, in a rain-free zone, with the cloud's two highlight tones classified tightly:

| frame | cloud px | cloud centroid x |
|---|---|---|
| A 14:52:37 | 1170 | 324.1 |
| B 14:52:53 | 1167 | 362.9 |
| C 14:53:54 | 1048 | 387.7 |

Monotonic rightward, and a control band in the street (y 380-400, red channel only) showed
**0 mismatches** - the camera did not move by a pixel, so the shift belongs to the cloud layer and
nothing else. The rate is not constant (2.4 px/s then 0.4 px/s) because the five clouds take
different speeds from their hash and wrap at different times, which also moves the pixel count.


### The twinkle was invisible, and that was a defect, not a preference

Round 6 left the twinkle unverified with the diagnosis "1 world unit is under 1 device pixel at
a 639 px viewport". That diagnosis was right, and it also said the feature was not being
delivered: the user asked for stars with motion, and at narrow widths there was none to see.
Two real bugs were behind it, both found by chasing the measurement rather than by looking:

1. **Every tier drew a 1x1 world unit.** At `S=1.18` that is under one device pixel. Now the
   brightest tier is a 2x2 core and the mid tier 2x1, so there is always something to see and
   something to count.
2. **The cross flare was painted after the core**, so its horizontal arm covered the core's
   bottom row and its vertical arm covered the right column - a "2x2 bright star" was really one
   pixel again. The flare is now drawn first and the core goes on top.

Chasing those also surfaced a third, which is a violation of the page's own hard-edge rule:

3. **`fillRect` antialiases.** The per-frame stars and clouds were being drawn inside
   `setTransform(S,0,0,S,0,0)` with `S` fractional, so every edge that landed on a fractional
   device pixel was blended. `imageSmoothingEnabled=false` governs `drawImage`, not `fillRect` -
   it never protected these two layers. Both are now drawn in device space with rounded
   coordinates (`c.save(); c.setTransform(1,0,0,1,0,0); ... c.restore()`), which is what the
   baked layers effectively get for free. A neighbouring inconsistency went with it: the stars
   used `DY+tgy` and the clouds `cyy`, so the two were not in the same band of sky at all.

**Final live measurement** (rain-free zone, cat asleep, ground control band 0 mismatches every
time, so the camera is provably still):

| interval | bright px changed | mid px changed |
|---|---|---|
| 7 s | 0 | 10 |
| 28 s | 0 | 4 |
| 35 s | 0 | 9 |
| 6 s (after the device-space fix) | 0 | 3 |

The mid tier moving is the twinkle, proven with a control: under reduced motion `tStars=0` would
freeze **both** tiers, so motion in the mid tier is direct evidence that the per-frame star layer
is live. The bright tier's 27 pixels never move and are almost certainly the baked sky's own
stars, which sit close enough to `#fffaf0` to land in the same bucket - separating the two needs
a desktop-width live browser, which the FilePanel cannot provide. That limitation is recorded
rather than papered over: **the twinkle is verified, the provenance of one brightness bucket is
not.**

The general lesson, and the reason this took three passes: the first measurement was blind
(feature smaller than a pixel), the second was misled (JPEG ringing on a dithered sky, an order of
magnitude more noise than signal), and the third only worked after the feature was made big
enough and hard-edged to exist at all. A measurement that cannot see a thing is not evidence
that the thing is fine - it is often evidence that the thing is too small, and in this case it
was.

---

## Round 7 (2026-10-02) — 前景剪影 / 浮窗位置 / 三段衔接 / 灯光 / 海里一条鱼

用户这一轮给了 5 条，先做这 5 条，随后又追加 4 条修正。全部只改本地，未 commit / push。

### 7.1 前景层只留灯，其余黑剪影全部拿掉

`prop()` 原来有四种：路灯柱、弧形灌木、桥墩、栏杆，全是近黑纯剪影。
灌木那一版改过形状（40x23 的方块 -> 20 高的弧形）还是被否。**问题不在形状，
在这层语言本身**：1.25x 的前景是用来给画面压出前后层次的暗部，一旦这一层
开始放灌木和栏杆，它读成的就是"一排挡在猫前面的黑三角"——轮廓全是尖的、
颜色全是近黑、每件的高度都卡在猫胸口到头顶之间，第一眼看到的是遮挡不是深度。

只保留路灯，因为灯自带光：剪影的柱身仍然是暗的，但灯罩那一小块是画面上
最亮的东西，于是它读成"光从前景掠过去"。

### 7.2 前景灯改成手排坐标，不再等距平铺

10 盏、间距 126 一路排到底——**等距本身就是问题**：等距的东西读成图案，
不读成街道。改成 `FORE_LAMPS` 手排世界坐标再乘 1.25，间距 210..450 不均变：
家门口一棵、街口一棵、街上三棵（这一段最密，是住着人的街）、桥上两棵、
台阶顶一棵、岸上一棵。岸那一段只留一根——开阔的岸边本来就不该排灯。

同时把前景灯罩底下那道 20 格长的淡黄光柱拿掉了：在 1.25x 视差下它比灯罩还宽、
垂到地面，读成"一根黄柱子"而不是光。这一层是剪影层，只该负责压暗和给灯一个位置。

### 7.3 浮窗右缘留白 6% -> 15%

6% 在 1280 宽上只有 77px，卡片看着像被顶到边角上，右边那一竖条只剩一丝，
读出来是"浮窗被挤出去了"而不是"页面右边有一栏"。改成 `clamp(vw*0.15, 88, 240)`。
低于 88 在 1024 屏上又太贴边，高于 240 在超宽屏上卡片会被甩到正中。

### 7.4 三段衔接：不再换地面贴图，改成一条连续的路

**这是被否两次之后才想明白的。** 两次的错法一样：z0 草皮加土路、z1 人行道、
T1 用 `surf()` 铺四段、T2 再来一次人行道加碎石加桥台加木栈道。**每次换材质
就多一根垂直硬边，压什么都读成"三块贴图拼起来"。问题不在画法，在
"过渡 = 换脚下的贴图"这个思路本身。**

这次整条世界只有【一条】路，形式完全一致：
`受光唇 -> 6 行面层 -> 压边暗线 -> 两档土层`，七种材质共用这一套骨架。
材质相接处不切一刀，而是 `seam()` 让两种材料**互相伸进对方**（双向咬合齿，
位置按下标哈希错开）+ 压一道 1 像素暗缝。

**过渡于是从路两旁读出来**：T1 是院墙 + 剪过的路树 + 一对门柱 + 指向街的路牌；
T2 是把街关上的矮墙和铁门 + 门柱上最后一盏壁灯 + 街尾堆着的碎砖和报废推车；
T3 是整条路唯一一次高度变化（四级台阶，也用同一套 `road()` 按级铺）。

过渡带里放手放高物件是安全的：猫巡逻只在每区头尾 570 格内来回
（`lo=70, hi=SCENE_W-70`），**根本不会进过渡带**，被挡住的只有主动跑过去的那几秒。

### 7.5 过渡带材质：褐色夯土只留 84 格

用户看图后指出 T1/T2"全是褐色的土"、"材质不统一很奇怪"。原因是院子里的
夯土一路铺到 760，于是 T1 整段 320 格全是褐土。改成分段逻辑：

    夯土(84) -> 碎石(T1, 320) -> 石板(街 640 + T2 300) -> 桥台(64) -> 木桥(684) -> 石阶(120) -> 礁石(740)

褐色夯土缩到 556..640 共 84 格，只表示"从家门口出来那几步"。

### 7.6 光：两版光晕都被否，最后整层拿掉

`lamp()` 统一了所有灯（z1 街灯、T2 壁灯、z2 桥灯、z3 缆桩、钓鱼台、窗口），
把原来每盏灯旁边那块 `rgba(255,176,59,.09)` 的矩形换成三样东西：
**亮芯 + 光柱 + 地面光池**。

"光晕"这一层试了两版都被否：
- 第一版实心十字臂 —— 一根黄杠横穿画面，把 z0 的窗户整个盖掉（窗户是全画面焦点）
- 第二版菱形描边环 —— 一圈闭合的线挂在画面上，边缘又直又长，读成"贴了张图"

**两个都不行，因为都在灯四周画圈。** 最后整层拿掉，只留三样"从一个点往别处走"
的东西。`LITH` 色表和 `shaft()` / `pool()` 保留。

### 7.7 地面光池的方向曾经是反的

第一版光池中心给 `#4a4028`（亮度 64），人行道受光唇是 `#454d58`（亮度 76）——
**灯脚下的地面比没灯的地方还暗**。探针一测就露馅。改成 `#6a5f3c`（95）
之后：灯下 95 / 150 格外无人行道 48，光真的落在地上了。

### 7.8 受光唇被压穿的三个真缺陷

用 `make-probe-pix.ps1` 扫全程 381 个采样点（判据：顶边亮度必须比面层亮 8 以上）：

| 缺陷 | 症状 | 修法 |
|---|---|---|
| 材质纹理从 `top` 画起 | 石板缝/木板缝把受光唇打成暗点，`LIPdark=118/381`，整条路读成虚线 | 铁律：所有笔画一律从 `top+1` 起 |
| 篱笆用 `rgba(13,11,19,.4)` 画影子 | 半透明把底下那行算成两色混合，院子土路 600 格的受光唇整条压穿 | 改硬边 `#241f19` / `#2e2b26`，下移到面层第一行 |
| 路面顶边被灯的光池盖住 | 灯下那一段受光线断掉 | 接受：地上有光斑时唇边被照亮是物理正确的，判据放宽 |

修完 `LIPdark` 从 118 降到 19（剩下 8 个在台阶区、1 个在院子路口，都合理）。

### 7.9 海里一条鱼

`fish` 在 `frame()` 里逐帧积分，**画在设备像素空间**（世界坐标乘 S 之后经常落在
分数设备像素上，`fillRect` 会抗锯齿，和星与云踩过的同一个坑）。形状按 S 放大，
每个矩形取整到设备像素。

- 游速 24 格/秒，游到边界反向
- 尾巴两帧摆动（游动 5.5Hz，跃起时 11Hz）
- 每 4.5~9.5 秒跃出水面一次，抛物线最高 17 格，跳出时甩水珠、落水时留一圈涟漪
- 轮廓是纺锤不是方块：尾柄 2 格高、身体 4 格、头 5 格，背线从尾往头一级级升上去
- 11x5 这个尺度画不出曲线，唯一的办法是让背线和腹线**不等长**

**三个被量出来的真缺陷**：
1. 游动范围 3030..3580 有 390 格在**陆地上**（waterX=3420）—— 现在 3440..3620
2. 范围太宽时两端贴在视口边缘，中段反而没人看得见 —— 收到 180 格
3. 尾鳍 `#2a5170` 和水波纹 `#2a4d6b` 只差一格亮度，尾巴和身后水纹连成一条线
   —— 水纹最亮那档压到 `#22435c`，海里最亮的东西因此变成鱼

**动效证据**（`make-probe-pix.ps1` 手动驱动 12 帧，读画布上的鱼腹像素）：

    SWIM x/n/cx: 3529/108/767  3528/108/764  3526/108/760  3525/108/755
                  3524/162/752  3522/162/748  3521/162/745  3520/162/741
                  3519/162/737  3518/162/734  3516/162/729  3515/162/725

世界坐标连续递减、**画在屏幕上的质心 767->725 同步移动**、腹像素数 108/162
随摆尾变化。三项都动，才叫"在游"；只有 x 动而质心不动，那是改了个数字没改画面。

### 7.10 首页文案和底部进度条

- 首页 lede 从 58 字的三站预告缩成 `猫叼着钥匙出门巡逻。`
- 底部 `.track` 从 `aria-hidden` 的装饰刻度改成 `<nav>` + 四个 `<button>`：
  悬停/聚焦时用 `<b>` 浮出区名。点一下 `goto(i)`，猫跑过去。
  原来 `pointer-events:none` + 2x10 的细刻度，看得见摸不着，而它是全画面唯一
  "知道自己能点"的位置。

---

## 这一轮在测量上踩的坑

1. **探针的 IIFE 在解析期就死了。** `var g=view.world.main.getContext('2d')`
   写在 IIFE 顶层，而 `buildWorld()` 要等页面自己的 resize 才跑，`view.world`
   此刻是 null —— 抛异常，**后面所有 setTimeout 都没注册**，探针一个字都不显示，
   看起来完全像"探针正常，只是页面没数据"。

2. **`RM.matches=false` 赋值是静默失败的。** `MediaQueryList.matches` 是只读
   accessor，sloppy 模式下写入被丢弃，reduced-motion 下鱼纹丝不动，12 帧日志
   全等 —— 那证明的是"reduced-motion 生效"，不是"鱼会游"。要整个替换绑定：
   `RM={matches:false}`。

3. **`paused=true` 之后画面全白。** headless 截图时会触发 resize，而
   `layout()` 里 `view.cv.width=vw` 会**清空 canvas**。循环已停，空白就永远留着。
   正确做法是在读到像素的那一刻把 `view.cv.toDataURL()` 拷出来贴到页面上，
   让截图和数值描述同一帧。

4. **`el.textContent=` 会清掉子元素。** 动态日志条如果挂在报告节点里面，
   报告函数每次重写 `textContent` 就把它抹了，只能出现第一帧。
   而且它要是 z-index 比报告低，还会被报告的白底盖住。

5. **headless 只有 2-3 帧 rAF。** 相机缓动永远落不了地，于是"鱼不在屏上"
   只是相机没跟上，不是鱼的毛病。必须先把 `cat.x` 和 `view.camX` 直接摆到位，
   再用定时器手动驱动 `frame()`，测的才是鱼。

6. **shot.ps1 截图 1440x900 但布局视口是 1414x807**，画面被纵向拉了 1.115 倍。
   凭肉眼量图上的坐标去反推世界坐标会全部对不上——本轮一开始在窗户位置上
   算了三轮才对上。**要量就用探针读像素，不要量截图。**

---

## Round 8 (2026-10-02) — 院子左边的篱笆 / 猫真正在走 / 顶部日期时间

### 8.1 篱笆围住整个院子

原来篱笆只从 240（屋的右边）排到 640，院子左边是一段敞开的草坡，房子读起来
像"路边的一栋楼"而不是"一处有院子的家"。现在从 42 排起，中��� 228..362 那一段
正好被屋和屋檐盖住，两道横杆贯通——于是篱笆是围着房子长的。

夯土路的起点同步从 190 挪到 **236（屋门口）**。原来这条路从 190 就开始，
篱笆从 42 接到屋左墙的那一段（44..234）会横在土路上；挪走之后这一段是草地，
篱笆落在草上，院子才真的是被围起来的。

### 8.2 "坐下就再也不动"：两处，第二个是不可逆的

用户看到的是猫盘腿坐下之后再也不动。查下来是两个独立的原因：

1. **巡逻目标是当前区里的一小段。** `lo..hi = ZONE_W+70 .. ZONE_W+SCENE_W-70`，
   猫永远在自家门口转悠，画面上看它就没去过别处。
2. **`cat.idle>=16` 之后 `asleep=true`，而没有任何一条路径会把它叫醒**——
   除了人工输入。所以"坐下"是不可逆的。那不叫巡逻，那叫停了。

现在：

- 目标是**相对当前位置的随机距离** 300..1500 格，往左往右都可能，跨区是常事
- 打盹有 `nap` 计时，`napLim` 7~12 秒，到点自己起身接着走
- 停和睡共用那张盘起来的精灵，靠时长区分：歇 1.4~4.6 秒，盹 7~12 秒。
  站着纹丝不动读成"卡住了"，盘着读成"它在那儿歇一会儿"——然后它会站起来
  继续走，这正是要的"走走停停"。坐着的时候不跟朝向翻转

### 8.3 阈值不是拍的，是模拟出来的

`out\sim-cat.ps1` 把 frame() 里的猫状态机原样复刻，用固定步长跑 150 秒
（3000 步），不需要浏览器。三轮迭代：

| 改动 | x 范围 | NAP 占比 | 最长静止 |
|---|---|---|---|
| 第一版（idle>9，span 240..1100） | 46..1647 | **31%** | 18.3s |
| idle>34，span 300..1500 | 46..2154 | **14%** | 15.3s |
| 加边界反向修正 | 46..1931 | 14% | 15.7s |

第一版的 NAP 占掉三成时间，页面读起来是"睡着的猫偶尔走两步"；而且 150 秒
只走到 x=1647，**桥和岸根本没被走到过**。idle 阈值 9 意味着每轮停完都睡
（一轮 walk+SIT 涨 20~30 秒 idle，必然越过 9），改成 34 让它连走三四趟才歇一次。

边界反向修正也是模拟出来的：夹一次边界之后目标和脚下只差两三格，于是
"走"被跳过、立刻进 SIT、再立刻换点，日志里读成
`SIT 9.0s / idle 9.0s / SIT 9.0s` 连续三次，猫在原地抽搐。

**注意这是逻辑模拟，不是浏览器实跑。** 它回答"这台状态机会不会卡住"，
不回答"浏览器里跑起来是什么样"。

### 8.4 顶部日期时间

`<time class="clock" id="clock">`，用 `<time>` 而不是 `<span>`：带
machine-readable 的 `datetime` 属性，读屏和"复制"拿到的仍是完整时间戳。
PS2P 是等宽点阵字，冒号和数字同宽，所以不会跳。

挂在 `setInterval` 上而不是 `frame()` 里：rAF 在标签页切到后台时会停摆，
时钟会跟着停；定时器在后台被节流到 1Hz 一次，正好够用，而且不占每帧预算。

HUD 布局：`F1YINGCAT | 区名 | 时钟 | [空隙] | 区导航`。靠右的
`margin-left:auto` 留给区导航——给时钟也加 auto 的话区名和时钟之间会空出
700 多像素，读起来像两块不相干的东西。窄屏只留 `HH:MM`，完整日期在
`datetime` 属性里。

### 8.5 这一轮工具上的死路

**headless 跑不了长时间行为。** 它只出 2~3 帧 rAF，之后会冻结所有短定时器
（Chrome 控制台报 `Every renderer should have at least one task provided by
a primary task provider`）：`setInterval` 一次都不触发，递归 `setTimeout`
也只跑第一层，但**已经排定的长定时器照常触发**。所以猫走 150 秒这种行为在
浏览器里根本观察不到，只能退回逻辑模拟。

这不是新问题，是第 7 轮那条"headless 只有 2-3 帧 rAF"的延续。区别是上一轮
还能用 `setInterval` 驱动 12 帧，这一轮的 renderer 连短定时器都不给了。

**教训：当"用定时器驱动多帧"这条路连续失败两次，就该换方法，而不是继续调参数。**
换成 PowerShell 逻辑模拟之后两轮迭代就把阈值定出来了，比在浏览器里试快得多。

---

## Round 9 (2026-10-02) — 归档页 + 三篇文章页（除盘面外全部页面）

首页收工，开始做"看盘面以外"的页面。范围是侦察后确认的 4 个：
`tag.html` + `post/*.html` 三篇。`MarketViewer.html` 和 `premarket.html`
是用户明确排除的盘面页面，一页没动。

### 9.1 侦察：三件事决定了后面的做法

1. **老页面全是 Gmeek 模板 + 外链 CDN 的 GitHub Primer CSS。**
   `mirrors.sustech.edu.cn/cdnjs/.../primer.css` —— CDN 挂了页面就散架，
   而且 Primer 是 GitHub 的视觉语言，和像素夜行风完全不搭。
2. **`static/` 里只有 `index.html`**，tag 和三篇文章只存在于 `docs/`。
   也就是说此前"static = 源、docs = 部署"这件事只对首页成立。
3. **三篇文章全是 micro-post**：29 / 86 / 12 词，一到两句话加一个链接。

第 2 条直接决定了这一轮的工作方式：先在 `static/` 建源，同步到 `docs/`，
而不是直接在 `docs/` 上改——否则新写的文件只有一份，改起来没有安全网。

### 9.2 两个决策（问过用户）

- **文章页纵向、归档页横版。** 归档天然是"路"，翻旧文章这个动作本身就是
  往回翻，卷轴不碍事；读一篇文章不是，眼睛要的是一条竖着的线。
  三篇现在都是短文，横版完全撑得开——但以后会变长，横版读长文是灾难。
- **旧元素全清**：去掉 Primer CDN（页面零外部请求）、评论按钮（本来没接）、
  Gmeek 署名（换成自己的）。保留一个 GitHub Issue 链接——还能提 bug。

### 9.3 抽了三个共享资源

- **`assets/site.css`**（24 KB，含内嵌 PS2P 字体）— 设计 token、HUD、时钟、
  底部进度条、按钮、硬边卡片、文章页排版。只放四个页面都要用的，
  世界浮窗那些留在各自页面里。
- **`assets/site.js`**（5 KB）— 时钟、区导航、底部四个可点方块。
  刻意**不**引入精灵表：品牌位置改用一枚内联 SVG 像素猫，
  它就是首页 favicon 里那只，两处本来就是同一个图形。
- **`assets/sprite.js`**（7.8 KB）— 用脚本从 `index.html` 精确抽出的
  PAL + 13 帧精灵 + drawSprite，一个字符没改。

**已知约束（写进文件头注释了）**：`index.html` 里还有一份完全相同的
PAL / SPR / drawSprite，那份是为了让首页保持单文件自包含。
**改猫的画法要改两处。**

### 9.4 归档页：一条横着走的夜路，文章是路边的牌子

世界只有一区，不做首页那三段过渡带 —— 过渡带是为"从一个场景走到另一个
场景"存在的，归档只有一个场景，造三段过渡是空转。保留的是三样语言：
同一块路面（受光唇/6 行面层/压边/两档土层）、同一批闪烁的星、同一只猫。

文字用 DOM、canvas 只画世界 —— 和首页浮窗同一套思路：canvas 画中文只能
`fillText`，一画就丢掉像素感。

**筛选**按标签过滤时，被筛掉的那块牌子**木框留着、纸条抽走**，相机不跳、
猫照样走过去。走过的路上只剩它要看的那一类 —— 这才是"筛选"该有的手感。

### 9.5 这一轮改掉的四个真缺陷

1. **`sprite.js` 整份没执行。** 拼接脚本里我写了 `` "`n\n" ``，
   PowerShell 双引号里换行符是反引号，第二个 `\n` 是**字面的反斜杠+n**，
   于是 `};\nfunction drawSprite` 成了语法错误。整个精灵脚本没跑，
   `window.PIX` 是 undefined，猫那一行抛异常，frame() 中断，页面全黑。
   **而且它不报 onerror** —— 解析期错误不触发 error 事件，
   看起来完全像"探针正常，只是页面没数据"。

2. **背板比纸条宽 98 像素。** DOM 牌子的 196 是 **CSS 像素**，
   我按 196 **世界单位**去画背板，S=3 时正好宽三倍。
   两者要靠 `PLATE_W / S` 换算。

3. **纸条横向偏出去 98 像素。** 我把"背板左缘"当成了中心，又减了一次
   半个牌宽。改成以牌子中心 `P.x` 对齐。

4. **支架比它底下的地面还暗。** 支架 `#3a2418` 亮度 40，地面第一层土
   `#333a43` 亮度 58 —— 于是牌子读成"浮在路面上的一块板"，
   看不见它站在什么东西上。提到 `#4a3524`。

另外两处是重画远景和修层次：档案架第一版画成 164 宽 166 高的墙，
颜色和背景只差一档，**它不是远处，是一堵墙**，把整块告示牌吞在里面。
距离感不靠"画小一点"，靠"又小又暗又密"三件事同时成立。
支架也必须画在牌面**之前**，否则被背板盖住等于不存在。

### 9.6 文章页：同一副外壳，竖着读

每篇配一幅**程序化**像素插画，画在 `data-art` 指定的 canvas 上：
起点（一个亮点炸开）、盘前的钟（指针指 08:45 + 向上阶梯折线）、
撞墙的猫（复用首页那只真猫，墙上几个洞）。

三个可复现的坑：

- **画布按整数倍放大。** 放大 1.5 倍时每个源像素落成 1.5 个设备像素，
  canvas 会插值出一条缝，整幅画就不再是像素画。
- **精灵落地要用 `feetY-92` 而不是 `feetY-44`。** 首页那边 mul=2、
  精灵 24 行，底边落在 `feetY+4`；照抄 -44 会让猫浮在地面上方 40 像素，
  第一眼根本不会觉得它站在地上。
- **折线必须走阶梯**（横一段、竖一格）。按 `dx*s/n` 插值画出来是 45 度
  斜线，而斜线在这个站里读成"划痕"——首页的引线为这件事专门改成直角。

### 9.7 数据三处副本

`POSTS` 现在存在于 `index.html`、`tag.html`、`assets/post.js` 三处。
上下篇导航和归档页都靠它。**改文章元数据要记得三处都改。**

---

## Round 10 (2026-10-02) — 收尾验证：窄屏进度条，和一个 headless 新坑

上一轮交付时我把"窄屏文章页底部进度条是否可见"标成了**工具限制、未能证实**。
这一轮回去把它证实了 —— 结论是**可见**，而且顺带挖出一个真缺陷。

### 10.1 上一轮那个"未能证实"是错的

当时手里两条证据互相矛盾：盒模型探针报 `rect=12,1486 396x4`，
`pos=fixed disp=block vis=visible op=1`，位置分毫不差；而 raw 视口图底部
120 像素里找不到那条 track。一边说元素在、一边说像素不在，只能有一个是错的。

矛盾的来源是**看的方式**：轨道底色 `rgba(59,51,80,.8)` 压在 `--ink #14121c`
上混出来是 `#332c46`，4px 高。在 1x 截图里它是一条几乎贴背景的暗线，
而同一张图上还有一块 `#ffee00` 的探针报告在抢视线 —— 于是"看不见"
变成了"我恰好没在看那一行"。

把裁切窗口压到 34px 高、放大 8 倍，四个 pip 和条立刻清清楚楚。
**教训：判断"某个东西在不在"之前，先确认取景框真的罩住了它。**

### 10.2 但它确实有一处真缺陷：橙色进度段从来没画过

逐像素扫 420px 宽那一行，拿到的是完整答案：

| x | 颜色 | 是什么 |
|---|---|---|
| 12 | `#ef7c2a` | 橙色 fill 起点（正好是 `left:12px`） |
| 54–69 | `#ffb03b` | pip 0，`.on` |
| 153–168 | `#ffb03b` | pip 1，`.on` |
| **210** | `#332c45` | fill 到此为止 = 12 + 396 × 50% |
| 252–267 | `#15122a` 边 + `#3b3350` | pip 2，未点亮 |
| 351–366 | `#15122a` 边 + `#3b3350` | pip 3，未点亮 |
| 408 | `#14121c` | 条结束（`right:12px`） |

四个 pip 精确落在 12.5 / 37.5 / 62.5 / 87.5%，fill 占 50%。

问题出在 `site.js`：`initNav()` 造出了 `.fill` 这个 div，**却从来没给它赋过
宽度**，CSS 里是 `width:0`。首页的 fill 由 `setZone()` 每次换区写一次，
共享脚本没有 `setZone()`，于是**非首页的进度条永远只有底色、没有橙色进度段** ——
两个 pip 亮着，底下的路却一格没走过。

补上，算法和首页一字不差：

```js
if (fill && active >= 0) fill.style.width = ((active + 1) / ZONES.length * 100).toFixed(1) + '%';
```

### 10.3 顺带纠正一条写错的注释

`initNav()` 上方的注释写着"非首页这几个页面不属于任何一区，所以传 -1，
整条进度条都点亮"—— **这是错的，而且代码从来没实现那个 -1 分支**
（`i <= -1` 一个都不会亮）。

实际情况正相反：这几个页面就是**属于某一区**的。`ZONES[1]` 是"公告栏 /
NOTICE BOARD"，而 tag 和三篇文章的 HUD 区名都写着 NOTICE BOARD ——
文章是挂在公告栏牌子上的路牌。`data-active="1"` 是对的。
注释已改成描述真实行为，并写明 -1 时保持 `width:0`。

**注释和它的代码互相矛盾时，先怀疑注释。** 这一条是反着查出来的：
先看到四个页面全传 1，才回头看 ZONES 才发现注释站不住脚。

### 10.4 headless 的新坑：首帧截图漏掉后插入的 fixed 元素

排查中撞上一个没见过的现象，单独记一笔：

- 真实文章页，420×900，延时 800ms → 轨道**整条不画**，y=886~889 全是底色
- 同一页，延时 2200ms → 还是不画
- 同一页 + 一个 1px 的 fixed div 在 1200ms 插进 body → **轨道正常画出来**

headless 的**首帧截图会漏掉页面加载后才插入的 fixed 元素**，直到有别的东西
触发一次重绘。`boot()` 跑在 `DOMContentLoaded` 里，`znav` 和时钟都被画出来了
—— 只有这个 `position:fixed` 的漏了。所以"元素在 DOM 里"和"元素在像素里"
可以同时一个真一个假。

`post/_probe.html` 之所以测得出来，纯粹因为它自己往 body 里塞了个报告，
顺手把重绘触发了。**探针报"有"的时候，得先确认探针自己没顺手修好现场。**

定位用的是 1px 空 div（`_probe2.html`）而不是报告：报告那版同时动了取景和
DOM 两处，分不清是哪一处起了作用。两个探针用完即删，没留在 `static/`。

---

## Round 11 (2026-10-02) — 对着目标收口：RSS 还停在旧模板

目标那句是"做除了看盘面以外的页面"。这一轮先回头核**到底还剩什么**，
再把剩的做掉。

### 11.1 范围盘点：确认没有漏网的页面

| 文件 | 判定 |
|---|---|
| `index.html` | 首页，前八轮已收工 |
| `tag.html` | 归档页，第九轮已做 |
| `post/*.html` ×3 | 文章页，第九轮已做 |
| `MarketViewer.html` | 盘面页，**按用户要求不动** |
| `premarket.html` | 盘面页（美股/A50/港股/外汇/原油/黄金 + ECharts），**不动** |
| `rss.xml` | 站点对外的 feed，**首页明写"订阅"链出去** —— 就是它 |
| `postList.json` | Gmeek 构建产物，全站无引用，**不动** |

`premarket.html` 只存在于 `docs/`、不在 `static/`，是唯一一个"两边不一致"的
页面。核过内容确认是盘面页，排除正确 —— 但它仍然缺一份 `static/` 源，
**下次若要把盘面页也纳管，得先补这份源**。

### 11.2 真正的缺口：订阅出去的还是 Gmeek 的占位文本

`rss.xml` 是 Gmeek 从 `blogBase.json` 生成的，而那份配置里
`"title": "Blog Title"`、`"subTitle": "Blog description"`、
`"avatarUrl": "https://github.githubassets.com/favicons/favicon.svg"`
三个字段从没填过。于是首页新做的那个入口 —— 公告栏里写着
**"订阅 / RSS / 每天早上自己来叫你"** —— 点进去是
`<title>Blog Title</title>`、`<description>Blog description</description>`、
图片标题 `avatar`，头像是 GitHub 的占位 favicon 地址。
`lastBuildDate` 还停在 8 月 26 日。

**这是新设计里唯一漏掉身份的地方**：页面全是像素橘猫，订阅出去却还是模板脸。

重写时顺手把三件事做对：

- **时区**。原文件三篇的 `pubDate` 都是 `+0000`，而 `postList.json` 里的
  `createdDate` 是 UTC+8 日期 —— 两者本来就对得上（bug 那篇 UTC 是 8/26，
  UTC+8 是 8/27）。统一改成 `+0800`，和 `blogBase.json` 的 `"UTC": 8` 一致。
- **描述**。三篇的 `<description>` 换成**新页面 `og:description` 的原文**，
  不再是 Gmeek 那份。改一处漏一处的风险就此断开。
- **图**。`<image><url>` 要的是一个能真取到的 URL，内联 `data: URI`
  在多数阅读器里不认。所以按 favicon 那份 SVG 的**同一套矩形几何**，
  整数 2 倍画成 `assets/cat.png`（32×32，207 B）。
  生成脚本 `out/make-cat-png.ps1` 把 16×16 源码网格打印出来核对过，
  逐行与 SVG 一致。**这个图标现在有两份真身**（PNG 和五个页面 head 里的
  data URI），改画法要一起改。

### 11.3 全站内链体检

`out/linkcheck.ps1`：把 5 个非盘面页面里所有相对 `href`/`src`
按 `docs/` 树解析一遍。**26 条内链，0 条死链**。

第一版报了 5 条"死链"，全是误报 —— 正则把 JS 拼接片段
`href="' + c.href + '"` 当成了链接。过滤条件加上"值里含 `+ ' $` 即跳过"后归零。
**链接检查器不区分 HTML 属性和 JS 字符串，就一定会被拼接代码刷屏。**

### 11.4 今天第二次被 PowerShell 5.1 的编码咬

写 `make-cat-png.ps1` 时在注释里写中文，结果：

```
ParserError: Unexpected token ')' in expression or statement.
```

**PowerShell 5.1 把没有 BOM 的 `.ps1` 当 ANSI 读**，UTF-8 的中文字节
被按本地代码页解释，其中某些组合会吃掉后面的引号，语法就断了。
第一次失败报的是 `Bitmap` 构造器 "Parameter is not valid"，完全指向另一个方向，
差点去查 GDI+ —— 真正的错在**解析期**，比报错位置早了好几行。

处理：脚本一律纯 ASCII，中文说明写进 BRIEF 而不是写进脚本。
写完 `Get-Content -Raw -Encoding UTF8` 看 BRIEF 会花屏（同一个原因，
读的时候要显式带 `-Encoding UTF8`），**写和读要用同一套编码假设**。

另外 `New-Object System.Drawing.Bitmap (16*$M), (16*$M)` 这种写法在
变量参与时参数会被当字符串，用 `-ArgumentList` 或
`[System.Drawing.Bitmap]::new(...)` 才稳。

---

## Round 12 (2026-10-02) — 收口后被复查打回：三个真问题

目标在第 11 轮判了完成。复查指出三条证据缺口，复查完**其中一条是真 bug**，
一条是整个站点会**每天被自动冲掉**。这一轮把它们全修了。

### 12.1 真 bug：从任何文章页点分区方块都 404

`site.js` 原来写死：

```js
var HOME = 'index.html';   // 被 initNav 里的两处 location.href 消费
```

`tag.html` 在站点根，`post/*.html` 在 `post/` 下。文章页点任何一个分区方块
（顶部区导航或底部四格）都会跳到 **`post/index.html#zN`** —— 那个文件不存在。
三篇文章、八个入口，全是死链。

**为什么前面十一轮一次都没发现**：第 11 轮刚跑过链接体检，报的是
"5 个页面 26 条内链 0 死链"。因为这个地址**不在任何 `href` 属性上**，
它是 JS 里 `window.location.href = HOME + '#' + id` 拼出来的。
扫 HTML 的检查器在结构上就看不见它。

修法不是去算相对路径，而是**读页面 head 里那个品牌链接的 href**：

```js
function homeHref() {
  var b = document.getElementById('brand');
  var h = b && b.getAttribute('href');
  /* 首页的品牌链接是 '#z0' 这种纯片段（首页自带脚本，根本不加载本文件），
     但真被读到的话拼出来会是 '#z0#z1' 这样的坏片段。宁可退回站点根。 */
  if (!h || h.charAt(0) === '#') return './';
  return h;
}
```

那个 href 是每个页面手写的、本来就对、而且**链接检查器本来就在校验它**。
把导航地址挂在一条已经被验证的链接上，比在 JS 里重算一遍路径可靠。

**真机验证**（不是读代码，是真点）：从
`docs/post/Origin of everything.html` 点第三个方块「回到雨桥」，
实际跳到 `file:///C:/WorkFiles/blog/docs/index.html#z2`，
首页直接落在雨桥区，进度条三格点亮、橙色填到 75%。

### 12.2 链接检查器补上 JS 那一层

`out/linkcheck.ps1` 加了第二遍：对每个页面加载的 `<script src>`，
把里面像相对路径的字符串字面量抠出来，**按该页面的目录**逐个解析。
一个从 `/` 正确、从 `/post/` 错误的字面量，正是这一遍要抓的东西。

两个假阳性，都是自己踩的：

1. 第一版把 JS 拼接片段 `href="' + c.href + '"` 当成了链接，报 5 条死链。
   过滤条件加上"值里含 `+ ' $` 即跳过"后归零。
   **不区分 HTML 属性和 JS 字符串的链接检查器，一定会被拼接代码刷屏。**
2. 加了第二遍之后，它把我新写的**注释**里那句"写死 'index.html' 会 404"
   当成了活路径，又报 3 条。修法是扫之前先剥掉 `/* */` 和 `//` 注释 ——
   **检查器扫的是代码，不是文档。**

然后做了一次负向测试证明它真的有用：往 `docs/assets/site.js` 尾部塞回
`var HOME='index.html';`，检查器立刻报出那 3 个文章页；还原后归零，
static/docs 哈希一致。**一个从没红过的检查器和一个坏了的检查器长得一模一样。**

### 12.3 真正危险的那条：Gmeek 每天把整个 docs/ 重写一遍

`STATUS.md` 里早就写着：

> **Gmeek 的 runAll 模式会重写 docs/，任何不在它认知里的文件都会被删掉**

`Gmeek.yml` 第 53 行 `cp -a /opt/Gmeek/docs ${{ github.workspace }}`，
而它的 schedule 是 `cron: "0 16 * * *"`（每天 16:00 UTC）。
也就是说 **`tag.html`、`post/*.html`、`rss.xml` 会在每天凌晨被模板版覆盖，
线上看着"没改过"，其实是每天被冲一次。**

`market-viewer-sync.yml` 已经在 Gmeek 之后跑（`workflow_run` 触发），
但它的 cp 清单只有四项：`MarketViewer.html`、`index.html`、`assets/`、`data/`。
**归档页、三篇文章、RSS 三样都不在里面。** `git add` 的清单同样只有四项 ——
就算 cp 了，不 add 就等于没提交。

三处一起补（漏任何一处都还是会被冲）：

| 位置 | 补了什么 |
|---|---|
| `paths:` 触发 | `static/tag.html`、`static/post/**`、`static/rss.xml` |
| cp 清单 | 同上三项，加空目录守卫 `ls static/post/*.html >/dev/null 2>&1` |
| `git add` | `docs/tag.html docs/rss.xml docs/post/` |

workflow 名字**故意不动** —— `pages-deploy.yml` 用 `workflow_run` 按名字挂在
它上面，改名会直接断掉部署链。只在注释里写明它现在名不副实。

`out/syncsim.ps1` 做了一次沙盒仿真：拿真的 `static/` 当源，把 `docs/`
填成 Gmeek 留下的样子（模板版 index/tag/rss、一个 Gmeek 凭空造的
`post/Gmeek-orphan.html`、`assets/gmeek.css`），照 workflow 的清单逐条 replay，
再断言每条同步结果和 `static/` 字节一致。14 条全过。

仿真还暴露一件本来不会有人知道的事：**sync 只覆盖、不删除**，
所以 Gmeek 造出来的孤儿文件会留在 `docs/` 里。当前无害
（`blogBase.json` 记的 `postUrl` 和现有三个文件名一致，Gmeek 不会另起名字），
但真出了孤儿文章页，症状会是"某个 URL 居然能打开"。

**故意不同步的两项**，也写进注释免得以后有人"顺手补上"：
`static/fonts/`（Gmeek 遗留，`index.html` 和 `site.css` 都把字体内嵌成
base64 了，**没有任何页面引用 `fonts/*.woff2`**，搬过去只是让部署包变大）
和 `static/.sync-trigger`（Mavis 的空标记文件）。

### 12.4 还没动的（留给用户决定）

`static/index.html:2661` 有一条指向 `Meekdai/Gmeek` 的**活代码**署名链接，
是首页唯一的外部链接；首页也还没有用户要保留的那个 GitHub Issue 链接。
第九轮确认过"去掉 Gmeek 署名、保留一个 Issue 链接"，但那句话是针对
四个新页面说的，而用户同时说过"主页面先这样"—— 首页是它唯一还没被
这条决定覆盖的地方。删是一行，但署名是用户的判断，不替他做。

---

## Round 13 (2026-10-02) — 归档页在手机上木框浮在天上

用户报"tag 页面有 bug"。查下来是两个叠在一起的问题，主因在窄屏才暴露。

### 13.1 主因：`drawImage` 的偏移量和 `fillRect` 的变换不是一回事

画布主上下文的变换是 `setTransform(S,0,0,S,0,0)`，**没有平移分量**。
相机偏移（`-camX` 和 `DY`）是靠 `drawImage` 逐个当参数传进去的。
于是同一个世界坐标系里就有了两套写法：路面和远景用 `drawImage(..., DY)`
所以带上了偏移，木框和支架用 `fillRect(..., GROUND-46, ...)` 所以没带上。
纸条（DOM）、猫、路面三者都带 `DY`，只有木框不带 —— 于是木框浮在天上、
纸条站在路上，猫走到牌子底下会被纸条挡住。

用 639×683 的实测值验算（S=1，DY=302），和截图逐项对得上：

| 元素 | 代码算出的屏幕 y | 截图实测（÷1.25） |
|---|---|---|
| 木框背板 | 62..180 | 60..184 ✓ |
| 支架立柱 | 144..190 | 180..238 ✓ |
| 猫（带 DY） | 492 | 615 ✓ |
| 路面（带 DY） | 492 | 612 ✓ |
| DOM 纸条（带 DY） | 308..480 | ✓ |

**为什么十一轮一次都没发现。** `S = floor(min(vh/230, vw/340))`，
宽屏时（1280×800 → S=3）正好让 `vh*0.72/S ≈ GROUND`，于是
`destY = 576/3 - 190 = 2` —— **DY 几乎等于 0，bug 被数值抵消掉了**。
窄屏或竖屏时 S 被宽度卡住，DY 能到几百。**十轮里所有桌面端截图都在
bug 的盲区里。**

修法就是把 `DY` 放进变换：`c.save(); c.setTransform(S,0,0,S,0,DY*S); … c.restore();`

**首页早就踩过这个坑并且写下来了**（`index.html` 里 `rainAmt>0` 那段上方：
"凡是直接 fillRect 画的东西，都必须自己补上这两个平移，否则坐标是世界坐标……
雨、桥面溅点、闪电折线三段都栽过这一下：雨桥一直'不下雨'"）。
两个文件共用同一套约定，规则只写在一边，另一边照踩。
**约定要写在共用的地方，或者至少互相引用** —— 已在 tag.html 加了交叉引用。

### 13.2 第二个：木框尺寸写死，和纸条真实尺寸对不上

`PLATE_W=196, PLATE_H=118` 是写死的，但纸条的真实尺寸是变的：

- 窄屏 `@media(max-width:860px)` 把 `width` 从 196 改成 **168**（实测 168）
- 高度本来就随标题和摘要折几行走，**实测 172~190px**

所以窄屏下木框比纸条宽 28px、比纸条矮 50 多 px，居中也偏出去 14px。
顺带说一句：`positionPlates()` 用 `PLATE_W/2` 居中，而画布那边用
`sx-pw/2`，两边靠同一个常量"碰巧一致"，一旦 DOM 宽度变了就各偏各的。

改成量 DOM：新增 `measurePlates()`，在 `buildPlates()` 之后和每次
`layout()`（resize 会跨过 860px 那条断点）时读 `offsetWidth/offsetHeight`
存到 `POSTS[i].domW/domH`，画布和定位都改用实测值。
写死的常量保留为兜底（`(P.domW||PLATE_W)/S`），`domW` 缺失时不会算出 NaN。

**`.plate.off` 用的是 `opacity:0` 而不是 `display:none`**，所以纸条被筛掉时
`offsetWidth` 依然有效 —— 这条路径特意确认过，否则"筛选后 resize"会
把尺寸量成 0。

### 13.3 工具：edit 改不动含中文注释的块

`edit` 工具连续三次报"找不到精确匹配"，而 `read` 出来可见文本完全一致。
同一行 ASCII（`var sx=...`）一改就成功 —— 问题出在中文注释行，
那些全角标点里藏着不可见差异。写了 `out/replacelines.ps1` 按行号替换，
**同时保证 UTF-8 无 BOM + LF 不被改写**（这些站点文件就是这个规格）。
改代码块优先按行号或按纯 ASCII 锚点，中文注释单独处理。

### 13.4 方法：动画页面不能跨帧比较

一开始反复对不上号：截图里牌子在 y≈85，inspect 报纸条底部 480。
原因是相机跟着猫在走，**截图和 inspect 是两帧不同的世界位置**。
第一张截图还是"导航瞬间"拍的，视口随后又变过一次（799→639）。

教训：判断动画页面的布局，要取**同一帧**的证据。
这一轮最终靠的是"inspect 单帧的精确矩形 + 用它反推的 S/DY 去对截图像素"。
控制变量则靠 `shot.ps1` 固定尺寸 + 强制 reduced-motion。

### 13.5 验证

| 视口 | 结果 |
|---|---|
| 1280×800 | 木框立于路面，纸条贴面，猫在路面 —— 无回归 |
| 430×900 | 同上，支柱可见 |
| 360×740 | 同上，支柱可见 |
| 639×683（真机） | 木框已落到地面，纸条底部 480 / 地面 492 |

控制台 0 错误 0 警告；`out/linkcheck.ps1` 5 页 26 条内链 0 死链；
static 与 docs 十二个文件 SHA256 一致。

**留一个没动的观察**：纸条是 DOM、`z-index:10`，画布 `z-index:1`，
所以猫走到牌子正后方时会被纸条挡住。牌子是种在路上的，猫从后面走过
在物理上说得通，但主角被遮住不好看。改成猫在前需要把猫挪到独立的
画布层上，不是顺手能改的，等用户定。

---

## Round 14 (2026-10-02) — 归档页重做成白天的草原

用户提了三件事：移动会偏移、想改成白天的草原、木板要随文章数自动增多、
纸条要贴在木板上（比木板小一点）。四件都在这一轮做完。

### 14.1 偏移的真正原因：两套取整

上一版木板在**世界坐标**里 `Math.round(sx - pw/2)`，纸条在**屏幕坐标**里
`Math.round(cx - w/2)`。同一块板子被算了两次，`camX` 每帧变，两次取整
落在不同的格子上 —— 表现为木板在纸条边上每帧抖一个像素。

改成**只有一个来源**：

```js
function plateRect(i){
  var P=POSTS[i], S=view.S;
  var w=P.domW||PLATE_W, h=P.domH||PLATE_H;
  var cx=Math.round((P.x-view.camX)*S);
  var bottom=Math.round((GROUND+view.destY)*S)-Math.round(26*S);
  return {x:cx-Math.round(w/2), y:bottom-h, w:w, h:h, cx:cx, bottom:bottom};
}
```

木板画在屏幕空间、用 `r` 外扩 `pad`；纸条直接 `translate(r.x, r.y)`。
两边读的是同一次调用的返回值，结构上不可能再错开。

顺带去掉一个隐患：原来纸条靠 `translateY(-100%)` 定位，那个 -100% 依赖
元素**自己的高度**，标题一换行高度就变，板子和纸又错开。现在直接给
`r.y`，和高度无关。

`transform` 从此成了定位的载体，所以 CSS 里两处必须清掉：
`.plate:hover` 的 `translate(-2px,-2px)` 和 `.plate.off` 的
`translateY(14px)` —— 都会把纸条从板上拽走。hover 改成只动投影，
"抽走"改成只用透明度。

### 14.2 纸条贴在木板上

木板 = 纸条外扩 `pad = 7*S`，四边等距；板面画两道横缝读成"三块木头拼的"，
顶上一个金色图钉，两根立柱从板底落到路面。纸条比木板小一圈，居中，
就是一张钉在木牌上的纸。

### 14.3 场景：白天的草原

夜空和档案架换成：蓝天三档色带 + 阶梯太阳 + 循环云 + 远山 + 草甸 + 土路
+ 近景草。山、云、太阳全部**逐列算高度再量化到台阶**，不画斜线也不画圆
—— 斜线在这个站读成"划痕"（第 9 轮为此专门把折线改成直角）。

### 14.4 远景改成按地平线比例排版

第一版把山画在世界层里、尺寸是固定的世界单位。结果 S=1 的窄屏上视口
900 高、世界只有 300，山缩成天上一个小土包，**下面六百像素全是空天**。
夜里是深色，看不出来；换成白天的蓝天就一眼露馅。

改成：远山和草甸都在**屏幕空间**画，纵向按 `horizon` 取比例
（山高 0.10~0.30 H，草甸 0.09 H），横向 0.4x 视差并循环平铺。
任何视口比例下构图都一样，远景层整块删掉。

草甸还必须**一路铺到路面**（`horizon`），只铺到山脚的话中间会漏出一条
天蓝 —— 改完第一版就是这么漏的，第二版补上。

### 14.5 木板随文章数自动增多

这一条本来就是结构上成立的：`p.x = FIRST_X + i*GAP`，`WORLD_W` 由最后
一块牌推出，主层画布 `cv.width = WORLD_W`，天空/山/草甸/草叶都循环平铺。
`out/worldgrow.ps1` 从**源文件里读出这几个公式**再求值（不是复刻一份）：

| 文章数 | 最后一块 x | WORLD_W |
|---|---|---|
| 3 | 1180 | 1588 |
| 8 | 2880 | 3288 |
| 20 | 6960 | 7368 |

真机验证：造了个 8 篇的临时副本，筛选计数自动变成 ALL 8 / DOCUMENTATION 5
/ BUG 3，世界变长、场景继续平铺。**唯一一次翻车是夹具生成器自己少了逗号**，
页面白屏 —— 那种"看起来像页面坏了"的现象，先怀疑夹具。

### 14.6 验证：漂移检测脚本，和它自己翻的三次车

肉眼看不出一像素的偏移，所以写了 `out/margin.ps1` 扫真实像素行：
先找**最宽的连续米色纸面**，再从纸面往外找**最外侧**的木框像素，
量出左右边距，几个不同机位必须给出同一个数。

这个脚本自己翻了三次车，每次都是"看起来在跑、其实什么都没测"：

1. **量出全空、还报 PASS。** 管道会把数组**拆开**，`$runs | Sort-Object`
   把"数组的数组"摊平成裸整数，后面取下标全返回 null。
2. **右边距恒定少 4 像素。** `.plate` 的 `box-shadow: 4px 4px` 正好落在
   纸的右边框和木板右边之间，往右扫会停在影子上。
   左边没有这层遮挡，所以只量左边 —— 这不是取巧，是唯一诚实的量法。
3. **量出 3 像素。** "往左找第一块木头"停在了**最靠内**的木像素上，
   那是边框不是板边。改成"找到第一块之后继续穿过去"才对。

最后必须自检：**证明这个检查能报错**。一个只会打印 PASS 的检查，
和一个根本没看东西的检查长得一模一样。现在四个机位都是 23/23：

```
fin-400.png   board 617..852   paper 640..829   marginL=23 marginR=23
fin-600.png   board  17..252   paper  40..229   marginL=23 marginR=23
fin-900.png   board 137..372   paper 160..349   marginL=23 marginR=23
fin-1200.png  board 257..492   paper 280..469   marginL=23 marginR=23
```

### 14.7 还改掉的两个小东西

- **首帧闪一下。** 纸条是 `position:absolute;left:0;top:0`，在第一帧
  `positionPlates()` 跑之前它就在屏幕左上角。`#plates{visibility:hidden}`，
  摆完第一帧再显示。
- **太阳压住 HUD。** 它的半径随 S 放大而 y 只按 `horizon` 比例走，
  S=1 时 0.23 躲开了筛选条，S=3 时半径三倍又压回去了。
  压到 0.42 是两档都躲开的位置。另外 `FILTER` 那个词本来没有底色，
  `--stone` 落在蓝天上几乎看不见，补上和按钮同样的深底。

### 14.8 验证

- 1280×800 / 430×900 / 360×740 三档实机截图，构图一致
- 8 篇夹具：牌子自动增多，筛选计数正确
- 漂移检测：4 机位 23/23，含自检
- 世界宽度：1~20 篇全部单调增长，无硬编码
- 控制台 0 错误 0 警告
- `out/linkcheck.ps1` 5 页 26 条内链 0 死链
- static 与 docs 十二个文件 SHA256 一致

---

## Round 15 (2026-10-02) — 上一轮漏掉的那一条：CSS 过渡

复查指出：`.plate` 的 `transition` 里还留着 `transform`，而且所有验证都开着
reduced-motion。两条都对，而且第二条揭出了这一轮真正的东西。

### 15.1 真正的根因不是取整，是过渡

上一轮我认定"两套 `Math.round`"是偏移的根因，改成了单一来源 `plateRect()`。
那个改动是必要的 —— 两次计算确实会落在不同格子上。但它**不是**用户看到的
那个偏移的原因。

真正的原因是：

```css
.plate{ transition: transform .08s steps(2), ... }
```

纸条的坐标每帧被 `positionPlates()` 写进 transform，而木框是 canvas 瞬时画
的、没有任何过渡。所以相机一移动，木框立刻到了新位置，纸条却要用 0.08 秒
`steps(2)` 去追 —— 视觉上就是"啪地歪一下再回来"，`steps(2)` 让它只有 0 和 1
两帧，越走越偏。

修法只有一行：把 `transform` 从 transition 里拿掉。

```css
transition:box-shadow .08s steps(2),opacity .2s;
```

**为什么十一轮都没测出来。** `site.css` 里有一条
`@media (prefers-reduced-motion:reduce){ *{transition:none!important} }`，
而 `shot.ps1` 默认强制开启 reduced-motion。也就是说**我这一轮跑的每一个截图
测试，CSS 过渡都是关闭的**，这类 bug 在里面结构性地不可见。
上一轮我写"控制台 0 错误、四机位 23/23"的时候，测的根本不是出问题的那条路径。

### 15.2 量化：纸条偏了 260 像素

`margin.ps1` 扫真实像素行，量"纸左缘相对板左缘"：

| | 板 x | 纸 x | 纸左缘 − 板左缘 |
|---|---|---|---|
| 修复后 | 978..1213 | 1001..1190 | **23** |
| 修复前 | 844..1079 | 1126..1279 | **282** |

不是"抖一像素"，是纸条彻底脱板 282 像素、还被视口切掉。测试脚本直接报
`board wood not found beside the paper` —— 木板离纸条太远，找不到旁边的木头。

### 15.3 反向验证：把这个 bug 加回去，检查必须报 FAIL

只证明"现在是好的"不够，要证明**这个检查确实能抓到它**：

1. 临时把 `transform .08s steps(2)` 加回 transition
2. 用同样的方式重新截图（`-Motion`）
3. `margin.ps1` 报 FAIL
4. 还原，再跑，PASS

修复后 8 帧（2 个机位 × 4 个延迟，全部 `-Motion`）：

```
mo-400-300   board 978..1213  paper 1001..1190  marginL=23 marginR=23
mo-400-500   board 978..1213  paper 1001..1190  marginL=23 marginR=23
mo-400-700   board 978..1213  paper 1001..1190  marginL=23 marginR=23
mo-400-900   board 844..1079  paper  867..1056  marginL=23 marginR=23
mo-1200-300  board  53..288   paper   76..265   marginL=23 marginR=23
mo-1200-500  board 341..576   paper  364..553   marginL=23 marginR=23
mo-1200-700  board  53..288   paper   76..265   marginL=23 marginR=23
mo-1200-900  board 523..758   paper  546..735   marginL=23 marginR=23
```

木框位置在帧间确实在变（978→844、53→341→523），说明采到了相机**滑动过程中**
的画面，不是静止帧。

### 15.4 教训

**"测试环境"本身就是被测系统的一部分。** 这一轮我为了拿稳定画面而用了
`shot.ps1` 的默认 reduced-motion，它顺手关掉了 CSS 过渡 —— 而这正是被测的
机制。截图工具的"方便默认值"和被测行为重叠时，默认值会把 bug 藏起来。

现在 `out/margin.ps1` 的文件头写明了：采样必须带 `-Motion`，
并且给出了 `site.css` 里那条规则的原文和它为什么致命。

同理，**改了计算不等于改完了**：CSS 里凡是作用在承载定位的那个属性上的
声明（这里的 `transform`、上一轮清掉的 `:hover` 和 `:off` 里的 `translate`），
都要一起看一遍。定位一旦由 JS 每帧写入，transform 就从"动画"变成了"坐标"，
任何针对它的过渡或变换都是 bug。
---

## Round 16 (2026-10-02) — 手机端顶部互相遮挡、底部路条、猫的移动特效

用户提了三件事。

### 16.1 顶部遮挡：两个独立的成因

**(a) 筛选条压在区导航上。** `.filters` 写死了 `top:56px`，而 HUD 是
`flex-wrap` 的 —— 宽屏一行放得下，窄屏区导航折到第二行，HUD 长高了，
写死的 top 就和区导航叠在一起（430px 宽时两者 y 区间 56~64 完全重合）。

改成量 HUD 的实际高度。但**第一版改法又错了**：在 `layout()` 里量一次。
两个坑叠在一起 —— 区导航是 `site.js` 在 `DOMContentLoaded` 里才塞进 HUD 的，
在那之前 HUD 只有品牌和时钟（高 34），塞完变成 71。量到 34、写下 `top:40px`，
结果筛选条和区导航**完全重合在 y=40**（真机 inspect 实测）。

正解是 `ResizeObserver`：它盯的是尺寸变化本身，不管变化是谁引起的。
降级路径留了 `addEventListener('resize', fitFilters)`。

**(b) FAR SHORE 被切掉一截。** `site.css` 给 `.hud > *` 统一写了
`flex-shrink:0`（那是给品牌和时钟的），区导航于是挤不下也不肯缩，
390px 宽时直接溢出视口。窄屏下让它独占整行、内部自己折行。

现在 360px 宽：品牌+时钟一行，区导航两行（FAR SHORE 完整），筛选条一行，
三者互不重叠。

### 16.2 底部路条：跟着猫走的那条

上面那排四个方块说的是"我在站点的哪一区"，它永远是固定的。新加的这条
说的是"这条路我走完了没有"，跟着相机动：深色底槽 + 走过部分的木色填充 +
每篇文章一个刻度（走过的变亮 `#ffd98a`，还在前面的是暗的 `#5a5470`），
一眼看出还剩几篇。

**画在 canvas 上，没做成 DOM。** 它每帧都要跟相机走；DOM 版本就是一条
每帧重写的 transform —— 第 15 轮刚在那种东西上栽过（一个 CSS transition
让纸条脱板 282 像素）。颜色也刻意和分区条分开：两根挨在一起，
不换色就分不清谁是谁。

### 16.3 猫的移动特效：原来根本没有

精灵只有三张（`cat24` / `cat24_blink` / `cat24_sleep`），**没有走路帧**。
归档页的 `drawCat` 原来只有一句"选一张贴上去"，猫是贴着地滑过去的，
远看就是一张会动的贴纸。

首页那套是有的，照搬过来：**上下弹（正弦）+ 前倾 + 落地压扁/空中拉长 +
扬尘 + 眨眼 + 影子**。减少动效时全部归零 —— 画布上的运动完全不受 CSS
transition 管辖，所以 JS 里必须真的判断 `RM.matches`。

**同时把猫拆到独立的一层画布**（`#cCat`，`z-index:6`，夹在场景 1 和纸条 5
之间）。原来猫和牌子共用一张画布，猫从牌子**后面**经过，走过去时整个
消失在纸条后面 —— 移动特效有一半时间看不见。现在告示牌是立在路边的、
猫走在路前面，猫从牌子前经过。

### 16.4 验证：我的测量方法错了两次

想证明弹跳在渲染，量了四帧的猫脚底高度，全是同一个值 —— 一度以为代码没生效。

**错因是我在拿正弦的一个周期当常量测。** 弹跳是
`sin(now*0.009+ph)`，**一半周期是 0**，随机抽几个时刻当然抽不到。
用页面内探针打出实时读数才看清：

```
moving=true  RM=false  dir=1
now=122  sin=0.745
hopN=0.745  hop=3.75
feet=186.3  anim=true          <- 地面是 190，脚抬起了 3.7 格
```

再用两个夹具做对照（同样的 `ph`，一个走路一个坐着）：

| | 猫顶 | 猫脚底 |
|---|---|---|
| 走路（弹跳波峰） | 457 | 564 |
| 坐着（无弹跳） | 462 | 575 |

**脚底抬升 11 像素**，理论值 3.75 世界单位 × S=3 = 11.25。吻合。

第二个坑：探针脚本里含 `</script>`，把 tag.html 自己的脚本提前闭合，
整段源码当正文渲染了出来 —— 注入探针的代码块不要带闭合标签，
改成在原脚本内部插。

### 16.5 顺带修的

- **太阳**：之前在阶梯圆盘里塞了个浅色**方块**，圆盘套方块像荷包蛋。
  改成亮芯跟着盘的形状走。
- **首帧闪一下**：`#plates` 加 `visibility:hidden`，第一帧摆完再显示。


---

## Round 17 (2026-10-02) — 底栏改成这一页的进度条，太阳重画

用户两条：底下的条应该是这一页的进度条，现在点它会跳主页面；太阳太丑。

### 17.1 底栏：删掉跳首页的分区条

原来归档页底部挂的是 `site.js` 建的 `.track` —— 四个分区方块，点一下
`HOME + '#zN'` 回首页对应区。那是**首页的语言**：它回答"我在站点的哪一区"。
归档页底下要回答的是"这篇路我走完了没有、现在第几篇"，两件事无关。

直接删掉 tag.html 里的 `<nav class="track" id="track">`。`site.js` 里
`var tr = el('track'); if(!tr) return;` 会安静地跳过，不报错（真机控制台 0 错误）。

**去主页面还有两条路**：顶上的品牌区和区导航。底部不再承担这个职责。

底栏由 `drawRoadBar()` 画，现在它是这一页唯一的底栏，所以给足了信息：

- 深色底槽 + 走过的部分（木色填充，上沿一道亮边 —— 和站里"受光唇 + 面层"同一套语言）
- **每篇文章一个刻度**，走过的 `#ffd98a`，还在前面的 `#574f6b`：还剩几篇一眼看到
- 猫最近的那一篇，条上方顶一个**小尖**（两行阶梯，三角也不画斜边），说得出"现在第几篇"

真机实测：点底栏 → `navigation.detected: false, urlChanged: false`，不再跳走。

### 17.2 太阳：连着修了两个自己的 bug

**Bug 一：光芒坐标不自洽。** 第一版除了上下左右四根短条，还加了四个对角，
但左下和右下落在了不同方向，串起来在盘底拼出一个"碗"。而且对角哪怕画成
虚线阶梯，斜向在这个站依然读成"划痕"（首页的引线为这件事专门改成直角）。
**去掉对角，只留四根短条。**

**Bug 二：盘身被掐细了。** 改同心环时我写成"只填到 `wMid` 就停"，
于是在 0.42~0.76 那一圈里行宽比上下两段都窄一圈，底边反而外扩出来 ——
就是上一版那个"碗"的真正成因。改成**由外往内逐层覆盖**：每层先铺满自己
的 `wOut`，再被里层盖住。

最终形制：三档同心色环（`#fff3c4` 芯 / `#f6cf5e` 中 / `#e3ac44` 边）
+ 上下左右四根短条，逐行算每环半宽整行填充（2×sr 次绘制，不是逐像素），
轮廓是台阶，整体没有一根斜线。

### 17.3 验证

- 真机点底栏：`urlChanged: false`；DOM 里底部已无任何 link/button
- 控制台 0 错误 0 警告（`site.js` 遇到没有 `#track` 安静返回）
- 视口 1280×800 / 390×844 / 360×744 实机截图
- 漂移检测 `-Motion` 6 帧复跑 PASS（23/23）
- linkcheck 5 页 26 条内链 0 死链
- static 与 docs 十二个文件 SHA256 一致

**记一笔工具坑**：`Get-Content` 不带 `-Encoding` 按 ANSI 读 UTF-8 文件，
行数能和 `[System.IO.File]::ReadAllLines` 差四百多行。所以数行数和按行
替换一律走 .NET 的 ReadAllLines，不要用 Get-Content。

---

## Round 18 — 底栏改成可点的；查清"加一篇会不会自动加板子"

### 18.1 底栏：canvas 命中测试 → 真正的 `<a>`

上一轮的底栏是画在画布上的（`drawRoadBar(c)`），点它靠的是坐标换算。
用户要的是"跟主页面类似、可以点击的那种"——那就不能再靠像素猜。

判据很硬：**可点不等于能按 `x<720` 判断**。它意味着要能 Tab 到、
要被读屏念出来、要右键能"在新标签打开"、要中键能开新页。这些全都
要求它是带真 `href` 的 `<a>`。所以：

```html
<nav class="roadbar" id="roadbar" aria-label="文章进度"></nav>
```

`buildRoadBar()` 一次建出 `POSTS.length` 个 `<a href="post/...">`，
每个带 `title`（标题＋日期）和 `aria-label`；`updateRoadBar()` 每帧只写
两样东西：填充条的 `width`，和刻度的 `left` 百分比。

刻度对应的是**本页的文章**，不是首页的四个分区——刻度跳到那一篇自己，
跟主页面那种"跳到别的区"不是一回事。

### 18.2 两个不能省的约束

**`width` 和 `left` 上绝对不能加 transition。** 定位由 JS 每帧写入的属性，
一旦挂上 transition 就从"坐标"变成"动画"——第 15 轮那个纸条脱板 282px
就是这么来的。刻度更进一步连 `transform` 都不用，只用 `left` 百分比，
把"每帧重写 transform"这个雷区整个绕开。

**刻度位置是构造性正确的，不靠像素调。** 刻度 i 放在

    t_i = (x_i - 0.34 * viewW) / (WORLD_W - viewW)

而相机是 `goal = clamp(cat.x - 0.34*viewW, 0, maxCam)`。猫正好走到第 i 块
板子时 `cat.x = x_i`，此刻 `p = camX/maxCam = (x_i - 0.34*viewW)/maxCam`，
和 `t_i` 逐项相等。**所以刻度一定在猫踩到那块板子的那一刻亮起来**，
这是等式对上的，不是凑的。那个 `0.34` 必须和相机前瞻系数一致，改一个
就要改另一个。

### 18.3 自己引入的一个问题：底栏把拖动吃了

底栏 `z-index:8`，画布 `z-index:1`。底栏压在画布上面，于是**从底栏空白处
起手拖动会打到底栏，猫走不动**——一个交互抢走另一个交互。

```
.roadbar{ ... pointer-events:none}
.roadbar a{ ... pointer-events:auto}
```

容器全透，只有刻度把点击拿回来。刻度仍然可点（下面有实测），底栏以外的
区域拖动照旧。

### 18.4 加一篇会不会自动加一块板子：**不会**

三份**手写**的数组，各存一份，全都得手工加一行：

| 文件 | 变量 | 字段 |
|---|---|---|
| `static/index.html:682` | `posts:[...]` | 多一个 `pin` |
| `static/tag.html:187` | `var POSTS=[...]` | 多一个 `lv` |
| `static/assets/post.js:18` | `var POSTS = [...]` | 无 `desc` |

板子的位置是**算出来的**、不是写死的：`p.x = FIRST_X + i*GAP`，
`WORLD_W = 最后一块 + GAP*1.2`。`worldgrow.ps1` 验过 3 篇→1588、
8 篇→3288、20 篇→7368。**但那是在数组已经有那一行之后**。数组里没有，
世界就短一截，世界宽度不会自己变。

真正的源头在 Gmeek 那边：`blogBase.json` 的 `postListJson`，落到盘上是
`docs/postList.json`——每次构建**重新生成**，里面已经有全部文章的
`postTitle` / `postUrl` / `createdDate` / `labels`。**自动化的原料是现成的。**

缺的是 `desc` 和 `words`（摘要、字数）——`postList.json` 里没有这两个字段。
所以要自动，得决定这两样怎么办：从文章 HTML 抓正文当摘要，还是直接不显示。

### 18.5 验证

- 真机点刻度：跳到 `post/Origin of everything.html`、跳到
  `post/hao-duo-bug-a-。。html`，`urlChanged: true`、正文标题都正确
- 三个刻度在无障碍树里是 `navigation[文章进度]` 下的 `link`，
  `focusable` + `pointerActionable`，`rect` 宽 10px（当前刻度 19px，
  因为 `.cur` 有 `top:-5px`）
- 填充随相机走：9% → 30% → 97%，刻度 `done`/`cur` 跟着换
- 控制台 0 错误 0 警告
- linkcheck：5 页 26 条内链 0 死链
- 漂移检测复跑 PASS（23/23）。这一轮的两帧相机位置真的差 173px
  （板子 970→797），纸条跟着挪了正好 173px，相对边距不变——
  比同机位对比更能说明问题
- `tag.html` 885 行、UTF-8 无 BOM、0 个 CRLF；static 与 docs SHA256 一致

**记一笔**：`static/fonts/press-start-2p.*` 两个文件在 `static` 里但
`docs` 里没有，而且**全站没有任何地方引用它们**（`site.css` 用的是系统
等宽）。所以同步缺这两个文件不影响站点，是孤儿文件，没动它们。

---

## Round 19 — 猫会消失；底栏点击改成"走过去"；样式并回主页面

### 19.1 猫坐下就整只消失：一个精灵名对不上

用户报"有时候猫会消失（可能是坐着的时候）"。不是"可能"，是坐下一只像素都不剩。

`sprite.js` 里蜷睡精灵注册的名字是 **`cat24_sleep_raw`**，而 `tag.html` 要的是
**`cat24_sleep`**。正式名是首页那份 `index.html` 在运行时派生出来的：

```js
SPR.cat24_sleep = SPR.cat24_sleep_raw.map(function(r){ return r.replace(/\|/g,''); });
delete SPR.cat24_sleep_raw;
```

**`sprite.js` 里没有这两行。** 而 `drawSprite` 第一句就是

```js
var rows=SPR[name]; if(!rows) return;
```

查不到名字，静默返回，一个像素都不画，影子照旧留在原地——所以现象是
"猫不见了，但地上还有块影子"。触发条件是
`sitting = cat.asleep || (!cat.moving && cat.pause>0.7)`，也就是每次走到巡逻
目标停下来歇脚都会中招。

**为什么前几轮一直没照出来**：`shot.ps1` 强制 reduced-motion，headless 只有
两三帧 rAF、`dt` 夹在 0.05，`cat.idle` 攒不到 2.2 秒，**猫永远进不了停顿
状态**。也就是说，所有靠截图做的检查，结构上就看不见这一类 bug。这条比
bug 本身更值钱：以后凡是"状态机分支"，截图不算证据，得另外造探针。

修法就是把那两行补进 `sprite.js`（放在 `SPR` 字面量之后、`drawSprite`
之前，`window.PIX` 导出在更后面，所以时序没问题）。

### 19.2 底栏点一下不再跳页，改成走到那块板子底下

`<a href="post/...">` 换成 `<button class="pip">`。跳转确实是错的——这一页的
内容全在场景里，文章详情在别的页，跳出去等于把场景扔了。

`gotoPost(i)` 不做瞬移，让猫自己跑过去，相机跟着它走：

```js
cat.tgt=p.x; cat.hurry=true; cat.idle=2.3;   /* 2.3 刚好越过 2.2 的起步门槛 */
```

`hurry` 是新加的一档速度：平时散步 40/s，点刻度那一次跑 340/s。840 个世界
单位，散步要 **21 秒**，点一下然后干等 21 秒是不能接受的；340/s 大约 2.5 秒。
`drawCat` 里的 `running` 也接上了 `cat.hurry&&cat.moving`，于是这一趟会前倾、
弹跳、扬尘，和按方向键走是同一套表现。

人工输入（方向键 / 拖动 / 滚轮）会把 `cat.tgt` 和 `cat.hurry` 一起清掉，
否则用户一边拖、猫一边往旧目标跑，两边打架。

### 19.3 样式并回主页面

`.roadbar` 从「14px 黑条 + 10px 细刻度」整个换成 `site.css` 里 `.track` 的
形制：4px 细条、16px 方块刻度、`--dusk` / `--orange` / `--amber` 同一套配色、
悬停或聚焦时浮出 8px 标签。窄屏也跟着收成 `12px / 10px`。

**只留一个高亮态**（`.pip.on`），和主页面一个口径。上一版的 `done` 态拿掉了
——走过哪几个已经由橙色填充条表达了，再加一种颜色只会让两个页面长得不一样。

`pointer-events:none` 打在容器上、只有刻度 `auto` 这条仍然保留：底栏压在画布
上面，不这么做，从底栏空白处起手拖动会被吃掉。

### 19.4 自己踩的坑：`className` 赋值是整体替换

```
roadTicks[i].className = (i===cur?'on':'');
```

这行每帧执行一次，而**赋值不是追加，是把整个 class 属性换掉**。于是
`class="pip"` 当场被抹掉，后果有两个：

1. `.roadbar .pip` 不再匹配，按钮退回浏览器默认样式——白底、大号粗体字，
   一眼就能看出坏了
2. 点击处理里的 `e.target.closest('.pip')` 也匹配不上，**点刻度彻底没反应**

改成 `classList.toggle('on', i===cur)`，它只动这一个类。这类 bug 的通用教训：
**每帧重写 `className` / `style.cssText` 之前，先确认它不是在抹掉别人的东西**；
要保留的类用 `classList.toggle`，或者把整串拼回去。

### 19.5 验证

- **猫**：写了一个探针页（`out/sprite-probe.html`）直接把三张精灵并排画出来，
  `cat24` / `cat24_blink` / `cat24_sleep` 全部 `OK, 24 rows`，蜷睡那张是
  宽而扁的圆团，和站立姿一眼可辨
- **端到端**：临时插一份 `_sitprobe.html`，每帧强制 `cat.asleep=true`，
  截图确认猫以蜷睡姿态画在场景里（不是空白），验完即删
- **点击**：点刻度 `navigation.urlChanged: false`（不再跳页），相机跟着猫
  一起平移过去，悬停标签正常浮出
- **DOM**：刻度是 `<button class="pip">` / `<button class="pip on">`，
  16×16，`pointerActionable: true`，在无障碍树里是 `navigation[文章进度]`
  下的 button
- linkcheck：5 页 26 条内链 0 死链
- 漂移检测 PASS（23/23），改前改后各一个机位
- 窄屏 390×844 实机截图正常
- `tag.html` 927 行、`sprite.js` 303 行，均 UTF-8 无 BOM、0 个 CRLF；
  static 与 docs SHA256 一致

---

## Round 20 — 删 premarket.html，统一到 MarketViewer；修分辨率错乱

### 20.1 先说结论：按选项加载不同 JSON，本来就是通的

这一条不用改，是核实。`MarketViewer` + `render.js` 的结构是：

```
data/manifest.json          ← 页面清单（id / label / icon / data 路径）
  ├─ premarket  → data/premarket/latest.json    34597 B, 8 sections
  ├─ intraday   → data/intraday/latest.json      2135 B, 3 sections（占位）
  └─ postmarket → data/postmarket/latest.json   40743 B, 6 sections
```

真机点三个选项，网络日志逐条对上：

```
GET /data/manifest.json            200   ← 启动读清单
GET /data/premarket/latest.json    200   ← 默认页
GET /data/postmarket/latest.json   200   ← 点"盘后总结"
GET /data/intraday/latest.json     200   ← 点"盘中观察"
```

所以"统一用 MarketViewer，按选项加载不同 json"**只差一件事**：站外入口没有指路
的办法。补了 hash（20.3）之后这件事就完整了。

### 20.2 premarket.html 删掉，零损失

那张页早就是一张**写死并已过期**的静态快照：

- `<title>Pre-market 盘前速览 · 2026-08-28</title>` —— 停在 8 月 28 日，
  而 `data/premarket/latest.json` 已经是 10-01
- 5 张图表（Equity / Yield / Korea / DXY / CNH）全部硬编码在 HTML 里，不读任何 JSON
- echarts 走 `cdn.jsdelivr.net` —— 和前几轮"去掉 CDN 依赖"的方向相反
- **它只存在于 `docs/`，`static/` 里从来没有过**。前几轮的同步检查是单向的
  （只看 static 有没有对上 docs），所以一个只存在于部署目录里的页面，
  源目录里查无此文件这件事被掩盖了很多轮

而盘前速览的实际内容早就由 MarketViewer 里那一栏接手了。删。

### 20.3 补 `#hash` 直达

统一到一个文件之后，首页三个时段卡片都指向同一个 `MarketViewer.html`，
光这样点进来全落在盘前。所以给 `render.js` 加了 hash 路由：

- `openPageById(id, opts)` —— tab 点击 / 首屏 / hash 改动走**同一条路径**
- 首屏读 `location.hash`，认不出来就安静回第一页（手敲错的不报错）
- 切 tab 时用 `history.replaceState` 写回 hash。用 `location.hash=` 不行：
  每点一次 tab 压一条历史，浏览器"后退"会在三个 tab 之间来回弹，
  而不是真的离开这个页面
- `#postmarket` / `#intraday` 直达均实测通过，title 与内容都对

链接相应改成 `MarketViewer.html#premarket` / `#intraday` / `#postmarket`。

### 20.4 分辨率错乱：坏的不是"有些"，是**只有一个宽度**

扫了 20 个宽度（360→2560）并逐个测量 `documentElement.scrollWidth`，
只有一个真的坏了：

| 宽度 | 整页横向溢出 |
|---|---|
| **600** | **YES +64px** |
| 其余 19 个（360/390/414/480/520/599/640/700/768/820/900/1024/1100/1280/1366/1440/1600/1920/2560） | 无 |

600px 那次的实测数字把根因摆得很清楚：

```
.wrap              L60  R540  W480    ← 对
#content           L72  R528  W456    ← 对
#content > section L72  R664  W592    ← 592 塞进 456，溢出 136px
```

**`1fr` 轨道的 auto 最小尺寸 = 该列所有 grid item 的 min-content 最大值。**
section 里只要有一处内容算出来宽（长标签 / 不换行的数字 /
`-webkit-line-clamp` 的长文），整条轨道就被顶宽，section 跟着溢出，
页面出现横向滚动条、右侧一条内容被切掉。

原来的修复只写了一半：

```css
#content > section.span-2{ grid-column:1; min-width:0; }   /* 只有 .span-2 */
```

可 1fr 只有一列时，**同列的每个 section 都在给这条轨道贡献 min-content**，
一个没写 `min-width:0` 的就够把页面撑破。所以规则落到每一个 section 上，
轨道本身也从 `1fr` 改成 `minmax(0,1fr)`（最小值 0，不是 auto 的 min-content）：

```css
#content > section{ min-width:0; }
#content > section > *{ min-width:0; max-width:100%; }
#content{ grid-template-columns:minmax(0,1fr); }            /* 600-1024 */
#content{ grid-template-columns:repeat(3,minmax(0,1fr)); }  /* 768+ */
#content{ grid-template-columns:repeat(2,minmax(0,1fr)); }  /* 992-1199 / 768-991 */
.kpi-row / section.kpi-strip .kpi-row → repeat(n, minmax(0,1fr))
```

**就地改原有声明，没有新增重复规则**——新写的媒体查询会被后面同特异性的
旧规则覆盖掉，这个坑踩过一次就够了。改完 20 个宽度全部
`H-OVERFLOW=no` / `PAGE-BREAKERS(0)`。

### 20.5 表格横向滚动加了个提示

`.table-wrap` 本来就是 `overflow-x:auto`（表格能滚，代码里写了注释）。
问题不在能不能滚，在**看不出来能滚**——右半列直接被切掉，一眼看着像页面坏了。
1920 上都这样（"五、原油价格"那张表最明显）。

纯 CSS 的滚动阴影，不动任何盒模型尺寸：两端的"盖子"用
`background-attachment:local` 跟着内容一起滚，两条阴影用 `scroll` 钉在容器上。
能往右滚时右缘出现阴影，滚到头自己消失。表头有实底，阴影只在透明的表体行透出。

### 20.6 工具坑：`shot.ps1` 的窄屏路径会把 fetch 弄挂

第一轮扫宽度时，≤480 的截图全是 8–13 KB 的空页，卡在"加载中…"，
加 `-DelayMs 4000` 也没变化。断点正好是 `shot.ps1` 的 `MinDirectWidth = 520`。

原因在它自己的代码里：窄屏时它把 harness 写在**系统 TEMP 目录**再用
`file://` 打开，然后在里面嵌目标页的 `http://` URL —— 跨源嵌套，
iframe 里那个 `fetch('data/manifest.json')` 就静默死了。**页面是好的，
是量它的尺子坏了。** 而且这个失败长得跟"页面真的挂了"一模一样。

于是自己写了一个同源 harness（`docs/_frame.html`，从 docs/ 起服务，
和页面同源），顺带**直接测量**而不是靠眼睛判断：

- `documentElement.scrollWidth` vs `clientWidth` → 整页横向溢出
- 遍历所有元素找 `right > clientWidth` 的，**但排除掉祖先里有滚动容器的**
  （`table-wrap` 里的 table 超出只是"可滚"，不算撑破页面）——第一版探针
  没做这个区分，把 171 个可滚元素误报成"撑破页面"，差点改错地方
- 连 `.wrap` / `#content` / `section` 的实际左右边界一起打出来，根因一眼可见

这个 harness 以后量 MarketViewer 任何宽度都能直接复用，验完即删。

### 20.7 验证

- 20 个宽度（360→2560）全部 `H-OVERFLOW=no` / `PAGE-BREAKERS(0)`，
  报告拼成一张图逐行核对
- 三个选项各自 fetch 到对应 JSON（网络日志 4 条 200），`#postmarket`
  / `#intraday` 直达内容与 tab 高亮都对
- 控制台 0 错误 0 警告
- linkcheck 扩到 6 页 30 条内链 0 死链（把 `MarketViewer.html` 加进扫描列表了，
  它现在是中枢却一直没被检查覆盖到）
- static ↔ docs **双向**核对：23 : 23，内容 0 差异
- 全站已无 `premarket.html` 引用（只剩一处我自己写的说明注释）

### 20.8 遗留（不在本轮范围）

- `static/fonts/press-start-2p.*` 只在 static、docs 里没有，且全站无引用。
  和第 18 轮记的是同一件事，没动
- `data/intraday/latest.json` 仍是占位（3 段、`待接入`）。它现在是三个选项
  之一，tab 能切、页面能渲染，但没接真实盘中数据

### 20.9 顺带查清 `rss.xml` 是什么

用户问起这个文件，查了一遍，结论记在这里（属于会被反复重新发现的仓库事实）：

- **是什么**：手写的 RSS 2.0 订阅源，列 3 篇文章。文件里自己写着
  `<generator>hand-written, kept in static/ as the source of truth</generator>`
- **怎么进站的**：首页"远岸 / FAR SHORE"区的一个链接
  （`index.html` 的 `links` 数组：`{cn:'订阅', en:'RSS', href:'rss.xml', external:true}`）。
  除此之外**全站没有第二个入口**
- **内容**：channel 级有 title / link / description / language / `ttl 60` /
  `lastBuildDate` / `atom:link self` / `<image>`（指向 `assets/cat.png`）；
  3 条 item 各带 title / link / description / category / guid / pubDate

**两个真问题**：

1. **没有自动发现**。`index.html` 的 `<head>` 里只有一条 `<link rel="icon">`，
   **没有** `<link rel="alternate" type="application/rss+xml">`。
   浏览器和阅读器因此无法自动认出订阅源，订阅者只能自己翻到最后一个区去找那个按钮。
   补一行 `<link>` 就能解决。
2. **手工维护，而且会被 Gmeek 覆盖**。`blogBase.json` 里有
   `"rssSplit": "sentence"` —— 这是 Gmeek 自己的 RSS 生成配置，也就是说
   Gmeek 每次构建都会写自己的 `docs/rss.xml`。我们这份放在 `static/` 里当源头，
   重新构建后部署目录里那份会被 Gmeek 的版本替换掉（第 11 轮就是这个情况：
   Gmeek 先产出一个占位 rss.xml，被手写版覆盖掉了）。
   **所以加一篇文章要同时手改 rss.xml**，否则新文章不会出现在订阅里。

**好消息**：删掉 `premarket.html` 没有让 rss.xml 变陈旧——3 条 item 链接
（`post/hao-duo-bug-a-。。.html` / `post/Pre-market -pan-qian-su-lan.html` /
`post/Origin of everything.html`）逐条换算成本地路径都存在，且没有一条指向
那个被删的页面（RSS 从来就指向文章页，不是那个独立页）。

### 20.10 补一轮：清掉仓库元数据里的 premarket.html 残留

上一节那句"全站已无 premarket.html 引用"是**只核过站点**（`docs/` + `static/`
里的 html/js/css/json/xml）得出的结论，漏了仓库元数据——workflow 和
STATUS.md 不在那个扫描范围内。三处已清：

**1. `.github/workflows/Gmeek.yml` 删掉 "Protect premarket.html" 步骤。**
那个步骤用 `git cat-file -e HEAD:docs/premarket.html` 守卫着
`git checkout HEAD -- docs/premarket.html`，删页之后它会安静地走到 else 分支
打个警告，不会复活页面——但它和"已无引用"的说法对不上，也会让后来人以为
这张页还需要维护。

删之前先确认了删得安全，那一步不是白加的：
`cp -a /opt/Gmeek/docs` 是**整目录替换**，紧接着 `git add .` + `git commit`
会把"删除"提交进去。它保护的是 `docs/` 里**唯一没有 `static/` 对应物**的文件；
其余手工内容（`MarketViewer.html` / `tag.html` / `rss.xml` / `assets/` / `data/`）
都有 `static/` 源头。所以这一步随那唯一的例外一起消失，没有留下缺口。

**真正的保护网在另一份 workflow 里，之前没注意过：**
`market-viewer-sync.yml` 在 `static/**` 变化时、以及 Gmeek 跑完后
（`workflow_run`，注释里明写"防止被它清空"），把 `static/` 全量搬回 `docs/`
再提交。它还顺手解答了前几轮反复报告的一件事——**`static/fonts/` 是故意不同步的**
（`index.html` 和 `site.css` 都把字体内嵌成 base64 了，没有一个页面引用
`fonts/*.woff2`），那不是遗漏，是有意排除。

**2. `STATUS.md` 重写。** 它是 2026-08-26 那次 GitHub 故障的现场记录，
里面"待办"第 2 条是"验证 https://f1yingcat.github.io/premarket.html 返回 200"，
现状段还写着该文件 ✅ 存在。这些会直接误导下一个维护者/agent。
现在改成：当前状态 / 部署链（Gmeek → market-viewer-sync → pages-deploy）/
仍然成立的关键教训 / 已作废存档。三条教训里最硬的那条保留并更新了——
**手工维护的内容一律放 `static/`**，直接写进 `docs/` 的没人替它兜底。

**3. `backup/Pre-market 盘前速览.md`**（用户没列，但查到就一起改了）。
Gmeek 的文章源文件，正文里有一条 `https://f1yingcat.github.io/premarket.html`。
`static/post/` 里那篇虽然已经改成 `../MarketViewer.html#premarket`，而且
`market-viewer-sync.yml` 会在 Gmeek 之后用 `static/post/` 覆盖回去（所以线上
是对的），但只要哪天从 backup 重新生成，死链就回来了。一并改成
`https://F1yingCat.github.io/MarketViewer.html#premarket`。

**记一笔工具坑**：`[System.IO.File]::WriteAllLines` 在 Windows 上按
`Environment.NewLine` 写，也就是 **CRLF**——用它改一个本来是 LF 的文件会把
行尾全换掉。改行尾敏感的文件要么 `WriteAllText` 手工拼 `"`n"`，要么写完
再核对 CRLF 计数。另外那次替换没生效，是因为我按 `Select-String` 显示的
文本敲 old_string，而实际主机名是全小写的 `f1yingcat.github.io`
（页面里其它地方是 `F1lyingCat`），**同仓库里两种大小写混用**，按行号重建更稳。

---

## Round 21 — 归档按文章数自动更新：三份手写副本 → 一份生成物

### 21.1 先核实：其实只有数据是手工的

问的是"归档怎么根据文章数自动更新长度、公告板数"。查完发现**结构早就是自适应的**，
手写的只有那份数据：

- `tag.html`：`p.x = FIRST_X + i*GAP`，`WORLD_W = 最后一块 + GAP*1.2` — 纯公式
- 首页公告栏：`board.keep:3` + `hidden = length - keep`，lede 明写"新钉一条上来，
  旧的就挪进归档" — 本来就是为增长设计的

真正的问题是**数据有三份手写副本**（`index.html` / `tag.html` / `post.js`），
加一篇要手工改三处，漏一处就是"首页有、归档页没有"。

### 21.2 顺带清掉两个死字段

- **`lv` 全站零引用**（`.lv` / `['lv']` 一处都没有），纯死字段，不产出
- **`pin` 只被 `index.html` 拼成 `pin0/1/2` 的 CSS 类**做图钉配色，没有语义。
  改成按显示位置取模，位置变了我也不用改数据

### 21.3 源头选 `blogBase.json`，不是 `docs/postList.json`

两个候选的字段差别是决定性的：

| | postTitle | postUrl | createdDate | labels | **description** | **wordCount** |
|---|---|---|---|---|---|---|
| `blogBase.json` → `postListJson` | ✓ | ✓ | ✓ | ✓ | **✓** | **✓** |
| `docs/postList.json` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |

三份数组要的 `cn/desc/lab/date/words/href` 正好是后两列的映射，
`docs/postList.json` 少这两列就驱动不了板子。所以源头是 `blogBase.json`
（Gmeek 每次构建写到仓库根）。

### 21.4 落地：生成物 `assets/posts.js`

`out/genposts.ps1` 读 blogBase.json → 按 `createdDate` 升序 → 出
`window.POSTS = [...]`。三个页面各自 `<script src>` 引它，内嵌数组全删。

**href 有一处不对称的坑**：生成物里是**站点根相对**的 `post/xxx.html`，
首页/归档页直接用；文章页跑在 `/post/xxx.html` 里，原样用会解析成
`/post/post/xxx.html`，所以 `post.js` 里统一 `replace(/^post\//,'')`。

**清单为空时三个页面都整页报明确的错**，不渲染半吊子：
`tag.html` 直接 `return`（下面 `WORLD_W` 要读 `POSTS[length-1].x`，
空数组会算出 NaN，世界宽度/相机边界/底栏刻度一起废）；
`index.html` 把 lede 换成那句提示。安静的空板子看着像"最近没发文"。

### 21.5 修了一个会在"加第 4 篇"时才爆的 bug

```js
var shown=PORTAL.posts.slice(0,B.keep);      // 错
var shown=PORTAL.posts.slice(Math.max(0,PORTAL.posts.length-B.keep));  // 对
```

数组是 `createdDate` **升序**，而 `slice(0,3)` 取的是**最旧** 3 篇。
现在只有 3 篇看不出来，等加到第 4 篇，首页就会开始把最新的藏进归档 ——
和这段自己的 lede 正好相反。8 篇实测确认：公告栏显示最近 3 篇
（09-19 / 09-25 / 09-28），"全部文章（还有 5 篇）"。

### 21.6 CI：跑在 static→docs 之后，只写 docs/

`market-viewer-sync.yml` 加了一步 `shell: pwsh` 调生成器，**输出到
`docs/assets/posts.js`**，两个位置问题都不是随意的：

- **必须在 static→docs 拷贝之后**。Gmeek 刚跑完，仓库根的 `blogBase.json`
  才是最新的；放在拷贝之前，会被 `cp -r static/assets/.` 里那份旧拷贝盖回去
- **不能写 `static/`**。这个 workflow 的 push 触发路径是 `static/**`，
  在这里往 static/ 提交会再次触发自己，无限循环

于是两条路都留着：仓库里 `static/assets/posts.js` 让 `file://` 也能看，
CI 那步保证**即使仓库里那份忘了更新，部署出去的还是对的**。
`git add docs/assets/` 本来就在列表里，不用改。

### 21.7 验证

- **3 篇**：三个页面控制台 0 错误，公告栏 3 条、归档 3 块板子、底栏 3 刻度，
  上下篇导航 href 正确剥掉 `post/` 前缀
- **8 篇（临时扩 blogBase.json 再还原）**：过滤器自动变 ALL 8 / DOC 6 / BUG 2，
  底栏 8 个刻度均匀排开（70/149/228/307/386/464/543/619），世界变长，
  公告栏显示最近 3 篇 + "还有 5 篇"。还原后 blogBase 与 posts.js 都回到 3 篇，
  无 `.bak-test` 残留
- linkcheck 6 页 18 脚本 35 链 0 死链（posts.js 已纳入扫描）
- static ↔ docs 双向核对 0 差异
- CI 调用形式（相对路径、工作目录=仓库根）本地实测跑通，两份 posts.js SHA256 一致

**记一笔工具坑**：`.ps1` 里写中文注释 → PowerShell 5.1 按 ANSI 读无 BOM 文件，
中文变乱码直接把语法解析带崩（`margin.ps1` 早就写着这条警告）。
`out/` 下的 `.ps1` 一律 ASCII-only，注释用英文；
生成出来的 `posts.js` 可以带中文，那是**数据**、用显式 UTF8 编码器写，
和脚本源码是两回事。另外 `param()` 必须是文件里第一条语句，
`$ErrorActionPreference` 不能写在它前面。

**已知取舍**（用户确认过）：摘要直接用 Gmeek 的 `description`，所以两处文字会变——
P1 多了个英文句点、P2 变成"由Minimax-M3 Mavis更新"。换来的是不引入任何新的
手工维护面，摘要和 RSS、博客列表保持一致。

### 21.8 补：CI 那一步不能阻断部署

`market-viewer-sync.yml` 的步骤顺序是
`Checkout → Sync static→docs → **Regenerate posts.js** → Commit & Push`。
生成器夹在中间，**它一失败，后面的 Commit & Push 整个被跳过** ——
"生成脚本出 bug"会升级成"整个站点不再更新"。为一个只影响文章清单的脚本，
这个代价太大，所以给那步加了 `continue-on-error: true`：
失败时兜底是仓库里那份（可能稍旧的）posts.js，站点照常可用，
run 标红、日志里看得到报错。

顺带把 CI 触发链记清楚（回答"推上去会不会自动更新"）：

```
发文章写进 backup/*.md
  └─> Gmeek（cron 每天 UTC 16:00 = 北京次日 0:00 / issue / 手动）
        写新的 blogBase.json  ← posts.js 的【唯一】源头，只有 Gmeek 写
        └─> market-viewer-sync（workflow_run 触发）
              重新生成 docs/assets/posts.js
              └─> pages-deploy → 线上

手动 push static/post/*.html
  └─> market-viewer-sync 也会被 static/post/** 触发
        但 blogBase.json 还没更新（Gmeek 没跑）→ posts.js 仍是旧的
```

也就是说：**走 Gmeek 发文章就是全自动；手动 push 一个文章页则要等 Gmeek 下一次跑**
（最快当天 UTC 16:00）。想让后者也立刻生效，得让生成器把
`static/post/*.html` 里没进 blogBase 的文件也并进去（标题从文件名/标题行取，
摘要和字数留空，等 Gmeek 补全）——没做，因为那会在"刚 push、Gmeek 还没跑"
的窗口里造出字段不全的条目。
### 21.9 编辑 issue 会把页面整个重置 —— 治本

用户报：改 GitHub issue 后 Gmeek 会把页面重置。查了机制和历史，确认属实：

```
Gmeek.yml
  cp -a /opt/Gmeek/docs  $workspace     ← 整目录覆盖
  git add . && git commit               ← 把重置【提交】
  （文件末尾还有 deploy job）            ← 把重置【发上线】
```

历史提交 `6276c3c`（2026-08-27）就是证据：它改了 `docs/MarketViewer.html`、
`docs/assets/render.js`、`docs/data/*` —— 全是我们手写、只在 `static/` 里有源头的文件。

**原有的保护是有洞的**：`market-viewer-sync.yml` 靠 `workflow_run` 跟在 Gmeek 后面
修，但（1）中间有个窗口重置版是活的，（2）它的条件是
`workflow_run.conclusion != 'failure'` —— **Gmeek 一失败，修复也跟着跳过，重置就留下了**。

**修法：把还原搬进 Gmeek 自己那条流水线**，在 docs 拷贝之后、commit 和 deploy 之前。
重置于是既进不了 git、也发不出去。而 Gmeek 失败时本 job 直接失败、末尾的 deploy
不跑，线上保留上一次的好版本 —— 这才是安全的失败方向。

**故意不给还原步骤加 `continue-on-error`**（和上一节那个 `Regenerate posts.js`
正好相反）：那里失败只是清单稍旧，这里失败却会把重置发上线。

**文件清单只写一份**：`out/restore-docs.sh`，两条 workflow 都调它。两边各写一份的
话总有一边漏掉某个页面，于是"一边还原、另一边又冲掉"。

**验证**（拿真实 docs/ 树做，不是沙箱）：把 12 个文件冲成 `GMEEK-RESET` 标记，
跑脚本，然后 `git diff docs/` —— **空**。即还原是逐字节成功的。
另在沙箱里验证过语义边界：我们维护的文件还原，Gmeek 独有的产物
（`echarts.min.js`、只存在于 docs 的文章页）原样保留。

**顺带确认数据流是干净的**：`static/data/` 才是权威（每日任务的提交只碰这一侧），
`docs/data/` 纯是镜像、只由 `sync: market-viewer from static` 改过。所以把
`data/` 也纳入还原是安全的，不存在回退风险 —— 这也正是第一次提交时我在本地
撞到过的那个坑（本地是 10-01、远端是 10-02），在 CI 里不会发生，因为 CI 的
checkout 和 `static/` 那一刻是同一棵树。
### 21.10 issue 怎么流到公告栏 / 文章页 / 归档（顺带挖出一个数据污染）

问：新开一个 issue，Gmeek 跑一遍之后，它怎么变成公告栏上的一条、文章页、归档里的一块板子？

链路（每一步都有据）：

```
issue opened/edited  ->  Gmeek.yml 触发
  Gmeek.py --issue_number
    ├─ backup/<title>.md          ← 文章正文落到这里（Gmeek 的源）
    ├─ blogBase.json postListJson ← ★ posts.js 的唯一源头
    └─ docs/post/<slug>.html      ← Gmeek 生成的页面
  git commit + push
  ->  market-viewer-sync（workflow_run 触发）
        out/restore-docs.sh        static/ 盖回 docs/
        out/genposts.ps1           blogBase.json -> docs/assets/posts.js
  ->  pages-deploy（workflow_run 触发）-> 线上
```

**实测过"新开 issue"这条路**：模拟 Gmeek 生成 `docs/post/NEWPOST.html` + 往 blogBase 加 P4 +
顺手重置 `docs/tag.html`，跑那两个脚本，结果 —— 新文章页**存活**（还原脚本只往 docs/post 里拷、
从不删多余文件）、`tag.html` 被还原、`posts.js` 自动变成 4 篇并带上正确 href。✓
也就是说新 issue 会自动出现在公告栏、归档、且点得进去。

**但要提醒一件事**：现在这 3 篇文章的源有两套 ——
`static/post/*.html`（我们手写的像素版）和 `backup/*.md`（Gmeek 的源）。
线上实测是**我们手写那版**（2582 字节，引 `../assets/posts.js`，带 `data-art` 插画，没有 Primer）。
所以**去改这几篇的 issue，页面不会变** —— Gmeek 确实会重新生成 `docs/post/x.html`，
但紧接着被 `restore-docs.sh` 用 static 的版本盖回去。只有**新开 issue 建新文章**才会走 Gmeek 那版。

**顺带挖出一个数据污染**：`3cdc968` 那次 Gmeek 运行往
`backup/Origin of everything.md` **追加了一行来源链接** `[f1lyingcat.github.io](url)`，
于是 blogBase 里那篇的 `description` 变成两行、夹着 markdown 字面量，`wordCount` 还从 29 虚增到 56。
生成器忠实照抄，归档牌子上就会显示出 `[f1yingcat.github.io](url)` 这种东西。

在 `genposts.ps1` 里加了一道 `ConvertTo-Description`：先整体丢掉"标签里带点的链接"
（那是 Gmeek 的来源链接，把它拆开只会剩个裸域名），再解包正常的行文链接、图片、裸 URL，
折叠换行，最后清掉 CJK 标点前被留下的空格。干跑覆盖了 6 种脏输入。

`wordCount: 56` 没动 —— 那是 Gmeek 从被污染的 backup 算出来的，真实值无从得知，
去改 `backup/*.md` 也会被下次运行覆盖。留给 Gmeek 自己纠正。

**记一笔**：正则里的 CJK 标点要用 `\u3002` 这种转义写，不能直接写字面量。
脚本必须保持纯 ASCII（PowerShell 5.1 按 ANSI 读无 BOM 文件），这次先写了字面量、
非 ASCII 字节有 6 个、正则死活匹配不到，改成转义才生效。
**收尾**：`backup/Origin of everything.md` 里那行来源链接也删了，blogBase 里 P1 的
`wordCount`（56 → 29）和 `description` 一并纠正。Gmeek 下次跑会按干净的 backup 重算，
所以这个纠正能留住。线上一度显示"56 字"，那是虚的。