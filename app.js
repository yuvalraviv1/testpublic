const videoElement = document.getElementById('input_video');
const videoCanvas = document.getElementById('video_canvas');
const videoCtx = videoCanvas.getContext('2d');
const drawCanvas = document.getElementById('draw_canvas');
const drawCtx = drawCanvas.getContext('2d');

const btnVid = document.getElementById('btn-vid');
const btnClear = document.getElementById('btn-clear');
const btnColor = document.getElementById('btn-color');
const btnThick = document.getElementById('btn-thick');
const btnSample = document.getElementById('btn-sample');
const btnSize = document.getElementById('btn-size');
const btnClr = document.getElementById('btn-clr');
const colorLeft = document.getElementById('color-left');
const colorRight = document.getElementById('color-right');
const sizeOverlay = document.getElementById('size-overlay');
const sizeBar = document.getElementById('size-bar');
const sizeIndicator = document.getElementById('size-indicator');
const colorOverlay = document.getElementById('color-overlay');
const modeBadge = document.getElementById('mode-badge');
const debugEl = document.getElementById('debug');

let showVideo = true;
let sampleMode = false;
const colors = [
  '#003366', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ffa500',
  '#800080', '#008080', '#ffffff', '#000000'
];
let colorIndex = 0;
let thicknessIndex = 1;
const thicknesses = [2,4,6,8];
const MIN_SIZE = 1;
const MAX_SIZE = 100;
let brushSize = thicknesses[thicknessIndex];

colors.forEach(c => {
  const sw = document.createElement('div');
  sw.className = 'swatch';
  sw.dataset.color = c;
  sw.style.background = c;
  colorOverlay.appendChild(sw);
});

const UI_HOVER_MS = 800;
const BUTTON_HOVER_MS = 1500;
const SWATCH_HOVER_MS = 500;

const Mode = { DRAW: 'draw', SIZE: 'size', COLOR: 'color' };
let appState = { mode: Mode.DRAW };
let leftOpenStart = 0;
let swatchTimers = new Map();

let handColors = {Left: colorLeft.value, Right: colorRight.value};
let prevPoints = {Left: null, Right: null};
const hoverTimers = new Map();

function setDebug(text) {
  if (debugEl) debugEl.textContent = text;
}

function resizeCanvases() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  [videoCanvas, drawCanvas].forEach(c => {
    c.width = width;
    c.height = height;
  });
}

window.addEventListener('resize', resizeCanvases);
// Set initial canvas sizes once on load
resizeCanvases();
updateSizeOverlay();

function clearDrawing() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function toggleVideo() {
  showVideo = !showVideo;
}

function cycleColor() {
  colorIndex = (colorIndex + 1) % colors.length;
  handColors.Left = colors[colorIndex];
  handColors.Right = colors[colorIndex];
  colorLeft.value = handColors.Left;
  colorRight.value = handColors.Right;
}

function cycleThickness() {
  thicknessIndex = (thicknessIndex + 1) % thicknesses.length;
  brushSize = thicknesses[thicknessIndex];
  updateSizeOverlay();
}

btnVid.addEventListener('click', toggleVideo);
btnClear.addEventListener('click', clearDrawing);
btnColor.addEventListener('click', cycleColor);
btnThick.addEventListener('click', cycleThickness);
btnSample.addEventListener('click', () => sampleMode = !sampleMode);
btnSize.addEventListener('click', () => enterSizeMode());
btnClr.addEventListener('click', () => enterColorMode());

colorLeft.addEventListener('input', e => { handColors.Left = e.target.value; });
colorRight.addEventListener('input', e => { handColors.Right = e.target.value; });

function isFingerExtended(lms, tip, pip) {
  return lms[tip].y < lms[pip].y;
}

function isPointing(lms) {
  return isFingerExtended(lms,8,6) &&
    !isFingerExtended(lms,12,10) &&
    !isFingerExtended(lms,16,14) &&
    !isFingerExtended(lms,20,18);
}

function isThumbsUp(lms) {
  return isFingerExtended(lms,4,3) &&
    !isFingerExtended(lms,8,6) &&
    !isFingerExtended(lms,12,10) &&
    !isFingerExtended(lms,16,14) &&
    !isFingerExtended(lms,20,18);
}

function isOpenHand(lms) {
  return isFingerExtended(lms,4,3) &&
    isFingerExtended(lms,8,6) &&
    isFingerExtended(lms,12,10) &&
    isFingerExtended(lms,16,14) &&
    isFingerExtended(lms,20,18);
}

