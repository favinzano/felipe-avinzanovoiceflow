---
name: felipe avinzano VoiceFlow
description: Private, local speech-to-text for Windows — precision rendered as interface
colors:
  ink: "#0d1b2a"
  bone: "#f4f1eb"
  paper: "#fbfaf7"
  signal-blue: "#2c5f8a"
  blue-light: "#83a9c8"
  incision-copper: "#b66d45"
  copper-muted: "#d17d61"
  clay: "#8a4f2e"
  rust: "#7a5544"
  fog: "#5a6870"
typography:
  display:
    fontFamily: "\"DM Serif Display\", serif"
    fontSize: "1.08em"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, sans-serif"
    fontSize: "clamp(28px, 4vw, 42px)"
    fontWeight: 480
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Geist, sans-serif"
    fontSize: "17px"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.16em"
rounded:
  none: "0px"
  floating-overlay: "14px"
spacing:
  sm: "9px"
  md: "16px"
  lg: "30px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "9px 13px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.signal-blue}"
    rounded: "{rounded.none}"
    padding: "0"
  nav-item:
    backgroundColor: "transparent"
    textColor: "rgba(244,241,235,.72)"
    rounded: "{rounded.none}"
    padding: "13px 11px"
  nav-item-active:
    backgroundColor: "rgba(244,241,235,.055)"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "13px 11px"
  card:
    backgroundColor: "rgba(251,250,247,.75)"
    rounded: "{rounded.none}"
    padding: "24px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "9px 10px"
---

# Design System: felipe avinzano VoiceFlow

## 1. Overview

**Creative North Star: "The Incision Mark"**

The system is named after its own logo: two overlapping rotated squares suggesting a single precise cut. Everything else follows from that image. This is a product for people who dictate instead of type — private, on-device, exact — and the interface behaves the same way: quiet, confident, deliberate. There is no flourish standing in for craft. Depth comes from hairline rules, not soft shadows; color comes from one accent, not a palette; emphasis comes from restraint, not size.

The system explicitly rejects the visual language of cloud transcription SaaS: no gradient hero, no warm cream/sand "AI default" neutrals, no card-grid dashboard-by-numbers layout, no rounded/glassy chrome. Where those products perform friendliness, this one demonstrates precision.

**Key Characteristics:**
- Sharp corners throughout the main app; the floating capture overlay alone uses a 14px radius so it reads as transient OS chrome
- One accent color (incision copper) used sparingly, for state and emphasis only
- Flat surfaces at rest; hard, unblurred, offset shadows reserved for a few active/floating elements
- Small, dense, confident type — this is a compact desktop tool, not an airy marketing page
- A single serif accent (DM Serif Display) reserved for exactly one wordmark segment — never a system font

## 2. Colors

The palette is a cool, near-black ink against warm bone and paper neutrals, with exactly one warm accent (copper) and one cool accent (signal blue) doing all the work.

