/**
 * content.js
 * Core engine for YTMusic Floating Lyrics Overlay.
 * Manages Document Picture-in-Picture window, DOM hooks, and real-time karaoke synchronization.
 */

(function () {
  'use strict';

  if (window.__YTMusicLyricsOverlayLoaded) return;
  window.__YTMusicLyricsOverlayLoaded = true;

  console.log('[YTMusicLyrics] Extension script initialized');

  const lyricsService = new window.__LyricsService();

  let pipWindow = null;
  let currentTrack = { title: '', artist: '', duration: 0, artUrl: '' };
  let currentLyrics = null;
  let activeLineIndex = -1;
  let lineElements = [];
  let syncTimer = null;
  let trackCheckTimer = null;

  // Settings with defaults
  let bgOpacity = 0.85;
  let fontSize = 20;
  let textAlign = 'center';
  let displayMode = 'normal';
  let timeOffset = 0.0;

  // Load saved preferences
  if (chrome?.storage?.local) {
    chrome.storage.local.get(['bgOpacity', 'fontSize', 'textAlign', 'displayMode', 'timeOffset'], (data) => {
      if (typeof data.bgOpacity === 'number') bgOpacity = data.bgOpacity;
      if (data.fontSize) fontSize = data.fontSize;
      if (data.textAlign) textAlign = data.textAlign;
      if (data.displayMode) displayMode = data.displayMode;
      if (typeof data.timeOffset === 'number') timeOffset = data.timeOffset;
    });
  }

  // --- Embedded Clean CSS (Immune to CSP blocks & eliminates white screen) ---
  const PIP_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    html, body {
      width: 100%;
      height: 100%;
      background: #0a0a0f !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      overflow: hidden;
    }
    #app-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      position: relative;
      background: rgba(12, 12, 18, var(--bg-opacity, 0.85));
      backdrop-filter: blur(28px);
      transition: background 0.3s ease;
    }
    #bg-art-blur {
      position: absolute;
      top: -30px; left: -30px; right: -30px; bottom: -30px;
      background-size: cover;
      background-position: center;
      filter: blur(50px) brightness(0.25);
      opacity: 0.7;
      z-index: 0;
      transition: background-image 0.8s ease;
    }
    header {
      position: relative;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(10, 10, 15, 0.65);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      transition: opacity 0.3s ease;
    }
    .track-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }
    .album-thumb {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      object-fit: cover;
      background: #222;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      flex-shrink: 0;
    }
    .title-artist {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }
    .track-title {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #fff;
    }
    .track-artist {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.65);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .icon-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      border-radius: 6px;
      padding: 5px 9px;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .icon-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.05);
    }
    .drawer {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(14, 14, 22, 0.96);
      backdrop-filter: blur(24px);
      z-index: 100;
      display: flex;
      flex-direction: column;
      transform: translateY(-100%);
      transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
      overflow-y: auto;
    }
    .drawer.open { transform: translateY(0); }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      font-size: 14px;
      font-weight: 600;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .drawer-body {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .setting-group { display: flex; flex-direction: column; gap: 6px; }
    .setting-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
    }
    .val-badge {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      color: #ff0055;
      font-weight: 600;
    }
    .clean-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      outline: none;
    }
    .clean-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #ff0055;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(255, 0, 85, 0.7);
    }
    .mode-chips { display: flex; gap: 8px; }
    .chip-btn {
      flex: 1;
      padding: 7px 10px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .chip-btn:hover { background: rgba(255, 255, 255, 0.18); }
    .chip-btn.active {
      background: #ff0055;
      border-color: #ff0055;
      box-shadow: 0 2px 8px rgba(255, 0, 85, 0.4);
    }
    .search-box { display: flex; gap: 6px; }
    .search-box input {
      flex: 1;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
    }
    .search-box input:focus { border-color: #ff0055; }
    .pin-box {
      background: rgba(255, 0, 85, 0.08);
      border: 1px solid rgba(255, 0, 85, 0.25);
      border-radius: 8px;
      padding: 10px 12px;
    }
    .pin-box kbd {
      background: #333;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 10px;
    }
    #lyrics-container {
      flex: 1;
      position: relative;
      z-index: 10;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 160px 18px;
      scroll-behavior: smooth;
      text-align: var(--text-align, center);
    }
    #lyrics-container::-webkit-scrollbar { width: 4px; }
    #lyrics-container::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
    }
    .lyric-line {
      font-size: var(--font-size, 20px);
      line-height: 1.6;
      font-weight: 500;
      padding: 8px 14px;
      margin: 4px 0;
      border-radius: 10px;
      color: rgba(255, 255, 255, 0.32);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .lyric-line:hover {
      color: rgba(255, 255, 255, 0.75);
      background: rgba(255, 255, 255, 0.04);
    }
    .lyric-line.active {
      color: #ffffff;
      font-weight: 700;
      font-size: calc(var(--font-size, 20px) * 1.18);
      text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
      transform: scale(1.02);
      background: rgba(255, 255, 255, 0.08);
    }
    #app-container.mode-theater .lyric-line.active {
      font-size: calc(var(--font-size, 20px) * 1.35);
      text-shadow: 0 0 32px rgba(255, 255, 255, 0.7);
    }
    #app-container.mode-ticker #lyrics-container { padding: 30px 16px; }
    #app-container.mode-ticker .lyric-line:not(.active) { display: none; }
    #app-container.mode-ticker .lyric-line.active {
      font-size: calc(var(--font-size, 20px) * 1.25);
      background: transparent;
    }
    .status-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
      text-align: center;
      gap: 12px;
    }
    .pulse-icon {
      font-size: 32px;
      animation: pulse 1.5s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.6; }
      50% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.6; }
    }
    footer {
      position: relative;
      z-index: 20;
      display: flex;
      flex-direction: column;
      padding: 8px 16px;
      background: rgba(10, 10, 15, 0.65);
      backdrop-filter: blur(16px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      gap: 6px;
      transition: opacity 0.3s ease;
    }
    .progress-bar-bg {
      width: 100%;
      height: 3px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: #ff0055;
      border-radius: 2px;
      transition: width 0.1s linear;
    }
    .footer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .playback-btns { display: flex; align-items: center; gap: 6px; }
    .ctrl-btn {
      background: none; border: none; color: #fff;
      cursor: pointer; font-size: 14px; padding: 4px 6px;
      border-radius: 6px; opacity: 0.85; transition: all 0.15s ease;
    }
    .ctrl-btn:hover { opacity: 1; background: rgba(255, 255, 255, 0.12); }
    .play-btn {
      font-size: 16px; background: #ffffff; color: #000;
      width: 28px; height: 28px; border-radius: 50%; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s ease;
    }
    .play-btn:hover { background: #ff0055; color: #fff; transform: scale(1.08); }
    .time-and-source {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .source-tag {
      background: rgba(255, 255, 255, 0.08);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 9px;
      color: #00ff88;
      margin-left: 6px;
    }
    #app-container.idle-hidden header,
    #app-container.idle-hidden footer {
      opacity: 0;
      pointer-events: none;
    }
  `;

  // --- Embedded Clean HTML Template (Instant rendering, 0ms latency) ---
  const PIP_HTML = `
    <div id="app-container">
      <div id="bg-art-blur"></div>

      <!-- Minimalist Header -->
      <header id="pip-header">
        <div class="track-meta">
          <img id="album-art" class="album-thumb" src="" alt="">
          <div class="title-artist">
            <div id="track-title" class="track-title">Waiting for YouTube Music...</div>
            <div id="track-artist" class="track-artist">Play any track</div>
          </div>
        </div>
        <div class="header-actions">
          <button id="settings-toggle-btn" class="icon-btn" title="Customize Opacity & Overlay Options">⚙️</button>
        </div>
      </header>

      <!-- Settings Drawer -->
      <div id="settings-drawer" class="drawer">
        <div class="drawer-header">
          <span>Overlay Settings</span>
          <button id="drawer-close-btn" class="icon-btn">✕</button>
        </div>

        <div class="drawer-body">
          <div class="setting-group">
            <div class="setting-label">
              <span>Background Opacity (Ghost Overlay)</span>
              <span id="opacity-val-label" class="val-badge">85%</span>
            </div>
            <input type="range" id="opacity-slider" min="10" max="100" value="85" class="clean-slider">
          </div>

          <div class="setting-group">
            <div class="setting-label">
              <span>Text Size</span>
              <span id="font-val-label" class="val-badge">20px</span>
            </div>
            <input type="range" id="font-slider" min="14" max="36" value="20" class="clean-slider">
          </div>

          <div class="setting-group">
            <div class="setting-label">Display Style</div>
            <div class="mode-chips">
              <button class="chip-btn active" data-mode="normal">🪟 Normal</button>
              <button class="chip-btn" data-mode="theater">📺 Fullscreen</button>
              <button class="chip-btn" data-mode="ticker">💬 Subtitles</button>
            </div>
          </div>

          <div class="setting-group">
            <div class="setting-label">Text Alignment</div>
            <div class="mode-chips">
              <button id="align-center-btn" class="chip-btn active">Center</button>
              <button id="align-left-btn" class="chip-btn">Left</button>
            </div>
          </div>

          <div class="setting-group">
            <div class="setting-label">Search / Fix Song Title</div>
            <div class="search-box">
              <input type="text" id="manual-query-input" placeholder="e.g. Kesariya or Beggin...">
              <button id="manual-search-btn" class="chip-btn active">Find</button>
            </div>
          </div>

          <div class="setting-group pin-box">
            <div style="font-weight: 600; color: #ff0055; margin-bottom: 4px;">📌 Keep on all Virtual Desktops:</div>
            <div style="font-size: 11px; opacity: 0.85; line-height: 1.4;">
              Press <kbd>Win</kbd> + <kbd>Tab</kbd> → Right-click this window → <strong>"Show this window on all desktops"</strong>.
            </div>
          </div>
        </div>
      </div>

      <!-- Lyrics Container -->
      <main id="lyrics-container">
        <div class="status-state">
          <div class="pulse-icon">🎵</div>
          <div>Playing on YouTube Music...</div>
        </div>
      </main>

      <!-- Minimalist Bottom Controls -->
      <footer id="pip-footer">
        <div class="progress-bar-bg" id="progress-bar-bg">
          <div class="progress-bar-fill" id="progress-bar-fill"></div>
        </div>

        <div class="footer-row">
          <div class="playback-btns">
            <button id="prev-btn" class="ctrl-btn" title="Previous">⏮</button>
            <button id="play-pause-btn" class="play-btn" title="Play / Pause">▶</button>
            <button id="next-btn" class="ctrl-btn" title="Next">⏭</button>
          </div>

          <div class="time-and-source">
            <span id="current-time-label">0:00</span>
            <span>/</span>
            <span id="duration-label">0:00</span>
            <span id="source-badge" class="source-tag">Auto-Sync</span>
          </div>
        </div>
      </footer>
    </div>
  `;

  // --- Track Detection ---

  function extractCurrentTrack() {
    const video = document.querySelector('video');

    // 1. YouTube Music Player Bar
    const titleEl = document.querySelector('ytmusic-player-bar .title');
    let title = titleEl ? titleEl.innerText.trim() : '';

    // 2. Media Session API
    if (!title && navigator.mediaSession?.metadata?.title) {
      title = navigator.mediaSession.metadata.title;
    }

    // 3. Document Title Fallback (e.g. "Song - Artist - YouTube Music")
    if (!title && document.title && document.title.includes(' - ')) {
      const parts = document.title.replace(' - YouTube Music', '').split(' - ');
      if (parts.length >= 2) {
        title = parts[0].trim();
      }
    }

    // Artist
    const bylineEl = document.querySelector('ytmusic-player-bar .byline a, ytmusic-player-bar .byline');
    let artist = bylineEl ? bylineEl.innerText.trim() : '';
    if (!artist && navigator.mediaSession?.metadata?.artist) {
      artist = navigator.mediaSession.metadata.artist;
    }

    // Artwork
    const thumbImg = document.querySelector('ytmusic-player-bar .thumbnail img');
    let artUrl = thumbImg ? thumbImg.src : '';
    if (!artUrl && navigator.mediaSession?.metadata?.artwork?.length) {
      artUrl = navigator.mediaSession.metadata.artwork[0].src;
    }

    const duration = video ? video.duration || 0 : 0;

    return { title, artist, artUrl, duration };
  }

  // Trigger the "LYRICS" tab in YouTube Music so lyrics load into DOM
  function ensureYTMusicLyricsTabLoaded() {
    try {
      if (lyricsService.scrapeYTMusicLyrics()) return;

      const tabs = document.querySelectorAll('ytmusic-tab-header-renderer, tp-yt-paper-tab');
      for (const tab of tabs) {
        if (tab.innerText && tab.innerText.trim().toUpperCase() === 'LYRICS') {
          tab.click();
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  async function checkForTrackChange(force = false) {
    const detected = extractCurrentTrack();
    if (!detected.title) return;

    if (force || detected.title !== currentTrack.title || detected.artist !== currentTrack.artist) {
      console.log(`[YTMusicLyrics] Active Track: ${detected.title} by ${detected.artist}`);
      currentTrack = detected;
      activeLineIndex = -1;
      lineElements = [];

      updatePiPTrackMeta();
      renderLoadingLyrics();

      // Trigger YouTube Music native tab in background
      ensureYTMusicLyricsTabLoaded();

      // Fetch lyrics
      setTimeout(async () => {
        currentLyrics = await lyricsService.getLyrics(detected.title, detected.artist, detected.duration);
        renderLyricsInPiP();
      }, 350);
    }
  }

  // --- Document Picture-in-Picture Engine ---

  async function togglePiPOverlay() {
    if (pipWindow) {
      pipWindow.close();
      return;
    }

    if (!('documentPictureInPicture' in window)) {
      alert('Document Picture-in-Picture is not supported in this browser version. Please update Chrome/Edge to version 116+.');
      return;
    }

    try {
      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 440,
        height: 600,
      });

      // Synchronously set dark background to eliminate blank white window!
      pipWindow.document.documentElement.style.background = '#0a0a0f';
      pipWindow.document.body.style.background = '#0a0a0f';

      // Inject clean HTML template synchronously
      pipWindow.document.body.innerHTML = PIP_HTML;

      // Inject clean CSS directly into a <style> tag (immune to CSP blocks!)
      const styleEl = pipWindow.document.createElement('style');
      styleEl.id = 'pip-embedded-css';
      styleEl.textContent = PIP_CSS;
      pipWindow.document.head.appendChild(styleEl);

      // Apply initial styling & saved preferences
      applyPreferencesToPiP();

      // Mark button active in player bar
      updateBarButtonState(true);

      // Setup PiP event handlers
      setupPiPEvents();

      // Trigger YouTube Music lyrics tab
      ensureYTMusicLyricsTabLoaded();

      // Render current track & lyrics
      currentTrack = extractCurrentTrack();
      updatePiPTrackMeta();

      if (currentTrack.title) {
        renderLoadingLyrics();
        lyricsService.getLyrics(currentTrack.title, currentTrack.artist, currentTrack.duration).then((lyrics) => {
          currentLyrics = lyrics;
          renderLyricsInPiP();
        });
      }

      // Start real-time sync loop (runs as song moves!)
      startSyncLoop();

      // Cleanup when PiP window closes
      pipWindow.addEventListener('pagehide', () => {
        console.log('[YTMusicLyrics] PiP window closed');
        pipWindow = null;
        stopSyncLoop();
        updateBarButtonState(false);
      });

    } catch (err) {
      console.error('[YTMusicLyrics] Failed to open Document Picture-in-Picture:', err);
      if (err.name === 'NotAllowedError') {
        showToast('Press <kbd>Alt</kbd> + <kbd>L</kbd> or click the mic button on the player bar to open lyrics!');
        const btn = document.getElementById('ytm-lyrics-overlay-btn');
        if (btn) {
          btn.classList.add('btn-pulse-alert');
          setTimeout(() => btn.classList.remove('btn-pulse-alert'), 3000);
        }
      }
    }
  }

  function applyPreferencesToPiP() {
    if (!pipWindow) return;
    const doc = pipWindow.document;
    const root = doc.documentElement;
    const appContainer = doc.getElementById('app-container');

    root.style.setProperty('--bg-opacity', bgOpacity);
    root.style.setProperty('--font-size', `${fontSize}px`);
    root.style.setProperty('--text-align', textAlign);

    if (appContainer) {
      appContainer.classList.remove('mode-theater', 'mode-ticker');
      if (displayMode === 'theater') appContainer.classList.add('mode-theater');
      else if (displayMode === 'ticker') appContainer.classList.add('mode-ticker');
    }
  }

  function setupPiPEvents() {
    if (!pipWindow) return;
    const doc = pipWindow.document;
    const appContainer = doc.getElementById('app-container');
    const drawer = doc.getElementById('settings-drawer');

    // Media Controls
    doc.getElementById('play-pause-btn')?.addEventListener('click', togglePlayback);
    doc.getElementById('prev-btn')?.addEventListener('click', playPrevious);
    doc.getElementById('next-btn')?.addEventListener('click', playNext);

    // Progress bar seeking
    const progressBar = doc.getElementById('progress-bar-bg');
    progressBar?.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const video = document.querySelector('video');
      if (video && video.duration) {
        video.currentTime = ratio * video.duration;
      }
    });

    // Settings Drawer Toggle
    doc.getElementById('settings-toggle-btn')?.addEventListener('click', () => {
      drawer?.classList.toggle('open');
    });
    doc.getElementById('drawer-close-btn')?.addEventListener('click', () => {
      drawer?.classList.remove('open');
    });

    // Background Opacity Slider (Ghost Overlay to Solid)
    const opacitySlider = doc.getElementById('opacity-slider');
    const opacityLabel = doc.getElementById('opacity-val-label');
    if (opacitySlider && opacityLabel) {
      opacitySlider.value = Math.round(bgOpacity * 100);
      opacityLabel.innerText = `${Math.round(bgOpacity * 100)}%`;

      opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        bgOpacity = val / 100;
        opacityLabel.innerText = `${val}%`;
        doc.documentElement.style.setProperty('--bg-opacity', bgOpacity);
        chrome.storage?.local?.set({ bgOpacity });
      });
    }

    // Font Size Slider
    const fontSlider = doc.getElementById('font-slider');
    const fontLabel = doc.getElementById('font-val-label');
    if (fontSlider && fontLabel) {
      fontSlider.value = fontSize;
      fontLabel.innerText = `${fontSize}px`;

      fontSlider.addEventListener('input', (e) => {
        fontSize = parseInt(e.target.value, 10);
        fontLabel.innerText = `${fontSize}px`;
        doc.documentElement.style.setProperty('--font-size', `${fontSize}px`);
        chrome.storage?.local?.set({ fontSize });
      });
    }

    // Display Style Mode Chips
    doc.querySelectorAll('.chip-btn[data-mode]').forEach(btn => {
      const mode = btn.dataset.mode;
      if (mode === displayMode) btn.classList.add('active');
      else btn.classList.remove('active');

      btn.addEventListener('click', () => {
        doc.querySelectorAll('.chip-btn[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        displayMode = mode;
        applyPreferencesToPiP();
        chrome.storage?.local?.set({ displayMode });
      });
    });

    // Text Alignment
    const alignCenterBtn = doc.getElementById('align-center-btn');
    const alignLeftBtn = doc.getElementById('align-left-btn');
    if (textAlign === 'left') {
      alignLeftBtn?.classList.add('active');
      alignCenterBtn?.classList.remove('active');
    }

    alignCenterBtn?.addEventListener('click', () => {
      textAlign = 'center';
      alignCenterBtn.classList.add('active');
      alignLeftBtn?.classList.remove('active');
      doc.documentElement.style.setProperty('--text-align', 'center');
      chrome.storage?.local?.set({ textAlign });
    });

    alignLeftBtn?.addEventListener('click', () => {
      textAlign = 'left';
      alignLeftBtn.classList.add('active');
      alignCenterBtn?.classList.remove('active');
      doc.documentElement.style.setProperty('--text-align', 'left');
      chrome.storage?.local?.set({ textAlign });
    });

    // Manual Song Search (e.g. for Hindi/regional songs)
    const searchInput = doc.getElementById('manual-query-input');
    const searchBtn = doc.getElementById('manual-search-btn');
    const runManualSearch = async () => {
      const q = searchInput?.value.trim();
      if (!q) return;
      drawer?.classList.remove('open');
      renderLoadingLyrics();
      currentLyrics = await lyricsService.getLyrics(q, '', currentTrack.duration);
      renderLyricsInPiP();
    };

    searchBtn?.addEventListener('click', runManualSearch);
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runManualSearch();
    });

    // Auto-Hide Controls when Mouse is Idle
    let idleTimer = null;
    const resetIdle = () => {
      appContainer?.classList.remove('idle-hidden');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!drawer?.classList.contains('open')) {
          appContainer?.classList.add('idle-hidden');
        }
      }, 3000);
    };

    doc.addEventListener('mousemove', resetIdle);
    resetIdle();
  }

  function updatePiPTrackMeta() {
    if (!pipWindow) return;
    const doc = pipWindow.document;

    const titleEl = doc.getElementById('track-title');
    const artistEl = doc.getElementById('track-artist');
    const thumbEl = doc.getElementById('album-art');
    const bgBlur = doc.getElementById('bg-art-blur');

    const cleanTitle = lyricsService.cleanTitle(currentTrack.title);
    if (titleEl) titleEl.innerText = cleanTitle || currentTrack.title || 'No track playing';
    if (artistEl) artistEl.innerText = currentTrack.artist || 'YouTube Music';
    if (thumbEl && currentTrack.artUrl) {
      thumbEl.src = currentTrack.artUrl;
      thumbEl.style.display = 'block';
    }
    if (bgBlur && currentTrack.artUrl) {
      bgBlur.style.backgroundImage = `url('${currentTrack.artUrl}')`;
    }
  }

  function renderLoadingLyrics() {
    if (!pipWindow) return;
    const container = pipWindow.document.getElementById('lyrics-container');
    const sourceBadge = pipWindow.document.getElementById('source-badge');

    if (sourceBadge) sourceBadge.innerText = 'Searching...';

    if (container) {
      const cleanTitle = lyricsService.cleanTitle(currentTrack.title);
      container.innerHTML = `
        <div class="status-state">
          <div class="pulse-icon">🔍</div>
          <div>Loading lyrics for "${escapeHtml(cleanTitle)}"...</div>
        </div>
      `;
    }
  }

  function renderLyricsInPiP() {
    if (!pipWindow) return;
    const doc = pipWindow.document;
    const container = doc.getElementById('lyrics-container');
    const sourceBadge = doc.getElementById('source-badge');
    lineElements = [];
    activeLineIndex = -1;

    if (!container) return;

    if (!currentLyrics || !currentLyrics.syncedLines || currentLyrics.syncedLines.length === 0) {
      if (sourceBadge) sourceBadge.innerText = 'No lyrics';
      container.innerHTML = `
        <div class="status-state">
          <div style="font-size: 28px;">🎙️</div>
          <div>No lyrics found for this track</div>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 6px;">
            Open ⚙️ Settings above to search or type the song title
          </div>
        </div>
      `;
      return;
    }

    if (sourceBadge) {
      sourceBadge.innerText = currentLyrics.isSynced ? 'Time-Synced' : 'Auto-Paced';
    }

    container.innerHTML = '';
    currentLyrics.syncedLines.forEach((line, index) => {
      const lineEl = doc.createElement('div');
      lineEl.className = 'lyric-line';
      lineEl.dataset.time = line.time;
      lineEl.dataset.index = index;
      lineEl.innerText = line.text || '♪';

      // Clicking any lyric line seeks playback directly!
      lineEl.addEventListener('click', () => {
        const video = document.querySelector('video');
        if (video) {
          video.currentTime = line.time;
        }
      });

      container.appendChild(lineEl);
      lineElements.push(lineEl);
    });
  }

  // --- Real-Time Karaoke Synchronization Engine ---

  function startSyncLoop() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(syncLyricsFrame, 100);
  }

  function stopSyncLoop() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  function syncLyricsFrame() {
    if (!pipWindow) return;
    const video = document.querySelector('video');
    if (!video) return;

    const doc = pipWindow.document;
    const curTime = (video.currentTime || 0) + timeOffset;
    const duration = video.duration || currentTrack.duration || 1;

    // 1. Update Progress Bar & Times
    const progressFill = doc.getElementById('progress-bar-fill');
    const curLabel = doc.getElementById('current-time-label');
    const durLabel = doc.getElementById('duration-label');
    const playBtn = doc.getElementById('play-pause-btn');

    if (progressFill) {
      const pct = Math.min(100, Math.max(0, (video.currentTime / duration) * 100));
      progressFill.style.width = `${pct}%`;
    }
    if (curLabel) curLabel.innerText = formatTime(video.currentTime);
    if (durLabel) durLabel.innerText = formatTime(duration);
    if (playBtn) playBtn.innerText = video.paused ? '▶' : '⏸';

    // 2. Karaoke Line Highlight & Smooth Auto-Scroll (Runs as song moves!)
    if (currentLyrics && currentLyrics.syncedLines && lineElements.length > 0) {
      const lines = currentLyrics.syncedLines;

      let foundIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= curTime) {
          foundIndex = i;
        } else {
          break;
        }
      }

      if (foundIndex !== activeLineIndex) {
        if (activeLineIndex >= 0 && lineElements[activeLineIndex]) {
          lineElements[activeLineIndex].classList.remove('active');
        }

        if (foundIndex >= 0 && lineElements[foundIndex]) {
          const activeEl = lineElements[foundIndex];
          activeEl.classList.add('active');

          const container = doc.getElementById('lyrics-container');
          if (container) {
            const targetY = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
            container.scrollTo({ top: targetY, behavior: 'smooth' });
          }
        }
        activeLineIndex = foundIndex;
      }
    }
  }

  // --- Media Controls ---

  function togglePlayback() {
    const video = document.querySelector('video');
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function playNext() {
    const nextBtn = document.querySelector('ytmusic-player-bar .next-button, #right-controls-buttons .next-button');
    if (nextBtn) nextBtn.click();
  }

  function playPrevious() {
    const prevBtn = document.querySelector('ytmusic-player-bar .previous-button, #right-controls-buttons .previous-button');
    if (prevBtn) prevBtn.click();
  }

  // --- Button Injection into YouTube Music Player Bar ---

  function injectOverlayButton() {
    if (document.getElementById('ytm-lyrics-overlay-btn')) return;

    const targetContainer = document.querySelector('ytmusic-player-bar .right-controls-buttons') ||
                            document.querySelector('ytmusic-player-bar #right-controls-buttons') ||
                            document.querySelector('ytmusic-player-bar');

    if (!targetContainer) return;

    const btn = document.createElement('button');
    btn.id = 'ytm-lyrics-overlay-btn';
    btn.title = 'Floating Lyrics Overlay (PiP) [Alt+L]';
    btn.setAttribute('aria-label', 'Floating Lyrics Overlay');

    btn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePiPOverlay();
    });

    targetContainer.prepend(btn);
    console.log('[YTMusicLyrics] Lyrics overlay button injected');
  }

  function updateBarButtonState(isActive) {
    const btn = document.getElementById('ytm-lyrics-overlay-btn');
    if (btn) {
      if (isActive) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  }

  function showToast(htmlMsg) {
    const existing = document.querySelector('.ytm-lyrics-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ytm-lyrics-toast';
    toast.innerHTML = `<span>🎵</span> <span>${htmlMsg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      setTimeout(() => toast.remove(), 500);
    }, 4500);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Keyboard Shortcuts & Message Listeners ---

  document.addEventListener('keydown', (e) => {
    // Alt + L to toggle lyrics PiP
    if (e.altKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      togglePiPOverlay();
    }
  });

  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'toggle_pip') {
        togglePiPOverlay();
        sendResponse({ success: true, isOpen: Boolean(pipWindow) });
      } else if (msg.action === 'get_status') {
        sendResponse({
          isOpen: Boolean(pipWindow),
          track: currentTrack,
          hasLyrics: Boolean(currentLyrics)
        });
      }
    });
  }

  // --- Init & Observers ---

  injectOverlayButton();

  trackCheckTimer = setInterval(() => {
    injectOverlayButton();
    checkForTrackChange();
  }, 1000);

})();
