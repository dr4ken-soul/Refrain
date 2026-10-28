# FRONTEND_SPEC.md: Refrain

Refrain watches public Telegram market voices, tests agreement against fixed rules, and records paper positions or rejections through Chainlink CRE. Built for BLI Legal Tech Hackathon 2 on DoraHacks, for the RYO-CHAN Autonomous Agents bounty and the Chainlink Best Workflow with CRE bounty.

---

## 0. Project Identity

- **Name:** Refrain
- **One-line pitch:** KOL calls become evidence before they become trades.
- **Aesthetic (Gate 1):** Bento grid operational, expressed as a light forensic evidence board.
- **Identity fingerprint (section 0C):** top-left lead, bottom-right support / Swiss rational / monochrome plus single pop / solid plus inline asset / editorial stagger / subtle precision
- **Design dials:** DESIGN_VARIANCE 5, MOTION_INTENSITY 4, VISUAL_DENSITY 7
- **2026 trend layer:** primary Surveillance Design, supporting Blueprint Design. Expression level: clear influence. Surveillance appears as timestamps, recognition boxes around extracted token mentions and system status labels. Blueprint appears as annotated callouts in the verdict anatomy and the CRE filing path. No other trend is used.
- **Crypto classification:** Category B, off-chain crypto tool, and Category C, AI agent for crypto. A narrow Category A surface exists only for the Sepolia attestation contract that receives CRE reports. No user wallet signing exists in the MVP.
- **Chain:** Ethereum Sepolia for the RefrainLedger consumer contract and for CRE simulation with broadcast. Mainnet use is read-only and limited to public Chainlink Data Feeds where a feed exists.
- **Funds:** none. Positions are paper records. The product never holds a balance, never requests an exchange key and never places an order.
- **Logo and favicon:** neither exists. Both stay as plain comment slots until the project owner supplies or approves an asset.

```tsx
{/* Logo slot: replace with public/logo.svg once provided */}
```

```html
<!-- Favicon slot: replace with public/favicon.ico once provided -->
```

---

## 1. Global Design System

### 1.1 Fonts (Gate 4, confirmed)

```css
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
```

- `--font-display`: 'Archivo', sans-serif. Headlines, section titles and large metrics only.
- `--font-body`: 'Archivo', sans-serif. Body copy, controls and table text.
- `--font-mono`: 'IBM Plex Mono', monospace. Timestamps, contract addresses, prices, Entry, SL, TP, status labels, rules and CRE log fragments.
- Tailwind mapping: `font-display`, `font-body` and `font-mono` resolve to the three variables above. Display and body intentionally share one family. Weight and size create the hierarchy.
- Headings use `text-wrap: balance`. Long paragraphs use `text-wrap: pretty`. Body measure is capped between `60ch` and `72ch` unless a data table requires full width.
- Numeric data uses `tabular-nums` in every price, metric, timestamp and score context.

### 1.2 Colour System (Gate 5, confirmed)

Colour strategy: Restrained. Cool tinted neutrals carry the surface. Vermilion stays under roughly ten per cent of any viewport. OKLCH is used so perceived lightness stays consistent across ink, borders and semantic states.

```css
:root {
  --bg-primary: oklch(0.972 0.006 228);
  --bg-secondary: oklch(0.945 0.008 228);
  --bg-surface: oklch(0.995 0.003 228);
  --bg-elevated: oklch(0.925 0.010 228);
  --bg-inverse: oklch(0.185 0.018 242);

  --accent: oklch(0.575 0.205 31);
  --accent-hover: oklch(0.520 0.200 31);
  --accent-glow: oklch(0.575 0.205 31 / 0.12);

  --text-primary: oklch(0.185 0.018 242);
  --text-secondary: oklch(0.420 0.016 240);
  --text-muted: oklch(0.490 0.013 240);
  --text-inverse: oklch(0.965 0.005 228);

  --border-subtle: oklch(0.185 0.018 242 / 0.08);
  --border-default: oklch(0.185 0.018 242 / 0.16);
  --success: oklch(0.500 0.130 155);
  --error: oklch(0.520 0.200 27);

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  --shadow-board: 0 24px 48px -24px oklch(0.185 0.018 242 / 0.18);
  --shadow-overlay: 0 16px 40px -16px oklch(0.185 0.018 242 / 0.22);
  --duration-fast: 120ms;
  --duration-normal: 220ms;
  --duration-slow: 650ms;
}
```

Colour rules:

- Components reference variables only. No hex value appears in a component file.
- Primary actions use `--text-primary` as the fill and `--text-inverse` as the label. Vermilion does not fill a primary action except on hover.
- `--accent` is reserved for the nav progress line, recognition boxes around extracted mentions, promotion flags, the REJECTED stamp and focus-visible outlines.
- APPROVED is an ink stamp with a check icon and the word APPROVED. REJECTED is a vermilion stamp with a close icon and the word REJECTED. DEFERRED is a neutral bordered stamp with a clock icon and the word DEFERRED. Status is never carried by colour alone.
- `--success` appears only on live status dots, settled markers and positive paper P and L values. Negative P and L uses `--error` with an explicit minus sign and the word Loss where space allows.
- Bento surfaces use borders, not decorative shadows. `--shadow-board` is allowed only under the hero evidence board and the app board. `--shadow-overlay` is allowed only on menus, panels and dialogs.
- Radius language stays sharp: 4px on stamps and chips, 6px on buttons and fields, 8px on inner panels, 12px on the outer board shell. Status dots are the only circular elements besides icon buttons.

Global page rules:

```css
html {
  scrollbar-width: none;
  scroll-behavior: smooth;
}

::-webkit-scrollbar {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

The hidden scrollbar must not remove keyboard focus visibility. Every interactive element carries `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]` unless a section gives a stronger local treatment.

### 1.3 Global Z-Index Map

```text
z-0:   page background surface
z-[3]: micro-noise overlay, fixed inset-0, pointer-events-none, opacity-[0.025]
z-10:  normal section content and evidence board zones
z-20:  raised elements inside a section, verdict stamp, sticky table headers
z-30:  app-interior mobile bottom bar
z-40:  mobile navigation index panel, anchored under the fixed strip
z-50:  fixed B1 navigation strip and its progress line
z-[60]: menus and popovers opened from the app shell
z-[70]: modal scrim, bg-[oklch(0.185_0.018_242/0.52)]
z-[80]: modal panel
z-[90]: toast region, bottom-right on desktop and bottom-centre on mobile
```

No arbitrary 999 values. A new layer must take an existing slot or extend this map in the spec first.

### 1.4 Background Layer (Gate 3, confirmed: Static but Atmospheric)

No video, no WebGL scene, no canvas particle field and no photographic background is used on the landing page or inside the app.

```text
PAGE SURFACE:
  body: bg-[var(--bg-primary)] text-[var(--text-primary)] font-body antialiased

MICRO-NOISE OVERLAY:
  Element: one fixed div mounted once in the root layout
  Classes: pointer-events-none fixed inset-0 z-[3] opacity-[0.025]
  Background: inline SVG fractalNoise data URI, baseFrequency 0.8, numOctaves 3, tile 180px by 180px
  Behaviour: static. It never animates, never parallaxes and never sits above a modal panel.

SECTION RULES:
  Dense sections open on a full-width 1px line:
    border-t border-[var(--border-default)]
  Breathing sections use spacing only, with no rule, so the page does not become a ruled notebook.

EVIDENCE GRID UTILITY:
  Class name: .evidence-grid
  Use: inside the convergence zone of the evidence board only, where the surface is a measurement timeline
  Background: two 1px linear-gradient line layers in var(--border-subtle), background-size 28px 28px
  Ban: never apply .evidence-grid to a page section background.
```

### 1.5 Motion Primitives (Gate 3 follow-up, confirmed: Staggered Viewport Reveal)

Every scroll reveal replays in both directions. CSS keyframes are not used for scroll reveal. Motion components use `motion/react`.

```text
STANDARD SECTION REVEAL:
  initial: { filter: 'blur(8px)', opacity: 0, y: 18 }
  whileInView: { filter: 'blur(0px)', opacity: 1, y: 0 }
  viewport: { once: false, amount: 0.1 }
  transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] }

GROUP STAGGER:
  Parent variants: staggerChildren 0.05, delayChildren 0.08
  Child: same states as the standard reveal
  Rule: never place max-width, mx-auto or horizontal padding on the motion parent.
    The section stays full width. A plain inner div carries the container classes.

HERO LOAD SEQUENCE:
  Uses animate, not whileInView.
  Status line delay 0.15s, headline delay 0.28s, subheading delay 0.46s,
  CTA cluster delay 0.62s, evidence board delay 0.74s, board footer delay 0.92s.

