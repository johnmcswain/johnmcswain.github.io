# Margin — Design System v0.1

**Product:** Margin (working name) — a focused-work tool for thinking, writing, and journaling. Single-user, logged-in, with settings and detail screens. Fictional.
**Status:** v0.1 specification, derived from Kindle teardown + palette/typography inspiration.
**Date:** May 21, 2026

---

## Inspiration sources

The system inherits Kindle's **discipline** (one accent, tight palette, repeatable patterns) and **restraint** (minimal chrome, content-first). It deliberately rejects Kindle's **muted institutional voice** and **dark-by-default** posture in favor of a light/warm, opinionated stance.

<img src="R.png" alt="Figma color palette generator showing four colors in a horizontal layout: magenta #9E2473, blue #3490C2, near-black #0A1B24, and pale ice blue #CBE3F1." />

<img src="S.png" alt="Fontjoy interface showing three font choices in a left sidebar (Fugaz One, Biryani, Martel) with the phrase 'Font pairing made simple' set in a bold italic display face above body copy explaining the tool." />

From the Figma palette I'm keeping the **near-black `#0A1B24`** as a primary neutral and the **pale ice blue `#CBE3F1`** as a supporting tint. I'm rejecting the magenta/blue duo — two chromatic accents would fight the discipline we inherited from Kindle. I'll choose a single warmer accent instead.

From the Fontjoy result I'm keeping the **three-role type system** (display / UI / reading) but substituting fonts that fit a crisp-technical voice better than Fugaz One's display-poster register.

---

## Product premise (so the microcopy is real)

Margin is a quiet workspace for one person to think in. It holds three kinds of artifacts: **Notes** (short captures), **Drafts** (longer pieces being worked on), and **Threads** (collections that link notes and drafts around a theme). It has no social layer, no AI-summary widget, no recommendation engine. It does have version history, full-text search, and a focus mode. The user opens it to *do work*, not to be entertained.

This premise is what makes the voice "crisp & technical" rather than literary — the user is a working thinker, not a recreational reader.

---

## 1. Color

### Philosophy

One chromatic accent. One semantic-error color. Everything else is a neutral. The palette is built on a **warm off-white** foundation — not pure white, not gray — to communicate "long-session legibility" without the institutional feel of pure `#FFFFFF`.

### Tokens

```
PRIMARY (neutrals)
--canvas              #FAF7F2   Warm off-white. The page.
--surface             #FFFFFF   Pure white, only for elevated cards/modals on canvas.
--surface-sunken      #F1EDE5   For inset areas (code blocks, quote blocks, sidebars).

--ink                 #0A1B24   Primary text. Borrowed directly from Figma palette.
--ink-muted           #4A5862   Secondary text, metadata, captions.
--ink-soft            #8A9098   Tertiary text, placeholders, disabled.
--rule                #E5DFD3   Hairline dividers, subtle borders.

ACCENT (one, used sparingly)
--accent              #B4513A   Terracotta. Warm rust-orange.
--accent-hover        #9F4530   Slightly darker for interactive states.
--accent-soft         #F4E4DE   Tinted background for accent containers.

SEMANTIC
--success             #2F7D3F   Forest green. Reserved exclusively for save/sync confirmations.
--error               #B33A2E   Brick red. Reserved exclusively for destructive confirmations and validation failures.
--error-soft          #F4DDD9   Error container background.

ADDITIONAL TINT (inherited from Figma palette inspiration)
--ice                 #CBE3F1   Used in exactly one place: the focus-mode background overlay.
```

### Why terracotta as the accent

Three reasons. **One:** it's warm, which the canvas demands — a cool blue accent on a warm off-white feels mismatched. **Two:** it's rare enough in software UIs to feel deliberate (most apps reach for blue, green, or purple); using a clay/rust tone communicates that this isn't a generic productivity tool. **Three:** it sits well next to ink on the warm canvas without vibrating, which Kindle's blue would not do on this background.

### Rules

- The accent appears on **one element per screen maximum** as a focal point (active nav item, primary button, current selection).
- Hairlines do all the structural work. Containers do not have shadows.
- The ice blue (`#CBE3F1`) is a Chekhov's gun — it appears only in focus mode, which means the user sees it specifically when entering a different state. Reserving it gives it meaning.
- Success green and error red are never decorative. If you see either color, something happened or something needs your attention.

