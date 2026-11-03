// DashMorph Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const currentUrlEl = document.getElementById('current-url');
  const cardCountEl = document.getElementById('card-count');
  const containerCountEl = document.getElementById('container-count');
  const modeStateEl = document.getElementById('mode-state');
  const statusBadge = document.getElementById('layout-status-badge');
  const toggleBtn = document.getElementById('toggle-mode-btn');
  const toggleBtnText = document.getElementById('toggle-btn-text');
  const saveBtn = document.getElementById('save-page-btn');
  const resetBtn = document.getElementById('reset-page-btn');
  const sitesListEl = document.getElementById('sites-list');
  const savedSitesCountEl = document.getElementById('saved-sites-count');
  const exportBtn = document.getElementById('export-json-btn');
  const importBtn = document.getElementById('import-json-btn');
  const fileInput = document.getElementById('import-file-input');

  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${btn.dataset.tab}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Query active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id) {
    currentUrlEl.innerText = 'No active tab found';
    return;
  }

  try {
    const urlObj = new URL(activeTab.url);
    currentUrlEl.innerText = `${urlObj.host}${urlObj.pathname}`;
  } catch {
    currentUrlEl.innerText = activeTab.url || 'Unknown page';
  }

  // Load status from content script
  async function refreshStatus() {
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATUS' });
      if (response && response.success) {
        cardCountEl.innerText = response.cardCount || 0;
        containerCountEl.innerText = response.containerCount || 0;
        
        if (response.isRearrangeActive) {
          modeStateEl.innerText = 'ON';
          modeStateEl.style.color = '#10b981';
          toggleBtnText.innerText = 'Lock / Finish Rearrange';
        } else {
          modeStateEl.innerText = 'OFF';
          modeStateEl.style.color = '#94a3b8';
          toggleBtnText.innerText = 'Enable Rearrange Mode';
        }

        if (response.hasSavedLayout) {
          statusBadge.innerText = 'Custom Layout';
          statusBadge.className = 'site-badge saved';
        } else {
          statusBadge.innerText = 'Default';
          statusBadge.className = 'site-badge';
        }
      }
    } catch (e) {
      // Content script may not be loaded on internal chrome:// or extension pages
      cardCountEl.innerText = 'N/A';
      containerCountEl.innerText = 'N/A';
      modeStateEl.innerText = 'N/A';
      statusBadge.innerText = 'Not Injected';
    }
  }

  await refreshStatus();

  // Toggle mode button
  toggleBtn.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'TOGGLE_REARRANGE_MODE' });
      await refreshStatus();
    } catch (e) {
      alert('Could not toggle rearrange mode. Make sure this is a normal web page (not chrome://).');
    }
  });

  // Save button
  saveBtn.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'SAVE_LAYOUT' });
      await refreshStatus();
      loadSavedSites();
    } catch (e) {
      alert('Error triggering save on page.');
    }
  });

  // Reset button
  resetBtn.addEventListener('click', async () => {
    if (confirm('Reset this page back to its default layout?')) {
      try {
        await chrome.tabs.sendMessage(activeTab.id, { action: 'RESET_LAYOUT' });
        window.close();
      } catch (e) {
        alert('Error resetting layout.');
      }
    }
  });

  // Load saved sites list
  async function loadSavedSites() {
    chrome.storage.local.get('dashmorph_sites', (result) => {
      const sites = result.dashmorph_sites || {};
      const keys = Object.keys(sites);
      savedSitesCountEl.innerText = keys.length;

      if (keys.length === 0) {
        sitesListEl.innerHTML = `
          <div class="empty-state">
            <p>No customized pages saved yet.</p>
            <span>Drag cards on any dashboard to save a layout!</span>
          </div>
        `;
        return;
      }

      sitesListEl.innerHTML = '';
      keys.forEach(key => {
        const item = sites[key];
        const dateStr = item.savedAt ? new Date(item.savedAt).toLocaleDateString() : 'Saved';
        
        let displayUrl = item.url;
        try {
          const u = new URL(item.url);
          displayUrl = `${u.host}${u.pathname}`;
        } catch {}

        const row = document.createElement('div');
        row.className = 'site-item';
        row.innerHTML = `
          <div class="site-item-info">
            <div class="site-item-url" title="${item.url}">${displayUrl}</div>
            <div class="site-item-meta">${item.cardCount || 0} cards rearranged • ${dateStr}</div>
          </div>
          <button type="button" class="site-delete-btn" title="Remove custom layout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        `;

        // Delete button
        row.querySelector('.site-delete-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Remove custom layout for ${displayUrl}?`)) {
            await chrome.storage.local.remove(key);
            delete sites[key];
            await chrome.storage.local.set({ dashmorph_sites: sites });
            loadSavedSites();
            refreshStatus();
          }
        });

        sitesListEl.appendChild(row);
      });
    });
  }

  loadSavedSites();

  // Export JSON
  exportBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (allData) => {
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashmorph-layouts-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Import JSON
  importBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        await chrome.storage.local.set(importedData);
        alert('Layouts successfully imported!');
        loadSavedSites();
        refreshStatus();
      } catch (err) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  });
});
