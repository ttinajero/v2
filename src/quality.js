// Graphics presets. "auto" starts high and steps down if the first seconds run slowly,
// which keeps older iPads smooth.
export const PRESETS = {
  low: { pixelRatio: 1, rings: 200, segments: 288, spray: 0.4 },
  medium: { pixelRatio: 1.5, rings: 260, segments: 384, spray: 0.7 },
  high: { pixelRatio: 2, rings: 320, segments: 512, spray: 1 },
};
const ORDER = ['low', 'medium', 'high'];

export function createQuality(renderer, ocean, spray, onChange) {
  let level = null;
  let auto = false;
  let samples = [];
  let watchTime = 0;

  function apply(name) {
    if (name === level) return;
    level = name;
    const p = PRESETS[name];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, p.pixelRatio));
    ocean.setDetail(p.rings, p.segments);
    spray.density = p.spray;
    onChange?.(name);
  }

  return {
    get level() {
      return level;
    },
    set(setting) {
      auto = setting === 'auto';
      samples = [];
      watchTime = 0;
      apply(auto ? 'high' : setting);
    },
    // Call every frame with the real frame time.
    update(dt) {
      // Hidden tabs and hitches say nothing about how fast the device really is.
      if (!auto || document.hidden || dt > 0.25) return;
      watchTime += dt;
      if (watchTime < 1.5) return; // skip warm-up hitches
      samples.push(dt);
      if (samples.length < 120) return;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      samples = [];
      const fps = 1 / avg;
      const i = ORDER.indexOf(level);
      if (fps < 40 && i > 0) apply(ORDER[i - 1]);
      else if (fps >= 40) auto = false; // settled
    },
  };
}
