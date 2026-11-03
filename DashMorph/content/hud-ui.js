// DashMorph HUD UI Component
// Injected floating HUD widget isolated inside Shadow DOM for zero-collision styling

class DashMorphHUD {
  constructor() {
    this.container = null;
    this.shadow = null;
    this.isExpanded = false;
    this.isRearrangeActive = false;
    this.hiddenCards = [];
    this.toastTimer = null;

    this.init();
  }

  init() {
    if (document.getElementById('dashmorph-hud-root')) return;

    this.container = document.createElement('div');
    this.container.id = 'dashmorph-hud-root';
    this.container.className = 'dashmorph-ignore';
    this.container.setAttribute('data-dashmorph-ui', 'true');

    // Attach Shadow DOM for style encapsulation
    this.shadow = this.container.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = this.renderTemplate();

    document.body.appendChild(this.container);

    this.bindEvents();
    this.updateStats();
  }

  renderTemplate() {
    return `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          user-select: none;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* Floating Pill Button */
        .dm-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 9999px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.2);
          cursor: pointer;
          border: 1px solid rgba(129, 140, 248, 0.3);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dm-pill:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 14px 28px -5px rgba(79, 70, 229, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
          border-color: rgba(165, 180, 252, 0.5);
        }

        .dm-pill-icon {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dm-pill-icon svg {
          width: 13px;
          height: 13px;
          fill: white;
        }

        .dm-pill-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .dm-pill-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.15);
          color: #c7d2fe;
          letter-spacing: 0.05em;
        }

        .dm-pill-badge.active {
          background: #10b981;
          color: #ffffff;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        /* Expanded Floating Card */
        .dm-panel {
          display: none;
          position: absolute;
          bottom: 52px;
          right: 0;
          width: 330px;
          background: rgba(15, 23, 42, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
          color: #f1f5f9;
          overflow: hidden;
          animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dm-panel.open {
          display: block;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .dm-header {
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .dm-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dm-header-title {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
        }

        .dm-header-subtitle {
          font-size: 11px;
          color: #94a3b8;
          max-width: 170px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dm-close-btn {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
        }
        .dm-close-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .dm-body {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Rearrange Switch Row */
        .dm-toggle-row {
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.25);
          padding: 12px 14px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dm-toggle-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dm-toggle-title {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
        }

        .dm-toggle-hint {
          font-size: 10px;
          color: #a5b4fc;
        }

        /* Switch Toggle */
        .dm-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .dm-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .dm-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #334155;
          transition: 0.25s;
          border-radius: 24px;
        }

        .dm-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.25s;
          border-radius: 50%;
        }

        input:checked + .dm-slider {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
        }

        input:checked + .dm-slider:before {
          transform: translateX(20px);
        }

        /* Info Stats */
        .dm-stats-card {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }

        .dm-stats-label {
          color: #94a3b8;
        }

        .dm-stats-val {
          color: #38bdf8;
          font-weight: 600;
        }

        /* Action Buttons Grid */
        .dm-btn-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .dm-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }

        .dm-btn-secondary {
          background: rgba(255, 255, 255, 0.07);
          color: #e2e8f0;
          border-color: rgba(255, 255, 255, 0.1);
        }
        .dm-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        .dm-btn-primary {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: #ffffff;
        }
        .dm-btn-primary:hover {
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        .dm-btn-danger {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .dm-btn-danger:hover {
          background: rgba(239, 68, 68, 0.25);
          color: #ffffff;
        }

        /* Unhide drawer */
        .dm-unhide-btn {
          display: none;
          background: rgba(245, 158, 11, 0.15);
          color: #fde68a;
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 10px;
          padding: 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
        }
        .dm-unhide-btn.visible {
          display: block;
        }

        /* Toast Alert */
        .dm-toast {
          position: fixed;
          bottom: 84px;
          right: 24px;
          background: #0f172a;
          color: #f8fafc;
          border: 1px solid #3b82f6;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 500;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dm-toast.active {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
      </style>

      <!-- Pill Button -->
      <div class="dm-pill" id="dm-pill-btn" title="DashMorph - Drag & Drop Layout Studio">
        <div class="dm-pill-icon">
          <svg viewBox="0 0 24 24"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm-9 9h7v7H4v-7zm9 0h7v7h-7v-7z"/></svg>
        </div>
        <span class="dm-pill-title">DashMorph</span>
        <span class="dm-pill-badge" id="dm-mode-badge">Edit Off</span>
      </div>

      <!-- Expanded Panel -->
      <div class="dm-panel" id="dm-panel">
        <div class="dm-header">
          <div class="dm-header-left">
            <div class="dm-pill-icon">
              <svg viewBox="0 0 24 24"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm-9 9h7v7H4v-7zm9 0h7v7h-7v-7z"/></svg>
            </div>
            <div>
              <div class="dm-header-title">DashMorph Studio</div>
              <div class="dm-header-subtitle" id="dm-page-url">${window.location.host + window.location.pathname}</div>
            </div>
          </div>
          <button type="button" class="dm-close-btn" id="dm-close-btn" title="Close Panel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="dm-body">
          <!-- Big Toggle -->
          <div class="dm-toggle-row">
            <div class="dm-toggle-label">
              <span class="dm-toggle-title">Rearrange Mode</span>
              <span class="dm-toggle-hint">Drag cards to preview layout (Alt+Shift+D)</span>
            </div>
            <label class="dm-switch">
              <input type="checkbox" id="dm-toggle-input">
              <span class="dm-slider"></span>
            </label>
          </div>

          <!-- Stats -->
          <div class="dm-stats-card">
            <span class="dm-stats-label">Detected Cards & Containers</span>
            <span class="dm-stats-val" id="dm-stats-val">Scanning...</span>
          </div>

          <!-- Hidden Cards Notice -->
          <button type="button" class="dm-unhide-btn" id="dm-unhide-btn">
            👁️ Restore <span id="dm-hidden-count">0</span> hidden cards
          </button>

          <!-- Action Buttons -->
          <div class="dm-btn-grid">
            <button type="button" class="dm-btn dm-btn-secondary" id="dm-pick-btn" title="Pick any container or card manually">
              🎯 Pick Element
            </button>
            <button type="button" class="dm-btn dm-btn-primary" id="dm-save-btn" title="Save current arrangement">
              💾 Save Now
            </button>
          </div>

          <button type="button" class="dm-btn dm-btn-danger" id="dm-reset-btn" style="width: 100%;" title="Reset this page to original layout">
            🔄 Reset to Default Layout
          </button>
        </div>
      </div>

      <!-- Toast Alert -->
      <div class="dm-toast" id="dm-toast">
        <span id="dm-toast-msg">Layout updated & saved</span>
      </div>
    `;
  }

