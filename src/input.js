// Player intent as named actions, fed by the keyboard and by the touch controls,
// so the game never needs to know which device a command came from.
const KEY_ACTIONS = {
  sprint: ['ShiftLeft', 'ShiftRight'],
  rise: ['Space'],
  dive: ['KeyC', 'ControlLeft', 'ControlRight'],
  spyhop: ['KeyQ'],
  tailSlap: ['KeyE'],
  jump: ['KeyJ'],
  action: ['KeyF'],
  call: ['KeyV'],
  map: ['KeyM'],
  pause: ['Escape', 'KeyP'],
  panel: ['KeyH'],
};

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

export function createInput() {
  const keys = new Set();
  const pressedKeys = new Set();
  const touchHeld = new Set();
  const touchPressed = new Set();
  const stick = { x: 0, y: 0 }; // touch joystick, y > 0 is forward
  let enabled = true;

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (!keys.has(e.code)) pressedKeys.add(e.code);
    keys.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    touchHeld.clear();
  });

  const anyKey = (codes) => codes.some((c) => keys.has(c));

  return {
    held(name) {
      return enabled && (touchHeld.has(name) || anyKey(KEY_ACTIONS[name]));
    },
    // True during the frame the action was triggered.
    pressed(name) {
      return enabled && (touchPressed.has(name) || KEY_ACTIONS[name].some((c) => pressedKeys.has(c)));
    },
    // Global UI keys work even while gameplay input is disabled (menus, loading).
    pressedAlways(name) {
      return touchPressed.has(name) || KEY_ACTIONS[name].some((c) => pressedKeys.has(c));
    },
    forward() {
      if (!enabled) return 0;
      return Math.max(anyKey(FORWARD_KEYS) ? 1 : 0, stick.y > 0.15 ? Math.min(stick.y * 1.15, 1) : 0);
    },
    back() {
      return enabled && (anyKey(BACK_KEYS) || stick.y < -0.55);
    },
    turn() {
      if (!enabled) return 0;
      const keysTurn = (anyKey(LEFT_KEYS) ? 1 : 0) - (anyKey(RIGHT_KEYS) ? 1 : 0);
      const stickTurn = Math.abs(stick.x) > 0.12 ? -stick.x : 0;
      return Math.max(-1, Math.min(1, keysTurn + stickTurn));
    },
    get enabled() {
      return enabled;
    },
    setEnabled(value) {
      enabled = value;
      keys.clear();
      pressedKeys.clear();
      touchHeld.clear();
      touchPressed.clear();
      stick.x = 0;
      stick.y = 0;
    },
    endFrame() {
      pressedKeys.clear();
      touchPressed.clear();
    },
    touch: {
      stick,
      hold(name, on) {
        if (on) {
          if (!touchHeld.has(name)) touchPressed.add(name);
          touchHeld.add(name);
        } else {
          touchHeld.delete(name);
        }
      },
      press(name) {
        touchPressed.add(name);
      },
    },
  };
}