---

## 2. Typography

### Font choices

Three families, three roles, all available on Google Fonts.

| Role | Family | Style | Why |
|---|---|---|---|
| **Display** | **Fraunces** | Variable serif, used at heavy weight with optical size | High-contrast modern serif with strong personality. Used sparingly — section openers, empty-state headlines, the app wordmark. Replaces the Fugaz-One register from the inspiration with something more grown-up. |
| **UI / Interface** | **Inter** | Variable sans-serif | The de facto standard for UI text. Crisp, technical, neutral. Used for buttons, labels, navigation, settings rows, metadata. Stripe and Linear both use Inter for a reason. |
| **Reading / Body** | **Source Serif 4** | Variable serif | Long-form reading body. High contrast between thicks and thins, optimized for screen, slightly warmer than Bookerly. Used in the editor canvas and in any reading view. |

This is the high-contrast pairing you wanted: **serifs for body and display, sans for UI chrome.**

### Type scale

Based on a 1.25 (major third) ratio anchored to a 16px base.

| Token | Size | Line height | Weight | Family | Use |
|---|---|---|---|---|---|
| `display-xl` | 48px | 1.1 | 600 | Fraunces | Empty-state hero, marketing-style moments inside the app (settings landing, first-run) |
| `display` | 32px | 1.15 | 500 | Fraunces | Section openers ("Drafts", "Threads"), modal titles when warmth is wanted |
| `heading` | 22px | 1.3 | 500 | Fraunces | Note titles, thread names, document headings in the editor |
| `body-lg` | 18px | 1.6 | 400 | Source Serif 4 | Reading view & editor canvas — the prose you're working on |
| `body` | 16px | 1.5 | 400 | Source Serif 4 | Default reading text outside the editor (descriptions, longer settings explanations) |
| `ui` | 14px | 1.45 | 500 | Inter | All interface chrome: buttons, nav labels, settings rows, list items |
| `ui-sm` | 13px | 1.4 | 500 | Inter | Secondary UI: metadata, timestamps, counts, sub-labels |
| `caption` | 12px | 1.4 | 500 | Inter | Tertiary metadata: keyboard shortcuts, hint text, footnotes |
| `mono` | 13px | 1.5 | 400 | JetBrains Mono | Code blocks, IDs, technical strings (one bonus role for the technical voice) |

### Hierarchy notes

- The jump from `body-lg` (18px) to `heading` (22px) is small, intentionally. Reading and headings should feel like they belong to the same artifact.
- The jump from `ui` (14px) to `display` (32px) is large because that's where the **app shifts modes** — chrome to content. The size jump *is* the mode change.
- Source Serif and Fraunces are tonally compatible (both high-contrast serifs from related design lineages), so a heading and its body sit together without feeling like they're from different documents.
- Inter never appears in the editor canvas. Source Serif never appears on a button. The boundary between "writing" and "interface" is enforced typographically — a direct lesson from Kindle's serif-for-book / sans-for-app discipline.

---

## 3. Spacing

### Base unit

**4px.** Smaller than Kindle's effective 8px because this is a denser app with more controls per screen. The base of 4 supports both 8-multiple spacing (for layout) and 4-multiple spacing (for tight UI moments like icon-to-label gaps).

### Scale

```
--space-0    0px      (no space — for resetting)
--space-1    4px      Tight: icon-to-label, inside a chip
--space-2    8px      Snug: between related labels and inputs
--space-3    12px     Default inline: between a label and its descriptor
--space-4    16px     Default block: between settings rows
--space-5    24px     Section internal: between a heading and its content
--space-6    32px     Section gap: between settings groups
--space-8    48px     Major: above/below display headings
--space-10   64px     Page-level: between top-level sections on a detail screen
--space-12   96px     Editor-canvas top margin, generous breathing room for reading
```

### Layout rules

- **Editor canvas:** max content width of 680px, centered, with `--space-12` (96px) top padding. Reading is the primary act; it gets the most room.
- **Settings rows:** 56px tall, `--space-4` (16px) horizontal padding, hairline dividers, no internal background fill.
- **Sidebar / nav:** 240px wide on desktop. Items are 36px tall with `--space-3` (12px) horizontal padding. Tight, because this is navigation, not content.
- **Detail screens:** `--space-10` (64px) gap between top-level sections, `--space-6` (32px) between sub-groups, `--space-4` (16px) between rows.

