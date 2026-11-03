# Extensions 🚀

A curated collection of modern, production-ready Chromium browser extensions (Google Chrome, Microsoft Edge, Brave, Opera) built with Manifest V3.

---

## 📦 Projects Overview

| Extension | Description | Manifest | Tech Stack |
| :--- | :--- | :--- | :--- |
| [**ChromaScope**](./ChromaScope) | Precision pixel loupe & gradient color inspector with perceptual color naming and contrast tools. | V3 | JavaScript, HTML5 Canvas, EyeDropper API, CSS3 |
| [**DashMorph**](./DashMorph) | Real-time drag-and-drop dashboard card rearranger with persistent custom layout storage. | V3 | Vanilla JS, Shadow DOM HUD, HTML5 Drag & Drop, chrome.storage |
| [**YTMusic-LyricOverlay**](./YTMusic-LyricOverlay) | Synchronized floating karaoke lyrics overlay and Document Picture-in-Picture window for YouTube Music. | V3 | Vanilla JS, Document PiP API, LRC Parser, CSS Backdrop Filter |

---

### 🎨 1. ChromaScope
**Precision Pixel & Gradient Color Inspector for Chromium Browsers**
- 8× magnified pixel loupe and element color sampler.
- Perceptual color name identification (identifies named shades, nuances, and color family).
- Palette generator, contrast ratio checker, and history exporter.
- Keyboard shortcuts for rapid designer/developer workflows.

### ⚡ 2. DashMorph
**Dashboard & Card Rearranger with Persistent Layouts**
- Fluid drag-and-drop rearrangement of dashboard cards, widgets, and metric panels.
- Dual-storage persistence (`localStorage` + `chrome.storage.local`) that remembers your preferred layout upon reload.
- Shadow DOM HUD prevents CSS conflicts with host websites.
- MutationObserver-powered detection compatible with React, Vue, Vite, and Angular SPAs.

### 🎵 3. YTMusic-LyricOverlay
**Picture-in-Picture & Floating Synchronized Lyrics for YouTube Music**
- Synchronized karaoke-style lyric highlight and auto-scroll powered by Document Picture-in-Picture.
- Title normalization supporting Bollywood, Hindi, Punjabi, and international songs.
- Transparent ghost overlay with customizable opacity, font sizes, and theme accents.
- Seamless multi-monitor and virtual desktop visibility.

---

## 🛠️ Installation & Setup (Developer Mode)

To install and test any of these extensions locally:

1. Clone this repository:
   ```bash
   git clone https://github.com/devjainofficial/Extensions.git
   cd Extensions
   ```
2. Open your Chromium-based browser (Chrome, Edge, Brave, etc.) and navigate to the Extensions management page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** (or **Load unpacked extension**).
5. Select the folder of the specific extension you want to run (e.g., `ChromaScope`, `DashMorph`, or `YTMusic-LyricOverlay`).

---

## 👤 Author

**Dev Jain**
- GitHub: [@devjainofficial](https://github.com/devjainofficial)
