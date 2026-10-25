import { openModal, el } from './ui.js';
import { ICONS } from './icons.js';
import { writeSave } from './save.js';

// --- Fullscreen (iPadOS Safari still needs the webkit prefix) ---
export function fullscreenSupported() {
  const d = document.documentElement;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen);
}

export function toggleFullscreen() {
  const d = document.documentElement;
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  if (active) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  else (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d);
}

// --- Settings ---
const FIELDS = [
  { key: 'quality', label: 'Graphics', type: 'select', options: [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] },
  { key: 'touch', label: 'Touch controls', type: 'select', options: [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']] },
  { key: 'joystickSide', label: 'Joystick side', type: 'select', options: [['left', 'Left'], ['right', 'Right']] },
  { key: 'sensitivity', label: 'Camera speed', type: 'range', min: 0.3, max: 2, step: 0.1 },
  { key: 'music', label: 'Music', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'sfx', label: 'Sound effects', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'reduceMotion', label: 'Calmer camera', type: 'toggle' },
  { key: 'largeText', label: 'Large text', type: 'toggle' },
];

export function openSettings(game) {
  const { settings } = game.save;
  const form = el('div', 'settings');
  for (const f of FIELDS) {
    const row = el('label', 'settings-row', form);
    el('span', 'settings-label', row, f.label);
    let input;
    if (f.type === 'select') {
      input = el('select', '', row, f.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''));
      input.value = settings[f.key];
    } else if (f.type === 'range') {
      input = el('input', '', row);
      Object.assign(input, { type: 'range', min: f.min, max: f.max, step: f.step, value: settings[f.key] });
    } else {
      input = el('input', '', row);
      input.type = 'checkbox';
      input.checked = settings[f.key];
    }
    input.addEventListener('input', () => {
      settings[f.key] = f.type === 'toggle' ? input.checked : f.type === 'range' ? Number(input.value) : input.value;
      writeSave(game.save);
      game.applySettings();
    });
  }

  openModal({ title: 'Settings', body: form, className: 'modal-settings' });
}

// --- Pause ---
export function openPause(game) {
  const body = el('div', 'pause-menu');
  const item = (icon, label, fn) => {
    const b = el('button', 'btn pause-item', body, `${icon}<span>${label}</span>`);
    b.type = 'button';
    b.addEventListener('click', () => {
      modal.close();
      fn();
    });
    return b;
  };
  const modal = openModal({ title: 'Paused', body, className: 'modal-pause' });
  item(ICONS.rise, 'Resume', () => {});
  item(ICONS.profile, 'Profile', () => game.openProfile?.());
  if (game.tutorial?.active) item(ICONS.close, 'Skip tutorial', () => game.tutorial.skip());
  if (game.missions?.active) item(ICONS.close, `Abandon "${game.missions.active.def.title}"`, () => game.missions.abandon());
  // Quick pod toggle: swim alone, or bring everyone back.
  const comps = game.family?.companions() || [];
  if (comps.length) {
    const anyFollowing = comps.some((c) => game.family.following(c.id));
    item(ICONS.call, anyFollowing ? 'Swim alone' : 'Call your pod back', () => (anyFollowing ? game.family.restAll() : game.family.callAll()));
  }
  item(ICONS.gear, 'Settings', () => openSettings(game));
  if (fullscreenSupported()) item(ICONS.fullscreen, 'Fullscreen', toggleFullscreen);
  if (game.openMainMenu) item(ICONS.map, 'Main menu', () => game.openMainMenu());
  return modal;
}

// --- Fainting: no death, the orca wakes up somewhere safe ---
export function openFaint(game, onContinue) {
  const reason = {
    air: 'You stayed under too long without air.',
    boat: 'That boat hit you hard.',
    propeller: 'Propellers are dangerous! Stay away from the back of boats.',
    shark: 'The sharks got the better of you this time.',
    greatwhite: 'The great white was too strong this time. Fleeing is smart too!',
    whirlpool: 'The whirlpool pulled you under. Sprint away from the middle next time!',
  }[game.lastDamageSource] || 'You got hurt too much.';
  openModal({
    title: 'You fainted!',
    body: `<p>${reason}</p><p>Your family carried you somewhere safe. Rest, eat some fish and try again!</p>`,
    dismissable: false,
    className: 'modal-faint',
    buttons: [{ label: 'Keep swimming', primary: true, onClick: onContinue }],
  });
}