---

## 4. Voice

### Three adjectives

**Precise. Declarative. Quietly opinionated.**

- **Precise** — every word earns its place. No filler, no hedging, no marketing throat-clearing. If the system needs to say something, it says exactly that.
- **Declarative** — the product makes statements, not pleas. "Saved" not "Your changes have been saved successfully!". "Couldn't connect" not "Oops — looks like something went wrong!"
- **Quietly opinionated** — the system has a point of view about how work happens here, and it's not embarrassed about it. Defaults are confident. Warnings are honest. Onboarding tells you how to use the product rather than asking what you'd like.

### What the voice avoids

- Apologies ("Sorry!", "Oops")
- Exclamation marks (one, maybe, per quarter)
- Emoji
- Second-person commands that sound managerial ("Let's get started!")
- Empty encouragement ("Great job!", "You're crushing it!")
- Cute personification of the product ("Margin thinks you might like…")

### Microcopy examples

**Button label (primary action — saving a draft):**
> Save draft

Not "Save changes," not "Save & continue," not "💾 Save." Just the action and its object, no adornment.

**Empty state (the Drafts view, before the user has created anything):**
> **Nothing here yet.**
> Drafts hold work that isn't done. Press ⌘N to start one.

The body uses sentence case and a definite period. There's a definition ("Drafts hold work that isn't done") and an instruction (the keyboard shortcut). No illustration, no "Click below to begin!" — the explanation *is* the affordance.

**Error message (failed sync):**
> Couldn't sync. Your work is safe locally. Retry in a moment.

Three sentences, each doing one job: what failed, what's preserved, what to do. No blame, no panic, no "Please." The voice trusts the user to handle information.

**Confirmation toast (after saving):**
> Saved · 2 seconds ago

That's the whole toast. The middle dot is doing the work an extra sentence would otherwise do.

**Destructive confirmation (deleting a thread):**
> **Delete this thread?**
> The notes inside it will move to your archive. The thread itself will be removed.
>
> [Cancel] [Delete thread]

The voice tells the user exactly what happens to each kind of artifact. The destructive button is labeled with the verb and the object — never just "Delete" or "Yes."

**Settings sub-label (a real one, the kind Kindle gets wrong):**
> **Local-first sync**
> Margin saves to your device first, then syncs to your other devices when online. Off means this device only.

Contrast with Kindle's "Click for explanation." This explains in 23 words what the toggle does *and* what "off" means. The voice respects the reader's time by being complete, not by being short.

---

## 5. Component patterns (carried forward from Kindle teardown)

A few patterns from the Kindle analysis that explicitly survive here, because the discipline was the point:

- **One primary button per screen.** Primary = filled accent (terracotta). Secondary = outlined ink. Tertiary = ghost (text only). Just like Kindle, primacy is communicated by *singularity*, reinforced by color.
- **Toggles are iOS-style pills.** Off = `--rule` gray. On = `--accent` terracotta. Knob is `--surface` white.
- **Tabs use a 2px underline in the accent color.** Inherited verbatim from Kindle.
- **Settings rows have a title-and-descriptor pattern.** Inter 14/500 for the title, Inter 13/400 in `--ink-muted` for the descriptor. The descriptor *explains* — it doesn't say "click for explanation."
- **Empty states are text-only.** No illustrations. The voice does the work.

---

## 6. What this system communicates about its user

If Kindle's user was "the patient librarian," Margin's user is **the working thinker** — someone with their own ideas in motion, who wants software that gets the technical details right (sync, keyboard shortcuts, version history, exports) without imposing personality on them. They are post-onboarding by the second day. They keep notebooks. They've tried Notion and Obsidian and Bear and have opinions about all three.

The system is built to be **legible at speed** (Inter for chrome, warm canvas for long sessions), **decisive** (one accent, one error color, no decoration), and **literary where it counts** (Fraunces and Source Serif handle the moments where the product treats the work as work worth doing well).

It inherits Kindle's restraint but trades Kindle's institutional silence for something more honest: a product with a point of view, expressed quietly, in microcopy that reads like it was written by an adult.
