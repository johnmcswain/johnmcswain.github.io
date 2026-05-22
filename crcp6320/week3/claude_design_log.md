# Margin Design System — Build Chronology

A short record of how this project came together, with links to every input and output file.

---

## Inputs

- [`margin_design_system.md`](margin_design_system.md) — the v0.1 spec the user attached. Covers product premise, color tokens, typography roles + scale, spacing scale, voice rules, and component patterns inherited from a Kindle teardown.

## Outputs

- [`Margin Design System Standalone (HTML)`](margin_design_system_standalone.html) — same page, bundled into a single self-contained file (fonts inlined, works offline).
- [`Claude Design Log`](claude_design_log.md) — this file.

---

## Step 1 — Read the spec

Read [`margin_design_system.md`](margin_design_system.md) in full. Confirmed no companion images existed (`R.png` and `S.png` were referenced in the spec but not uploaded — they're descriptive context, not required assets).

Pulled out the system's load-bearing rules:

- One chromatic accent (terracotta `#B4513A`), one error red, otherwise neutrals.
- Warm off-white canvas `#FAF7F2`, never pure white for the page.
- Three-role type system: **Fraunces** (display), **Source Serif 4** (body/reading), **Inter** (UI chrome), plus **JetBrains Mono** for technical strings.
- Serif ↔ sans is a hard boundary: Inter never appears in the editor canvas; Source Serif never appears on a button.
- 4px spacing base; layout in 8s, chrome in 4s.
- Voice: precise, declarative, quietly opinionated. No apologies, exclamation marks, emoji, or empty encouragement.
- `#CBE3F1` ice blue appears in exactly one place: the focus-mode overlay.

## Step 2 — Plan

Set a todo list covering: color tokens with swatches, type scale with live specimens, spacing scale, components (buttons / toggle / tabs / settings rows / empty state / toast / modal / chips), voice with yes/no examples, and a verification pass.

Decided to build a **single-page reference document** rather than a slide deck — design systems are looked up, not presented. Decided the doc would use its own tokens (the page describing the system is itself an example of the system).

## Step 3 — Build the reference page

Wrote [`Margin Design System.html`](margin_design_system_standalone.html). A sticky 240px sidebar on the left (using the spec's own nav pattern: 36px-tall items, 12px padding, Inter 14/500), and a max-880px content column on the right with 96px top padding (matching the editor-canvas rule).

Sections in order:

1. **Overview** — the wordmark in Fraunces 88, the three pillars (Restraint / Typographic boundary / Quiet opinion), and inherits/rejects meta.
2. **Color** — neutrals, accent, semantic, each as a swatch grid with token name, hex, role, and usage. A foreground-on-background pairings table at the bottom.
3. **Typography** — three family cards, then live specimens for every scale step (`display-xl` → `mono`), then a "where serifs live / where sans lives" boundary card that makes the rule literal.
4. **Spacing** — proportional terracotta bars rendered at actual pixel width for every step, plus editor-canvas and sidebar measurements.
5. **Components** — buttons (primary/secondary/tertiary/destructive), iOS-style toggle, 2px-underline tabs, 56px settings rows with descriptors, text-only empty state, single-line toast (`Saved · 2 seconds ago`), destructive confirmation modal, chips.
6. **Voice** — six microcopy moments shown in their real components (primary action / confirmation / error / empty state / settings descriptor / destructive confirmation), each with yes/no comparison rows.
7. **Focus mode** — the one place ice blue appears.
8. **Reference** — who the system is for: built to be / not built to be.

## Step 4 — Verifier round 1

Called [`done`](margin_design_system_standalone.html) (clean console) and forked the verifier. Verifier flagged a layout collision: in the two-column Toast / Modal row inside the Components section, the `.comp-block header` used `justify-content: space-between` and the long descriptor on the right overlapped the uppercase title on the left.

## Step 5 — Fix

Made `.comp-block header` flex-wrap to a second line when constrained:

- Added `flex-wrap: wrap` and `gap: var(--s-3)`.
- Pinned the title with `flex: 0 0 auto`.
- Gave the note `flex: 1 1 auto; min-width: 0; text-align: right`.

In full-width comp-blocks the note still sits inline on the right; in the narrow Toast / Modal columns it drops cleanly below the title.

Re-ran [`done`](margin_design_system_standalone.html) — clean.

## Step 6 — Standalone bundle

User asked for a self-contained HTML export. Copied the source, added a `<template id="__bundler_thumbnail">` splash (Fraunces-style "Margin" wordmark with a terracotta dot, on the warm canvas color), and ran the bundler.

Result: [`Margin Design System (standalone).html`](margin_design_system_standalone.html) (~1.2 MB, fonts inlined, no external requests).

Presented for download. Removed the intermediate `(bundle-src).html` file once the bundle was built.

---

## File map

| File | Role |
| --- | --- |
| [`margin_design_system.html`](margin_design_system.html) | Input spec (user-provided) |
| [`margin_design_system_standalone.html`](margin_design_system_standalone.html) | Visual reference page (live working copy) |
| [`margin_design_system_standalone.html`](margin_design_system_standalone.html) | Same page, self-contained for offline use |
| [`claude_design_log.md`](claude_design_log.md) | This file |
