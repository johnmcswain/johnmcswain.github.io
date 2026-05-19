# TRUGSCHLUSS-WERKE AG
## Design Specification & World Bible

**Version 1.0 · Zürich · 2026**

This document is the canonical reference for Trugschluss-Werke AG, a fictional Swiss-German industrial concern manufacturing precision fallacy equipment since 1962. It is the source of truth for any agent — Claude Code, Claude Design, or otherwise — building, extending, or modifying the company's web presence.

The site is **design fiction**, not commerce. There is no real catalogue, no checkout, no inventory. The site is the product. Every page is an aesthetic artifact in a sustained satirical voice. The deadpan is absolute: nothing on the site ever acknowledges that the company is fictional or that fallacies are not real industrial goods.

---

## 1. THE PREMISE

Trugschluss-Werke AG manufactures fallacies as industrial products. The flagship line is the MFPU (Massive Fallacy Processing Unit) series, rack-mounted enterprise equipment producing thousands of fallacies per second. The company also produces desktop prosumer units (Sophist line), manufacturing equipment (Industrial line), hand-assembled limited editions (Heritage line), and orchestration software (NEMO-FAL™ platform).

The word *Trugschluss* is the actual German word for "fallacy" — literally "deception-conclusion." German-speaking visitors recognise the joke immediately. English-speaking visitors take the brand at face value until they read the product descriptions.

### 1.1 Voice & Register

The voice is that of a 1987 corporate heritage brochure, translated from German by someone who took the job very seriously. It never winks. It never breaks character. Every sentence is delivered with absolute regulatory sincerity.

The satire lives in **what is said**, never in **how it is said**.

- *Mischaracterisation: mild · moderate · severe · grotesque* — delivered as a routine specification line.
- *The unit is hand-calibrated at the Stuttgart facility before shipment.* — delivered as a routine quality assurance note.
- *Compliant with EN-1947, EN-2204, ISO-2891.* — delivered as a routine regulatory line.

### 1.2 Register Spectrum

The brand's design register flexes across the catalogue while the design system remains constant:

| Line | Register | Photography | Copy density |
|---|---|---|---|
| Sophist | Swiss-precise, restrained | Cream studio, soft directional light, generous space | Spare, reverent |
| MFPU | Swiss bones, German weight | Cream-to-charcoal, straight-on, harder shadows | Technical, dense, measured |
| Industrial | German-industrial, slightly menacing | In-situ factory floor, scale figures, deep shadow | Dense, regulatory |
| Heritage | Warm, museum-object | Single raking light, deep navy backdrop | Short, wistful, almost reverent |

The system holds because the bones never change. Only photographic register and copy density shift.

---

## 2. CORPORATE FACTS (CANON)

These facts are load-bearing. They must remain consistent across every page.

- **Legal name:** Trugschluss-Werke Aktiengesellschaft
- **Display wordmark:** TRUGSCHLUSS — WERKE
- **Shorthand:** Trugschluss or TW
- **Tagline (DE):** *Präzisionsdenkfehler seit 1962.*
- **Tagline (EN):** *Precision reasoning errors since 1962.*
- **Founded:** 14 March 1962
- **Founder:** Dr. Heinrich Vogel (1908–1981), formerly of Sulzer AG, Winterthur
- **Co-founder / financier:** Friedrich Kohlmeyer, Zürich industrialist, 31% original equity
- **Seed capital:** CHF 240,000 (1962)
- **Stock ticker:** SIX: TRGS
- **Employees:** 847
- **Countries shipped:** 43
- **Certifications:** EN-1947, EN-2204, ISO-2891

### 2.1 Facilities

| Facility | Address | Function | Established |
|---|---|---|---|
| Zürich | Bahnhofstrasse 47, 8001 Zürich, CH | Headquarters, design office | 1962 |
| Stuttgart | Reichenbachstrasse 12, 70567 Stuttgart, DE | Manufacturing (MFPU, Industrial) | 1971 |
| Glarus | Hauptstrasse 9, 8750 Glarus, CH | Heritage workshop, hand assembly | 1979 |

### 2.2 Key Historical Figures

- **Dr. Heinrich Vogel** (1908–1981) — Founder. Precision engineer, ex-Sulzer, 17 calibration patents.
- **Friedrich Kohlmeyer** (1911–1989) — Co-founder, financier.
- **Dr. Klaus Reichenbach** (1924–2007) — Stuttgart technical director from 1971. Designed the original MFPU rack architecture. Stuttgart manufacturing facility named after him.