  bindEvents() {
    const pill = this.shadow.getElementById('dm-pill-btn');
    const panel = this.shadow.getElementById('dm-panel');
    const closeBtn = this.shadow.getElementById('dm-close-btn');
    const toggleInput = this.shadow.getElementById('dm-toggle-input');
    const saveBtn = this.shadow.getElementById('dm-save-btn');
    const resetBtn = this.shadow.getElementById('dm-reset-btn');
    const pickBtn = this.shadow.getElementById('dm-pick-btn');
    const unhideBtn = this.shadow.getElementById('dm-unhide-btn');

    // Toggle panel
    pill.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      panel.classList.toggle('open', this.isExpanded);
      if (this.isExpanded) this.updateStats();
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isExpanded = false;
      panel.classList.remove('open');
    });

    // Toggle rearrange mode
    toggleInput.addEventListener('change', (e) => {
      this.setRearrangeMode(e.target.checked);
    });

    // Save button
    saveBtn.addEventListener('click', async () => {
      await window.DashMorphDragEngineInstance?.triggerAutoSave();
      this.showToast('✅ Layout explicitly saved to localStorage!');
    });

    // Reset button
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset this page layout back to its default arrangement?')) {
        await window.DashMorphStorageInstance.clearLayout();
        this.showToast('🔄 Layout cleared! Reloading to restore default...');
        setTimeout(() => window.location.reload(), 600);
      }
    });

    // Pick element button
    pickBtn.addEventListener('click', () => {
      this.showToast('🎯 Click any container or card to make it draggable (Esc to cancel)');
      window.DashMorphDetectorInstance.startPicker((pickedEl) => {
        const parent = pickedEl.parentElement;
        if (parent) {
          const cards = Array.from(parent.children).filter(c => c.nodeType === Node.ELEMENT_NODE);
          window.DashMorphDragEngineInstance.enableRearrangeMode([{
            element: parent,
            selector: window.DashMorphStorageInstance.getContainerSelector(parent),
            cards
          }]);
          this.setRearrangeMode(true);
          this.showToast('✨ Custom container selected! Cards are now draggable.');
        }
      });
    });

    // Restore hidden cards button
    unhideBtn.addEventListener('click', () => {
      document.querySelectorAll('.dashmorph-hidden').forEach(el => {
        el.style.display = '';
        el.classList.remove('dashmorph-hidden');
      });
      window.DashMorphDragEngineInstance.triggerAutoSave();
      this.updateHiddenCount();
      this.showToast('👁️ All hidden cards restored!');
    });

    // Global keyboard shortcut: Alt+Shift+D
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        this.toggleRearrangeMode();
      }
    });
  }

  toggleRearrangeMode() {
    const toggleInput = this.shadow.getElementById('dm-toggle-input');
    const newState = !this.isRearrangeActive;
    if (toggleInput) toggleInput.checked = newState;
    this.setRearrangeMode(newState);
  }

  setRearrangeMode(active) {
    this.isRearrangeActive = active;
    const badge = this.shadow.getElementById('dm-mode-badge');
    const toggleInput = this.shadow.getElementById('dm-toggle-input');

    if (toggleInput) toggleInput.checked = active;

    if (active) {
      if (badge) {
        badge.innerText = 'Edit ON';
        badge.classList.add('active');
      }
      const containers = window.DashMorphDetectorInstance.detectContainers();
      window.DashMorphDragEngineInstance.enableRearrangeMode(containers);
      this.showToast('⚡ Rearrange Mode ON: Drag cards to new positions');
      this.updateStats();
    } else {
      if (badge) {
        badge.innerText = 'Edit Off';
        badge.classList.remove('active');
      }
      window.DashMorphDragEngineInstance.disableRearrangeMode();
      this.showToast('🔒 Rearrange Mode OFF: Layout locked');
    }
  }

  updateStats() {
    const containers = window.DashMorphDetectorInstance?.detectContainers() || [];
    const totalCards = containers.reduce((acc, c) => acc + c.cards.length, 0);
    const statsEl = this.shadow.getElementById('dm-stats-val');
    if (statsEl) {
      statsEl.innerText = `${containers.length} containers • ${totalCards} cards`;
    }
    this.updateHiddenCount();
  }

  updateHiddenCount() {
    const hiddenEls = document.querySelectorAll('.dashmorph-hidden');
    const unhideBtn = this.shadow.getElementById('dm-unhide-btn');
    const countEl = this.shadow.getElementById('dm-hidden-count');
    if (unhideBtn && countEl) {
      countEl.innerText = hiddenEls.length;
      if (hiddenEls.length > 0) {
        unhideBtn.classList.add('visible');
      } else {
        unhideBtn.classList.remove('visible');
      }
    }
  }

  showToast(message) {
    const toast = this.shadow.getElementById('dm-toast');
    const msg = this.shadow.getElementById('dm-toast-msg');
    if (!toast || !msg) return;

    msg.innerText = message;
    toast.classList.add('active');

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('active');
    }, 2800);
  }
}

// Export singleton
window.DashMorphHUDInstance = new DashMorphHUD();
