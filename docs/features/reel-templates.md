# Reel Templates

- **Owner:** flownau
- **File:** `apps/flownau/src/modules/video/remotion/ReelTemplates.tsx`

---

## Canvas

All reel templates render at **1080 × 1920 px** at 30 fps.

---

## Safe Zone

Platform UI (Instagram/TikTok navigation bar at the top, action tray + caption at the bottom) overlaps the edges of a reel. All text must stay inside the safe zone.

```
┌─────────────────────────────────┐  ← y = 0
│         (no-text zone)          │  220 px
├──┬──────────────────────────────┤  ← y = 220
│  │                              │
│  │      SAFE ZONE               │
│80│      920 × 1250 px           │ 80
│px│      center: (540, 845)      │ px
│  │                              │
├──┴──────────────────────────────┤  ← y = 1470
│         (no-text zone)          │  450 px
└─────────────────────────────────┘  ← y = 1920
```

| Edge   | Margin |
|--------|--------|
| Top    | 220 px |
| Bottom | 450 px |
| Left   | 80 px  |
| Right  | 80 px  |

Constants defined once in `ReelTemplates.tsx`:

```ts
const SAFE_ZONE = { top: 220, bottom: 450, left: 80, right: 80 }
const SAFE_W = 920   // 1080 - 80 - 80
const SAFE_H = 1250  // 1920 - 220 - 450
```

---

## TextZone

`TextZone` is the high-level primitive that enforces the safe zone for all text. It positions its children inside the safe zone area and controls vertical alignment.

```tsx
<TextZone>                   // centered (default)
<TextZone align="top">       // anchored to safe zone top edge
<TextZone align="bottom">    // anchored to safe zone bottom edge
```

Every template wraps each `FitText` call in a `TextZone`. Adding a new template never requires recalculating margins — just use `TextZone` and `SAFE_W`/`SAFE_H`.

---

## FitText

`FitText` renders text inside a fixed bounding box. If the text overflows, the font size is reduced in 2 px steps until it fits (binary-search downward from `baseFontSize × maxTextSize%`).

Key props:

| Prop          | Description                                           |
|---------------|-------------------------------------------------------|
| `text`        | Content to render                                     |
| `baseFontSize`| Starting font size in px (before maxTextSize scaling) |
| `maxTextSize` | Brand multiplier 50–150 % (default 100)               |
| `fontFamily`  | From `BrandIdentity.titleFont` or `bodyFont`          |
| `color`       | From `BrandIdentity.secondaryColor`                   |
| `boxWidth`    | Always `SAFE_W` (920)                                 |
| `boxHeight`   | Always `SAFE_H` (1250)                                |
| `frameOffset` | Frame at which the fade-in animation starts           |
| `instant`     | Skip animation, appear at full opacity immediately    |

---

## Templates

| ID      | Name              | Slots              | Duration  | Use case                     |
|---------|-------------------|--------------------|-----------|------------------------------|
| ReelT1  | Single Moment     | `text1`            | 4 s       | One punchy statement          |
| ReelT2  | Single Statement  | `text1`            | 6.5 s     | Longer body copy, one screen  |
| ReelT3  | Hook & Reveal     | `text1`, `text2`   | 8 s       | Hook → payoff                 |
| ReelT4  | Arc               | `text1`–`text3`    | 11 s      | Opening → development → landing |

Scene timing constants (frames at 30 fps):

```
SCENE_SHORT = 75   (2.5 s)  — single-text templates
SCENE_HOOK  = 75   (2.5 s)  — hook scene
SCENE_BODY  = 120  (4 s)    — body / development
SCENE_LAND  = 90   (3 s)    — landing / reveal
TRAIL       = 45   (1.5 s)  — silent buffer after last text
```

---

## Brand Identity

Each template receives a `BrandIdentity` object (stored as `brand.brandIdentity` in the DB). All fields have defaults.

| Field            | Default      | Description                              |
|------------------|--------------|------------------------------------------|
| `primaryColor`   | `#000000`    | Background / overlay tint                |
| `secondaryColor` | `#ffffff`    | Text color                               |
| `titleFont`      | `sans-serif` | Font for title/hook slots                |
| `bodyFont`       | `sans-serif` | Font for body/development slots          |
| `overlayOpacity` | `0.55`       | Dark overlay over b-roll (0 = transparent, 1 = solid) |
| `maxTextSize`    | `100`        | Font size multiplier in % (50–150)       |

Supported fonts: Anton, Bebas Neue, Oswald, Black Han Sans, Inter, Montserrat, Poppins, DM Sans, Nunito, Raleway, Playfair Display (all loaded via `@remotion/google-fonts`).

---

## Adding a New Template

1. Export a new `ReelTN` component from `ReelTemplates.tsx`
2. Wrap every text block in `<TextZone>` (with optional `align` prop)
3. Pass `boxWidth={SAFE_W}` and `boxHeight={SAFE_H}` to every `FitText`
4. Register the template in `apps/flownau/prisma/seeds/templates.ts` with a `slotSchema`
5. Run `npx tsx prisma/seed.ts` to seed it