---

## 3. THE CATALOGUE

Eight products, plus consumables. Each anchors a register. The catalogue is deliberately tight — a real precision-engineering house does not have 200 SKUs.

| Designation | Line | Form | Price (CHF) |
|---|---|---|---|
| MFPU-7400 Straw Man Array | MFPU | 8U rack, enterprise | 18,400 |
| MFPU-9000 Circular Reasoning Mainframe | MFPU | 12U rack, premium enterprise | 41,000 |
| Sophist Standard | Sophist | Desktop, prosumer | 1,240 |
| Sophist Compact Travel Edition | Sophist | Portable, leather case | 720 |
| DRP-12 Premise Forge | Industrial | Floor-mounted, 2,400 kg | 184,000 |
| KLN-7 Cartridge Filling Station | Industrial | Floor-mounted, 890 kg | 124,000 |
| Begging-the-Question Apparatus, No. 0247/500 | Heritage | Hand-assembled, brass and walnut | 8,400 |
| NEMO-FAL™ Enterprise | Software | Annual licence | 1,800/seat/year |

Consumables (cartridges, premise lubricant, filtration elements) are a supporting category, not a primary product.

---

## 4. DESIGN SYSTEM

### 4.1 Palette

The palette is two-tone with a single warm neutral, plus one alarm colour held in reserve. The system supports both **DAY EDITION** (light) and **NIGHT EDITION** (dark) modes — the latter is *the night edition of the same catalogue*, not a different brand. The patina (oxidised copper) and cadmium orange remain the brand anchors across both modes.

#### Light theme (DAY EDITION — default)

```css
--ink:        #1a2332;   /* Deep ink navy — primary */
--ink-deep:   #0f1620;   /* Deeper navy for inversions */
--bone:       #ebe5d6;   /* Cream paper stock — page background */
--bone-warm:  #e3dcc8;   /* Slightly deeper cream for cards/sections */
--patina:     #4a7a78;   /* Oxidised copper / muted teal — accent */
--patina-deep:#2f5957;   /* Deeper patina for hover states */
--alarm:      #d4541f;   /* Cadmium orange — used ONLY for warnings,
                            in-stock indicators, configuration buttons */
--rule:       #1a2332;   /* Hairline rule colour, identical to ink */
--mute:       #6b6759;   /* Muted text for captions, metadata */
```

#### Dark theme (NIGHT EDITION)

```css
--ink:        #ebe5d6;   /* Foreground inverts to bone */
--ink-deep:   #f5efe0;   /* Slightly warmer bone for emphasis */
--bone:       #14202c;   /* Background is now deep ink */
--bone-warm:  #1a2733;   /* Lifted card/section background */
--patina:     #6b9a98;   /* Brighter patina — passes contrast on dark */
--patina-deep:#88b3b1;   /* Even brighter for accents on dark */
--alarm:      #e86a3a;   /* Slightly warmer/brighter orange */
--rule:       #ebe5d6;   /* Hairlines invert too */
--mute:       #9a9483;   /* Muted text, lifted to remain legible */
--bg-inverse: #0a0f15;   /* Deeper-than-bg for featured/footer */
```

#### Semantic tokens (use these in components, not the raw values)

```css
--bg:            /* page background */
--bg-alt:        /* card/section secondary background */
--bg-inverse:    /* always-dark sections (featured, footer) */
--fg:            /* primary text */
--fg-mute:       /* secondary/metadata text */
--fg-on-inv:     /* text on bg-inverse sections */
--accent:        /* patina deep, for headlines */
--accent-on-inv: /* patina, for use on dark backgrounds */
```

**Critical rules:**
- Never use pure white or pure black. The bone tones are non-negotiable across both themes.
- Cadmium orange appears sparingly. Never as a decorative element. Only as a punctuating regulatory marker.
- The patina is the accent. Used for headlines on certain sections, the bullet separators in product names, and small typographic flourishes. Never for body text.
- The featured product section and the footer **always** use `--bg-inverse` — in light mode this is the deep ink, in dark mode it's an even deeper near-black. They remain the darkest moments on the page in both themes.

### 4.1.1 Theme toggle

A persistent toggle sits in the top-right corner of every page: a minimal monoline switch with a sun/moon icon pair and a micro-label reading **DAY EDITION** or **NIGHT EDITION**. The toggle:

- Defaults to the user's system preference (`prefers-color-scheme`) on first visit
- Persists the explicit choice in `localStorage` (key: `tw-theme`)
- Uses an inline anti-flash script in `<head>` to prevent flash-of-wrong-theme on load
- Listens to system preference changes when no explicit choice has been stored
- Transitions colors smoothly (350ms ease) without drawing attention to the switch

