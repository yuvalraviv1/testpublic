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
const colorLeft = document.getElementById('color-left');
const colorRight = document.getElementById('color-right');

let showVideo = true;
let sampleMode = false;
const colors = ['#003366', '#ff0000', '#00ff00', '#0000ff'];
let colorIndex = 0;
let thicknessIndex = 1;
const thicknesses = [2,4,6,8];

let handColors = {Left: colorLeft.value, Right: colorRight.value};
let prevPoints = {Left: null, Right: null};
const hoverTimers = new Map();

function resizeCanvases(width, height) {
  [videoCanvas, drawCanvas].forEach(c => {
    c.width = width;
    c.height = height;
  });
}

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
}

btnVid.addEventListener('click', toggleVideo);
btnClear.addEventListener('click', clearDrawing);
btnColor.addEventListener('click', cycleColor);
btnThick.addEventListener('click', cycleThickness);
btnSample.addEventListener('click', () => sampleMode = !sampleMode);

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

function within(element, x, y) {
  const rect = element.getBoundingClientRect();
  const scaleX = videoCanvas.width / rect.width;
  const scaleY = videoCanvas.height / rect.height;
  const ex = x / scaleX + rect.left;
  const ey = y / scaleY + rect.top;
  return ex >= rect.left && ex <= rect.right && ey >= rect.top && ey <= rect.bottom;
}

function startHover(id) {
  hoverTimers.set(id, performance.now());
  document.getElementById(id).style.setProperty('--progress', 0);
}

function updateHover(id) {
  if (!hoverTimers.has(id)) return false;
  const start = hoverTimers.get(id);
  const diff = performance.now() - start;
  const progress = Math.min(diff / 1500, 1);
  document.getElementById(id).style.setProperty('--progress', progress * 100);
  if (diff > 1500) {
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
  drawCtx.lineWidth = thicknesses[thicknessIndex];
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
  resizeCanvases(results.image.width, results.image.height);
  videoCtx.save();
  videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
  if (showVideo) {
    videoCtx.drawImage(results.image, 0, 0, videoCanvas.width, videoCanvas.height);
  } else {
    videoCtx.fillStyle = '#000';
    videoCtx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);
  }
  videoCtx.restore();

  if (results.multiHandLandmarks) {
    results.multiHandLandmarks.forEach((landmarks, index) => {
      const hand = results.multiHandedness[index].label; // Left or Right
      drawConnectors(videoCtx, landmarks, HAND_CONNECTIONS, {color: '#0f0'});
      drawLandmarks(videoCtx, landmarks, {color: '#0f0', fillColor: '#0f0'});

      const x = landmarks[8].x * videoCanvas.width;
      const y = landmarks[8].y * videoCanvas.height;

      const overControl = [btnVid, btnClear, btnColor, btnThick, btnSample, colorLeft, colorRight].some(el => within(el, x, y));

      if (isPointing(landmarks) && !overControl) {
        if (sampleMode) {
          const base = landmarks[5];
          const tip = landmarks[8];
          const dx = (tip.x - base.x) * videoCanvas.width;
          const dy = (tip.y - base.y) * videoCanvas.height;
          const sx = x + dx * 0.5;
          const sy = y + dy * 0.5;
          handColors[hand] = sampleColor(sx, sy);
        }
        drawLine(hand, x, y);
        cancelHover(hand);
      } else if (isPointing(landmarks) && overControl) {
        resetPoint(hand);
        let triggered = false;
        if (within(btnVid, x, y)) triggered = updateHover('btn-vid');
        else cancelHover('btn-vid');
        if (!triggered && within(btnClear, x, y)) triggered = updateHover('btn-clear'); else cancelHover('btn-clear');
        if (!triggered && within(btnColor, x, y)) triggered = updateHover('btn-color'); else cancelHover('btn-color');
        if (!triggered && within(btnThick, x, y)) triggered = updateHover('btn-thick'); else cancelHover('btn-thick');
        if (!triggered && within(btnSample, x, y)) triggered = updateHover('btn-sample'); else cancelHover('btn-sample');
        if (!triggered && within(colorLeft, x, y)) startHover('color-left'); else cancelHover('color-left');
        if (!triggered && within(colorRight, x, y)) startHover('color-right'); else cancelHover('color-right');
      } else {
        resetPoint(hand);
      ['btn-vid','btn-clear','btn-color','btn-thick','btn-sample','color-left','color-right'].forEach(cancelHover);
      }
    });
  } else {
    resetPoint('Left');
    resetPoint('Right');
    ['btn-vid','btn-clear','btn-color','btn-thick','btn-sample','color-left','color-right'].forEach(cancelHover);
  }
}
