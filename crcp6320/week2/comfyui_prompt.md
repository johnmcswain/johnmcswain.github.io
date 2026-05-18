# COMFYUI PROMPT
## Plate I — The Stuttgart Manufacturing Facility

**Target asset:** `plate-01-stuttgart.png`
**Final dimensions:** 2880 × 1800 px (16:10) — generate at 1536 × 960 then upscale 2× via SDXL-ESRGAN
**Use:** Full-bleed photographic plate, section between hero and catalogue on the Trugschluss-Werke homepage
**Recommended models:** Flux.1 Dev / SDXL with Juggernaut XL v9 / RealVisXL v4
**Sampler:** DPM++ 2M Karras · 30–40 steps · CFG 4.5–6 (Flux: guidance 3.5)

---

## CONCEPT NOTES

A brutalist concrete manufacturing facility in Stuttgart, photographed in 1987 for the company's annual catalogue. The building is the subject. Period-accurate office workers and visitors provide human scale and atmospheric life — they are scale anchors, not the focus.

The composition should evoke **awe through architectural mass** rather than through reactive human gesture. The building does the emotional work. The figures are simply going about their Tuesday afternoon at a place of serious industrial dignity, the way office workers in a 1987 corporate report would be photographed.

The casting brief for the human figures: **deliberately diverse** (varied ages, body types, gender presentations, ethnic backgrounds), **deliberately ordinary** (clerks, engineers, a delivery person, perhaps a small group of architecture students at the edge of the plaza who *do* pause to look up), and **deliberately period-accurate** (1987 Stuttgart business attire, no contemporary elements).

---

## POSITIVE PROMPT

```
A monumental brutalist concrete manufacturing facility photographed
in Stuttgart, West Germany, spring 1987, late afternoon golden hour
with long raking shadows. The building is the subject and the
hero of the composition.

The structure is a massive horizontal mass of board-formed concrete
with visible wood grain texture, deep recessed vertical window
slots running floor to ceiling, a cantilevered upper floor
projecting outward over the ground level, oxidised copper
ventilation stacks rising from the roofline, hairline expansion
joints, geometric precision throughout, no ornamentation. A single
illuminated sign reading "TRUGSCHLUSS-WERKE" in heavy condensed
sans-serif letters mounted on the facade in patinated bronze.
A hairline-thin canopy hovers over the entrance.

Industrial modernism meets brutalism: think Paul Rudolph meets
the AEG turbine hall meets Erno Goldfinger. The building should
evoke awe through sheer mass, proportion, and confidence of
material — the kind of facility you would build if you were
certain your products would last fifty years.

In the foreground, a vast concrete plaza with hairline expansion
joints leads the eye toward the entrance. Going about an ordinary
Tuesday afternoon, scattered across the plaza:

  — A middle-aged office worker in a tan trench coat over a grey
    business suit, carrying a leather briefcase, walking briskly
    toward the entrance, checking a wristwatch
  — A woman in a navy 1980s skirt suit with shoulder pads, carrying
    a stack of folios and a rolled architectural drawing tube,
    walking in conversation with a colleague
  — Her colleague, in a beige cardigan over a button-down shirt and
    pleated trousers, holding a pen and notebook, gesturing
    mid-conversation
  — A delivery person in a brown utility coverall, pushing a small
    handcart with parcels, crossing the plaza
  — A small group of three architecture students with cameras and
    sketchpads standing at the edge of the plaza looking up at the
    facade, dwarfed by its mass, the only figures actually paying
    attention to the building

The human figures are a diverse cross-section of 1987 Stuttgart
office staff and visitors — varied ages, body types, gender
presentations, and ethnic backgrounds. They are scale anchors,
not the focus. Most pay no particular attention to the building
they work in every day; only the architecture students stop to
look up.

A black 1987 Mercedes-Benz W126 sedan and a beige Volkswagen
Passat parked at the side, scaled small. A few 1987-era bicycles
leaning against a low concrete bollard.

The composition is a low-angle architectural photograph, the
building filling the upper three-quarters of the frame, sky a
muted dove grey with the faintest warm horizon glow. The
foreground human activity occupies only the lower fifth of the
frame.

Photographic style: medium-format film photography, Hasselblad
500CM with 50mm Distagon lens, Kodak Portra 400 pushed one stop,
cool neutral colour palette with deep ink-navy shadows, oxidised
copper highlights, warm bone-cream concrete tones, no oversaturation.
Subtle film grain. The atmosphere of a corporate annual report
photograph: dignified, monumental, slightly austere, the kind of
image that would have been printed full-bleed in a 1987 catalogue.

Architectural details: board-formed concrete with visible wood
grain texture, deep horizontal shadow bands from cantilevered
floors, vertical window slots with bronze frames, oxidised copper
gutters and downspouts, geometric precision throughout. Captured
with maximum sharpness on the building, the figures slightly soft
to convey atmosphere and motion.

Mood: awe, reverence, mid-century industrial confidence, European
post-war optimism. A serious building doing serious work.

Editorial photography, architectural plate, professional medium
format, archival quality, 1987 corporate publication aesthetic.
```