The toggle is a *catalogue convention*, framed in the brand voice: this is a real industrial publication that comes in a day edition and a night edition. The micro-label sells the conceit.

### 4.2 Typography

The stack is three families: a heavy condensed display, a refined body serif, and a technical monospace.

| Role | Recommended | Fallback stack |
|---|---|---|
| Display (heavy condensed) | Druk Wide Bold, Söhne Breit Halbfett | `"Druk Wide", "Söhne Breit", "Arial Narrow Bold", sans-serif` |
| Body (humanist serif) | GT Sectra, Tiempos Text | `"GT Sectra", "Tiempos Text", Georgia, serif` |
| Monospace (technical) | ABC Diatype Mono, JetBrains Mono | `"ABC Diatype Mono", "JetBrains Mono", "IBM Plex Mono", monospace` |

For artifacts and prototypes where the licensed fonts are unavailable, the system gracefully degrades to:
- **Display:** `"Oswald", "Arial Narrow", sans-serif` at heavy weight (700), tight tracking, condensed
- **Body:** `"EB Garamond", Georgia, serif`
- **Mono:** `"JetBrains Mono", "IBM Plex Mono", "Courier New", monospace`

#### 4.2.1 Type rules

- Display type is **always** set in deep ink navy, never the accent.
- Display headlines use **tight tracking** (-0.02em to -0.04em) and **tight leading** (0.92 to 0.98).
- Product designations always use the bullet separator: **MFPU · 7400 · STRAW MAN ARRAY** or em-dash: **MFPU — 7400**.
- The wordmark **TRUGSCHLUSS — WERKE** is set with an em-dash, not a hyphen.
- Body serif is justified in multi-column contexts, left-aligned in single-column.
- Monospace is used for: model numbers, prices, dimensions, dates, addresses, regulatory references, file sizes, technical specs. Anything numeric or document-like.
- Small caps and mono-eyebrow labels appear above section headers, set in 10–12px mono, +0.1em tracking, deep navy.

### 4.3 Layout

The layout is grid-based with a visible 12-column structure. Hairline rules (1px, ink colour) separate sections and columns. Negative space is generous but disciplined.

- Maximum content width: 1440px, centred.
- Side margins: 64px desktop, 32px tablet, 20px mobile.
- Section vertical rhythm: 120px desktop, 80px tablet, 56px mobile.
- Hairline rules: exactly 1px, never thicker. The thinness is the aesthetic.

Asymmetry is encouraged. Centred symmetric layouts are discouraged except for the wordmark itself. Product hero compositions are always asymmetric — text on one side, photograph on the other, never balanced in mass.

### 4.4 Iconography

All icons are hairline monoline, drawn as if with a Rotring pen on a geometric grid. Stroke weight: 1px on small icons, 1.5px on larger ones. Never filled. Never coloured (always ink or patina).

Each fallacy type has its own diagrammatic glyph, drawn in the patent-illustration style:
- **Straw Man:** stick figure with hatched-fill body
- **Slippery Slope:** hairline curve descending with directional arrow
- **Ad Hominem:** two figures connected by a vector
- **Circular Reasoning:** circular arrow loop
- **False Dichotomy:** two boxes connected by an exclusive-or gate
- **Appeal to Authority:** pedestal with crown glyph
- **Begging the Question:** ouroboros (snake eating tail) rendered geometrically
- **Hasty Generalisation:** one filled dot extrapolated to a field of dots

### 4.5 The "Fig.1 / Fig.2" Move

The signature compositional pattern. Any product or concept can be diagrammed as a patent illustration with hairline leader lines and mono callouts. This is the design language announcing itself as authoritative.

Format:
```
Fig. 1 — [Subject description].
  (a) component label
  (b) component label
  (c) component label
```

Caption beneath, set in body serif italic, small: *Figures reproduced from the [model] service manual, revision [Mk], § [section].*

### 4.6 Buttons

Two button styles only.

**Primary:** Deep ink navy background, bone-coloured mono type, no border-radius (sharp corners), 14px padding vertical, 28px horizontal. Hover: darkens to ink-deep. Label is always uppercase mono with letter-spacing 0.08em.

**Secondary:** Transparent background, 1px ink hairline border, ink mono type, otherwise identical to primary. Used for downloads, secondary actions, "view product" cards.