LIVE ROW ENTRY:
  initial: { filter: 'blur(6px)', opacity: 0, y: -6 }
  animate: { filter: 'blur(0px)', opacity: 1, y: 0 }
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
  Row height is fixed by the zone spec so an entering row does not resize the board.

RECOGNITION BOX:
  initial: { opacity: 0, scale: 0.96 }
  animate: { opacity: 1, scale: 1 }
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.18 }

VERDICT STAMP:
  initial: { opacity: 0, scale: 1.18, rotate: -8 }
  animate: { opacity: 1, scale: 1, rotate: -6 }
  transition: { type: 'spring', stiffness: 420, damping: 26 }

COUNTER:
  From 0 to the fetched value over 1.2s with easeOut cubic-bezier(0.16, 1, 0.3, 1).
  Triggered by useInView with { once: false, amount: 0.1 }.
  A live value change after the count completes crossfades in 180ms. It never recounts from zero.

EXIT RULE:
  Any closing panel runs at 60 to 70 per cent of its opening duration.

REDUCED MOTION:
  With prefers-reduced-motion, reveals become opacity only at duration 0.2s,
  the stamp appears without scale, counters render at final value,
  and the live status dot stops pulsing.
```

Hover states use CSS transitions only. Inline `onMouseEnter` and `onMouseLeave` style changes are banned. Icons are inline SVG only, drawn on a 24px viewBox with `stroke-width: 1.5`, round caps and no fill unless a section states otherwise. Emoji are banned as interface elements.

### 1.6 Shared Components

These patterns are defined once and reused. Sections reference them by name rather than restyling them.

```text
PRIMARY ACTION (one label sitewide: Open live board):
  group inline-flex min-h-[44px] items-center gap-3 rounded-[6px]
  bg-[var(--text-primary)] px-5 py-3 font-mono text-[11px] font-medium
  uppercase tracking-[0.14em] text-[var(--text-inverse)]
  transition-colors duration-200 hover:bg-[var(--accent-hover)]
  Trailing icon sits in its own circle:
    flex h-7 w-7 items-center justify-center rounded-full
    bg-[oklch(0.965_0.005_228/0.14)] transition-transform duration-200
    group-hover:translate-x-[1px] group-hover:-translate-y-[1px]
  Icon: inline SVG arrow-up-right, h-3.5 w-3.5

SECONDARY ACTION:
  inline-flex min-h-[44px] items-center gap-2 rounded-[6px]
  border border-[var(--border-default)] bg-transparent px-5 py-3
  font-mono text-[11px] font-medium uppercase tracking-[0.14em]
  text-[var(--text-primary)] transition-colors duration-200
  hover:border-[var(--text-primary)]

STATUS STAMP:
  inline-flex items-center gap-1.5 rounded-[4px] border-2 px-2.5 py-1
  font-mono text-[11px] font-semibold uppercase tracking-[0.18em]
  APPROVED: border-[var(--text-primary)] text-[var(--text-primary)]
  REJECTED: border-[var(--accent)] text-[var(--accent-hover)]
  DEFERRED: border-[var(--border-default)] text-[var(--text-secondary)]
  OPEN: border-[var(--border-default)] text-[var(--text-secondary)], live dot before the word
  SETTLED: border-[var(--text-primary)] text-[var(--text-primary)], check icon before the word

DATA LABEL:
  font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]

DATA VALUE:
  font-mono text-sm tabular-nums text-[var(--text-primary)]

DOUBLE-BEZEL BOARD SHELL:
  Outer: rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-[6px]
  Inner: overflow-hidden rounded-[8px] border border-[var(--border-subtle)]
    bg-[var(--bg-surface)] shadow-[var(--shadow-board)]

LEDGER TABLE:
  Wrapper: overflow-x-auto rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]
  Table: w-full min-w-[760px] border-collapse text-left
  Head cell: sticky top-0 z-20 bg-[var(--bg-secondary)] px-4 py-3
    font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]
  Body cell: px-4 py-3.5 align-top text-sm text-[var(--text-secondary)]
  Row: border-t border-[var(--border-subtle)] transition-colors duration-150
    hover:bg-[var(--bg-secondary)]
  Numeric cell: font-mono tabular-nums text-[var(--text-primary)]
  Mobile: below md the table is replaced by ruled record rows, one record per block,
    each field as a label and value pair in a two-column grid. No horizontal page scroll.

FIELD (operator forms):
  Label: block font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2
  Input: min-h-[44px] w-full rounded-[6px] border border-[var(--border-default)]
    bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]
    placeholder:text-[var(--text-muted)] transition-colors duration-150
    hover:border-[var(--text-secondary)]
  Error text: mt-2 text-[13px] leading-snug text-[var(--error)]
  Rule: validate on blur. The message states the cause and the fix.

SKELETON:
  relative overflow-hidden rounded-[6px] bg-[var(--bg-elevated)]
  Shimmer child moves with a CSS transition on transform. No spinner is used for content loading.
```

---

## 2. Navigation: Gate 2, B1 Scroll-Progress Strip

```text
z-index: strip z-50, progress line inside the strip stacking context, mobile panel z-40

SKIP LINK (first focusable element on every route):
  sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-[60px] focus:z-[60]
  focus:rounded-[6px] focus:bg-[var(--text-primary)] focus:px-4 focus:py-2.5
  focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-[0.14em]
  focus:text-[var(--text-inverse)]
  Text: "Skip to main content"

STRIP:
  header fixed inset-x-0 top-0 z-50 border-b border-[var(--border-subtle)]
  bg-[oklch(0.972_0.006_228/0.92)] backdrop-blur-[14px]
  Backdrop blur is allowed here because the strip is fixed.

INNER:
  mx-auto grid h-[52px] w-full max-w-[1440px] grid-cols-[1fr_auto] items-center
  gap-3 px-4 md:h-14 md:px-8 lg:grid-cols-[220px_1fr_auto] xl:px-12

WORDMARK:
  Link to the top of the current surface.
  font-mono text-[13px] font-semibold uppercase tracking-[0.28em] text-[var(--text-primary)]
  Text: "REFRAIN"
  The logo comment slot from section 0 sits directly before this link in the markup.

CURRENT SECTION LABEL (desktop only):
  hidden items-center gap-3 lg:flex
  Separator: h-4 w-px bg-[var(--border-default)]
  Label: font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]
  Values, in page order: "Evidence board", "Current record", "The problem",
    "Anatomy of a verdict", "KOL reliability index", "Rejected trades",
    "Rules before positions", "CRE filing path", "Boundary"
  Change animation: initial { opacity: 0, y: 4 }, animate { opacity: 1, y: 0 },
    exit { opacity: 0, y: -4 }, duration 0.25s, ease [0.16, 1, 0.3, 1]
  Source: one IntersectionObserver per section with rootMargin "-45% 0px -50% 0px"

PROOF LINKS (desktop only):
  nav hidden items-center gap-7 lg:flex
  Link: relative py-2 text-[13px] font-medium text-[var(--text-secondary)]
    transition-colors duration-200 hover:text-[var(--text-primary)]
  Links: "Live board" to /app, "KOL index" to /#kol-index,
    "CRE filing path" to /#cre-filing-path
  Active state: text-[var(--text-primary)] plus an underline bar
    absolute -bottom-[1px] left-0 h-[2px] w-full origin-left bg-[var(--accent)]
    animating scaleX from 0 to 1 over 220ms. Colour alone never marks the active link.

PRIMARY ACTION:
  Shared Primary Action at compact size: min-h-[40px] px-4 py-2.5
  Label: "Open live board"
  Behaviour: route to /app. It never opens a wallet prompt.

LIVE STATUS (mobile and tablet only):
  flex items-center gap-2 lg:hidden
  Dot: h-2 w-2 rounded-full bg-[var(--success)]
    Pulse: animate scale [1, 1.35, 1] and opacity [1, 0.65, 1], duration 2.4s, repeat Infinity
    Replay state: dot uses bg-[var(--accent)] and does not pulse
  Text: font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]
    Live value: "Live"  |  Replay value: "Replay"

MENU BUTTON (below lg only):
  flex h-11 w-11 items-center justify-center rounded-[6px]
  border border-[var(--border-default)] text-[var(--text-primary)] lg:hidden
  aria-expanded and aria-haspopup="true" are required. aria-label: "Open section index"
  Icon: two inline SVG lines, h-5 w-5. Open state rotates the pair into a close mark
    with transition-transform duration-200.