---

## NEGATIVE PROMPT

```
modern glass curtain wall, postmodern, deconstructivist, parametric,
zaha hadid, frank gehry, curved walls, glossy surfaces, reflective
glass, contemporary, smartphones, modern cars, modern clothing,
high-vis vests, hard hats, construction workers, scaffolding,
graffiti, dirt, decay, ruins, abandoned, brutalist parody,
cartoon, illustration, painting, render, CGI, 3D model, unrealistic,
oversaturated, warm orange sunset, dramatic clouds, lens flare,
bokeh, blur except where specified, fisheye, wide angle distortion,
overly crowded scene, faces clearly visible in close detail,
fictional characters, science fiction, fantasy, armoured warriors,
robots, superheroes, costumes, helmets, capes, weapons,
modern military gear, tactical vests, present-day soldiers,
contemporary fashion, athleisure, sneakers, denim, hoodies,
backpacks, laptop bags, smartphones in hands, modern cars,
lowres, low quality, jpeg artefacts, watermark, text overlay,
caption, frame, border, signature, oversharp, hdr look,
instagram filter, vibrant, saturated, neon, fluorescent,
duplicate characters, identical office workers, all-male crowd,
all-white crowd, homogeneous crowd, stereotype caricature
```

---

## STAGING NOTES

The building must be the visual hero. The human figures occupy only the **lower fifth of the frame** — they are small, atmospheric, scale-giving. The eye should read: massive concrete mass → cantilevered upper floor → vertical window slots → the bronze TRUGSCHLUSS-WERKE sign → down to the plaza → out across the scattered human activity.

The architecture students at the edge of the plaza are the one group looking up. This single moment of attention does enormous work — it gives the viewer a model for how to look at the building, and quietly establishes that the building *is* worth looking up at. Everyone else is going about their day, which makes the building's awe-inducing quality feel earned rather than performed.

---

## ITERATION STRATEGY

Save each generation as `plate-01-stuttgart-v{N}.png` and update the filename in `index.html` to test.

### v1 — baseline (above prompt)
Run as-is. Evaluate: Is the building monumental enough? Is the palette landing? Are the human figures the right scale (small, atmospheric)? Do the architecture students read as a focal point at the edge?

### v2 — building emphasis
Add to positive: `the building dominates the frame, monumental scale, massive horizontal mass, cantilevered upper floor casting deep shadow across the entrance, vertical window slots in strict rhythm, the bronze TRUGSCHLUSS-WERKE sign clearly legible on the facade, board-formed concrete with strong wood grain texture visible in raking light`.

### v3 — palette tightening
Add: `cool ink-navy shadows on the concrete, oxidised teal-copper accents on copper gutters and ventilation stacks, bone-cream concrete walls warmed by late afternoon light, deeply desaturated overall, the figures rendered in muted period colours, no oversaturation anywhere in the frame`.

### v4 — atmospheric
Add: `faint atmospheric haze in the distance behind the building, soft dust motes visible in the raking afternoon light, the concrete reading slightly cooler in shadow and slightly warm in direct light, period-accurate Stuttgart industrial district setting, no contemporary elements visible anywhere in the frame`.

### v5 — composition tighter
Add: `low camera angle from across the plaza, the building looming, vanishing point in the upper third of the frame, vertical window slots leading the eye upward, the human figures small and scattered across the lower fifth of the frame, the architecture students providing a focal point at the lower right edge`.

### v6 — alternate framing
Switch the angle: `slightly elevated three-quarter view from across the plaza, the building reading at a slight angle, more of the horizontal mass visible, copper roofline catching the last light, the entire facade visible end to end`.

### v7 — emotional emphasis
Add: `the architecture students stand in quiet awe, one with hand raised slightly as if pointing out a structural detail to the others, body language of contemplation and discovery, the building's permanence and dignity rendering them small and human against fifty-year-old concrete`.

### v8 — black and white archival variant
For an alternate plate that reads as historical document: `black and white photograph, silver gelatin print, archival quality, late 1980s German industrial photography, the formal dignity of a corporate annual report black-and-white plate, deep blacks and bright whites with rich mid-grey concrete tones`.

