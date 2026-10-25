// Sea states. Weights go from the longest wave (left) to the shortest (right): boosting
// long ones makes a swell, boosting short ones makes a choppy wind sea. Only strengths
// change (never wavelengths or directions), so transitions never make the waves slide.
const PATTERNS = {
  calm: { chop: 0.5, weights: [0.9, 0.8, 0.7, 0.5, 0.4, 0.35, 0.3, 0.3], foam: 0.25, ripples: 0.7 },
  swell: { chop: 0.75, weights: [1.5, 1.3, 0.8, 0.5, 0.4, 0.4, 0.35, 0.3], foam: 0.35, ripples: 0.8 },
  normal: { chop: 0.85, weights: [1, 1, 1, 1, 1, 1, 1, 1], foam: 0.5, ripples: 1 },
  choppy: { chop: 0.85, weights: [0.5, 0.6, 0.9, 1.3, 1.5, 1.6, 1.6, 1.5], foam: 0.7, ripples: 1.4 },
  rough: { chop: 0.95, weights: [1.2, 1.2, 1.15, 1.1, 1.1, 1.1, 1, 1], foam: 0.85, ripples: 1.3 },
  bigSwell: { chop: 1, weights: [1.8, 1.5, 1, 0.8, 0.7, 0.6, 0.5, 0.5], foam: 0.75, ripples: 1.1 },
};

const DEFAULT_INTERVAL = 180; // seconds between changes (fixed rhythm; the next pattern is random)
const TRANSITION = 25; // seconds to blend into the new sea state

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export function createSea(game) {
  const { waves, params } = game;
  let currentName = 'normal';
  let from = snapshot();
  let to = PATTERNS.normal;
  let blend = 1;
  let timer = 0;

  function snapshot() {
    return { chop: params.chop, weights: [...waves.weights], foam: params.foam, ripples: params.ripples };
  }

  function change(name) {
    from = snapshot();
    to = PATTERNS[name];
    currentName = name;
    blend = 0; // silently: the sea just changes, no announcement
  }

  function pickRandom() {
    const names = Object.keys(PATTERNS).filter((n) => n !== currentName);
    return names[Math.floor(Math.random() * names.length)];
  }

  return {
    get pattern() {
      return currentName;
    },
    change,
    update(dt) {
      // The interval can be tuned from content.json without an update.
      const interval = game.content?.seaChangeSeconds ?? DEFAULT_INTERVAL;
      timer += dt;
      if (timer >= interval) {
        timer = 0;
        change(pickRandom());
      }
      if (blend < 1) {
        blend = Math.min(1, blend + dt / TRANSITION);
        const t = ease(blend);
        params.chop = lerp(from.chop, to.chop, t);
        params.foam = lerp(from.foam, to.foam, t);
        params.ripples = lerp(from.ripples, to.ripples, t);
        to.weights.forEach((w, i) => (waves.weights[i] = lerp(from.weights[i], w, t)));
      }
    },
  };
}