MOBILE INDEX PANEL:
  absolute inset-x-0 top-full z-40 border-b border-[var(--border-default)]
  bg-[var(--bg-primary)] shadow-[var(--shadow-overlay)]
  Animation: initial { opacity: 0, y: -6 }, animate { opacity: 1, y: 0 },
    exit { opacity: 0, y: -4 }, enter 220ms, exit 150ms
  Row: flex min-h-[52px] items-center justify-between border-t
    border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-primary)]
    first:border-t-0
  Rows: Evidence board, Current record, Anatomy of a verdict, KOL index,
    Rejected trades, Rules, CRE filing path, Boundary, Open live board
  The Open live board row uses bg-[var(--text-primary)] text-[var(--text-inverse)].
  Close behaviour: link activation, outside pointer down, or Escape.
    Focus returns to the menu button on close.

PROGRESS LINE:
  Track: absolute inset-x-0 bottom-[-1px] h-px bg-[var(--border-subtle)]
  Fill: h-full w-full origin-left bg-[var(--accent)]
  Drive: scaleX from useScroll().scrollYProgress through useSpring
    with stiffness 120, damping 26, mass 0.4. Transform only.
  On /app routes the fill tracks the app page scroll in the same way.
```

### 2.1 Routing and Access Model (Mandatory)

Refrain has no wallet connection in the MVP, so the wallet-gating patterns in FRONTEND_SKILL.md Steps 13 and 14 are not triggered. The access contract is explicit instead:

```text
PUBLIC ROUTES (no account, no wallet, readable by judges):
  /                              landing page specified in sections 3 to 11
  /app                           live evidence board, full width
  /app/calls                     every extracted call, filterable
  /app/convergence/[eventId]     one case file: evidence, rules, verdict, settlement
  /app/ledger                    paper positions and rejections
  /app/kols                      reliability index and channel roles
  /app/watchlist                 monitored sources, read-only without operator session
  /app/rules                     active mandate, read-only without operator session

OPERATOR ACTIONS:
  Adding a channel, changing a channel role, editing the mandate and requesting
  a manual CRE simulation run require an operator session issued from a
  server-side secret. Without it, Watchlist and Rules render in read-only mode
  with every control visibly disabled at opacity 0.45 and the disabled attribute set.
  Read-only note, exact copy: "Operator sign-in is required to change this record."

DATA HONESTY:
  Every board, table and metric reads the API or the Sepolia contract.
  If the newest ingested post is older than 15 minutes, the surface enters
  replay mode and shows "Recorded replay" in the board header.
  Empty states state what is missing and what happens next. No surface invents a call,
  a price, a score or a transaction hash.
```

Acceptance checks required before the demo:

- Open `/app` in a fresh browser with no wallet extension and confirm the board loads.
- Refresh `/app/convergence/[eventId]` directly and confirm the case file renders, not a host error page.
- Stop the collector, wait for stale data, and confirm the Recorded replay state appears.
- Disconnect the API and confirm each surface shows its error state with a retry action.
- Open Watchlist and Rules without an operator session and confirm read-only mode.
- Follow a Telegram source link and a Sepolia filing link and confirm both open the correct external record.

---

## 3. Section: Hero, Case Board

**Recipe:** bespoke, at the detail level of the Golden Spec Examples in COMPOSITION_RECIPES.md. Structure draws on `asymmetric-bento-grid` for the board and on the lower-anchor discipline of `cinematic-video-hero-split` for placement. Neither composition is copied.
**Customisations:** the visual slot is a working three-zone evidence board fed by the board API, not an image or a video.

```text
z-index within section: text z-10, board z-10, verdict stamp z-20

SECTION: Hero
Layout: relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--bg-primary)] pt-[52px] md:pt-14
Background: solid plus the global micro-noise overlay from section 1.4

INNER:
  mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-10 px-4 pb-12 pt-10
  md:px-8 md:pb-16 md:pt-16 lg:grid-cols-12 xl:px-12

TEXT STACK:
  relative z-10 lg:col-span-7 xl:col-span-6

  Status line (element 1 of 4):
    flex items-center gap-2.5 font-mono text-[11px] uppercase
    tracking-[0.18em] text-[var(--text-secondary)]
    Dot: h-2 w-2 rounded-full bg-[var(--success)], pulse as defined in section 1.5
    Live text: "Live · {n} public Telegram channels"
    Replay text: "Recorded replay · {n} public Telegram channels", dot bg-[var(--accent)]
    Animation: hero load, delay 0.15s

  Headline (element 2 of 4):
    mt-6 font-display text-[2.85rem] font-extrabold leading-[0.98]
    tracking-[-0.045em] text-[var(--text-primary)] [text-wrap:balance]
    sm:text-6xl lg:text-[4.35rem] xl:text-[5rem]
    Text, two lines: "KOL calls become evidence" / "before they become trades"
    Animation: hero load, delay 0.28s

  Subheading (element 3 of 4):
    mt-6 max-w-[58ch] font-body text-base leading-relaxed
    text-[var(--text-secondary)] md:text-lg
    Text: "Refrain watches public Telegram market voices, tests agreement
      against fixed rules, and records paper positions or rejections
      through Chainlink CRE."
    Animation: hero load, delay 0.46s

  CTA cluster (element 4 of 4):
    mt-8 flex flex-wrap items-center gap-3
    Primary: Shared Primary Action, label "Open live board", route /app
    Secondary: Shared Secondary Action, label "Read one verdict",
      anchor to #anatomy-of-a-verdict
    Animation: hero load, delay 0.62s

