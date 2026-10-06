// State variables
let currentQuest = null;
let currentSessionId = null;
let currentItemIndex = 0;
let walkStartTime = null;
let screenActiveSeconds = 0;
let isScreenDimmed = false;
let screenTimerInterval = null;

// Speech Synthesis
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92; // Outdoor cadence
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const naturalVoice = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Siri') || v.name.includes('Google') || v.name.includes('Samantha'))
  ) || voices.find((v) => v.lang.startsWith('en'));

  if (naturalVoice) {
    utterance.voice = naturalVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Ensure voices are loaded
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// Helpers for UI Views
function showView(viewId) {
  document.querySelectorAll('.view-section').forEach((el) => {
    el.classList.remove('active');
  });
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
}

// Pill button group helper
function setupPillGroup(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    container.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
}

function getPillValue(containerId) {
  const active = document.querySelector(`#${containerId} .pill-btn.active`);
  return active ? active.dataset.val : null;
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  setupPillGroup('setting-options');
  setupPillGroup('time-options');
  setupPillGroup('age-options');

  // Dim Mode Toggle
  const dimOverlay = document.getElementById('dim-overlay');
  const btnToggleDim = document.getElementById('btn-toggle-dim');

  btnToggleDim.addEventListener('click', () => {
    isScreenDimmed = true;
    dimOverlay.classList.add('active');
  });

  dimOverlay.addEventListener('click', () => {
    isScreenDimmed = false;
    dimOverlay.classList.remove('active');
  });

  // Start Quest
  document.getElementById('btn-start-quest').addEventListener('click', startQuest);

  // Audio Replay
  document.getElementById('btn-replay-voice').addEventListener('click', () => {
    if (currentQuest && currentQuest.items[currentItemIndex]) {
      speak(currentQuest.items[currentItemIndex].promptText);
    }
  });

  // Found It Button -> trigger camera
  const cameraInput = document.getElementById('camera-file-input');
  document.getElementById('btn-found-it').addEventListener('click', () => {
    cameraInput.click();
  });

  cameraInput.addEventListener('change', handlePhotoCaptured);

  // Skip item
  document.getElementById('btn-skip-item').addEventListener('click', advanceToNextItem);

  // Next item from modal
  document.getElementById('btn-next-item').addEventListener('click', () => {
    document.getElementById('verify-overlay').classList.remove('active');
    advanceToNextItem();
  });

  // New Walk
  document.getElementById('btn-new-walk').addEventListener('click', () => {
    resetState();
    showView('view-setup');
  });
});

// Start Quest API Call
async function startQuest() {
  const startBtn = document.getElementById('btn-start-quest');
  startBtn.disabled = true;
  startBtn.innerHTML = '<span>⏳</span> Preparing Quest Offline...';

  const payload = {
    setting: getPillValue('setting-options') || 'park',
    timeAvailableMinutes: parseInt(getPillValue('time-options') || '30', 10),
    ageBand: getPillValue('age-options') || 'young_kids',
    seasonAndRegion: document.getElementById('input-region').value.trim() || 'Autumn / Pacific Northwest',
    accessibility: {
      flatPavedOnly: document.getElementById('chk-paved').checked,
      lowMobility: document.getElementById('chk-mobility').checked,
      lowVision: document.getElementById('chk-vision').checked,
    },
  };

  try {
    const res = await fetch('/api/quest/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate quest');
    }

    const data = await res.json();
    currentQuest = data.quest;
    currentSessionId = data.sessionId;
    currentItemIndex = 0;
    walkStartTime = Date.now();
    screenActiveSeconds = 0;

    startScreenTimer();
    renderCurrentItem();
    showView('view-walk');
  } catch (err) {
    alert(`Could not start quest: ${err.message}`);
  } finally {
    startBtn.disabled = false;
    startBtn.innerHTML = '<span>🚀</span> Start Scavenger Walk';
  }
}

// Screen-to-Sky Timer
function startScreenTimer() {
  if (screenTimerInterval) clearInterval(screenTimerInterval);

  screenTimerInterval = setInterval(() => {
    if (!walkStartTime) return;
    const totalWalkSeconds = Math.max(1, Math.round((Date.now() - walkStartTime) / 1000));

    // Screen is active only if tab is visible and not pocket-dimmed
    if (document.visibilityState === 'visible' && !isScreenDimmed) {
      screenActiveSeconds++;
    }

    const skyPct = Math.max(0, Math.min(100, Math.round(((totalWalkSeconds - screenActiveSeconds) / totalWalkSeconds) * 100)));
    document.getElementById('sky-ratio-text').textContent = `${skyPct}% Eyes on Sky`;
  }, 1000);
}