**The configuration button** (REQUEST CONFIGURATION) is the only button on the site that may use the cadmium orange, and only on product pages. It is the visual punctuation of the entire commerce premise.

No buttons say "Buy Now." No buttons say "Add to Cart." The verbs of this site are: **REQUEST CONFIGURATION**, **DOWNLOAD TECHNICAL DOCUMENT**, **VIEW PRODUCT**, **CONTACT SALES ENGINEER**, **SCHEDULE CONSULTATION**.

### 4.7 Imagery

Product photography is the largest visual element on most pages. It should always be:
- Studio-lit, never composited or stylised
- Set against the bone or ink background (never a third colour)
- Asymmetrically placed within its container
- Grounded by a real, soft shadow

Where actual photography is unavailable (e.g. in prototypes), use clean geometric placeholders in the design system colours — never lorem-ipsum stock imagery.

---

## 5. SITE ARCHITECTURE

```
HOME

CATALOGUE
  · MFPU Series
      · MFPU-7400 Straw Man Array
      · MFPU-9000 Circular Reasoning Mainframe
  · Sophist Line
      · Sophist Standard
      · Sophist Compact Travel Edition
  · Industrial
      · DRP-12 Premise Forge
      · KLN-7 Cartridge Filling Station
  · Heritage
      · Begging-the-Question Apparatus
  · NEMO-FAL™ Platform
  · Consumables

ABOUT
  · History
  · Facilities
  · Leadership
  · Press Room

SUPPORT
  · Service & Authorised Centres
  · Documentation Library
  · Dealer Locator

CAREERS

INVESTOR RELATIONS

REQUEST CONFIGURATION (form)
```

Ten top-level destinations. Each is a designed artifact in the same system.

---

## 6. THE CONFIGURATION FORM

The form is a piece of content, not a transaction. It is the funniest object on the site precisely because it asks the questions a real industrial sales process would ask.

Fields (all set in mono, single column, narrow width):

1. **Intended deployment context** — radio: editorial / political / academic / governmental / private enterprise / other
2. **Expected throughput** — number, in fallacies per second
3. **Operating environment** — radio: data centre / office / field deployment / undisclosed
4. **Do you currently operate competing equipment?** — yes / no; if yes, manufacturer and model
5. **Power infrastructure** — single phase / three phase / consultation required
6. **Three professional references** — name, organisation, relationship
7. **Anticipated quarterly cartridge volume** — number
8. **Compliance certifications required** — checkbox list of fictional standards
9. **Additional notes** — textarea

On submit, the form returns a confirmation page: *"Thank you. Your configuration request (reference number TW-[random]-2026) has been received. A senior sales engineer will contact you within four to six weeks to schedule a technical consultation. — Margarethe Holzer, Senior Sales Engineer, Trugschluss-Werke AG."*

No back-end. No data is stored. The form is a piece of writing.

---

## 6.1 THE DOSSIER (CART) SYSTEM

The site simulates an e-commerce shopping experience without ever breaking the deadpan. The shopping cart is renamed the **DOSSIER** — a procurement-document metaphor consistent with how a real Trugschluss customer would prepare a formal quotation request.

### Architecture

**Top-right dossier indicator** — a small mono button reading **DOSSIER · NN** where NN is the item count. When empty, the count is muted (hairline outline, no fill). When non-empty, the count badge fills with cadmium orange. Adding an item causes the badge to pulse (scale 1 → 1.5 → 1, 500ms with a spring-back ease).

**The slide-in drawer** — opens from the right at 480px width (full-width on mobile). Structured as a procurement document:
- Header: **DOSSIER** in heavy condensed + mono submeta *Configuration · TW-2026*
- Body: line entries per product (small glyph + designation + reference + lead time + price + quantity stepper + remove button)
- Footer: mono totals table with *Subtotal / Calibration · Stuttgart (included) / VAT 7.7% (CH) / Quotation Total* + primary action **REQUEST FORMAL QUOTATION**
- Footnote: *Lead times confirmed at quotation. Hand-calibrated in Stuttgart before shipment.*

**The toast notification** — appears bottom-centre on add, dismisses after 3.2s. Inverse-bg styling, mono type, with a hairline patina-bordered checkmark and a reference number in the patina accent. Copy format: *"MFPU-7400 added to dossier — TW-4729"*.

**The product detail overlay** — slides up from the bottom (translateY 100% → 0). Full-bleed but max-width-constrained inner content. Top sticky bar with breadcrumb and close. Two-column hero: text/specs/CTA on left, full SVG patent-style schematic on right against the inverse-bg. Each product has its own schematic.