EVIDENCE BOARD:
  Wrapper: relative z-10 lg:col-span-10 lg:col-start-3 xl:col-span-9 xl:col-start-4
  Shell: Shared Double-Bezel Board Shell
  Animation: initial { filter: 'blur(10px)', opacity: 0, y: 28 }
    animate { filter: 'blur(0px)', opacity: 1, y: 0 }
    duration 0.85s, ease [0.16, 1, 0.3, 1], delay 0.74s

  BOARD HEADER:
    flex h-12 items-center justify-between gap-3 border-b
    border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4
    Left: Data Label, text "Evidence board"
    Centre tag: hidden rounded-[4px] border border-[var(--border-default)]
      px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]
      text-[var(--text-secondary)] sm:block
      Text: "Paper only"
    Right: flex items-center gap-2 font-mono text-[11px] tabular-nums
      text-[var(--text-muted)]
      Label "Updated" plus the ingest time in Africa/Lagos time, format HH:mm:ss

  MOBILE TAB BAR (below md only):
    grid grid-cols-3 border-b border-[var(--border-subtle)] md:hidden
    Tab: min-h-[44px] px-2 font-mono text-[10px] uppercase tracking-[0.14em]
    Active tab: bg-[var(--bg-secondary)] text-[var(--text-primary)]
      with a 2px inset bottom bar in var(--accent)
    Inactive tab: text-[var(--text-muted)]
    Tabs: "Calls", "Convergence", "Verdict"
    Each tab is a real button with aria-pressed. On md and above all zones show.

  BOARD GRID:
    grid grid-cols-1 md:min-h-[432px] md:grid-cols-12

  ZONE A, CALL STREAM:
    border-[var(--border-subtle)] md:col-span-4 md:border-r
    Zone header: flex h-11 items-center justify-between border-b
      border-[var(--border-subtle)] px-4
      Left: Data Label, text "Latest calls"
      Right: Data Value at text-[11px], the count parsed in the visible window
    Rows: divide-y divide-[var(--border-subtle)]
    Row: grid min-h-[76px] grid-cols-[1fr_auto] gap-3 px-4 py-3
      Entry animation: Live Row Entry from section 1.5, newest first, maximum 5 rows
      Channel line: flex items-center gap-2
        Initial block: flex h-6 w-6 shrink-0 items-center justify-center
          rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-secondary)]
          font-mono text-[10px] font-semibold text-[var(--text-secondary)]
          Content: first two letters of the handle, uppercase. No avatar image is hotlinked.
        Handle: truncate font-mono text-[12px] text-[var(--text-primary)]
        Time: font-mono text-[11px] tabular-nums text-[var(--text-muted)]
      Excerpt: mt-1.5 line-clamp-2 text-[13px] leading-snug text-[var(--text-secondary)]
        The extracted token or contract address inside the excerpt is wrapped in a
        relative span with px-1 font-mono text-[var(--text-primary)].
        Recognition box: pointer-events-none absolute inset-0 rounded-[3px]
          border border-[var(--accent)], Recognition Box animation from section 1.5
      Direction tag: self-start rounded-[4px] border border-[var(--border-default)]
        px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]
        Values: "Long", "Short", "Spot buy", "Close", "Mention"
    Loading state: 5 Shared Skeleton rows at min-h-[76px]
    Empty state: px-4 py-8 text-sm leading-relaxed text-[var(--text-secondary)]
      Text: "No calls have been ingested yet, so the board is waiting for the
        collector. Recorded calls appear here as soon as the replay set loads."

  ZONE B, CONVERGENCE TIMELINE:
    evidence-grid relative border-[var(--border-subtle)] md:col-span-4 md:border-r
    Zone header: same shell as Zone A
      Left: Data Label, text "Convergence"
      Right: Data Value at text-[11px], the asset or narrative under test
    Voice list: relative space-y-3 px-4 py-4
      Connector: absolute bottom-6 left-[27px] top-6 w-px bg-[var(--border-default)]
      Voice row: relative flex gap-3
        Node: mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-[var(--bg-surface)]
          bg-[var(--text-primary)]
          Promotion-flagged node: bg-[var(--accent)]
        Voice panel: min-w-0 flex-1 rounded-[6px] border
          border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5
          Top line: flex items-center justify-between gap-2
            Handle: truncate font-mono text-[12px] text-[var(--text-primary)]
            Offset: font-mono text-[11px] tabular-nums text-[var(--text-muted)],
              format "+00:42", "+18:07", "+03:12:44"
          Fact line: mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]
            tabular-nums text-[var(--text-secondary)]
            Fields: "Conviction 72", "Urgency 41", "Score 64.2"
          A repeated post by the same channel renders inside the same voice panel
            as a second offset line. It never creates a second node.
    Threshold meter: border-t border-[var(--border-subtle)] px-4 py-3.5
      Label row: flex items-center justify-between
        Data Label, text "Independent voices"
        Data Value, format "3 of 3"
      Segments: mt-2.5 grid grid-cols-3 gap-1.5
        Segment: h-1.5 rounded-[2px] bg-[var(--bg-elevated)]
        Filled segment: bg-[var(--text-primary)], scaleX from 0 to 1, origin-left,
          duration 0.5s, stagger 0.12s
      Timing line: mt-2.5 font-mono text-[11px] tabular-nums text-[var(--text-muted)]
        Format: "Spread 03:12:44 · window 24h · forwards excluded"

  ZONE C, VERDICT SHEET:
    relative bg-[var(--bg-secondary)] md:col-span-4
    Zone header: same shell as Zone A, bg-[var(--bg-secondary)]
      Left: Data Label, text "Verdict"
      Right: Data Value at text-[11px], format "Rules v1"
    Stamp: Shared Status Stamp, absolute right-4 top-[60px] z-20,
      Verdict Stamp animation from section 1.5
    Sheet rows: px-4 py-4
      Row: flex items-baseline justify-between gap-4 border-b
        border-[var(--border-subtle)] py-2.5 last:border-b-0
      Label: Data Label  |  Value: Data Value, text-right
      Approved rows: Asset, Direction, Entry, Paper size, Stop, Target, Expires
      Rejected rows: Asset, Direction claimed, Reason code, Rule failed, Filed as
      Reason sentence under the rows: text-[13px] leading-relaxed
        text-[var(--text-secondary)]
        Approved example: "Three independent channels reached the same pair inside
          the window, and every mandate rule passed, so a paper position was filed."
        Rejected example: "One channel repeated the same contract nine times inside
          one hour. Repetition is recorded as one opinion, so the threshold was not met."
    CRE filing row: mt-2 flex items-center justify-between gap-3 rounded-[6px]
      border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5
      Left: Data Label, text "CRE filing"
      Right link: flex min-h-[32px] items-center gap-1.5 font-mono text-[12px]
        tabular-nums text-[var(--text-primary)] underline-offset-4 hover:underline
        Content: shortened transaction hash plus an inline SVG external icon, h-3.5 w-3.5
      Pending value before a real filing exists: "Awaiting simulation run"

  BOARD FOOTER:
    grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-t
    border-[var(--border-subtle)] bg-[var(--bg-surface)]
    Cell: px-3 py-3 text-center md:px-4
      Value: font-display text-lg font-bold tabular-nums text-[var(--text-primary)] md:text-xl
      Label: mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]
    Cells: "{n}" / "Channels monitored", "{n}" / "Calls parsed", "0" / "Real funds at risk"
    Animation: hero load, delay 0.92s. Counts use the Counter primitive.

ASSET BRIEF:
  Type: coded live component. No image, video or 3D asset.
  Data: GET /api/board returns the call window, the active convergence event,
    the latest verdict, counts and the newest ingest time.
  Fallback: the frozen replay set defined in APP_BLUEPRINT.md. The board labels it
    as a recorded replay. A static screenshot is never substituted for the board.
```

---

## 4. Section: Current Record

**Recipe:** `metrics-section` from COMPOSITION_RECIPES.md.
**Customisations:** five metrics instead of three, every value read from the API, dividers as rules rather than cards.

```text
z-index: content z-10

SECTION: Current Record
Layout: border-t border-[var(--border-default)] bg-[var(--bg-primary)] py-16 md:py-24
Inner: mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12

Heading row:
  flex flex-wrap items-end justify-between gap-4
  Title: font-display text-2xl font-bold tracking-[-0.02em]
    text-[var(--text-primary)] md:text-[2rem]
    Text: "The current record"
  Data note: font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]
    Live text: "Read from the running system"
    Replay text: "Read from the frozen replay set"

Metrics grid:
  mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[8px]
  border border-[var(--border-default)] bg-[var(--border-default)]
  md:grid-cols-3 xl:grid-cols-5

Metric cell:
  bg-[var(--bg-surface)] px-4 py-5 md:px-5 md:py-6
  Value: font-display text-[2rem] font-extrabold leading-none tabular-nums
    text-[var(--text-primary)] md:text-[2.75rem]
  Label: mt-2.5 font-mono text-[10px] uppercase leading-relaxed
    tracking-[0.14em] text-[var(--text-muted)]
  Animation: Standard Section Reveal with Group Stagger.
    Values count with the Counter primitive over 1.2s.

Metrics, in order:
  Calls parsed | Convergence events | Paper positions opened |
  Trades rejected | Positions settled

Footnote:
  mt-5 max-w-[68ch] text-[13px] leading-relaxed text-[var(--text-secondary)]
  Text: "Counts cover the monitored data set only. A rejected trade is a completed
    decision, so it is counted and filed beside every position."

ASSET BRIEF:
  Type: none. Data from GET /api/metrics.
```

---

## 5. Section: Problem Statement

**Recipe:** `full-width-statement` from COMPOSITION_RECIPES.md.
**Customisations:** left-aligned statement on the cool paper surface, one supporting line, no CTA.

```text
z-index: content z-10

SECTION: Problem Statement
Layout: bg-[var(--bg-primary)] py-20 md:py-32
Inner: mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12

Statement:
  max-w-[16ch] font-display text-[clamp(2.4rem,6vw,5.25rem)] font-extrabold
  leading-[0.98] tracking-[-0.04em] text-[var(--text-primary)] [text-wrap:balance]
  Text: "One loud caller is not a market consensus."
  Animation: word by word, blur(8px) opacity 0 y 18 to blur(0) opacity 1 y 0,
    duration 0.55s per word, stagger 0.07s, viewport { once: false, amount: 0.1 }

Support line:
  mt-8 max-w-[62ch] font-body text-base leading-relaxed
  text-[var(--text-secondary)] md:text-lg
  Text: "Call channels are paid in attention, so repetition is cheap and
    coordination is hard to see from inside one feed. Refrain reads across
    the watchlist, then asks whether separate voices arrived at the same
    claim without copying each other."
  Animation: Standard Section Reveal, delay 0.35s

ASSET BRIEF:
  Type: none.
```

---

## 6. Section: Anatomy of a Verdict

**Recipe:** `tabbed-feature-explorer` from COMPOSITION_RECIPES.md.
**Customisations:** tabs inspect one real case rather than three product features. The visual slot is the frozen evidence record. This section carries the first of the two permitted eyebrows.

```text
z-index: content z-10, sticky case summary inside the section z-20

SECTION: Anatomy of a Verdict
id: anatomy-of-a-verdict
Layout: border-t border-[var(--border-default)] bg-[var(--bg-secondary)] py-20 md:py-28
Inner: mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12

Eyebrow (1 of 2 on the page):
  font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent-hover)]
  Text: "Case file"

Title:
  mt-4 font-display text-3xl font-extrabold tracking-[-0.03em]
  text-[var(--text-primary)] md:text-[2.6rem] md:leading-[1.02]
  Text: "Anatomy of a verdict"

Intro:
  mt-4 max-w-[64ch] font-body text-base leading-relaxed text-[var(--text-secondary)]
  Text: "One decided case, opened in full. The posts stay frozen at the moment
    of decision, the rule results stay beside the claim they judged, and the
    outcome is settled against recorded prices rather than memory."

CASE SUMMARY STRIP:
  mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[8px]
  border border-[var(--border-default)] bg-[var(--border-default)] lg:grid-cols-4
  Cell: bg-[var(--bg-surface)] px-4 py-4
    Label: Data Label
    Value: mt-1.5 Data Value, truncate where an address is long
  Cells: Asset, First call, Decision time, Filing
  The Filing value links to the case route and, after broadcast, to Sepolia Etherscan.

