// State variables
let currentQuest = null;
let currentSessionId = null;
let currentItemIndex = 0;
let walkStartTime = null;
let screenActiveSeconds = 0;
let isScreenDimmed = false;
let screenTimerInterval = null;

// Map & Radar Animation State
let mapCanvas = null;
let mapCtx = null;
let mapAnimFrame = null;
let pulseRadius = 0;
let userHeading = 0; // heading angle in radians
let userPos = { x: 0, y: 0 };
let targetPos = { x: 0, y: 0 };
let mapOffset = { x: 0, y: 0 };
let isDraggingMap = false;
let dragStart = { x: 0, y: 0 };
let landmarkNodes = [];

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
  if (target) {
    target.classList.add('active');
    if (viewId === 'view-walk') {
      setTimeout(initMapCanvas, 50);
    }
  }
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

// Category to Emoji Helper
function getCategoryEmoji(category, title = '') {
  const lower = (category + ' ' + title).toLowerCase();
  if (lower.includes('oak') || lower.includes('tree') || lower.includes('bark')) return '🌳';
  if (lower.includes('leaf') || lower.includes('leaves') || lower.includes('foliage')) return '🍂';
  if (lower.includes('bird') || lower.includes('chirp') || lower.includes('sing')) return '🐦';
  if (lower.includes('stone') || lower.includes('rock') || lower.includes('pebble')) return '🪨';
  if (lower.includes('acorn') || lower.includes('pinecone') || lower.includes('nut')) return '🌰';
  if (lower.includes('listen') || lower.includes('sound') || lower.includes('wind')) return '🎧';
  if (lower.includes('shadow') || lower.includes('step') || lower.includes('count')) return '🔢';
  if (lower.includes('compare') || lower.includes('vs')) return '⚖️';
  return '🌿';
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  setupPillGroup('setting-options');
  setupPillGroup('time-options');
  setupPillGroup('age-options');

  // Dim Mode Toggle
  const dimOverlay = document.getElementById('dim-overlay');
  const btnToggleDim = document.getElementById('btn-toggle-dim');

  if (btnToggleDim) {
    btnToggleDim.addEventListener('click', () => {
      isScreenDimmed = true;
      dimOverlay.classList.add('active');
    });
  }

  dimOverlay.addEventListener('click', () => {
    isScreenDimmed = false;
    dimOverlay.classList.remove('active');
  });

  // Start Quest
  document.getElementById('btn-start-quest').addEventListener('click', startQuest);

  // Audio Buttons (Top Pill & Audio Button)
  const speakCurrent = () => {
    if (currentQuest && currentQuest.items[currentItemIndex]) {
      speak(currentQuest.items[currentItemIndex].promptText);
    }
  };
  document.getElementById('btn-audio-speak').addEventListener('click', (e) => {
    e.stopPropagation();
    speakCurrent();
  });
  document.getElementById('nav-banner-pill').addEventListener('click', speakCurrent);

  // Found It Button -> trigger camera
  const cameraInput = document.getElementById('camera-file-input');
  document.getElementById('btn-found-it').addEventListener('click', () => {
    cameraInput.click();
  });
  cameraInput.addEventListener('change', handlePhotoCaptured);

  // Hint Modal Trigger
  const hintOverlay = document.getElementById('hint-overlay');
  document.getElementById('btn-show-hint').addEventListener('click', () => {
    if (!currentQuest || !currentQuest.items[currentItemIndex]) return;
    const item = currentQuest.items[currentItemIndex];
    document.getElementById('hint-category-tag').textContent = item.category.toUpperCase();
    document.getElementById('hint-item-title').textContent = item.title;
    document.getElementById('hint-prompt-text').textContent = item.promptText;
    document.getElementById('hint-guidance-text').textContent = item.verificationGuidance;
    hintOverlay.classList.add('active');
  });

  document.getElementById('btn-close-hint').addEventListener('click', () => {
    hintOverlay.classList.remove('active');
  });
  hintOverlay.addEventListener('click', (e) => {
    if (e.target === hintOverlay) hintOverlay.classList.remove('active');
  });

  // Compass Re-center button
  document.getElementById('btn-compass-orient').addEventListener('click', () => {
    mapOffset = { x: 0, y: 0 };
    userHeading += Math.PI / 4;
  });

  // Skip item
  document.getElementById('btn-skip-item').addEventListener('click', advanceToNextItem);

  // Next item from verification modal
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
    const skyText = `${skyPct}% Eyes on Sky`;
    const el1 = document.getElementById('sky-ratio-text');
    if (el1) el1.textContent = skyText;
  }, 1000);
}

