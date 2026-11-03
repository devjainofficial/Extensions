# ChromaScope 🎨
### Precision Pixel & Gradient Color Inspector for Microsoft Edge (Manifest V3)

**ChromaScope** is a precision color inspection extension designed specifically for **Microsoft Edge**. It allows you to inspect the exact pixel color of any element, image, video, canvas, or gradient on a webpage—or anywhere across your screen—and identifies the **exact perceptual color name** based on its shade, nuance, and gradient position.

---

## ⚡ Global Keyboard Shortcuts in Microsoft Edge

You can trigger ChromaScope anytime without touching your mouse:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd> | **Open Popup** | Instantly opens the ChromaScope extension popup from any tab in Edge |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | **Page Loupe & Hover Inspector** | Injects the 8× magnified pixel loupe directly over the active webpage (press again to toggle off) |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | **Quick Screen EyeDropper** | Instantly launches the native screen eyedropper to sample any pixel |
| <kbd>H</kbd> *(in Page Loupe)* | **Hover Diff Lock** | Locks and compares an element's **Resting Color vs Hover Color** side-by-side |
| <kbd>C</kbd> *(in Page Loupe)* | **Copy CSS Hover Rule** | Generates and copies ready-to-use CSS `:hover` rule & Tailwind classes to clipboard |
| <kbd>Space</kbd> *(in Page Loupe)* | **Freeze Inspection** | Freezes the loupe view to examine pixel details |
| <kbd>M</kbd> *(in Page Loupe)* | **Toggle Sound** | Mutes / unmutes the Chromesthesia audio harmonic synthesizer |
| <kbd>Arrow Keys</kbd> *(in Loupe)* | **1px Nudge** | Nudges cursor by 1 pixel (hold <kbd>Shift</kbd> for 5px) for sub-pixel accuracy |

*(You can also customize these shortcut keys anytime in Edge via `edge://extensions/shortcuts`)*

---

## 🌟 Key Features

### 1. Complete 4-Color Hover State Matrix (`:hover` Dual-State Inspector)
Inspect both the background and foreground text colors across both resting and hover states:
* **All 4 Colors at a Glance**: When hovering over any button, link, list item, or interactive component, ChromaScope instantly resolves:
  1. **Normal (Resting) Background Color** (Swatch, HEX, exact perceptual name)
  2. **Normal (Resting) Text Color** (Swatch, HEX, exact perceptual name)
  3. **Hover (Active) Background Color** (Swatch, HEX, exact perceptual name)
  4. **Hover (Active) Text Color** (Swatch, HEX, exact perceptual name)
* **Single-Click Copy**: Click any of the 4 items to immediately copy its specific HEX value.
* **One-Click CSS Generator (<kbd>C</kbd>)**: Press <kbd>C</kbd> or click **Copy All 4 Colors (CSS)** to copy ready-to-paste CSS rules and Tailwind utility classes:
  ```css
  /* Normal State */
  button {
      background-color: #EF4444; /* Scarlet */
      color: #FFFFFF; /* White */
  }
  /* Hover State */
  button:hover {
      background-color: #4B5563; /* Slate Gray */
      color: #000000; /* Black */
  }
  ```
* **Lock Inspection (<kbd>H</kbd>)**: Press <kbd>H</kbd> while hovering to lock the 4-color matrix in place so you can freely examine, compare, or copy values.

### 2. Dual-Engine Precision Pixel Sampling
* **Native Screen EyeDropper (`window.EyeDropper`)**: One-click screen picker that can sample **any single pixel on your entire display** (not just the webpage DOM, but OS elements, media, canvas, WebGL, and complex CSS gradients) with zero latency.
* **In-Page Interactive Loupe Inspector**: Floating **8× magnified pixel loupe** directly over the webpage with crosshair reticles, single-pixel nudging, and live HUD readout.

### 3. Exact CIELAB Perceptual Color Naming
* Built-in dictionary containing **1,648 curated named colors** (including CSS Color Level 4, Pantone-inspired shades, Resene, and artistic nuances).
* Performs conversion from **sRGB $\to$ Linear RGB $\to$ CIE XYZ $\to$ CIELAB** using standard D65 illuminants.
* Computes **CIE76 $\Delta E$ (Delta-E)** perceptual Euclidean distance:
  $$\Delta E = \sqrt{(\Delta L^*)^2 + (\Delta a^*)^2 + (\Delta b^*)^2}$$