TAB BAR:
  mt-8 flex gap-1 overflow-x-auto border-b border-[var(--border-default)]
  Tab: min-h-[44px] shrink-0 px-4 py-3 font-mono text-[11px] uppercase
    tracking-[0.14em] transition-colors duration-200 md:px-5
  Active: text-[var(--text-primary)] shadow-[inset_0_-2px_0_var(--accent)]
  Inactive: text-[var(--text-muted)] hover:text-[var(--text-primary)]
  Tabs: "Evidence", "Rules", "Outcome"
  Behaviour: buttons with aria-pressed, arrow keys move between tabs,
    content changes with AnimatePresence mode="wait",
    initial { opacity: 0, y: 10 }, animate { opacity: 1, y: 0 },
    exit { opacity: 0, y: -6 }, enter 320ms, exit 200ms

TAB PANEL, EVIDENCE:
  mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12
  Post list: space-y-3 lg:col-span-7
    Post record: rounded-[8px] border border-[var(--border-default)]
      bg-[var(--bg-surface)] p-4 md:p-5
      Header: flex flex-wrap items-center justify-between gap-2
        Handle: font-mono text-[13px] font-medium text-[var(--text-primary)]
        Time: font-mono text-[11px] tabular-nums text-[var(--text-muted)]
      Excerpt: mt-3 text-sm leading-relaxed text-[var(--text-secondary)]
        Extracted mentions carry the recognition box from section 3.
      Extracted fields: mt-4 grid grid-cols-2 gap-3 md:grid-cols-4
        Field: border-t border-[var(--border-subtle)] pt-2.5
          Data Label above Data Value
        Fields: Asset, Direction, Conviction, Urgency
      Footer: mt-4 flex flex-wrap items-center justify-between gap-3
        Evidence hash: truncate font-mono text-[11px] text-[var(--text-muted)]
        Source link: Shared Secondary Action at compact size, min-h-[36px] px-3 py-2,
          label "Open source post", external icon, opens the Telegram post
  Reading rail: lg:col-span-5
    Panel: rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5
      Title: font-body text-base font-semibold text-[var(--text-primary)]
        Text: "How to read this record"
      Rows: mt-4 space-y-4
        Row: flex gap-3
          Marker: mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[var(--text-primary)]
          Text: text-sm leading-relaxed text-[var(--text-secondary)]
      Row copy:
        "A boxed mention is the exact span the parser extracted. Nothing outside
          a box influenced the asset choice."
        "Offsets are measured from the first independent call, so timing spread
          can be checked rather than trusted."
        "A forward is evidence of copying. It is shown, then removed from the
          independent voice count."
        "The evidence hash covers the frozen bundle. Change one character and
          the filed hash no longer matches."

TAB PANEL, RULES:
  mt-8 overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]
  Rule row: grid grid-cols-[auto_1fr] gap-3 border-t border-[var(--border-subtle)]
    px-4 py-4 first:border-t-0 md:grid-cols-[44px_1fr_auto] md:items-center md:px-5
    Result mark: flex h-8 w-8 items-center justify-center rounded-full
      border border-[var(--border-default)]
      Pass icon: inline SVG check, h-4 w-4, text-[var(--text-primary)]
      Fail icon: inline SVG close, h-4 w-4, text-[var(--accent-hover)]
    Rule name: text-sm font-semibold text-[var(--text-primary)]
    Rule evidence: mt-1 font-mono text-[12px] tabular-nums leading-relaxed
      text-[var(--text-secondary)]
    Result word: font-mono text-[11px] uppercase tracking-[0.16em]
      Values: "Pass" or "Fail"
  Rules, in decision order:
    Independent voices | Timing spread inside window | No copied forward in the set |
    Weighted conviction | Liquidity floor | Promotion veto |
    Price source agreement | Mandate size limit | Stop, target and expiry present
  Panel footer: border-t border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-4 md:px-5
    Text: text-[13px] leading-relaxed text-[var(--text-secondary)]
    Copy: "The language model extracts claims and writes the explanation. These
      fixed rules decide, so the same frozen bundle always reaches the same verdict."

TAB PANEL, OUTCOME:
  mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12
  Price record: lg:col-span-7
    Panel: rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5
    Chart frame: evidence-grid relative h-[240px] overflow-hidden
      rounded-[6px] border border-[var(--border-subtle)] md:h-[280px]
      Series: one SVG polyline in var(--text-primary), stroke-width 2, no area fill
      Entry line: 1px dashed line in var(--text-muted) with a mono price label
      Stop and target lines: 1px solid lines, stop in var(--accent),
        target in var(--success), each with a text label so colour is never alone
      Exit marker: 10px ink square, rotate-45, with the exit reason beside it
    Source line: mt-3 font-mono text-[11px] leading-relaxed text-[var(--text-muted)]
      Format: "Outcome source {name} · checked against {name} · deviation {value}%"
  Settlement sheet: lg:col-span-5
    Rows reuse the verdict sheet row pattern from section 3.
    Rows: Exit price, Exit reason, Paper result, Settled at, Settlement filing
    Score effect block: mt-4 rounded-[6px] border border-[var(--border-default)]
      bg-[var(--bg-secondary)] p-4
      Title: Data Label, text "Reliability effect"
      Line per contributing channel: mt-2.5 flex items-center justify-between
        font-mono text-[12px] tabular-nums
        Handle left, signed delta right, example format "+1.8" or "-2.4"

ASSET BRIEF:
  Type: frozen case data plus one coded SVG price chart. No photography.
  Data: GET /api/events/{eventId} returns posts, rule results, verdict,
    outcome series, settlement and score effects.
  Selection rule: the landing page features the most recent decided case with a
    complete evidence bundle. The builder must not hardcode a case.
```

---

## 7. Section: KOL Reliability Index

**Recipe:** bespoke ledger surface, following the dashboard hardening rule that dense data uses ruled rows before boxed cards.
**Customisations:** channel roles from the audited watchlist are shown as plain record labels.

```text
z-index: content z-10, sticky table header z-20

SECTION: KOL Reliability Index
id: kol-index
Layout: bg-[var(--bg-primary)] py-20 md:py-28
Inner: mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12

Title:
  font-display text-3xl font-extrabold tracking-[-0.03em]
  text-[var(--text-primary)] md:text-[2.6rem]
  Text: "Every voice keeps its record"

Intro:
  mt-4 max-w-[64ch] font-body text-base leading-relaxed text-[var(--text-secondary)]
  Text: "Scores move only when a tracked call settles. A loud week changes
    nothing on its own, and a channel that promotes without disclosure
    carries that flag in public beside its results."

Table: Shared Ledger Table, mt-10
Columns: Channel | Role | Calls tracked | Settled record | Promotion flags |
  Reliability | Latest call
Channel cell:
  Initial block plus handle, same construction as the hero call row.
  Under the handle: platform line in font-mono text-[11px] text-[var(--text-muted)],
    value "Telegram · public"
Role values: "Core signal", "Meme radar", "Noisy source", "Red flag specimen"
Settled record format: "{wins} hit · {losses} stopped · {expired} expired"
Promotion flags: count plus, where the count is above zero, a vermilion outline
  flag icon rendered as inline SVG before the number
Reliability cell:
  Value: font-display text-xl font-bold tabular-nums
  Bar: mt-1.5 h-1 w-[88px] rounded-[2px] bg-[var(--bg-elevated)]
    Fill: h-full origin-left rounded-[2px] bg-[var(--text-primary)],
      width set from the score, scaleX animates on entry over 700ms
Row link behaviour: the full row routes to /app/kols with the channel preselected.
  Keyboard access uses a real link on the handle, never a clickable row alone.

Scoring note:
  mt-5 max-w-[68ch] text-[13px] leading-relaxed text-[var(--text-secondary)]
  Text: "The starting score is neutral for every channel. Structured futures calls
    settle against their own stop and target. Memecoin calls settle against the
    mandate stop, target and expiry recorded at the moment of the call."

ASSET BRIEF:
  Type: none. Data from GET /api/kols.
```

---

## 8. Section: Rejected Trades

**Recipe:** `stacked-card-reveal` from COMPOSITION_RECIPES.md.
**Customisations:** cards become flat dossier sheets with square corners at the project radius, stacked by scroll position without pinning, so Gate 3 behaviour stays a staggered reveal.

```text
z-index: sheet 1 z-10, sheet 2 z-20, sheet 3 z-30 within the section only

SECTION: Rejected Trades
Layout: border-t border-[var(--border-default)] bg-[var(--bg-secondary)] py-20 md:py-28
Inner: mx-auto w-full max-w-[1100px] px-4 md:px-8

