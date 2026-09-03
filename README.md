# 🛠️ My Tools Hub

A collection of personal utility tools and mini-applications built to optimize workflows. Designed with a consistent **Dark Neumorphism** UI for a clean, modern, and distraction-free experience.

## 🌟 Available Tools

### 1. [FontLab](./tools/font-lab/index.html)

A lightning-fast font tester designed for creators and UI/UX designers.

- Real-time typography preview.
- Supports Google Fonts and custom fonts.
- Neumorphic controls for font size, weight, and ratio testing.
- Export font combinations easily.

### 2. [Scene Exporter](./tools/scene-exporter/index.html)

Convert scene frame data into a compact scene list and combine it with timing
metadata to generate a CapCut-ready timeline.

- Accepts pasted JSON or uploaded `.json` files containing a frames array.
- Sorts frames by `sceneNumber` and `shotNumber`, then maps image URLs,
	descriptions, and motion into numbered scene records.
- Previews the converted scene list and exports it as `converted-scenes.json`.
- Accepts a timing JSON array (or `frames` array) with `index`, `srtStart`, and
	`srtEnd` values.
- Matches timing entries to scenes, calculates rounded durations, and preserves
	an existing `effect` or infers one from the motion description.
- Previews and exports the final timeline as `capcut-final.json`.

### 3. [Ratio Calculator](./tools/ratio-calculator/index.html)

Quickly calculate missing values for A:B = C:D ratios. Perfect for resizing and scaling.

- Calculate missing values instantly from 3 inputs.
- Quick action with 'Enter' key support.
- Smart error handling (prevents division by zero).
- Clean Neumorphic input fields and result highlight.

### 4. [Case Converter](./tools/case-converter/index.html)

Convert any text between common casing styles in one click.

- Sentence case, lower case, UPPER CASE, Capitalized Case, Title Case.
- Fun formats: aLtErNaTiNg cAsE and InVeRsE CaSe.
- Live re-conversion as you type, with char/word counter.
- One-click Copy button with instant feedback.

### 5. [URL Extractor](./tools/url-extractor/index.html)

Extract every URL from plain text in seconds.

- Detects `http://`, `https://`, `ftp://`, and `www.` links automatically.
- Strips trailing punctuation and normalizes `www.` URLs.
- Optional deduplication toggle with live extraction as you type.
- Copy all results in one click.

### 6. [Password Generator](./tools/password-generator/index.html)

Create strong random passwords with full control over length and character types.

- Adjustable length from 4 to 128 characters.
- Toggle uppercase, lowercase, numbers, and symbols.
- Uses `crypto.getRandomValues` for secure randomness.
- Strength estimate, show/hide toggle, and one-click copy.

### 7. [Prompt Library](./tools/prompt-library/index.html)

Collect and manage creative prompts in a small personal library.

- Browse prompt cards with preview details.
- Add, edit, and delete prompt entries.
- Designed for quick reuse and inspiration.

### 8. [Story Builder](./tools/story-builder/index.html)

Create structured story briefs and AI prompts for short fiction.

- Build character cards, plot beats, and emotional arcs.
- Generate an AI-ready prompt and export brief as TXT/MD/JSON.
- Uses the shared Dark Neumorphism theme for consistent UI.

_(More tools coming soon...)_

## 🎨 UI/UX DNA: Dark Neumorphism

This hub uses a shared design language across all tools:

- **Base Color:** Deep Dark `#18181b`
- **Accent Color:** Vibrant Red `#ef4444`
- **Component Style:** Flat, Pressed, and Floating soft shadows.

## 🚀 How to Add a New Tool

To maintain the design consistency, a Master Template is provided.

1. Copy the folder `template/`.
2. Rename it to your new tool's name (e.g., `tools/new-tool/`).
3. The `index.html` is already linked to the global `assets/css/neumorphism.css`.
4. Add your logic to `script.js` and link the tool in the main root `index.html`.

## 💻 Tech Stack

- HTML5 / CSS3 / JavaScript (Vanilla)
- [Tailwind CSS](https://tailwindcss.com/) via CDN (for rapid layout styling)
- [FontAwesome 6](https://fontawesome.com/) (Icons)

---

_Coded with ☕ and ❤️_