function getGesture(lms) {
  if (isPointing(lms)) return 'pointing';
  if (isThumbsUp(lms)) return 'thumbs up';
  if (isOpenHand(lms)) return 'open hand';
  return 'unknown';
}

function within(element, x, y) {
  const elementRect = element.getBoundingClientRect();
  const canvasRect = videoCanvas.getBoundingClientRect();
  const scaleX = canvasRect.width / videoCanvas.width;
  const scaleY = canvasRect.height / videoCanvas.height;
  const pageX = x * scaleX + canvasRect.left;
  const pageY = y * scaleY + canvasRect.top;
  return (
    pageX >= elementRect.left &&
    pageX <= elementRect.right &&
    pageY >= elementRect.top &&
    pageY <= elementRect.bottom
  );
}

function startHover(id) {
  hoverTimers.set(id, performance.now());
  document.getElementById(id).style.setProperty('--progress', 0);
}

function updateHover(id, ms = BUTTON_HOVER_MS) {
  if (!hoverTimers.has(id)) {
    startHover(id);
    return false;
  }
  const start = hoverTimers.get(id);
  const diff = performance.now() - start;
  const progress = Math.min(diff / ms, 1);
  document.getElementById(id).style.setProperty('--progress', progress * 100);
  if (diff > ms) {
    hoverTimers.delete(id);
    document.getElementById(id).style.setProperty('--progress', 0);
    document.getElementById(id).click();
    return true;
  }
  return false;
}

function cancelHover(id) {
  const el = document.getElementById(id);
  if (!el) return;
  hoverTimers.delete(id);
  el.style.setProperty('--progress', 0);
}

function sampleColor(x, y) {
  const imageData = videoCtx.getImageData(Math.max(0,x-1), Math.max(0,y-1), 1, 1).data;
  return `rgb(${imageData[0]},${imageData[1]},${imageData[2]})`;
}

function drawLine(hand, x, y) {
  const prev = prevPoints[hand];
  drawCtx.strokeStyle = handColors[hand];
  drawCtx.lineWidth = brushSize;
  drawCtx.lineCap = 'round';
  drawCtx.beginPath();
  if (prev) {
    drawCtx.moveTo(prev.x, prev.y);
  } else {
    drawCtx.moveTo(x, y);
  }
  drawCtx.lineTo(x, y);
  drawCtx.stroke();
  prevPoints[hand] = {x, y};
}

function resetPoint(hand) {
  prevPoints[hand] = null;
}

function enterSizeMode() {
  appState.mode = Mode.SIZE;
  sizeOverlay.classList.remove('hidden');
  colorOverlay.classList.add('hidden');
  updateSizeOverlay();
}

function enterColorMode() {
  appState.mode = Mode.COLOR;
  colorOverlay.classList.remove('hidden');
  sizeOverlay.classList.add('hidden');
  colorLeft.classList.remove('hidden');
}

function exitModes() {
  appState.mode = Mode.DRAW;
  sizeOverlay.classList.add('hidden');
  colorOverlay.classList.add('hidden');
  colorLeft.classList.add('hidden');
}

function updateSizeOverlay() {
  const ratio = (brushSize - MIN_SIZE) / (MAX_SIZE - MIN_SIZE);
  sizeBar.style.height = `${ratio * 100}%`;
  sizeIndicator.style.width = `${brushSize}px`;
  sizeIndicator.style.height = `${brushSize}px`;
}

function selectColor(color) {
  handColors.Left = color;
  handColors.Right = color;
  colorLeft.value = color;
  colorRight.value = color;
  document.querySelectorAll('#color-overlay .swatch').forEach(sw => {
    if (sw.dataset.color === color) sw.classList.add('selected');
    else sw.classList.remove('selected');
  });
}

// highlight default color
selectColor(handColors.Right);

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 640,
  height: 480
});
camera.start();

