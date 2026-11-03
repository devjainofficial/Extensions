# ⚡ DashMorph - Browser Dashboard & Card Rearranger

> **Drag, drop, preview, and persist custom card layouts on any dashboard or web application.**

DashMorph is a Chromium browser extension (Chrome, Edge, Brave, Opera) that allows you to freely rearrange dashboard cards, metrics, and widgets to see how different layouts look, and saves your preferred arrangement directly into `localStorage` and `chrome.storage.local`. When you revisit or refresh the page, DashMorph automatically re-orders everything exactly as you customized it!

---

## ✨ Features

- 🎯 **Drag-and-Drop Rearrangement**: Reorganize dashboard cards, chart widgets, and metric panels with fluid 60fps drag handles and real-time drop slot indicators.
- 💾 **Dual-Storage Persistence**: Saves your custom arrangements automatically to both `window.localStorage` (scoped by origin & path) and `chrome.storage.local`.
- 🔄 **Auto-Arrange on Revisit**: Re-orders cards instantly upon page load or reload without layout flicker.
- ⚡ **SPA & Vite / React / Vue Compatible**: Built with a debounced `MutationObserver` to seamlessly handle dashboards that render data asynchronously after API calls.
- 🛡️ **Zero CSS Collision (Shadow DOM HUD)**: The floating control studio widget is encapsulated inside Shadow DOM so website styles never conflict with it.
- ⌨️ **Quick Toggle Shortcut**: Press `Alt + Shift + D` anytime to toggle Rearrange Mode on/off.
- 👁️ **Hide & Collapse Cards**: Minimize individual cards (`▾`) or temporarily hide unwanted widgets (`✕`) with a one-click restore drawer.
- 🎯 **Smart Element Picker**: If a custom or non-standard container isn't auto-detected, use the crosshair picker to click and make any container draggable.
- 📦 **Backup, Export & Import**: Export all your custom layouts as a `.json` file to backup or share across devices.
- 🖥️ **Pixel-Perfect Demo Included**: Includes a replica of the LogMomento dashboard (`localhost:5173/timetrack?user=7`) for instant testing!

---

## 🚀 Quick Start & Installation

### Step 1: Open Extension Settings in Browser
- **Google Chrome**: Navigate to `chrome://extensions/`
- **Microsoft Edge**: Navigate to `edge://extensions/`
- **Brave Browser**: Navigate to `brave://extensions/`

### Step 2: Enable Developer Mode
- Turn on the **"Developer mode"** toggle in the top-right corner.

### Step 3: Load Unpacked Extension
1. Click the **"Load unpacked"** button.
2. Select the DashMorph folder:
   ```
   d:\AI\Projects\Extensions\DashMorph
   ```
3. DashMorph is now installed and active!

---

## 🧪 Testing with the Included Demo Dashboard

DashMorph comes with a built-in replica of the **LogMomento** time-tracking dashboard:

1. Open `demo/index.html` in your browser:
   - Double-click `d:\AI\Projects\Extensions\DashMorph\demo\index.html`
   - Or start a local server:
     ```powershell
     cd d:\AI\Projects\Extensions\DashMorph
     python -m http.server 5173
     ```
     and open `http://localhost:5173/demo/index.html`
2. You will see the floating **`[ ⚡ DashMorph ]`** pill at the bottom-right corner.
3. Click the pill or press **`Alt + Shift + D`** to activate Rearrange Mode.
4. Drag any card:
   - Swap the **"Breakdown"** card and the **"3h 10m"** card!
   - Move the **24-hour timeline strip** above the metric cards!
   - Move the **activity screenshot gallery** to the top!
5. Notice the toast: *"✨ Layout auto-saved to localStorage!"*
6. Refresh the page (`F5`) — notice how the dashboard instantly auto-arranges itself to your chosen layout!
7. Click **"Reset to Default Layout"** whenever you want to return to original.

---

## 🛠️ Project Structure

```
d:\AI\Projects\Extensions\DashMorph/
├── manifest.json             # Manifest V3 extension configuration
├── icons/                    # App icons (16, 32, 48, 128 px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── generate.ps1
├── background/
│   └── service-worker.js     # Background worker for shortcuts & badge updates
├── content/
│   ├── storage-manager.js    # Fingerprinting & localStorage / chrome.storage sync
│   ├── card-detector.js      # Smart grid/flex & card heuristic detection engine
│   ├── drag-engine.js        # Drag handles, ghost preview, drop slot & DOM reorder
│   ├── hud-ui.js             # Shadow DOM floating control studio & toasts
│   ├── content.js            # SPA MutationObserver & page bootstrap
│   └── content.css           # Dragging, ghost, and drop slot styling
├── popup/
│   ├── popup.html            # Extension action popup
│   ├── popup.css             # Popup UI styling
│   └── popup.js              # Active tab status, backup & site layout manager
└── demo/
    ├── index.html            # LogMomento dashboard replica testbed
    └── demo.css              # Demo dashboard styles
```

---

## 🧠 How DashMorph Persists Layouts

Traditional DOM reordering extensions break on modern web frameworks (React, Vue, Svelte) because elements are recreated on render. DashMorph solves this using a **multi-factor structural and semantic fingerprinting algorithm**:

1. **Deterministic Fingerprints**: For each card, DashMorph captures:
   - Heading/Title text (`h1`-`h6`, `.title`, `.header`)
   - Text sample preview
   - Stable data attributes (`data-card-id`, `data-testid`, etc.)
   - Semantic CSS classes (ignoring dynamic hash classes)
   - Relative structural index
2. **Dual Sync**:
   - `window.localStorage`: Keyed by `dashmorph_layout:https://example.com/path`
   - `chrome.storage.local`: Indexed by page URL with backup metadata
3. **SPA Observer**:
   - A debounced `MutationObserver` watches for asynchronous DOM updates (e.g. when React loads data from an API) and smoothly re-orders elements without triggering mutation loops or layout thrashing.