### Primary
- **Incision Copper** (#b66d45): The product's single expressive color. Marks active/recording state, active nav indicator, and the "Flow" wordmark/hero-emphasis segment (large text only — at small sizes this hex falls to ~3.5:1 contrast on bone/paper, below WCAG AA). Used sparingly — its rarity is what makes it read as a signal rather than decoration. A muted variant, **Copper Ash** (#d17d61), marks error state in the floating overlay only.
- **Clay** (#8a4f2e): A darkened, text-safe copper reserved for small uppercase labels on light backgrounds — history timestamps, empty-state tags, guide tags/footer labels. Clears 4.5:1 against bone/paper where raw Incision Copper does not. Same hue family as the accent, shifted toward ink for legibility; never used at large sizes (Incision Copper covers those).
- **Rust** (#7a5544): A muted warm brown reserved for low-emphasis destructive actions (delete term, delete history entry) and the "before" struck-through text in the guide demo. Deliberately quieter than Clay/Copper — this is a de-emphasized affordance, not an accent.

### Secondary
- **Signal Blue** (#2c5f8a): The interactive/informational accent — links, focus rings on inputs, section labels, secondary buttons, the "processing" state. A lighter tint, **Blue Light** (`--blue-light`, #83a9c8), is used for the brand initial in the floating overlay, the processing-state waveform, and as the `:focus-visible` outline color on the dark sidebar (where full-strength signal blue's ~2.6:1 contrast against ink is too low to read as a focus ring).

### Neutral
- **Ink** (#0d1b2a): Primary text color and the sidebar/overlay background. Doubles as both "text on light" and "surface, dark."
- **Bone** (#f4f1eb): The base UI background and the primary text color on dark (ink) surfaces.
- **Paper** (#fbfaf7): Card and input backgrounds — a hair lighter than bone, giving cards a barely-there lift without a shadow.
- **Fog** (#5a6870): Muted/secondary text — metadata, timestamps, helper copy. Darkened from an earlier #8c97a0 to clear 4.5:1 against bone/paper; keeps the same cool slate-blue character, just shifted toward ink for legibility.

### Named Rules
**The One Accent Rule.** Incision copper appears only where something is actively happening (recording, an accent label, a timestamp) or as the single wordmark flourish. It never becomes a background, a button fill, or a decorative border. If copper shows up on more than one element in a given view without a state reason, that's a violation.
**The Text-Safe Variant Rule.** Incision Copper's full-strength hex is reserved for non-text fills/borders and large text (≥18px); any small-text (labels, timestamps, tags) use of the accent hue goes through Clay instead. Never use raw `--copper` as a color value on text under 18px — reach for `--clay`.

## 3. Typography

**Display Font:** DM Serif Display (with serif fallback)
**Body Font:** Geist (variable, weights 100–900, with sans-serif fallback)

**Character:** A geometric, technical sans (Geist) carries every functional surface at small, dense sizes; a single serif (DM Serif Display, weight 400 only) appears in exactly one place — the "Flow" suffix of the wordmark — as a deliberate, rationed flourish rather than a paired display family.

### Hierarchy
- **Display** (400, 1.08em, line-height 1, letter-spacing -0.035em): DM Serif Display. Reserved exclusively for the "Flow" wordmark segment and the `.hero-emphasis` inline accent. Never used for anything else — introducing it elsewhere dilutes the one deliberate flourish into a decorative type system.
- **Headline** (480, clamp(28px, 4vw, 42px), line-height 0.98, letter-spacing -0.045em): Page `h1`s. Tight tracking, near-black ink.
- **Title** (550, 22px, line-height 1.2, letter-spacing -0.025em): Section `h2`s.
- **Body** (400, 13px, line-height 1.6): Page leads, card copy, history entries. This is a dense, compact interface — body text runs smaller than typical web defaults by design, trading airiness for information density.
- **Label** (700, 10px, letter-spacing 0.16em, uppercase): Eyebrows, kickers, card labels, empty-state tags. Always signal-blue or incision-copper, never ink or bone directly.

### Named Rules
**The Rationed Serif Rule.** DM Serif Display exists in exactly one context: the "Flow" wordmark suffix (and its `.hero-emphasis` echo). It is never a second font paired across headings — introducing it as a general display face would turn a signature flourish into generic serif/sans pairing.

## 4. Elevation

Flat by default. Cards, panels, and settings groups carry zero shadow — a single hairline border (`1px solid` ink-at-13%-opacity on light surfaces, bone-at-14%-opacity on dark) is the only depth cue at rest. Shadows are reserved for a small set of active or floating elements, and where they appear they are hard-edged and offset — no blur radius — reading as stamped or printed rather than lit from above.

### Shadow Vocabulary
- **Record Button Shadow** (`box-shadow: 10px 10px 0 rgba(44,95,138,.15)`, shifting to `14px 14px 0 rgba(44,95,138,.16)` on hover): The primary interactive element. The button itself sits rotated -4deg; the shadow reinforces that off-axis, "stamped" quality.
- **Overlay Shadow** (`box-shadow: 0 8px 18px rgba(13,27,42,.32)`): The one true soft/ambient shadow in the system, used only because the rounded floating overlay sits above arbitrary desktop content and needs to visually separate from anything behind it.
- **Toast/Demo Shadow** (`box-shadow: 8px 8px 0 rgba(44,95,138,.16)` / `7px 7px 0 rgba(44,95,138,.14)`): Same hard-offset language as the record button, used on the toast and demo-overlay mockups.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest; a hairline border carries all resting hierarchy. Shadows only appear on elements that are either interactive (record button), floating above other content (overlay), or transient (toast) — never as ambient decoration on a static card.

## 5. Components

Tactile and exact: every control reads as precision-made rather than soft. Cards, buttons, and inputs share the same sharp corner. The capture overlay is the sole rounded exception because it behaves as transient Windows chrome rather than an in-app container.

### Buttons
- **Shape:** Square corners, no exceptions (radius: 0px).
- **Primary:** Ink background, bone text, 9px 13px padding, 650-weight 8-11px label type. Used for the main action in feature cards and dictionary forms.
- **Record Button (signature):** The one circular-feeling control in the system (achieved via an inner mic icon, not radius), rotated -4deg at rest, ink fill, hard offset signal-blue shadow. Recording state swaps fill to incision-copper with a pulse animation; processing state swaps to signal-blue with an alternating tilt animation.
- **Ghost/Text Button:** No border or fill, signal-blue text, used for secondary actions (export, clear, "open guide").
- **Nav Item:** Transparent at rest, 2px solid-copper left border plus a faint bone-tinted background on hover/active — the only place a colored border is used, and only ever on the left edge of a nav row, never as a card accent.
- **Focus:** Every custom button gets an explicit `:focus-visible` outline — 2px signal-blue, offset outward on light surfaces (buttons, cards) so it doesn't collide with the sharp-cornered fill; 2px blue-light, offset inward, on the dark sidebar's nav items, since full-strength signal-blue reads too faint against ink.

### Cards / Containers
- **Corner Style:** 0px radius, always.
- **Background:** `rgba(251,250,247,.75)` (translucent paper) over the bone page background.
- **Shadow Strategy:** None at rest — see Elevation. Depth comes entirely from the 1px hairline border.
- **Border:** `1px solid var(--rule)` (ink at 13% opacity).
- **Internal Padding:** 24px standard (feature-card), tighter for dense list-style cards.

### Inputs / Fields
- **Style:** 1px hairline border, paper background, 0 radius, 9px 10px padding.
- **Focus:** Border shifts to signal-blue — no glow, no ring, just a color change on the existing hairline.

### Navigation
- **Style:** Dark ink sidebar, bone text at reduced opacity (72% default, 100% active), numbered index markers (01–06) prefacing each nav label — a real ordered list of app sections, not a decorative eyebrow trope. Active/hover state adds a 2px copper left-border and a subtle background lift.

### The Incision Mark (signature component)
Two overlapping squares — one solid-filled, one outlined — each rotated ±4deg, rendered in pure CSS (`i` and `i + i` pseudo-siblings) at three scales (default 22px, large 38px, hero 118px). This is the product's logo and the namesake of the whole design system: a single deliberate cut, never fussy, never literal (no scissors, no waveform icon standing in for the mark).

## 6. Do's and Don'ts

### Do:
- **Do** use exactly one accent color (incision copper #b66d45) for state and emphasis; let signal blue (#2c5f8a) carry all other interactive/informational meaning.
- **Do** keep in-app corners sharp — `border-radius: 0` on cards, buttons, inputs, and containers. Reserve the documented 14px radius exclusively for the floating capture overlay.
- **Do** use hairline borders (`1px solid`, ink or bone at ~13% opacity) as the default way to separate surfaces.
- **Do** reserve hard, offset, unblurred shadows for elements that are interactive, floating, or transient (record button, overlay, toast) — never as ambient decoration on a resting card.
- **Do** keep DM Serif Display confined to the "Flow" wordmark segment and its `.hero-emphasis` echo.
- **Do** keep body and UI type small and dense (11-14px body, 7-10px labels) — this is a compact desktop tool, not a spacious marketing page.
- **Do** use `--clay` (not raw `--copper`) for any accent-colored text under 18px, and `--fog` (not a one-off gray hex) for any muted/secondary text — both are calibrated to clear WCAG AA 4.5:1 on bone/paper.

### Don't:
- **Don't** introduce a gradient hero section or gradient text anywhere — flat color only.
- **Don't** shift the neutral palette toward cream/sand/beige "AI default" tones; neutrals stay ink/bone/paper.
- **Don't** build a generic card-grid "dashboard-by-numbers" layout with no hierarchy — every card in this system earns a specific shape (recorder, mini-card, history row), not a repeated identical box.
- **Don't** add rounded corners, soft glassy chrome, or blurred ambient shadows anywhere — that reads as generic SaaS, which this product explicitly rejects.
- **Don't** use copper as a background fill or a decorative border color outside the nav-item left-border and active/recording states.
- **Don't** pair DM Serif Display with anything beyond the single "Flow" wordmark use — it is a rationed flourish, not a second display family.
- **Don't** use `border-left`/`border-right` accent stripes anywhere except the nav-item active/hover indicator, which is the one sanctioned instance of that pattern in this system.
