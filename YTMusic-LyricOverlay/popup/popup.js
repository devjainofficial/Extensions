document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const toggleBtn = document.getElementById('toggle-btn');

  // Query YouTube Music tabs
  const tabs = await chrome.tabs.query({ url: '*://music.youtube.com/*' });
  const ytmTab = tabs && tabs.length > 0 ? tabs[0] : null;

  if (ytmTab) {
    statusDot.className = 'status-dot';
    statusText.innerText = 'Connected to YouTube Music';

    try {
      chrome.tabs.sendMessage(ytmTab.id, { action: 'get_status' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          statusText.innerText = 'Ready on YouTube Music';
          return;
        }

        if (response.track && response.track.title) {
          statusText.innerText = `Playing: ${response.track.title}`;
        }
        if (response.isOpen) {
          toggleBtn.innerHTML = '<span>✕ Close Floating Lyrics</span>';
          toggleBtn.className = 'btn secondary';
        }
      });
    } catch {
      // ignore
    }

    toggleBtn.addEventListener('click', async () => {
      // Focus tab
      await chrome.tabs.update(ytmTab.id, { active: true });
      if (ytmTab.windowId) {
        await chrome.windows.update(ytmTab.windowId, { focused: true });
      }

      // Send toggle message
      chrome.tabs.sendMessage(ytmTab.id, { action: 'toggle_pip' }, () => {
        window.close();
      });
    });

  } else {
    statusDot.className = 'status-dot offline';
    statusText.innerText = 'YouTube Music is not open';
    toggleBtn.innerHTML = '<span>🚀 Open YouTube Music</span>';

    toggleBtn.addEventListener('click', async () => {
      await chrome.tabs.create({ url: 'https://music.youtube.com' });
      window.close();
    });
  }
});
