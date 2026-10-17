# 🛠️ My Tools Hub

A collection of personal utility tools and mini-applications built to optimize workflows. Designed with a consistent **Dark Neumorphism** UI for a clean, modern, and distraction-free experience.

## 🌟 Available Tools

### 1. [FontLab](./tools/font-lab/index.html)

A lightning-fast font tester designed for creators and UI/UX designers.

- Real-time typography preview.
- Supports Google Fonts and custom fonts.
- Neumorphic controls for font size, weight, and ratio testing.
- Export font combinations easily.

### 2. [Ratio Calculator](./tools/ratio-calculator/index.html)

Quickly calculate missing values for A:B = C:D ratios. Perfect for resizing and scaling.

- Calculate missing values instantly from 3 inputs.
- Quick action with 'Enter' key support.
- Smart error handling (prevents division by zero).
- Clean Neumorphic input fields and result highlight.

### 3. [Case Converter](./tools/case-converter/index.html)

Convert any text between common casing styles in one click.

- Sentence case, lower case, UPPER CASE, Capitalized Case, Title Case.
- Fun formats: aLtErNaTiNg cAsE and InVeRsE CaSe.
- Live re-conversion as you type, with char/word counter.
- One-click Copy button with instant feedback.

### 4. [URL Extractor](./tools/url-extractor/index.html)

Extract every URL from plain text in seconds.

- Detects `http://`, `https://`, `ftp://`, and `www.` links automatically.
- Strips trailing punctuation and normalizes `www.` URLs.
- Optional deduplication toggle with live extraction as you type.
- Copy all results in one click.

### 5. [Password Generator](./tools/password-generator/index.html)

Create strong random passwords with full control over length and character types.

- Adjustable length from 4 to 128 characters.
- Toggle uppercase, lowercase, numbers, and symbols.
- Uses `crypto.getRandomValues` for secure randomness.
- Strength estimate, show/hide toggle, and one-click copy.

### 6. [Prompt Library](./tools/prompt-library/index.html)

Collect and manage creative prompts in a small personal library.

- Browse prompt cards with preview images, tags, and pins.
- Add, edit, duplicate, and delete prompt entries.
- Export/import JSON backups (merge or replace).

### 7. [Story Builder](./tools/story-builder/index.html)

Create structured story briefs and AI prompts for short fiction.

- Build character cards, plot beats, and emotional arcs.
- Live AI-ready prompt, one-click Copy Prompt / Copy Brief.
- Uses the shared Dark Neumorphism theme for consistent UI.

### 8. [Read Aloud](./tools/read-aloud/index.html)

Distraction-free reader for TTS plus a Vietnamese → English practice mode.

- Reader mode shows only your text, so Edge Read Aloud skips UI labels.
- Translate Vietnamese to English (Google, auto-fallback to MyMemory).
- Speak with browser voices (Edge Natural voices preferred), adjustable speed.
- Recent translation history, click to replay.

_(More tools coming soon...)_

## 🎨 UI/UX DNA: Dark Neumorphism

This hub uses a shared design language across all tools:

- **Base Color:** Deep Dark `#18181b`
- **Accent Color:** Vibrant Red `#ef4444`
- **Component Style:** Flat, Pressed, and Floating soft shadows.

## 🚀 How to Add a New Tool

To maintain the design consistency, a Master Template is provided.

1. Copy the folder `template/` into `tools/` and rename it (e.g., `tools/new-tool/`).
2. Rename `index-template.html` to `index.html` (paths are already set for `tools/<name>/`).
3. Create `script.js`, then uncomment the `<script src="script.js">` line.
4. Add a card for the tool in the root `index.html`.

## 💻 Tech Stack

- HTML5 / CSS3 / JavaScript (Vanilla)
- [Tailwind CSS](https://tailwindcss.com/) via CDN (for rapid layout styling)
- [FontAwesome 6](https://fontawesome.com/) (Icons)

---

_Coded with ☕ and ❤️_