**The checkout overlay** — same slide-up pattern as the detail overlay. Renders the configuration form from §6 prefilled with the dossier contents in a summary block. Form submission shows a confirmation state styled as a formal acknowledgement letter signed by **Margarethe Holzer**. The dossier is cleared on successful submission.

### Persistence

- **localStorage key:** `tw-dossier`
- **Value shape:** `[{ id: "mfpu-7400", qty: 2 }, { id: "drp-12", qty: 1 }]`
- Persists across sessions. Returning users see a *Dossier restored · N items* toast 1.2s after page load.
- VAT rate (7.7%) reflects the Swiss federal rate as of the catalogue's publication year.

### The 8 product catalogue (machine-readable)

```js
mfpu-7400         CHF 18,400   Lead 2–4 weeks
sophist-standard  CHF 1,240    Lead in stock
drp-12            CHF 184,000  Lead 12–16 weeks
bqa-247           CHF 8,400    Lead 6 months
mfpu-9000         CHF 41,000   (defined in catalogue but not yet wired)
sophist-travel    CHF 720      (defined in catalogue but not yet wired)
kln-7             CHF 124,000  (defined in catalogue but not yet wired)
nemo-fal          CHF 1,800/yr (defined in catalogue but not yet wired)
```

### Voice rules for the dossier system

- The cart is the **dossier**. Never "cart."
- The action is **Add to Dossier**, never "Add to Cart."
- Submission requests a **Formal Quotation**, never "Checkout" or "Place Order."
- Confirmation references are formatted **TW-YYYY-NNNN** (e.g. TW-2026-7429).
- The confirmation closes with *Mit freundlichen Grüssen* (German for "with friendly regards") and Margarethe Holzer's signature.
- Pricing is always in CHF, with the Swiss thousand-separator format.
- VAT is the Swiss federal rate, 7.7%, labelled in mono as *VAT · 7.7% (CH)*.
- "Calibration · Stuttgart" is always included in the totals, set as *included*. This is the deadpan punching through the e-commerce furniture.

---

---

## 6.2 THE 3D LAYERED SCHEMATIC

The featured product section's hero diagram is rendered as a **2.5D parallactic exploded blueprint**, not a 3D rendered model. The patent-illustration register is non-negotiable; the depth effect must read as *an isometric blueprint coming apart in mid-air*, not as a product render.

### Layer stack (back to front)

```
Layer 1 — layer-sphere       z: -180px  Patina accent sphere (the recedes-deepest backdrop)
Layer 2 — layer-grid          z: -120px  Background hairline grid
Layer 3 — layer-chassis       z: -40px   Main rack body, shadow, top/bottom strips
Layer 4 — layer-front-panel   z: +20px   Ventilation slots, display, LED row, model plate
Layer 5 — layer-cartridges    z: +60px   Hot-swap cartridge bays (project most forward)
Layer 6 — layer-annotations   z: +140px  Fig. 2 callouts, leader lines, dimension labels
```

### Drivers

- **Section scroll position** — the existing `--rel` value from the parallax system drives both rotation and explode-distance.
- **Rotation** — `transform: rotateY(calc(var(--rel) * 14deg)) rotateX(calc(var(--rel) * 4deg))`. The unit appears to turn slowly on a pedestal as it passes through viewport.
- **Explode** — each layer's translateZ is augmented by `var(--explode) * Npx`, where `--explode` is `-var(--rel)`. When the section is centred, the unit assembles. As it enters and exits viewport, the layers separate, exposing internal structure.
- **Opacity falloff** — the sphere layer dims slightly as the explosion progresses (`opacity: calc(1 - (var(--explode) * var(--explode)) * 0.15)`), so it doesn't dominate at extremes.

### Perspective

```css
.schematic-stage  perspective: 2400px;  perspective-origin: 50% 45%;
.schematic-scene  transform-style: preserve-3d;
.layer            transform-style: preserve-3d;  (each layer absolute, full inset)
```

The high perspective value (2400px) keeps the rotation gentle — too low and it becomes a fisheye effect, too high and the depth disappears. 2400px lands in the *blueprint coming alive on the page* register.

### Reduced motion

The entire schematic flattens under `prefers-reduced-motion: reduce`:
```css
.schematic-scene { transform: none !important; }
.layer { transform: translateZ(0) !important; }
```
The static composition is complete — all six layers visible, stacked, with the patent diagram fully assembled. Users who can't perceive the motion see the canonical schematic.

---