Title:
  font-display text-3xl font-extrabold tracking-[-0.03em]
  text-[var(--text-primary)] md:text-[2.6rem]
  Text: "The trades Refrain refused"

Intro:
  mt-4 max-w-[62ch] font-body text-base leading-relaxed text-[var(--text-secondary)]
  Text: "A signal product is judged by what it talks you out of. Each refusal
    below is a filed decision with the same evidence standard as a position."

DOSSIER STACK:
  mt-12 space-y-4 md:space-y-0
  Sheet: relative rounded-[8px] border border-[var(--border-default)]
    bg-[var(--bg-surface)] p-5 md:sticky md:p-7
    Sticky offsets on md and above: sheet 1 top-[88px], sheet 2 top-[104px],
      sheet 3 top-[120px]. Each later sheet slides over the earlier edge.
    Animation: Standard Section Reveal per sheet. No scale transform on scroll,
      because Gate 3 selected staggered reveal rather than pinned scroll.
  Sheet header: flex flex-wrap items-start justify-between gap-3
    Case name: font-body text-lg font-semibold text-[var(--text-primary)] md:text-xl
    Stamp: Shared Status Stamp, REJECTED
  Fact grid: mt-5 grid grid-cols-2 gap-3 md:grid-cols-4
    Field: border-t border-[var(--border-subtle)] pt-2.5, Data Label above Data Value
  Reason: mt-5 max-w-[66ch] text-sm leading-relaxed text-[var(--text-secondary)]
    md:text-base
  Filing line: mt-5 flex flex-wrap items-center justify-between gap-3
    border-t border-[var(--border-subtle)] pt-4
    Left: font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)],
      format "Reason code {code}"
    Right: text link "Open case file" to /app/convergence/[eventId],
      font-mono text-[12px] tabular-nums underline-offset-4 hover:underline

Required dossier cases, selected from real records by reason code:
  1. COORDINATED_PUMP: a pre-announced call event or a burst whose timing and
     shared referral markers show coordination before any price test runs.
  2. SINGLE_VOICE_REPETITION: one channel repeating one asset inside the window.
     The sheet states the repeat count and the single-opinion rule.
  3. Mandate breach group: a claim with reason code LIQUIDITY_FLOOR,
     MANDATE_SIZE or PRICE_DISAGREEMENT. This is a presentation group, not a
     new reason code. The failed figure is printed, not summarised.
  If a reason code has no real case yet, the sheet is omitted. The section
  renders with the cases that exist and never invents the third.

ASSET BRIEF:
  Type: none. Data from GET /api/events?decision=rejected with one case per reason code.
```

---

## 9. Section: Rules Before Positions

**Recipe:** `architecture-layers` from COMPOSITION_RECIPES.md.
**Customisations:** layers are mandate rules with their active values printed at the right edge, read from the active ruleset.

```text
z-index: content z-10

SECTION: Rules Before Positions
Layout: bg-[var(--bg-primary)] py-20 md:py-28
Inner: mx-auto w-full max-w-[920px] px-4 md:px-8

Title:
  text-center font-display text-3xl font-extrabold tracking-[-0.03em]
  text-[var(--text-primary)] md:text-[2.6rem]
  Text: "Rules before positions"

Intro:
  mx-auto mt-4 max-w-[60ch] text-center font-body text-base leading-relaxed
  text-[var(--text-secondary)]
  Text: "The mandate is a public record with a version and a hash. Change a
    value and the version changes, so an old verdict can always be replayed
    against the rules that produced it."

Layers: mt-12 flex flex-col gap-3
Layer:
  flex items-start gap-4 rounded-[8px] border border-[var(--border-default)]
  bg-[var(--bg-surface)] p-5 transition-colors duration-200
  hover:border-[var(--text-secondary)] md:p-6
  Index: min-w-[2rem] pt-0.5 font-mono text-[12px] tabular-nums text-[var(--text-muted)]
  Body: min-w-0 flex-1
    Name: text-base font-semibold text-[var(--text-primary)]
    Explanation: mt-1 text-sm leading-relaxed text-[var(--text-secondary)]
  Active value: shrink-0 rounded-[4px] border border-[var(--border-default)]
    bg-[var(--bg-secondary)] px-2.5 py-1.5 font-mono text-[12px] tabular-nums
    text-[var(--text-primary)]
  Animation: Group Stagger from section 1.5

Layers, in decision order. Values render from the active ruleset, not from copy:
  Independent voices: "Separate channels, with forwards and reposts removed."
  Time window: "Contract-address assets have a 24-hour window. Listed pairs have a 6-hour window."
  Weighted conviction: "Conviction counts only after reliability weighting."
  Liquidity floor: "Thin pools are refused before any size is calculated."
  Promotion veto: "Referral markers, paid placement language and scheduled
    call events stop the trade and are filed as promotion evidence."
  Paper size: "Size is capped as a share of the paper bankroll, then scaled
    by weighted conviction inside that cap."
  Stop, target, expiry: "A position without all three cannot be filed."

Ruleset footer:
  mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[8px]
  border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-4 md:px-5
  Left: font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)],
    format "Active ruleset v{n}"
  Right: truncate font-mono text-[12px] tabular-nums text-[var(--text-secondary)],
    the ruleset hash

ASSET BRIEF:
  Type: none. Data from GET /api/rules/active.
```

---

## 10. Section: CRE Filing Path

**Recipe:** bespoke vertical walkthrough, informed by `vertical-grid-walkthrough` from COMPOSITION_RECIPES.md.
**Customisations:** hairline guides carry a seven-stage system path. The media slot is replaced by a real CRE simulation log panel. This section carries the second of the two permitted eyebrows.

```text
z-index: guides z-0 inside the section, content z-10, log panel z-20

SECTION: CRE Filing Path
id: cre-filing-path
Layout: relative overflow-hidden border-t border-[var(--border-default)]
  bg-[var(--bg-secondary)] py-20 md:py-28
Inner: relative z-10 mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12

Guides: absolute inset-y-0 hidden w-px bg-[var(--border-subtle)] lg:block
  at left-[8%], left-[38%] and left-[72%]
  Entry animation: scaleY from 0 to 1, origin-top, duration 1s,
    ease [0.16, 1, 0.3, 1], viewport { once: false, amount: 0.1 }

Eyebrow (2 of 2 on the page):
  font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent-hover)]
  Text: "Chainlink CRE"

Title:
  mt-4 font-display text-3xl font-extrabold tracking-[-0.03em]
  text-[var(--text-primary)] md:text-[2.6rem]
  Text: "How a verdict gets filed"

Intro:
  mt-4 max-w-[64ch] font-body text-base leading-relaxed text-[var(--text-secondary)]
  Text: "The workflow is the filing clerk, not a badge at the end. Remove CRE
    and no position opens, no rejection is filed and no score moves."

PATH AND LOG GRID:
  mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12

  PATH (lg:col-span-5):
    Stage list: relative space-y-3
      Connector: absolute bottom-4 left-[15px] top-4 w-px bg-[var(--border-default)]
      Stage: relative flex gap-4
        Node: flex h-8 w-8 shrink-0 items-center justify-center rounded-full
          border border-[var(--border-default)] bg-[var(--bg-surface)]
          font-mono text-[11px] tabular-nums text-[var(--text-primary)]
        Stage body: min-w-0 flex-1 rounded-[8px] border
          border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3.5
          Name: text-sm font-semibold text-[var(--text-primary)]
          Fact: mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]
      Animation: Group Stagger
    Stages:
      1 Telegram collector: "Public channels are read with an operator account
        and stored with their original timestamps."
      2 Evidence store: "Posts become a frozen bundle with a content hash.
        Edits and forwards stay visible in the record."
      3 Extraction agent: "Deterministic parsers read structured calls first.
        The model handles unstructured text and narrative tags."
      4 Fixed rules: "The mandate decides. The output is approved, rejected
        or deferred, with a reason code in every case."
      5 CRE verdict workflow: "The workflow fetches the bundle and market
        prices under consensus, replays the rule results and signs one report."
      6 Sepolia ledger: "The consumer contract records the verdict, the paper
        position terms and the ruleset hash. It holds no funds."
      7 CRE settlement workflow: "Due positions are priced again under
        consensus. The settlement report closes the position and moves scores."

  LOG PANEL (lg:col-span-7):
    Shell: Shared Double-Bezel Board Shell with the inner surface set to
      bg-[var(--bg-inverse)] text-[var(--text-inverse)]
    Header: flex h-12 items-center justify-between border-b
      border-[oklch(0.965_0.005_228/0.14)] px-4
      Left: font-mono text-[11px] uppercase tracking-[0.16em]
        text-[oklch(0.965_0.005_228/0.72)], text "CRE simulation"
      Right: font-mono text-[11px] tabular-nums text-[oklch(0.965_0.005_228/0.72)],
        the latest run time from the run index
    Log body: max-h-[420px] overflow-y-auto px-4 py-4 md:px-5
      Line: font-mono text-[12px] leading-[1.75] tabular-nums
        text-[oklch(0.965_0.005_228/0.86)], whitespace-pre-wrap break-all
      Content rule: lines are read from the committed CRE run log for the
        featured case. The builder must not type sample log lines into the page.
      Empty state before the first broadcast run:
        "No broadcast run has been recorded yet. Dry-run output will appear
          here after the first simulation, labelled as a dry run."
    Footer: flex flex-wrap items-center justify-between gap-3 border-t
      border-[oklch(0.965_0.005_228/0.14)] px-4 py-3.5
      Left: font-mono text-[11px] uppercase tracking-[0.14em]
        text-[oklch(0.965_0.005_228/0.72)], text "Sepolia · simulation with broadcast"
      Right: filing link in the same pattern as the hero CRE filing row
    Annotation callouts under the panel: mt-4 grid grid-cols-1 gap-3 md:grid-cols-3
      Callout: border-t-2 border-[var(--text-primary)] pt-3
        Label: Data Label
        Text: mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]
      Callouts:
        "Consensus fetch" / "Bundle and price reads are aggregated, so one
          faulty response cannot file a verdict on its own."
        "Signed report" / "The ledger accepts reports only through the
          configured forwarder, and each case hash can be filed once."
        "Open simulation" / "Deployment to the DON needs Early Access, so the
          submitted proof is the CLI simulation with broadcast and its log."

