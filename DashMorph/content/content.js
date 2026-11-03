// DashMorph Content Script Orchestrator
// Coordinates initialization, layout application on page load, MutationObserver, and messaging

(function () {
  if (window.__DASHMORPH_INITIALIZED__) return;
  window.__DASHMORPH_INITIALIZED__ = true;

  console.log('[DashMorph] Content script loaded on:', window.location.href);

  let mutationTimeout = null;
  let hasAppliedLayout = false;

  // Attempt to apply saved layout to page
  async function applySavedLayout() {
    try {
      const savedLayout = await window.DashMorphStorageInstance.loadLayout();
      if (!savedLayout || !savedLayout.containers || savedLayout.containers.length === 0) {
        return false;
      }

      const count = window.DashMorphDragEngineInstance.applyLayoutOrder(savedLayout.containers);
      if (count > 0) {
        hasAppliedLayout = true;
        console.log(`[DashMorph] Successfully restored layout with ${count} rearranged cards from localStorage.`);
        
        // Update badge
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', cardCount: count }).catch(() => {});
        }
        return true;
      }
    } catch (e) {
      console.warn('[DashMorph] Error applying saved layout:', e);
    }
    return false;
  }

  // MutationObserver for dynamic SPAs (React, Vue, Vite dashboards)
  function initSPAObserver() {
    const observer = new MutationObserver((mutations) => {
      // Ignore mutations originating from DashMorph itself
      let hasSignificantMutation = false;
      for (const m of mutations) {
        if (m.target && (m.target.closest?.('#dashmorph-hud-root, .dashmorph-ignore, [data-dashmorph-ui]'))) {
          continue;
        }
        if (m.addedNodes.length > 0) {
          hasSignificantMutation = true;
          break;
        }
      }

      if (!hasSignificantMutation) return;

      // Debounce re-application so we don't spam during component renders
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => {
        applySavedLayout();
        window.DashMorphHUDInstance?.updateStats();
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Message listener from popup and background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'TOGGLE_REARRANGE_MODE') {
        window.DashMorphHUDInstance?.toggleRearrangeMode();
        sendResponse({ success: true, active: window.DashMorphHUDInstance?.isRearrangeActive });
      } else if (request.action === 'RESET_LAYOUT') {
        window.DashMorphStorageInstance.clearLayout().then(() => {
          window.location.reload();
        });
        sendResponse({ success: true });
      } else if (request.action === 'GET_STATUS') {
        const containers = window.DashMorphDetectorInstance?.detectContainers() || [];
        const cardCount = containers.reduce((acc, c) => acc + c.cards.length, 0);
        window.DashMorphStorageInstance.loadLayout().then(saved => {
          sendResponse({
            success: true,
            isRearrangeActive: !!window.DashMorphHUDInstance?.isRearrangeActive,
            containerCount: containers.length,
            cardCount,
            hasSavedLayout: !!saved,
            savedAt: saved?.savedAt || null
          });
        });
        return true; // Keep channel open for async response
      }
      return true;
    });
  }

  // Bootstrap when DOM is ready
  function init() {
    // 1. Initial attempt to apply saved layout
    applySavedLayout();

    // 2. Setup SPA observer for delayed rendering
    initSPAObserver();

    // 3. Retry after 1s for slow-hydrating dashboards
    setTimeout(() => {
      if (!hasAppliedLayout) {
        applySavedLayout();
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
