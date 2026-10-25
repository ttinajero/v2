import { ICONS } from './icons.js';

// [action, label, mode]: hold buttons stay active while pressed, tap buttons fire once.
const BUTTONS = [
  ['action', 'Action', 'tap'],
  ['jump', 'Jump', 'tap'],
  ['sprint', 'Sprint', 'hold'],
  ['dive', 'Dive', 'hold'],
  ['rise', 'Rise', 'hold'],
  ['tailSlap', 'Slap', 'tap'],
  ['spyhop', 'Look', 'hold'],
  ['call', 'Call', 'tap'],
];

const STICK_RADIUS = 60;

// Pointer capture can throw for pointers the browser no longer tracks; losing it is harmless.
function capture(el, id) {
  try {
    el.setPointerCapture(id);
  } catch {
    /* ignore */
  }
}

export function prefersTouch(setting) {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  if (new URLSearchParams(location.search).has('touch')) return true;
  return window.matchMedia('(pointer: coarse)').matches;
}

// On-screen controls for iPad: a floating joystick on one side, a drag/pinch area to
// look around, and big thumb buttons on the other side.
export function createTouchControls(input, chase) {
  const root = document.createElement('div');
  root.className = 'touch-ui';
  root.hidden = true;
  root.innerHTML = `
    <div class="touch-stick-zone"></div>
    <div class="touch-look-zone"></div>
    <div class="touch-stick"><div class="touch-knob"></div></div>
    <div class="touch-buttons">
      ${BUTTONS.map(
        ([name, label, mode]) => `
        <button type="button" class="touch-btn touch-${name}" data-action="${name}" data-mode="${mode}" aria-label="${label}">
          ${name === 'action' ? '' : ICONS[name]}
          <span>${label}</span>
        </button>`,
      ).join('')}
    </div>`;
  document.body.appendChild(root);

  const stickZone = root.querySelector('.touch-stick-zone');
  const lookZone = root.querySelector('.touch-look-zone');
  const stickBase = root.querySelector('.touch-stick');
  const knob = root.querySelector('.touch-knob');
  const actionBtn = root.querySelector('.touch-action');
  const actionLabel = actionBtn.querySelector('span');

  // Keep iOS Safari from scrolling, zooming or showing callouts while playing.
  root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- Joystick: appears wherever the thumb lands ---
  let stickId = null;
  let originX = 0;
  let originY = 0;
  function placeStick(x, y) {
    stickBase.style.left = `${x}px`;
    stickBase.style.top = `${y}px`;
  }
  function resetStick() {
    stickId = null;
    input.touch.stick.x = 0;
    input.touch.stick.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
    stickBase.classList.remove('active');
    stickBase.style.left = '';
    stickBase.style.top = '';
  }
  stickZone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    capture(stickZone, e.pointerId);
    originX = e.clientX;
    originY = e.clientY;
    placeStick(originX, originY);
    stickBase.classList.add('active');
  });
  stickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - originX;
    let dy = e.clientY - originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx *= STICK_RADIUS / len;
      dy *= STICK_RADIUS / len;
    }
    input.touch.stick.x = dx / STICK_RADIUS;
    input.touch.stick.y = -dy / STICK_RADIUS;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  const endStick = (e) => {
    if (e.pointerId === stickId) resetStick();
  };
  stickZone.addEventListener('pointerup', endStick);
  stickZone.addEventListener('pointercancel', endStick);

  // --- Look zone: one finger orbits the camera, two fingers pinch to zoom ---
  const pointers = new Map();
  let pinchDist = 0;
  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  lookZone.addEventListener('pointerdown', (e) => {
    capture(lookZone, e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinchDist = pinchDistance();
  });
  lookZone.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 1) {
      chase.orbit(dx * 1.4, dy * 1.4);
    } else if (pointers.size === 2) {
      const d = pinchDistance();
      if (pinchDist > 0 && d > 0) chase.zoom(pinchDist / d);
      pinchDist = d;
    }
  });
  const endLook = (e) => {
    pointers.delete(e.pointerId);
    pinchDist = pointers.size === 2 ? pinchDistance() : 0;
  };
  lookZone.addEventListener('pointerup', endLook);
  lookZone.addEventListener('pointercancel', endLook);

  // --- Buttons ---
  root.querySelectorAll('.touch-btn').forEach((btn) => {
    const name = btn.dataset.action;
    const hold = btn.dataset.mode === 'hold';
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(btn, e.pointerId);
      btn.classList.add('down');
      if (hold) input.touch.hold(name, true);
      else input.touch.press(name);
    });
    const release = () => {
      btn.classList.remove('down');
      if (hold) input.touch.hold(name, false);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
  });

  return {
    setVisible(visible) {
      root.hidden = !visible;
      document.body.classList.toggle('touch-mode', visible);
      if (!visible) resetStick();
    },
    setSide(side) {
      document.body.classList.toggle('stick-right', side === 'right');
    },
    // Contextual action: the big button shows what it would do, dimmed when nothing is near.
    setAction(label) {
      actionLabel.textContent = label || 'Action';
      actionBtn.classList.toggle('idle', !label);
    },
  };
}