## 6.3 PHOTOGRAPHIC PLATES

The page architecture supports **numbered photographic plates** between major sections — full-bleed editorial photographs presented as catalogue plates with hairline corner frames, plate number, eyebrow label, title, byline, and metadata block. The first plate (between hero and catalogue) is the **Stuttgart Manufacturing Facility**.

### Image specifications

| Property | Value |
|---|---|
| **Filename** | `plate-01-stuttgart.png` (placeholder, easy to iterate as `-v2`, `-v3`, etc.) |
| **Dimensions** | 2880 × 1800 px (16:10 aspect) |
| **Native generation** | Z-Image-Turbo (verified working) at official workflow defaults; alternates SDXL at 1536 × 960 or Flux at 1344 × 832, both upscaled 2× via ESRGAN or SUPIR |
| **Format** | PNG (lossless, photographic). Expect 6–12 MB at full resolution. For production deployment, consider exporting an additional optimised JPEG fallback or webp variant — but the canonical asset is PNG. |
| **Vertical safe zone** | Central 70% — top 15% and bottom 15% may be cropped during parallax |
| **Colour grade** | Match site palette: cool ink-navy shadows, oxidised copper accents, bone-cream warm tones, no oversaturation |

### Layout behaviour

- **Full-bleed.** 100vw width, 88vh height (min 560px, max 900px). Border-top and border-bottom hairlines tie the plate into the editorial flow.
- **Parallax.** The image drifts vertically at `calc(--rel * 80px)` — slower than the foreground caption text which drifts at `calc(--rel * -24px)`. The opposing motion creates depth without distraction.
- **Image headroom.** The `.plate-image` element extends `-10%` above and below the visible plate (`inset: -10% 0 -10% 0; height: 120%`), giving the parallax movement room to operate without revealing edges.
- **CSS overlay.** A subtle radial vignette + top/bottom gradient locks the image into the palette regardless of raw source variation. In dark mode the vignette deepens to compensate for the deeper page background.

### Frame elements

```
plate-label     top-left      "Plate — I, Catalogue 2026"
plate-ref       top-right     "Photographed Spring 1987 · archive · TW · 1987.03.114"
plate-frame     four corners  Hairline corner brackets (24×24px, 1px border, 0.6 opacity)
plate-caption   bottom-left   Eyebrow + display title + body byline + meta block
```

The caption uses the same typographic register as the rest of the site: mono eyebrow with leading hairline rule, heavy condensed display title with optional italic serif emphasis (`<em>` styled as body-serif italic), body-serif byline at 15px italic, mono metadata block right-aligned with hairline rule above.

### Fallback pattern

When the image hasn't loaded (or hasn't been generated yet), a subtle 40×40px hairline grid pattern over the deep ink background keeps the plate looking intentional. This means the page never appears broken during image iteration — only progressively more refined as new versions land.

### Image generation

A standalone document, `comfyui_prompt.md`, contains the full positive prompt, negative prompt, and eight-version iteration strategy for generating the Stuttgart facility plate via ComfyUI. **The current production asset was generated using Z-Image-Turbo** (model files: `qwen_3_4b.safetensors` text encoder, `z_image_turbo_bf16.safetensors` diffusion model, `ae.safetensors` VAE) via the official Z-Image-Turbo Text-to-Image workflow. Alternate models documented for fallback: Flux.1 Dev, SDXL with Juggernaut XL v9 or RealVisXL v4. The prompt is tuned to produce a brutalist concrete manufacturing facility with period-accurate (1987) human figures at scale, in the site's exact palette.

### Future plates

The same plate architecture supports additional photographic essays as the site grows:

- **Plate II** — Zürich design office, Bahnhofstrasse 47 interior
- **Plate III** — Glarus heritage workshop, hand-assembly benches
- **Plate IV** — 1971 archival portrait of Dr. Klaus Reichenbach

Each future plate slots into the existing section template — only the image file, plate number, caption, and metadata change. The frame, parallax, typography, and overlay system remain identical.

---

## 6.4 AMBIENT AUDIO

The page supports a persistent **ambient audio track** that loops in the background. Framed in the brand voice as the **Ambient track** — an editorial choice, like a magazine that ships with a vinyl insert. Not "background music," not "soundtrack," not "soundscape." Just *Ambient*.

### Asset

