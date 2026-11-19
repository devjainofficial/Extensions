// SmartTV Orbit - Cloud Web Remote & Automation Hub
const CLOUD_TOPIC_CMD = 'orbit_devja_tv_cmd';
const CLOUD_TOPIC_STATUS = 'orbit_devja_tv_status';
const NTFY_BASE = 'https://ntfy.sh';

// State
let tvStatus = {
  online: true,
  volume: 45,
  wakefulness: 'Awake',
  currentApp: 'YouTube'
};

let routines = JSON.parse(localStorage.getItem('orbit_routines') || '[]');
let customActions = JSON.parse(localStorage.getItem('orbit_custom_actions') || '[]');

// Default custom actions if empty
if (customActions.length === 0) {
  customActions = [
    { title: 'Sleep in 30 Min', type: 'script', val: 'sleep_30m', icon: 'fa-moon' },
    { title: 'Night Volume 20%', type: 'key', val: 'VOL:20', icon: 'fa-volume-low' },
    { title: 'Jain Stavan Live', type: 'url', val: 'https://www.youtube.com/results?search_query=Jain+Stavan+live', icon: 'fa-music' },
    { title: 'HDMI 1 Input', type: 'key', val: '243', icon: 'fa-plug' }
  ];
  localStorage.setItem('orbit_custom_actions', JSON.stringify(customActions));
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  renderCustomRoutines();
  renderCustomActions();
  initCloudStatusListener();
});

// Tab Switching
function switchTab(tabId) {
  ['remote', 'routines', 'apps', 'custom'].forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const tab = document.getElementById(`tab-${t}`);
    if (t === tabId) {
      view.classList.remove('hidden');
      tab.classList.add('active-tab');
      tab.classList.remove('text-slate-400');
    } else {
      view.classList.add('hidden');
      tab.classList.remove('active-tab');
      tab.classList.add('text-slate-400');
    }
  });
}

// Send Command via Cloud Relay
async function sendCommand(type, payload) {
  // Haptic feedback for touch devices
  if (navigator.vibrate) navigator.vibrate(25);

  const command = `${type.toUpperCase()}:${payload}`;
  console.log('Sending command:', command);

  try {
    const res = await fetch(`${NTFY_BASE}/${CLOUD_TOPIC_CMD}`, {
      method: 'POST',
      body: command,
      headers: {
        'Title': 'SmartTV Command',
        'Priority': 'urgent'
      }
    });
    if (res.ok) {
      flashStatus('Command Delivered');
    }
  } catch (err) {
    console.error('Error sending command:', err);
    flashStatus('Network Error', true);
  }
}

// Quick Channel Launcher
function sendQuickChannel(channel) {
  if (channel === 'paras') {
    sendCommand('URL', 'https://www.youtube.com/@parasnetwork/live');
  } else if (channel === 'jinvani') {
    sendCommand('URL', 'https://www.youtube.com/@jinvanichannelofficial/live');
  }
}

// Volume handling
function sendVolume(val) {
  document.getElementById('vol-display').textContent = `${val}%`;
  sendCommand('VOL', val);
}

// Keyboard text input
function sendTypedText() {
  const input = document.getElementById('type-input');
  const text = input.value.trim();
  if (!text) return;
  sendCommand('TYPE', text);
  input.value = '';
}

// Cast URL
function castUrlToTV() {
  const input = document.getElementById('cast-url-input');
  const url = input.value.trim();
  if (!url) return;
  sendCommand('URL', url);
  input.value = '';
}

// Screenshot Request
function requestScreenshot() {
  sendCommand('SCREEN', 'now');
  flashStatus('Requesting Screenshot...');
}

// Routines Management
function toggleRoutine(routineName, isEnabled) {
  sendCommand('ROUTINE_TOGGLE', `${routineName}:${isEnabled ? '1' : '0'}`);
}

function testRoutine(routineName) {
  sendQuickChannel(routineName);
}

function openNewRoutineModal() {
  document.getElementById('modal-routine').classList.remove('hidden');
  document.getElementById('modal-routine').classList.add('flex');
}

function openNewActionModal() {
  document.getElementById('modal-action').classList.remove('hidden');
  document.getElementById('modal-action').classList.add('flex');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
  document.getElementById(modalId).classList.remove('flex');
}