// Render Current Quest Item
function renderCurrentItem() {
  if (!currentQuest || currentItemIndex >= currentQuest.items.length) {
    finishWalk();
    return;
  }

  const item = currentQuest.items[currentItemIndex];
  document.getElementById('current-category').textContent = item.category.toUpperCase();
  document.getElementById('current-title').textContent = item.title;
  document.getElementById('current-prompt').textContent = item.promptText;

  // Speak the prompt aloud
  speak(item.promptText);
}

// Handle Photo Verification
async function handlePhotoCaptured(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const overlay = document.getElementById('verify-overlay');
  const loading = document.getElementById('verify-loading');
  const content = document.getElementById('verify-content');

  overlay.classList.add('active');
  loading.style.display = 'flex';
  content.style.display = 'none';

  const item = currentQuest.items[currentItemIndex];
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('sessionId', currentSessionId);
  formData.append('questItemId', item.id);
  formData.append('itemTitle', item.title);
  formData.append('category', item.category);
  formData.append('targetDescription', item.targetDescription);
  formData.append('verificationGuidance', item.verificationGuidance);

  try {
    const res = await fetch('/api/quest/verify', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Verification request failed');
    }

    const data = await res.json();
    const ver = data.verification;

    loading.style.display = 'none';
    content.style.display = 'flex';

    const badge = document.getElementById('verify-badge');
    const spokenBox = document.getElementById('verify-spoken');
    const caveatBox = document.getElementById('verify-caveat');

    badge.className = 'verify-status-badge';
    if (ver.found && !ver.isUncertain) {
      badge.classList.add('success');
      badge.textContent = '🎉 Found & Verified!';
    } else if (ver.isUncertain) {
      badge.classList.add('uncertain');
      badge.textContent = '🤔 Close! Let’s Investigate';
    } else {
      badge.classList.add('miss');
      badge.textContent = 'Keep Looking Nearby!';
    }

    spokenBox.textContent = ver.spokenFeedback;
    speak(ver.spokenFeedback);

    if (ver.certaintyCaveat) {
      caveatBox.style.display = 'block';
      caveatBox.textContent = `⚠️ ${ver.certaintyCaveat}`;
    } else {
      caveatBox.style.display = 'none';
    }
  } catch (err) {
    loading.style.display = 'none';
    content.style.display = 'flex';
    document.getElementById('verify-badge').className = 'verify-status-badge miss';
    document.getElementById('verify-badge').textContent = 'Error';
    document.getElementById('verify-spoken').textContent = `Could not verify: ${err.message}`;
  } finally {
    // Reset camera input
    e.target.value = '';
  }
}

function advanceToNextItem() {
  currentItemIndex++;
  renderCurrentItem();
}

// Complete Walk
async function finishWalk() {
  if (screenTimerInterval) clearInterval(screenTimerInterval);

  const totalWalkSeconds = Math.max(1, Math.round((Date.now() - walkStartTime) / 1000));
  const skyRatio = Math.max(0, Math.min(1.0, (totalWalkSeconds - screenActiveSeconds) / totalWalkSeconds));
  const skyPct = (skyRatio * 100).toFixed(1);

  try {
    const res = await fetch('/api/session/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        durationSeconds: totalWalkSeconds,
        screenActiveSeconds: screenActiveSeconds,
      }),
    });

    const data = await res.json();
    document.getElementById('complete-subtitle').textContent = `You finished "${currentQuest.questTitle}"!`;
    document.getElementById('final-sky-ratio').textContent = `${skyPct}%`;
    document.getElementById('final-time-breakdown').textContent = `Eyes on nature: ${Math.round((totalWalkSeconds - screenActiveSeconds) / 60)} min • Screen on: ${screenActiveSeconds} sec`;
    document.getElementById('btn-view-journal').href = data.journalUrl;

    speak(`Congratulations! You completed the walk with ${skyPct} percent of your time looking at nature! Check out your field journal.`);
    showView('view-complete');
  } catch (err) {
    alert(`Error finalizing session: ${err.message}`);
  }
}

function resetState() {
  currentQuest = null;
  currentSessionId = null;
  currentItemIndex = 0;
  walkStartTime = null;
  screenActiveSeconds = 0;
  if (screenTimerInterval) clearInterval(screenTimerInterval);
}

// Register Offline Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('ServiceWorker registration error:', err);
    });
  });
}