| Property | Value |
|---|---|
| **Filename** | `calm_wonder.mp3` (placed in the same directory as `index.html`) |
| **Format** | MP3 (widest browser support). Optional fallbacks: `.ogg` / `.webm` via `<source>` elements |
| **Looping** | Seamless. The HTML5 `loop` attribute handles this natively — author the file with the loop point at the file boundaries (no fade-in/out at start/end) |
| **Duration** | Any. Three to seven minutes is the editorial sweet spot — long enough that the loop isn't conspicuous, short enough to keep the file size reasonable. The current production asset is a tight 15–20 second loop that relies on seamless looping for length |
| **Bitrate** | 128 kbps stereo is sufficient for ambient material. 192 kbps if the file is musical and warrants the fidelity |

### Audio provenance

The current `calm_wonder.mp3` asset was generated using the **ElevenLabs Music generator** with the following prompt:

> *"I need a 15-20 second loop of ambient, background electronic music, with a focus on atmospheric pads and chords. Consider a sense of calm and wonder. 2-4 chords."*

The prompt is deliberately on-brand: *calm and wonder* is exactly the emotional register Trugschluss-Werke would specify for its catalogue's ambient track — never "exciting," never "energetic," never "uplifting." The 2–4 chord constraint ensures the loop isn't musically conspicuous on repeat. Atmospheric pads (sustained, slow-attack synthesizer voicings) rather than melodic content keep the audio from competing with the visitor's attention to the page.

The filename `calm_wonder.mp3` derives directly from the prompt's emotional brief and serves as the asset's own quiet documentation.

**For future ambient assets in the same family**, retain the prompt scaffolding: *ambient, electronic, atmospheric pads, 2–4 chords, 15–20 second loop, [emotional register].* The emotional register can shift across plates and contexts (calm and wonder for the homepage, focused and analytical for product pages if the catalogue ever supports per-page audio), but the structural constraints (pads not melody, sparse harmony, short seamless loop) hold the brand identity across tracks.

### Control component

A persistent ambient control sits in the top-right cluster alongside the theme toggle and dossier button. Position order, left to right: **ambient → dossier → theme**.

The control consists of:
- A **mute toggle button** with an animated three-bar waveform icon. The bars pulse vertically while playing (CSS keyframe animation, 0.9s loop, staggered delays). When muted, the bars compress to a single hairline and dim to 45% opacity.
- A **hover-revealed volume slider** that slides out to the right when the user hovers the control. Width animates from 0 to 120px over 350ms. The slider uses thin hairline styling matching the rest of the design system — 1px track, 8×12px ink-filled thumb, sharp corners.
- A **micro-label beneath** reading **Ambient · On** or **Ambient · Off** (matching the `DAY EDITION` / `NIGHT EDITION` label format of the theme toggle).
- A **state badge inside the button** reading "On" or "Off" in the heavy condensed mono.

### Behaviour

**Off by default.** First visit: silent. Visitors opt in by clicking the toggle. This is non-negotiable; autoplay-with-sound is hostile design and modern browsers block it anyway.

**Persistence.** State is stored in `localStorage` under the key `tw-ambient` as a JSON object: `{ playing: boolean, volume: number (0–100) }`. The state survives across sessions, page refreshes, and tab switches.

**Resume on return.** If a returning visitor had ambient ON in their previous session, the page attempts to resume playback 800ms after load. If the browser blocks the resume (no user gesture in current session), the state is silently reverted to OFF and the UI updates to match — no error, no nag, no "click here to enable audio" banner.

**Graceful degradation.** If the audio file is missing, the file fails to load, or any decoding error occurs, the control silently reverts to OFF state. The page does not break. The control simply behaves as though the user clicked it to mute.

**Volume.** Default 40% (a quiet ambient level — not silent, not intrusive). Range 0–100. Changes save immediately to `localStorage`. Sliding to 0 does NOT auto-mute the toggle — the user remains in "ON" state at zero volume, so unsliding restores audibility without re-toggling. This is the convention preferred by audio applications.

### CSS keys

```css
.ambient-control          /* outer wrapper, position fixed top-right */
.ambient-toggle           /* the clickable mute/play button */
.ambient-toggle .wave     /* three-bar waveform icon */
.ambient-toggle .wave span /* individual bars, animated */
.ambient-volume           /* slide-out volume slider container */
.ambient-volume input[type="range"]  /* the slider itself */
.ambient-label            /* micro-text label beneath */

/* States, applied to .ambient-control */
.ambient-control.playing  /* audio is playing — bars animate */
.ambient-control.muted    /* audio is paused — bars flat and dim */
```

### LocalStorage keys reference

The page now persists three independent state keys:

| Key | Shape | Description |
|---|---|---|
| `tw-theme` | string `"light"` \| `"dark"` | Day/night edition preference |
| `tw-dossier` | array `[{id, qty}]` | Configuration dossier items |
| `tw-ambient` | object `{playing, volume}` | Ambient audio state |

All three persist independently. Clearing one does not affect the others.

### Accessibility

- The toggle has a dynamic `aria-label` that reads "Play ambient audio" when off, "Mute ambient audio" when on
- The volume slider has `aria-label="Ambient audio volume"`
- Keyboard focus reveals the volume slider via `:focus-within` (same behaviour as hover, so keyboard users get full control)
- The label beneath provides a redundant text indicator of state
- Audio is never autoplayed without explicit user action

### Future audio additions

The architecture supports additional audio tracks if the catalogue grows — for instance, a **second track** that plays only when the user is in the dossier drawer (a slightly different ambient, marking a shift in mode). The current implementation is single-track, but the state shape (`{ playing, volume }`) could be extended to `{ tracks: [...], active: 0, volume }` without breaking persistence.

---

## 7. COPY LIBRARY (CANONICAL SENTENCES)

These sentences are canonical. They may be reused verbatim across the site.

**The founder's principle (appears in About, lobby plaque, occasionally in footer):**
> *"Faulty reasoning will occur regardless of our involvement. It may as well occur to specification."*
> — Dr. Heinrich Vogel, 1962 prospectus

**The diary entry (About page, history section):**
> *"The reasoning was, in each case, structurally unsound — and yet the men appeared sincere. If error of this kind occurs reliably and at scale, it is a manufacturing process. It is merely uncatalogued."*
> — H. Vogel, Düsseldorf, autumn 1961

**The tagline, always paired:**
> *Präzisionsdenkfehler seit 1962.*
> *Precision reasoning errors since 1962.*

**The succession line:**
> *Service parts remain available for all generations.*

**The Stuttgart line:**
> *Hand-calibrated at the Stuttgart facility before shipment.*

**The Glarus line:**
> *Assembled by hand in our Glarus workshop. Each unit numbered.*

---

## 8. FOOTER (STANDARD ACROSS ALL PAGES)

Three columns, tiny mono type. The colophon move.

**Left column — Facilities:**
```
TRUGSCHLUSS-WERKE AG
Bahnhofstrasse 47
8001 Zürich, CH

MANUFACTURING
Reichenbachstrasse 12
70567 Stuttgart, DE

HERITAGE WORKSHOP
Hauptstrasse 9
8750 Glarus, CH
```

**Centre column — Regulatory:**
```
Compliant with EN-1947, EN-2204, ISO-2891.
Patents pending in CH, DE, AT, FR, IT, UK, US, JP.
Export controls vary by jurisdiction.
SIX: TRGS

Präzisionsdenkfehler seit 1962.
Precision reasoning errors since 1962.
```

**Right column — Mark & copyright:**
```
[Company mark, hairline diagram]

© 1962–2026 Trugschluss-Werke AG.
All rights reserved.
```

---

## 9. DO / DON'T

**Do:**
- Hold the deadpan absolutely. Every page, every sentence.
- Use the bone background everywhere. Pure white is forbidden.
- Use hairline rules between sections, between columns, beneath eyebrow labels.
- Use the bullet separator (·) and em-dash (—) in product names and section labels.
- Set numerics in mono. Always.
- Treat every page as a designed object. No template pages.
- Make the satire load-bearing: succession lineage, regulatory references, fictional addresses with real-sounding street names.

**Don't:**
- Break character. Ever. Not in error messages, not in form validation, not in 404 pages.
- Use generic e-commerce language: "Buy Now," "Add to Cart," "Customers also bought."
- Use stock photography or generic imagery.
- Use pure white, pure black, or any colour outside the defined palette.
- Use rounded corners on buttons, cards, or imagery. Sharp corners only.
- Centre product compositions. Asymmetry is the rule.
- Use icon libraries (Font Awesome, Lucide, etc.) without restyling to the hairline monoline standard.
- Add testimonials, reviews, social proof banners, or pop-ups.

---

## 10. THE NORTH STAR

A visitor lands. Within five seconds they understand: this is a beautifully designed European industrial brand that, somehow, sells fallacies. The satire lands instantly, the deadpan holds, and they want to keep scrolling because the *site is gorgeous*. They share the URL. They come back to show a friend. They screenshot the homepage.

The job is **aesthetic memorability**. The fictional product line is the vehicle. The design system is the payload.

— *End of specification.*