function saveNewRoutine() {
  const name = document.getElementById('m-routine-name').value.trim();
  const start = document.getElementById('m-routine-start').value;
  const end = document.getElementById('m-routine-end').value;
  const type = document.getElementById('m-routine-type').value;
  const val = document.getElementById('m-routine-val').value.trim();

  if (!name || !val) {
    alert('Please provide a name and action value.');
    return;
  }

  const newRoutine = { id: Date.now(), name, start, end, type, val, enabled: true };
  routines.push(newRoutine);
  localStorage.setItem('orbit_routines', JSON.stringify(routines));
  
  // Sync routines to TV
  sendCommand('SYNC_ROUTINES', JSON.stringify(routines));

  renderCustomRoutines();
  closeModal('modal-routine');
}

function renderCustomRoutines() {
  const container = document.getElementById('custom-routines-container');
  container.innerHTML = '';

  routines.forEach(r => {
    const card = document.createElement('div');
    card.className = 'glass-card rounded-2xl p-4 border-l-4 border-l-sky-500 shadow-md space-y-2';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm font-bold">
            <i class="fa-solid fa-bell"></i>
          </span>
          <div>
            <h3 class="text-xs font-bold text-white">${r.name}</h3>
            <span class="text-[11px] text-sky-400 font-medium">${r.start} – ${r.end}</span>
          </div>
        </div>
        <button onclick="deleteRoutine(${r.id})" class="text-slate-500 hover:text-red-400 p-1">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </div>
      <p class="text-[11px] text-slate-300 pl-10">${r.type === 'youtube_search' ? 'Searches & plays: ' : 'Target: '} ${r.val}</p>
    `;
    container.appendChild(card);
  });
}

function deleteRoutine(id) {
  routines = routines.filter(r => r.id !== id);
  localStorage.setItem('orbit_routines', JSON.stringify(routines));
  sendCommand('SYNC_ROUTINES', JSON.stringify(routines));
  renderCustomRoutines();
}

// Custom Actions Extension Builder
function saveNewAction() {
  const title = document.getElementById('m-action-title').value.trim();
  const type = document.getElementById('m-action-type').value;
  const val = document.getElementById('m-action-val').value.trim();

  if (!title || !val) {
    alert('Please fill out all fields.');
    return;
  }

  const newAction = { title, type, val, icon: 'fa-bolt' };
  customActions.push(newAction);
  localStorage.setItem('orbit_custom_actions', JSON.stringify(customActions));
  renderCustomActions();
  closeModal('modal-action');
}

function renderCustomActions() {
  const grid = document.getElementById('custom-actions-grid');
  grid.innerHTML = '';

  customActions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'remote-btn glass-card hover:bg-slate-700/50 p-3.5 rounded-2xl flex items-center gap-2.5 text-left border border-slate-700/60 shadow-md';
    btn.onclick = () => {
      if (a.type === 'key') sendCommand('KEY', a.val);
      else if (a.type === 'url') sendCommand('URL', a.val);
      else if (a.type === 'app') sendCommand('LAUNCH_APP', a.val);
      else if (a.type === 'script') sendCommand('SCRIPT', a.val);
    };
    btn.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm">
        <i class="fa-solid ${a.icon || 'fa-bolt'}"></i>
      </div>
      <div class="flex-1 truncate">
        <div class="text-xs font-bold text-white truncate">${a.title}</div>
        <div class="text-[10px] text-slate-400 capitalize">${a.type}</div>
      </div>
    `;
    grid.appendChild(btn);
  });
}

// Cloud Status Listener (Realtime status from TV)
function initCloudStatusListener() {
  const evtSource = new EventSource(`${NTFY_BASE}/${CLOUD_TOPIC_STATUS}/sse`);
  evtSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'message') {
        const msg = JSON.parse(data.message);
        if (msg.volume !== undefined) {
          document.getElementById('vol-display').textContent = `${msg.volume}%`;
          document.getElementById('vol-slider').value = msg.volume;
        }
        if (msg.screenshot) {
          const img = document.getElementById('screen-img');
          img.src = msg.screenshot;
          img.classList.remove('hidden');
        }
      }
    } catch (err) {}
  };
}

function flashStatus(msg, isError = false) {
  const el = document.getElementById('conn-status');
  el.textContent = msg;
  el.className = isError ? 'text-red-400 font-bold' : 'text-sky-400 font-bold';
  setTimeout(() => {
    el.textContent = 'Cloud Connected (WAN)';
    el.className = 'text-emerald-400 font-medium';
  }, 2500);
}