ASSET BRIEF:
  Type: committed CRE CLI run log plus live run metadata. No generated imagery.
  Source: cre-runs/ in the repository, indexed by the API at GET /api/cre/runs.
  Fallback: the labelled empty state above. Sample terminal text is banned.
```

---

## 11. Section: Boundary and Final CTA

**Recipe:** bespoke split legal sheet, followed by an inverse conversion panel adapted from `footer-video` with the media column removed.
**Customisations:** no video exists in this product, so the closing weight comes from the inverse surface and type scale.

```text
z-index: content z-10

SECTION: Boundary
Layout: bg-[var(--bg-primary)] py-20 md:py-28
Inner: mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-10 px-4
  md:px-8 lg:grid-cols-12 xl:px-12

Left statement (lg:col-span-5):
  Title: font-display text-3xl font-extrabold leading-[1.02]
    tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.6rem]
    Text: "Built to refuse as well as to act"
  Body: mt-5 max-w-[52ch] font-body text-base leading-relaxed text-[var(--text-secondary)]
    Text: "Refrain is an education and evidence system for a legal-tech
      hackathon. Its limits are part of the design, and they are printed
      here rather than buried in a footer."
  Animation: Standard Section Reveal

Boundary sheet (lg:col-span-7):
  overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]
  Row: grid grid-cols-[auto_1fr] gap-3 border-t border-[var(--border-subtle)]
    px-4 py-4 first:border-t-0 md:px-5
    Marker: mt-0.5 flex h-7 w-7 items-center justify-center rounded-full
      border border-[var(--border-default)]
      Icon: inline SVG, h-3.5 w-3.5, one per row: banknote-off style mark,
        eye, key, scale. Drawn as simple stroke forms, never copied brand marks.
    Row title: text-sm font-semibold text-[var(--text-primary)]
    Row text: mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]
  Rows:
    "Paper positions only" / "No exchange account is connected, no order is
      placed and no contract in this system can move funds."
    "Authorised sources only" / "The collector reads public channels and
      sources the operator is a member of. It does not enter private groups
      on a user's behalf."
    "No private keys in the product" / "The only signer is the CRE report
      path into a ledger that records decisions. Telegram session material
      stays on the collector host and never reaches the browser."
    "Not financial advice" / "Scores describe recorded paper outcomes under
      one public mandate. They are not a recommendation to buy or sell any asset."

FINAL CTA PANEL:
  mt-4 overflow-hidden rounded-[12px] bg-[var(--bg-inverse)]
  px-5 py-14 text-[var(--text-inverse)] md:px-10 md:py-20
  Inner: mx-auto flex max-w-[760px] flex-col items-center text-center
  Heading: font-display text-4xl font-extrabold leading-[0.98]
    tracking-[-0.04em] [text-wrap:balance] md:text-[3.4rem]
    Text: "Bring your own twenty voices"
    Animation: Standard Section Reveal
  Subtext: mt-5 max-w-[54ch] font-body text-base leading-relaxed
    text-[oklch(0.965_0.005_228/0.76)]
    Text: "Start with the public Telegram channels you already read. Refrain
      keeps their record, tests their agreement and files what it decided."
    Animation: Standard Section Reveal, delay 0.15s
  Action: mt-8, Shared Primary Action with the fill inverted for this surface:
    bg-[var(--bg-primary)] text-[var(--text-primary)]
    hover:bg-[var(--accent)] hover:text-[var(--text-inverse)]
    Label stays "Open live board"
    Animation: Standard Section Reveal, delay 0.3s

ASSET BRIEF:
  Type: none.
```

---

## 12. Footer

```text
z-index: content z-10

SECTION: Footer
Layout: border-t border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-12
  md:px-8 md:py-14 xl:px-12
Inner: mx-auto w-full max-w-[1440px]

Top row:
  flex flex-col justify-between gap-8 md:flex-row md:items-start
  Left:
    Wordmark: font-mono text-[13px] font-semibold uppercase
      tracking-[0.28em] text-[var(--text-primary)]
      Text: "REFRAIN"
    Attribution: mt-3 max-w-[46ch] font-body text-[13px] leading-relaxed
      text-[var(--text-secondary)]
      Text: "Built for BLI Legal Tech Hackathon 2. Entered for the RYO-CHAN
        Autonomous Agents bounty and the Chainlink Best Workflow with CRE bounty."
  Right link row:
    flex flex-wrap gap-x-7 gap-y-3
    Link: min-h-[36px] font-mono text-[11px] uppercase tracking-[0.16em]
      text-[var(--text-secondary)] transition-colors duration-200
      hover:text-[var(--text-primary)]
    Links: "Live board", "GitHub", "DoraHacks build", "Sepolia ledger"
    The Sepolia ledger link renders only after a real deployment address exists.

Bottom row:
  mt-10 flex flex-wrap items-center justify-between gap-3
  border-t border-[var(--border-subtle)] pt-6
  font-mono text-[11px] tabular-nums text-[var(--text-muted)]
  Left: "© 2026 Refrain"
  Right: "Paper positions only · Ethereum Sepolia"

Animation: Standard Section Reveal on the top row only. The bottom row is static.
```

---

## 13. App Interior

The landing page proves one case. The app interior is where judges inspect the whole record. It reuses the B1 strip, the board shell, stamps, ledger table and field patterns without new styling inventions.

### 13.1 App Shell

```text
z-index: rail z-20, mobile bottom bar z-30, B1 strip z-50

SHELL:
  min-h-[100dvh] bg-[var(--bg-primary)] pt-[52px] md:pt-14
  Desktop grid: lg:grid lg:grid-cols-[232px_1fr]

LEFT RAIL (lg and above):
  sticky top-14 hidden h-[calc(100dvh-3.5rem)] flex-col border-r
  border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-4 lg:flex
  Rail label: px-2 Data Label, text "Record"
  Rail link: mt-1 flex min-h-[44px] items-center gap-3 rounded-[6px] px-3
    text-sm font-medium text-[var(--text-secondary)]
    transition-colors duration-150 hover:bg-[var(--bg-elevated)]
    hover:text-[var(--text-primary)]
    Icon: inline SVG, h-[18px] w-[18px], stroke-width 1.5
  Active rail link: bg-[var(--bg-surface)] text-[var(--text-primary)]
    shadow-[inset_2px_0_0_var(--accent)]
  Links in order: Board, Calls, Ledger, KOL index, Watchlist, Rules
  Rail footer: mt-auto rounded-[6px] border border-[var(--border-default)]
    bg-[var(--bg-surface)] p-3
    Status line reuses the live or replay pattern from the nav.
    Second line: mt-1.5 font-mono text-[11px] tabular-nums text-[var(--text-muted)],
      format "Rules v{n} · {open} open"

MOBILE BOTTOM BAR (below lg):
  fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t
  border-[var(--border-default)] bg-[oklch(0.972_0.006_228/0.94)]
  backdrop-blur-[14px] lg:hidden
  Item: flex min-h-[56px] flex-col items-center justify-center gap-1
    font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-muted)]
    Icon above label, h-5 w-5
  Active item: text-[var(--text-primary)] with a 2px top bar in var(--accent)
  Items: Board, Calls, Ledger, KOLs, More
  More opens a sheet above the bar with Watchlist and Rules rows at min-h-[52px].
  Page content carries pb-[72px] below lg so the bar never covers a record.