function onResults(results) {
  videoCtx.save();
  videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
  videoCtx.translate(videoCanvas.width, 0);
  videoCtx.scale(-1, 1);
  if (showVideo) {
    videoCtx.drawImage(results.image, 0, 0, videoCanvas.width, videoCanvas.height);
  } else {
    videoCtx.fillStyle = '#000';
    videoCtx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);
  }

    if (results.multiHandLandmarks) {
      let debugParts = [];
      results.multiHandLandmarks.forEach((landmarks, index) => {
        let hand = results.multiHandedness[index].label; // Left or Right from camera
        // Because the video is mirrored, swap the handedness labels so that
        // they match the user's perspective
        if (hand === 'Left') hand = 'Right';
        else if (hand === 'Right') hand = 'Left';
        drawConnectors(videoCtx, landmarks, HAND_CONNECTIONS, {color: '#0f0'});
        drawLandmarks(videoCtx, landmarks, {color: '#0f0', fillColor: '#0f0'});

        const x = (1 - landmarks[8].x) * videoCanvas.width;
        const y = landmarks[8].y * videoCanvas.height;

        const overControl = [btnVid, btnClear, btnColor, btnThick, btnSample, btnSize, btnClr, colorLeft, colorRight].some(el => within(el, x, y));
        const gesture = getGesture(landmarks);
        let msg = `${hand}: ${gesture}`;

        if (hand === 'Left') {
          if (gesture === 'open hand') {
            if (!leftOpenStart) leftOpenStart = performance.now();
            if (performance.now() - leftOpenStart > 1000) {
              exitModes();
            }
          } else {
            leftOpenStart = 0;
          }
        }

        if (appState.mode === Mode.DRAW) {
          if (gesture === 'pointing' && !overControl) {
            if (sampleMode) {
              const baseX = (1 - landmarks[5].x) * videoCanvas.width;
              const baseY = landmarks[5].y * videoCanvas.height;
              const dx = x - baseX;
              const dy = y - baseY;
              const sx = x + dx * 0.5;
              const sy = y + dy * 0.5;
              handColors[hand] = sampleColor(sx, sy);
            }
            drawLine(hand, x, y);
            cancelHover(hand);
            msg += ` drawing (${Math.round(x)}, ${Math.round(y)}) color ${handColors[hand]}`;
          } else if (gesture === 'pointing' && overControl) {
            resetPoint(hand);
            let triggered = false;
            if (within(btnVid, x, y)) triggered = updateHover('btn-vid', BUTTON_HOVER_MS); else cancelHover('btn-vid');
            if (!triggered && within(btnClear, x, y)) triggered = updateHover('btn-clear', BUTTON_HOVER_MS); else cancelHover('btn-clear');
            if (!triggered && within(btnColor, x, y)) triggered = updateHover('btn-color', BUTTON_HOVER_MS); else cancelHover('btn-color');
            if (!triggered && within(btnThick, x, y)) triggered = updateHover('btn-thick', BUTTON_HOVER_MS); else cancelHover('btn-thick');
            if (!triggered && within(btnSample, x, y)) triggered = updateHover('btn-sample', BUTTON_HOVER_MS); else cancelHover('btn-sample');
            if (!triggered && within(btnSize, x, y)) triggered = updateHover('btn-size', UI_HOVER_MS); else cancelHover('btn-size');
            if (!triggered && within(btnClr, x, y)) triggered = updateHover('btn-clr', UI_HOVER_MS); else cancelHover('btn-clr');
            if (!triggered && within(colorLeft, x, y)) startHover('color-left'); else cancelHover('color-left');
            if (!triggered && within(colorRight, x, y)) startHover('color-right'); else cancelHover('color-right');
            msg += ' over control';
          } else {
            resetPoint(hand);
            ['btn-vid','btn-clear','btn-color','btn-thick','btn-sample','btn-size','btn-clr','color-left','color-right'].forEach(cancelHover);
          }
        } else if (appState.mode === Mode.SIZE) {
          resetPoint(hand);
          if (hand === 'Right' && gesture === 'pointing') {
            const val = Math.round((1 - landmarks[8].y) * (MAX_SIZE - MIN_SIZE)) + MIN_SIZE;
            brushSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, val));
            updateSizeOverlay();
          }
        } else if (appState.mode === Mode.COLOR) {
          resetPoint(hand);
          if (hand === 'Right' && gesture === 'pointing') {
            document.querySelectorAll('#color-overlay .swatch').forEach(sw => {
              if (within(sw, x, y)) {
                if (!swatchTimers.has(sw)) swatchTimers.set(sw, performance.now());
                if (performance.now() - swatchTimers.get(sw) > SWATCH_HOVER_MS) {
                  selectColor(sw.dataset.color);
                  swatchTimers.clear();
                }
              } else {
                swatchTimers.delete(sw);
              }
            });
          } else {
            swatchTimers.clear();
          }
        }
        debugParts.push(msg);
      });
      setDebug(debugParts.join(' | '));
      modeBadge.textContent = `MODE: ${appState.mode.toUpperCase()}`;
    } else {
      resetPoint('Left');
      resetPoint('Right');
      ['btn-vid','btn-clear','btn-color','btn-thick','btn-sample','btn-size','btn-clr','color-left','color-right'].forEach(cancelHover);
      swatchTimers.clear();
      setDebug('no hands');
      modeBadge.textContent = `MODE: ${appState.mode.toUpperCase()}`;
    }
  videoCtx.restore();
}