* Rather than naive RGB distance (which fails to model human visual perception), CIELAB matching ensures that color names reflect **how human eyes perceive lightness, chroma, and hue**.
* Displays match confidence percentage and nuance classification (e.g., *"Lighter, luminous tint of Cerulean"*, *"Nearly identical to Outrageous Orange"*).

### 4. Gradient & Shade Nuance Intelligence
* **Tonal Classification**: Categorizes pixels across the gradient spectrum (*Pure Highlight Tint*, *High Pastel*, *Light Mid-Tone*, *Core Vibrant Tone*, *Deep Shade*, *Shadow / Midnight*).
* **Undertone & Temperature**: Detects color warmth (*Warm Golden*, *Warm Fiery*, *Cool Nordic*, *Cool Green*, *Cool-Warm Magenta Transition*, *Neutral Achromatic*).
* **Multi-Stop Gradient Spectrum Generator**: Samples and computes intermediate gradient stops along color harmonies, naming every single intermediate stop and outputting clean CSS `linear-gradient` and `radial-gradient` code.
* **Automatic CSS Gradient Detection**: When inspecting in-page elements, it detects underlying `linear-gradient(...)`, `radial-gradient(...)`, and `conic-gradient(...)` CSS rules and reveals their definitions.

---

## 🎁 Surprise Elements & Developer Tools

### 1. 🎵 Chromesthesia Web Audio Synthesizer (Listen to the Color!)
* Light wavelengths correlate to sonic frequencies. ChromaScope uses the native **Web Audio API** to calculate the musical frequency of any color based on its hue, saturation, and luminance.
* Click **♫ Play Tone** in the popup (or pick a pixel in the loupe) to hear a warm, ambient harmonic bell chime tuned to that exact color's pitch (from 220Hz C4 up to 523Hz C5).

### 2. 👁️ Vision Accessibility & Color Blindness Simulator
Simulate how the sampled color and gradients appear to individuals with color vision deficiencies:
* **Protanopia** (L-cone deficiency / Red-blind, ~1% of males)
* **Deuteranopia** (M-cone deficiency / Green-blind, ~5% of males)
* **Tritanopia** (S-cone deficiency / Blue-blind, rare)
* **Achromatopsia** (Monochrome / Total color blindness)
* Shows transformed swatches, simulated hex codes, and the perceived color name.

### 3. 💻 Multi-Platform Developer Code Generator
* **Tailwind CSS v3 / v4**: Maps colors to the nearest Tailwind palette token (e.g. `bg-indigo-600`, `text-indigo-600`) as well as arbitrary value syntax (`bg-[#4F46E5]`).
* **CSS Custom Properties**: Generates semantic CSS variables (`--color-cerulean: #02A4D3;`).
* **SwiftUI Code**: Generates normalized `Color(red: ..., green: ..., blue: ...)`.
* **Flutter Code**: Generates `Color(0xFF4F46E5)`.

### 4. 🧠 Psychological Archetype & Cultural Resonance
* Provides an insightful psychological profile for every color:
  * Archetype (e.g. *The Anchor*, *The Catalyst*, *The Illuminator*, *The Equilibrium*)
  * Emotional resonance & subconscious perception
  * UI/UX interface design recommendations

---

## 🚀 How to Install in Microsoft Edge

1. Open **Microsoft Edge**.
2. In the address bar, navigate to:
   ```
   edge://extensions
   ```
3. Enable the **"Developer mode"** toggle in the left sidebar (or bottom-left toggle).
4. Click the **"Load unpacked"** button at the top of the extensions page.
5. Select the ChromaScope folder:
   ```
   D:\AI\Projects\Extensions\ChromaScope
   ```
6. The extension is now loaded! Click the **Extensions** icon (puzzle piece) in the Edge toolbar and pin **ChromaScope** for easy access.

---

## 🧪 Testing with the Playground

Open [`d:\AI\Projects\Extensions\ChromaScope\demo\test-page.html`](file:///d:/AI/Projects/Extensions/ChromaScope/demo/test-page.html) directly in Microsoft Edge:
* Test live hover elements (buttons that change color from Blue $\to$ Cobalt, Emerald $\to$ Dark Pine, etc.).
* Press <kbd>H</kbd> while hovering to see the live **Hover State Comparison**.
* Test multi-stop linear gradients, radial mesh blends, and conic spectrums.
* Test the Chromesthesia sound synthesizer.