---

## CHARACTER / HUMAN FIDELITY NOTES

**Diversity is part of the brief** — explicitly call for varied ages (mid-20s through 50s), varied body types, varied gender presentations, varied ethnic backgrounds. The workers and visitors should feel like a realistic 1987 cross-section of Stuttgart office staff and architecture students, not a casting choice.

**Period clothing details matter.** Push period accuracy:
- Women's suits: shoulder pads, knee-length skirts, modest blouses
- Men's suits: notch lapels, wider ties than contemporary, pleated trousers
- Briefcases (not laptop bags), wristwatches (not smartphones)
- Architecture students: corduroy jackets, jeans, canvas bags, 1980s SLR cameras (Nikon F3, Canon AE-1) hanging from neck straps
- No sneakers on adults, no contemporary athleisure, no hoodies, no logos

**Faces should not be the focus.** The figures are atmospheric — captured from middle distance, faces soft or in three-quarter view, the building always the sharpest element in the frame.

**The scale relationship is critical.** Figures must read as small relative to the building. If the model renders them too large, push them smaller in v2 with: `the human figures are deliberately small and atmospheric, occupying only the lower fifth of the frame, dwarfed by the architectural mass above them, the building dominating 75% of the frame vertically`.

---

## TECHNICAL NOTES

**Resolution.** Generate at **1536 × 960** (16:10) for SDXL native quality, or **1344 × 832** for Flux. Then upscale 2× via 4x-UltraSharp ESRGAN or SUPIR (best for architectural detail).

**Crop discipline.** The final image displays full-bleed at 88vh × 100vw, with **15% vertical headroom** absorbed by parallax movement. Important content — the building, the sign, the plaza, the figures — should sit in the **central 70% vertically**. The top 15% and bottom 15% may scroll out of view during parallax.

**Tonal range.** The image sits behind a CSS overlay that adds a radial vignette and slight top/bottom darkening. So the raw image should be **slightly brighter and slightly more contrasty than ideal** — the overlay will pull it back into the page palette.

**Final colour grade in Photoshop / Affinity (optional).**
- Lift shadows to match `--ink: #1a2332` rather than pure black
- Pull highlights toward `--bone: #ebe5d6` rather than pure white
- Add 5–8% warm tone to mid-tones to match the cream paper feel
- Sharpen the building, not the figures (keep them slightly soft)
- Export as **PNG (lossless)**. Expect 6–12 MB at 2880 × 1800. ComfyUI's default save node outputs PNG natively, so no conversion is required from the generation pipeline.

**File size considerations.** PNG at this resolution will be substantial (6–12 MB) versus a comparable JPEG (~600KB–1.2 MB). For local iteration and design-fiction use, this is fine. For production deployment with bandwidth concerns, consider one of:
- Export an additional optimised JPEG fallback (`plate-01-stuttgart.jpg`) and use the HTML `<picture>` element to serve either format
- Convert to WebP for ~70% size reduction with comparable quality
- Use a lower-resolution PNG (1920 × 1200) which will be ~3–5 MB

The current `index.html` references `plate-01-stuttgart.png` directly. If you produce a JPEG fallback, update the CSS `background-image` declaration or convert to a `<picture>` element accordingly.

**Hosting.** Place at `plate-01-stuttgart.png` in the same directory as `index.html`.

---

## ALTERNATE SUBJECTS (for future plates)

The page architecture supports additional plates as a series. Future prompts could generate:

- **Plate II** — The Zürich design office on Bahnhofstrasse 47, interior shot of Dr. Vogel's calibration bench preserved as it stood in 1962. No exterior — pure heritage interior, single raking light from a tall window.
- **Plate III** — The Glarus heritage workshop, three master craftsmen at hand-assembly benches working on Heritage-line apparatus. Brass and walnut catching warm light. The atmosphere of a small Swiss watchmaker's atelier.
- **Plate IV** — A 1971 archival portrait of Dr. Klaus Reichenbach standing beside the first MFPU prototype on the day the Stuttgart facility opened. Black-and-white, slightly grainy, reading like a press photograph from the official inauguration.
- **Plate V** — The Stuttgart facility at night, illuminated from within, the vertical window slots glowing warm against the ink-navy sky, a small number of evening-shift workers visible through the windows. The building working through the night.

Each maintains the same architectural and compositional language. The Stuttgart facility appears in multiple plates (day and night), reinforcing its role as the company's industrial heart.

---

*Document prepared 18 May 2026. Trugschluss-Werke AG · Visual archive.*
