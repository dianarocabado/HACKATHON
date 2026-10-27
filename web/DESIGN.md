# Heilbronn wirkt — design

Read this before building any screen. Types: `contracts/types.ts`. Sample data: `contracts/samples/`.

## Principles

1. **Phone first, one hand.** Every main action is reachable with a thumb. The big screen (`/screen`) is the only desktop-first view.
2. **Evidence before opinion.** Every number names its source ("senseBox Marktplatz, last 7 days"). Simulated values always carry the `simulated` badge.
3. **Plain German.** No jargon on screen: "Nachmittags im Schnitt 33 °C", not "heat score 0.86". Scores stay internal.
4. **Never hang.** Every loading state has a skeleton and a timeout message after 8 s with a retry.

## Colours

CSS variables in `web/styles/tokens.css`. Light is the default; dark redefines the same tokens.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F7F8F5` | `#121512` | page background |
| `--surface` | `#FFFFFF` | `#1C201C` | cards, panels, sheets |
| `--text` | `#1B1F1B` | `#ECEFEA` | body text |
| `--muted` | `#5F675F` | `#A3ABA2` | captions, sources |
| `--brand` | `#1F7A4D` | `#4CC38A` | primary buttons, links, mic |
| `--brand-ink` | `#FFFFFF` | `#0B1A12` | text on brand |
| `--border` | `#DDE2DA` | `#2E342D` | dividers, inputs |
| `--warn` | `#B54708` | `#F79009` | urgency 3, sensor "not confirmed" |
| `--ok` | `#067647` | `#47CD89` | confirmed, done, verified |
| `--sim` | `#7A5AF8` | `#A48AFB` | "simulated" badge only |

**Need scale** (hexagon fill, 0 → 1), sequential and colour-blind safe:
`#FFF5D6` `#FDD98A` `#F9A94B` `#E8702A` `#C2410C` `#8A1C04` (six steps at 0, .2, .4, .6, .8, 1).
Fill opacity 0.55 on the map, stroke `--surface` at 0.5 px.
**No data** (`null` score): transparent fill with a 45° hatch in `--muted` at 30 % opacity. Never grey it out as if it were "low".

**Category colours** (pins, chips): heat `#E8702A`, air `#6172F3`, noise `#9E77ED`, water `#2E90FA`,
biodiversity `#1F7A4D`, waste `#7A5C3E`, mobility `#DD2590`, other `#5F675F`.
Always pair the colour with an icon and a label, never colour alone.

## Type

- Font: `Inter` (Google Fonts) with the fallback `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Scale (rem): 0.8125 caption · 0.9375 body · 1.125 card title · 1.5 page title · 2.5 big-screen counters.
- Numbers use `font-variant-numeric: tabular-nums`. German formatting via `Intl.NumberFormat('de-DE')` (33,4 °C).

## Spacing and shape

4 px grid (4, 8, 12, 16, 24, 32). Card radius 16 px, buttons 12 px, chips full-round.
Minimum touch target 44 × 44 px. Side gutter 16 px on phones.

## Components

| Component | Notes |
| --- | --- |
| `AppBar` | Logo "Heilbronn wirkt", DE/EN toggle, nothing else |
| `BottomNav` | Karte · Missionen · Melden (centre, raised mic button) |
| `HexMap` | MapLibre basemap (OSM raster or MapTiler light), H3 polygons from `layers.json`, tap → `HexPanel` |
| `LayerToggle` | Segmented chips: Bedarf · Hitze · Luft · Rad · Grün · Risiko · Gefühlt |
| `Legend` | Six-step need scale + hatch swatch "keine Daten" |
| `HexPanel` | Bottom sheet: 2–4 plain-language facts with source, missions in this hexagon, "Hier melden" button |
| `MissionCard` | Category icon, title, place, effort chip, urgency dots (1–3), supporters count, status chip |
| `MissionDetail` | "Warum diese Mission?" box (rule + evidence in words), claim (name input), support (+1) |
| `MicButton` | 72 px circle, `--brand`, pulses while listening; long press not required, tap toggles |
| `TranscriptBox` | Live text while speaking, editable afterwards; typed fallback when speech fails |
| `ReportResult` | Category chip, summary, sensor check ("Sensor bestätigt: 33,1 °C, 140 m entfernt"), thank-you |
| `SimBadge` | Small pill "simuliert", `--sim` outline. Required on anything with `simulated: true` |
| `StatusChip` | open (border) · claimed (brand outline) · done (`--ok`) · verified (`--ok` filled) |
| `ImpactChart` | Before/after bars for the hexagon vs. city change, effect in words |

## Screens

```
Karte (/)                Missionen (/missions)     Melden (/report)          Big screen (/screen)
┌──────────────────┐     ┌──────────────────┐      ┌──────────────────┐      ┌───────────────────────────────┐
│ Heilbronn wirkt DE│     │ Missionen        │      │ Was fällt dir auf?│      │ ███ map, need layer ███  │ 42 │
│[Bedarf][Hitze]...│     │[Thema][Wer][Zeit]│      │                  │      │ ███ new reports pulse ███│Mel-│
│  ⬡⬡⬡ map ⬡⬡⬡     │     │┌────────────────┐│      │   "Am Bahnhof    │      │ ███                   ███│dun-│
│  ⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡     │     ││🔥 Bäume gießen ││      │    ist es heiß…" │      │ ███                   ███│gen │
│ legend ▭▭▭▭▭▭ ▨  │     ││Allee · 1 Std ●●●││      │                  │      │                          │ 8  │
│┌────────────────┐│     │└────────────────┘│      │      ( 🎤 )       │      │ latest: "Kein Schatten…" │Mis-│
││Nachmittags 33°C││     │┌────────────────┐│      │  Ort: Hauptbhf ✎ │      │                          │sio-│
││Nächster Baum…  ││     ││🚲 Radweg …      ││      │  [Tippen statt…] │      │                          │nen │
│└────────────────┘│     │└────────────────┘│      │                  │      │                     [QR] │    │
│ Karte  (🎤) Miss.│     │ Karte  (🎤) Miss.│      │ Karte  (🎤) Miss.│      └───────────────────────────────┘
└──────────────────┘     └──────────────────┘      └──────────────────┘
```

Report flow: mic → live transcript → location (QR param `?h3=` / GPS / map tap) → send → `ReportResult`.
If the Web Speech API is missing or errors, show the typed field immediately; never block on permissions.

## Text

German by default, English via toggle (strings in `web/lib/client/i18n.ts`). Tone: friendly, short, "du".
Examples: "Danke! Deine Meldung ist auf der Karte." · "Sensor bestätigt das: 33,1 °C." ·
"Kein Sensor in der Nähe. Magst du einen aufhängen?"

## Accessibility

Contrast ≥ 4.5:1 for text, focus rings visible (2 px `--brand`), map features also listed in the panel as text,
`prefers-reduced-motion` turns off pulses, every icon button has an `aria-label`.
