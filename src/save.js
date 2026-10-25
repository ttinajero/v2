// Progress and settings, kept in the browser's localStorage.
const KEY = 'orca-save-v1';

export const DEFAULT_SETTINGS = {
  quality: 'auto', // auto | low | medium | high
  touch: 'auto', // auto | on | off
  sensitivity: 1,
  joystickSide: 'left',
  reduceMotion: false,
  largeText: false,
  music: 0.5,
  sfx: 0.8,
};

function defaults() {
  return {
    version: 1,
    name: '',
    points: 0, // spendable
    totalPoints: 0, // lifetime, decides the rank
    missions: {}, // id -> best stars
    upgrades: { air: 0, speed: 0, strength: 0, energy: 0 },
    skin: 'classic',
    skins: ['classic'],
    album: {}, // species id -> true
    family: [], // ids of family members found
    friends: 0, // dolphins rescued that now follow
    resting: [], // companions sent away to rest (family ids or 'dolphins')
    tutorialDone: false,
    started: false,
    hour: 9, // time of day, kept between sessions
    seenMessages: [], // ids of content.json announcements already shown
    settings: { ...DEFAULT_SETTINGS },
  };
}

function merge(base, data) {
  for (const key of Object.keys(data || {})) {
    const value = data[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      merge(base[key], value);
    } else if (value !== undefined) {
      base[key] = value;
    }
  }
  return base;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return merge(defaults(), raw ? JSON.parse(raw) : {});
  } catch {
    return defaults();
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or storage full: the game keeps working, it just won't remember.
  }
}

// Fresh progress that keeps the player's settings.
export function resetProgress(save) {
  const fresh = defaults();
  fresh.settings = save.settings;
  Object.keys(save).forEach((k) => delete save[k]);
  Object.assign(save, fresh);
  writeSave(save);
}