PAGE HEADER (every app route):
  flex flex-wrap items-end justify-between gap-4 px-4 pb-5 pt-6
  md:px-8 md:pt-8
  Title: font-display text-[1.7rem] font-extrabold tracking-[-0.03em]
    text-[var(--text-primary)] md:text-[2.1rem]
  Support line: mt-1.5 max-w-[62ch] text-sm leading-relaxed text-[var(--text-secondary)]
  Right slot: route action or filter summary, never a second primary label
```

### 13.2 Route Surfaces

```text
/app BOARD:
  The hero evidence board at full content width, followed by two ruled panels:
  Open positions (Shared Ledger Table, position columns) and Latest rejections
  (three dossier rows in the section 8 pattern without sticky stacking).

/app/calls CALLS:
  Filter bar: flex flex-wrap gap-2 px-4 md:px-8
    Filter chip: min-h-[40px] rounded-[6px] border border-[var(--border-default)]
      px-3.5 font-mono text-[11px] uppercase tracking-[0.12em]
    Active chip: bg-[var(--text-primary)] text-[var(--text-inverse)]
    Filters: All, Structured, Memecoin, Ads filtered, Duplicates
  Table: Shared Ledger Table
  Columns: Time | Channel | Asset | Direction | Entry, stop, target |
    Conviction | Parser | Record
  Ads filtered rows show the filter reason in the Record column, for example
    "Referral code" or "Casino promotion". They never enter convergence.

/app/convergence/[eventId] CASE FILE:
  The section 6 anatomy at full width, with every contributing post rather
  than the featured subset, plus a replay panel:
    Panel: rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5
    Rows: Evidence hash, Ruleset hash, Ruleset version, CRE run reference,
      Verdict transaction, Settlement transaction
    Copy: "Replay uses the frozen bundle and the recorded ruleset. Live
      prices are never substituted into a decided case."

/app/ledger LEDGER:
  Two tabs in the section 6 tab pattern: "Positions" and "Rejections".
  Positions columns: Opened | Asset | Direction | Entry | Size | Stop |
    Target | State | Exit | Paper result | Filing
  Rejections columns: Decided | Asset | Claimed direction | Reason code |
    Voices counted | Filing
  State values use the Shared Status Stamp at compact size.

/app/kols KOL INDEX:
  The section 7 table, plus a channel detail region under the selected row:
  recent calls for that channel, score movement as ruled rows with dates,
  and every promotion flag with its source post link.

/app/watchlist WATCHLIST:
  Ruled source rows: initial block, handle, public URL, role select,
  active switch, last ingested message time, calls parsed.
  Operator form uses Shared Field patterns. Fields: Telegram handle or URL,
  role, starting note. Submit label: "Add channel".
  Validation copy examples:
    "Enter a public handle such as @channelname, or a full t.me link."
    "That channel is already on the watchlist, so nothing was added."
  The watchlist cap is 20 active sources. At the cap the form disables and
    states: "The watchlist holds 20 active sources. Pause one source to add another."

/app/rules RULES:
  The active mandate as Shared Field rows grouped under three ruled headings:
  Agreement, Risk, Exit. Saving creates a new ruleset version with a new hash.
  Past versions list under the form with version, created time and hash.
  Save label: "Save as new version"
  Confirmation copy after save: "Rules v{n} is active. Earlier verdicts keep
    the version that decided them."
```

### 13.3 Feedback Surfaces

```text
TOAST:
  fixed bottom-4 right-4 z-[90] w-[calc(100vw-2rem)] max-w-[360px]
  rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]
  px-4 py-3.5 shadow-[var(--shadow-overlay)]
  Animation: initial { opacity: 0, y: 12 }, animate { opacity: 1, y: 0 },
    exit { opacity: 0, y: 8 }, enter 240ms, exit 160ms
  Title: text-sm font-semibold text-[var(--text-primary)]
  Body: mt-1 text-[13px] leading-snug text-[var(--text-secondary)]
  Auto-dismiss after 4.5 seconds. Errors stay until dismissed.

INLINE ERROR PANEL (failed data load):
  rounded-[8px] border border-[var(--accent)] bg-[var(--accent-glow)] px-4 py-4
  Title: text-sm font-semibold text-[var(--text-primary)]
  Body: mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]
  Action: Shared Secondary Action at compact size, label "Retry loading"
  Copy pattern: state the failed read and the next step, for example
    "The call record did not load, so check the connection and retry loading."

EMPTY STATE:
  rounded-[8px] border border-dashed border-[var(--border-default)]
  bg-[var(--bg-surface)] px-5 py-10 text-center
  Title: font-body text-base font-semibold text-[var(--text-primary)]
  Body: mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-[var(--text-secondary)]
  One action where a next step exists. No illustration is used.
```

---

## 14. Responsive Summary

- The B1 strip keeps wordmark, live status and menu access on one 52px row at 360px wide. Proof links move into the index panel below `lg`.
- Hero type steps through four sizes. The board becomes a three-tab surface below `md`, so no zone is squeezed into unreadable columns.
- The anatomy tabs scroll horizontally inside their own bar on small screens. The page itself never scrolls sideways.
- Ledger tables switch to ruled record blocks below `md`, with each field as a label and value pair.
- The dossier stack loses sticky behaviour below `md` and becomes spaced sheets.
- The CRE path guides hide below `lg`. Stages and the log panel stack in reading order.
- The app rail becomes a five-item bottom bar below `lg`, with content padded clear of it.
- Every touch target is at least 44px in the smaller dimension, except inline text links inside body copy, which keep a 32px minimum line box.

---

## 15. Asset Brief Summary

- Photography: none.
- Video: none. Gate 3 selected a static atmospheric surface, so the Step 12 video pipeline does not activate.
- 3D models: none.
- Generated imagery: none. The evidence board, convergence timeline and price chart are coded from product data.
- Icons: inline SVG only, one stroke family, listed per component. No icon library is installed for the landing page.
- Logo and favicon: comment slots only, by owner instruction. The builder must ask before placing any mark in either slot.
- Data assets that must exist before the frontend is judged: the board API response, one complete decided case, the KOL index for the audited watchlist, at least one filed rejection, the active ruleset and one committed CRE run log. Each asset has a labelled empty or replay state in this spec, so missing data degrades honestly.

---

## 16. Spec Self-Check (Step 3D Rule 7)

- [x] Every element carries exact Tailwind classes or a named shared pattern with exact classes in section 1.6
- [x] Every animation states initial state, target state, duration, easing and delay, or references a primitive in section 1.5 that does
- [x] Every section declares its z-index position against the global map
- [x] Every section that needs data or media carries an asset brief, and the absence of media is stated where no media exists
- [x] Positional and sizing classes carry responsive variants at the points where layout changes
- [x] Composition recipes are referenced by name where a match exists, and bespoke surfaces are written at the same specificity where none does
- [x] No placeholder copy remains. Headlines, labels, states and messages are final text, with braces marking live values only
- [x] Scroll reveals replay with `once: false`, exits run shorter than entrances, and reduced-motion behaviour is defined
- [x] No wallet flow exists in the MVP, so no wallet gating, wallet pill or disconnect behaviour is implied anywhere in the interface
- [x] Layout families do not repeat as lead structures, split sections never run three deep, and the page uses two eyebrows in total
- [x] One primary action label, Open live board, is used in navigation, hero and final CTA
- [x] A builder can implement this spec without asking a design question

---

## Copy and Punctuation

This summary governs every visible string in the product and every document in this set.

- British English throughout.
- No em dashes, in interface copy, documentation or code comments. Use a comma, semicolon, colon or full stop.
- A full stop ends a thought and a comma carries one on. Related clauses belong in one sentence with a conjunction or semicolon, never joined by a bare comma. Independent thoughts get their own sentence.
- Labels, buttons, badges and stats take no trailing punctuation. A helper sentence takes one full stop. A short status confirmation takes one full stop.
- A fragment is allowed where the thought is already complete, for example a stamp or a status line. Padding a fragment into a sentence weakens it.
- Banned filler in headlines and body copy: elevate, seamless, unleash, unlock, empower, next-generation, cutting-edge, state-of-the-art, supercharge, revolutionise, transform used as a slogan, and empty forms such as the future of a category. Name the concrete action instead.
- Button labels are verb plus object: Open live board, Read one verdict, Add channel, Save as new version, Retry loading.
- One voice across the page: factual, quiet and specific. Numbers stay in one format per surface, and no figure is printed unless the system recorded it.