// Render Current Quest Item onto Navigation HUD
function renderCurrentItem() {
  if (!currentQuest || currentItemIndex >= currentQuest.items.length) {
    finishWalk();
    return;
  }

  const item = currentQuest.items[currentItemIndex];
  const emoji = getCategoryEmoji(item.category, item.title);

  // Top Navigation Pill
  document.getElementById('nav-target-name').textContent = item.title;

  // Bottom Floating HUD Card
  document.getElementById('hud-item-icon').textContent = emoji;
  document.getElementById('hud-item-title').textContent = item.title;
  document.getElementById('hud-item-subtitle').textContent = `${item.category.replace('_', ' ').toUpperCase()} • ${item.points || 50} pts`;

  // Sub-bar counter
  const remainingCount = currentQuest.items.length - currentItemIndex;
  document.getElementById('counter-text').textContent = `${remainingCount} of ${currentQuest.items.length} left`;

  // Update target waypoint coordinates on the radar map
  updateRadarTarget(currentItemIndex);

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
      badge.textContent = '🤔 Take a Closer Look';
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

// =========================================================
// INTERACTIVE NATURE RADAR & FIELD CANVAS ENGINE
// =========================================================

function initMapCanvas() {
  mapCanvas = document.getElementById('nature-map-canvas');
  if (!mapCanvas) return;
  mapCtx = mapCanvas.getContext('2d');

  function resizeCanvas() {
    mapCanvas.width = window.innerWidth;
    mapCanvas.height = window.innerHeight;
    userPos = { x: mapCanvas.width / 2, y: mapCanvas.height * 0.58 };
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Generate ambient park landmarks
  generateParkLandmarks();

  // Drag interaction to pan map
  mapCanvas.addEventListener('pointerdown', (e) => {
    isDraggingMap = true;
    dragStart = { x: e.clientX - mapOffset.x, y: e.clientY - mapOffset.y };
  });
  window.addEventListener('pointermove', (e) => {
    if (!isDraggingMap) return;
    mapOffset.x = e.clientX - dragStart.x;
    mapOffset.y = e.clientY - dragStart.y;
  });
  window.addEventListener('pointerup', () => {
    isDraggingMap = false;
  });

  // Start smooth animation loop
  if (mapAnimFrame) cancelAnimationFrame(mapAnimFrame);
  function loop() {
    drawMapFrame();
    mapAnimFrame = requestAnimationFrame(loop);
  }
  mapAnimFrame = requestAnimationFrame(loop);
}

function generateParkLandmarks() {
  const w = mapCanvas ? mapCanvas.width : 400;
  const h = mapCanvas ? mapCanvas.height : 800;

  landmarkNodes = [
    { x: w * 0.25, y: h * 0.35, label: 'Oak Stand', icon: '🌳' },
    { x: w * 0.8, y: h * 0.42, label: 'Fruit & Veg', icon: '🍎' },
    { x: w * 0.7, y: h * 0.22, label: 'Pine Glade', icon: '🌲' },
    { x: w * 0.2, y: h * 0.72, label: 'Wildflower Patch', icon: '🌾' },
    { x: w * 0.82, y: h * 0.75, label: 'Stone Terrace', icon: '🪨' },
  ];
}

function updateRadarTarget(idx) {
  if (!mapCanvas) return;
  const w = mapCanvas.width;
  const h = mapCanvas.height;

  // Set target position slightly north ahead of the user
  const angles = [-0.2, 0.15, -0.1, 0.25, -0.18, 0.05];
  const angle = angles[idx % angles.length];
  const distance = Math.min(w, h) * 0.32;

  targetPos = {
    x: userPos.x + Math.sin(angle) * distance,
    y: userPos.y - Math.cos(angle) * distance,
  };
}

function drawMapFrame() {
  if (!mapCtx || !mapCanvas) return;
  const ctx = mapCtx;
  const w = mapCanvas.width;
  const h = mapCanvas.height;

  // 1. Clean Map Background (Crisp field tone matching reference)
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(mapOffset.x, mapOffset.y);

  // 2. Subtle Park Zones / Footprints (like store aisles/park zones in reference)
  ctx.fillStyle = '#e2e8f0';
  const blockW = 55;
  const blockH = 75;

  // Draw structured zone blocks mimicking reference spatial layout
  const zones = [
    { x: w * 0.15, y: h * 0.25 },
    { x: w * 0.35, y: h * 0.25 },
    { x: w * 0.65, y: h * 0.28 },
    { x: w * 0.18, y: h * 0.45 },
    { x: w * 0.7, y: h * 0.48 },
    { x: w * 0.15, y: h * 0.68 },
    { x: w * 0.32, y: h * 0.70 },
    { x: w * 0.68, y: h * 0.72 },
  ];
  zones.forEach((z) => {
    ctx.beginPath();
    ctx.roundRect(z.x, z.y, blockW, blockH, 8);
    ctx.fill();
  });

  // Soft walking paths (paved loops)
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.15);
  ctx.lineTo(w * 0.5, h * 0.85);
  ctx.moveTo(w * 0.15, h * 0.55);
  ctx.lineTo(w * 0.85, h * 0.55);
  ctx.stroke();

  // 3. Landmark Nodes & Labels
  landmarkNodes.forEach((node) => {
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(node.icon, node.x, node.y);

    ctx.font = '500 10px system-ui';
    ctx.fillStyle = '#64748b';
    ctx.fillText(node.label, node.x, node.y + 14);
  });

  // 4. Dotted Navigation Breadcrumb Trail (From user to target)
  if (targetPos.x && targetPos.y) {
    const dx = targetPos.x - userPos.x;
    const dy = targetPos.y - userPos.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.floor(dist / 22);

    for (let i = 2; i < steps; i++) {
      const t = i / steps;
      const px = userPos.x + dx * t;
      const py = userPos.y + dy * t;

      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
    }

    // 5. Target Beacon Pin
    ctx.beginPath();
    ctx.arc(targetPos.x, targetPos.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(targetPos.x, targetPos.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();

    // Pulse ring around target
    const targetPulse = (Date.now() / 20) % 30;
    ctx.beginPath();
    ctx.arc(targetPos.x, targetPos.y, 14 + targetPulse * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(37, 99, 235, ${Math.max(0, 0.8 - targetPulse / 30)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 6. User Locator Disc (Matching (A) disc from reference)
  pulseRadius = (pulseRadius + 0.4) % 45;

  // Radar Pulse waves
  ctx.beginPath();
  ctx.arc(userPos.x, userPos.y, 18 + pulseRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(37, 99, 235, ${Math.max(0, 0.25 - pulseRadius / 45)})`;
  ctx.fill();

  // Outer halo
  ctx.beginPath();
  ctx.arc(userPos.x, userPos.y, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Blue Inner Circle
  ctx.beginPath();
  ctx.arc(userPos.x, userPos.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#2563eb';
  ctx.fill();

  // White Heading Arrow Pointer (▲)
  ctx.save();
  ctx.translate(userPos.x, userPos.y);
  ctx.rotate(userHeading);
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 5);
  ctx.lineTo(0, 2);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// Register Offline Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('ServiceWorker registration error:', err);
    });
  });
}
