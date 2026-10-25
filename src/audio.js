// All sound is synthesised with the Web Audio API: no files to download.
// Browsers (iPad Safari especially) only allow audio after a tap, so unlock() is
// called from the "Start swimming" button.

const CALM = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
const TENSE = [
  [50, 53, 57], // Dm
  [46, 50, 53], // Bb
  [43, 46, 50], // Gm
  [45, 49, 52], // A
];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createAudio(game) {
  let ctx = null;
  let master;
  let musicBus;
  let sfxBus;
  let worldFilter; // muffles the world when the orca is underwater
  let noiseBuffer;
  let ambience;
  let engine;
  let music;
  let volumes = { music: 0.5, sfx: 0.8 };

  function unlock() {
    if (ctx) {
      ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    worldFilter = ctx.createBiquadFilter();
    worldFilter.type = 'lowpass';
    worldFilter.frequency.value = 18000;
    sfxBus.connect(worldFilter).connect(master);
    musicBus.connect(master);
    setVolumes(volumes.music, volumes.sfx);

    // One second of white noise, reused by every noisy sound.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    startAmbience();
    startEngine();
    startMusic();
    // Re-resume when coming back to the tab (iOS suspends audio in the background).
    document.addEventListener('visibilitychange', () => !document.hidden && ctx.resume?.());
  }

  function setVolumes(m, s) {
    volumes = { music: m, sfx: s };
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(m * 0.35, ctx.currentTime, 0.1);
    sfxBus.gain.setTargetAtTime(s, ctx.currentTime, 0.1);
  }

  function noise() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    src.loopStart = Math.random();
    return src;
  }

  // Envelope helper: attack to `peak`, exponential decay over `decay` seconds.
  function envelope(gainNode, t, peak, attack, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // Volume for a sound at a world position.
  function atDistance(pos, base = 1) {
    if (!pos) return base;
    const o = game.controller.position;
    const d = Math.hypot(pos.x - o.x, pos.z - o.z);
    return base / (1 + d / 25);
  }

  function noiseHit({ freq = 800, q = 0.7, type = 'lowpass', peak = 0.5, attack = 0.01, decay = 0.6, sweepTo = null, pos = null }) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    filter.Q.value = q;
    const g = ctx.createGain();
    envelope(g, t, peak * atDistance(pos), attack, decay);
    src.connect(filter).connect(g).connect(sfxBus);
    src.start(t);
    src.stop(t + attack + decay + 0.1);
  }

  function tone({ freq = 440, to = null, type = 'sine', peak = 0.2, attack = 0.01, decay = 0.3, delay = 0, vibrato = 0, bus = null, pos = null }) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + attack + decay + 0.1);
    }
    const g = ctx.createGain();
    envelope(g, t, peak * atDistance(pos), attack, decay);
    osc.connect(g).connect(bus || sfxBus);
    osc.start(t);
    osc.stop(t + attack + decay + 0.1);
  }

  // --- Continuous layers ---
  function startAmbience() {
    // Surf: low-passed noise whose loudness swells slowly like waves.
    const src = noise();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.value = 0.18;
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoDepth.gain.value = 0.1;
    lfo.connect(lfoDepth).connect(g.gain);
    src.connect(lp).connect(g).connect(sfxBus);
    src.start();
    lfo.start();
    // A little wind hiss on top.
    const wind = noise();
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2400;
    hp.Q.value = 0.4;
    const wg = ctx.createGain();
    wg.gain.value = 0.025;
    wind.connect(hp).connect(wg).connect(sfxBus);
    wind.start();
    ambience = { g, wg };
  }

  function startEngine() {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(lp).connect(g).connect(sfxBus);
    osc.start();
    engine = { osc, g };
  }

  function startMusic() {
    music = { chord: 0, nextChord: 0, tension: 0, bassStep: 0, nextBass: 0 };
  }

  function playChord(notes, tense) {
    const t = ctx.currentTime;
    notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = midi(n);
      osc.detune.value = (Math.random() - 0.5) * 8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(tense ? 0.09 : 0.07, t + 1.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 8.5);
      osc.connect(g).connect(musicBus);
      osc.start(t);
      osc.stop(t + 9);
    });
    // A gentle high melody note now and then.
    if (Math.random() < 0.6) {
      const n = notes[Math.floor(Math.random() * notes.length)] + 12 + (Math.random() < 0.5 ? 7 : 0);
      tone({ freq: midi(n), type: 'sine', peak: 0.05, attack: 0.6, decay: 3, delay: 1 + Math.random() * 3, bus: musicBus });
    }
  }

  let lastWhale = 0;
  function update(dt) {
    if (!ctx) return;
    const c = game.controller;
    const t = ctx.currentTime;

    // Underwater: muffle everything in the world.
    const under = !c.inAir && c.depth > 1.6;
    worldFilter.frequency.setTargetAtTime(under ? 700 : 18000, t, 0.25);
    ambience.g.gain.setTargetAtTime(under ? 0.12 : 0.18, t, 0.5);

    // Boat engine hum from the nearest poacher.
    const near = game.boats?.nearestThreat?.() ?? Infinity;
    const engineLevel = near < 150 ? (1 - near / 150) * 0.12 : 0;
    engine.g.gain.setTargetAtTime(engineLevel, t, 0.3);
    engine.osc.frequency.setTargetAtTime(55 + Math.sin(game.time * 3) * 2 + (near < 40 ? 10 : 0), t, 0.2);

    // Whale song when the humpbacks are close.
    const whale = game.animals?.mother;
    if (whale && whale.distanceTo(c.position) < 220 && game.time - lastWhale > 14) {
      lastWhale = game.time;
      const pos = whale.position;
      tone({ freq: 140, to: 90, type: 'sine', peak: 0.25, attack: 0.8, decay: 2.2, vibrato: 6, pos });
      tone({ freq: 280, to: 200, type: 'triangle', peak: 0.06, attack: 0.9, decay: 2, delay: 0.2, vibrato: 10, pos });
    }

    // Music: calm chords, switching to a tense progression with a pulsing bass near danger.
    const danger = near < 120 || game.dangerNear;
    music.tension += ((danger ? 1 : 0) - music.tension) * Math.min(1, dt * 0.8);
    if (t >= music.nextChord) {
      const tense = music.tension > 0.5;
      playChord((tense ? TENSE : CALM)[music.chord % 4], tense);
      music.chord++;
      music.nextChord = t + (tense ? 4 : 8);
    }
    if (music.tension > 0.5 && t >= music.nextBass) {
      const root = TENSE[(music.chord + 3) % 4][0] - 12;
      tone({ freq: midi(root + (music.bassStep % 4 === 3 ? 7 : 0)), type: 'sawtooth', peak: 0.07, attack: 0.01, decay: 0.22, bus: musicBus });
      music.bassStep++;
      music.nextBass = t + 0.3;
    }
  }

  return {
    unlock,
    setVolumes,
    update,
    get unlocked() {
      return !!ctx;
    },
    splash(strength = 2, pos) {
      noiseHit({ freq: 1200 + strength * 200, sweepTo: 300, peak: Math.min(0.15 + strength * 0.06, 0.8), attack: 0.01, decay: 0.5 + strength * 0.08, pos });
      noiseHit({ freq: 180, peak: Math.min(0.1 + strength * 0.05, 0.6), decay: 0.35, pos });
    },
    blow(pos) {
      noiseHit({ type: 'bandpass', freq: 500, sweepTo: 1600, q: 1.2, peak: 0.35, attack: 0.08, decay: 0.9, pos });
    },
    bite() {
      tone({ freq: 160, to: 60, type: 'square', peak: 0.12, decay: 0.12 });
      noiseHit({ type: 'highpass', freq: 2500, peak: 0.25, decay: 0.08 });
    },
    slap(pos) {
      noiseHit({ type: 'highpass', freq: 1500, peak: 0.6, decay: 0.15, pos });
      tone({ freq: 90, to: 45, peak: 0.4, decay: 0.3, pos });
    },
    damage() {
      tone({ freq: 220, to: 70, type: 'square', peak: 0.1, decay: 0.3 });
      tone({ freq: 60, to: 35, peak: 0.4, decay: 0.35 });
    },
    eat() {
      tone({ freq: 420, to: 160, peak: 0.12, decay: 0.12 });
    },
    // The orca's call: a rising, wavering whistle. Family members answer.
    orcaCall(pitch = 1) {
      tone({ freq: 900 * pitch, to: 1700 * pitch, type: 'sine', peak: 0.22, attack: 0.15, decay: 0.7, vibrato: 30 });
      tone({ freq: 1700 * pitch, to: 1100 * pitch, type: 'sine', peak: 0.16, attack: 0.05, decay: 0.5, delay: 0.75, vibrato: 25 });
      tone({ freq: 450 * pitch, to: 700 * pitch, type: 'triangle', peak: 0.05, attack: 0.15, decay: 1, vibrato: 12 });
    },
    familyReply(delay, pitch) {
      tone({ freq: 800 * pitch, to: 1400 * pitch, type: 'sine', peak: 0.1, attack: 0.15, decay: 0.6, delay, vibrato: 25 });
    },
    dolphinWhistle(pos) {
      tone({ freq: 2400, to: 4200, type: 'sine', peak: 0.12, attack: 0.05, decay: 0.35, vibrato: 120, pos });
      tone({ freq: 4200, to: 2600, type: 'sine', peak: 0.1, attack: 0.02, decay: 0.3, delay: 0.38, vibrato: 90, pos });
    },
    ui() {
      tone({ freq: 880, type: 'triangle', peak: 0.06, decay: 0.06, bus: musicBus });
    },
    success() {
      [72, 76, 79, 84].forEach((n, i) => tone({ freq: midi(n), type: 'triangle', peak: 0.2, decay: 0.35, delay: i * 0.12, bus: musicBus }));
    },
    fail() {
      [67, 63, 60].forEach((n, i) => tone({ freq: midi(n), type: 'triangle', peak: 0.16, decay: 0.4, delay: i * 0.18, bus: musicBus }));
    },
    // Short warning sting when something dangerous appears.
    danger() {
      [52, 51].forEach((n, i) => tone({ freq: midi(n), type: 'sawtooth', peak: 0.12, attack: 0.02, decay: 0.5, delay: i * 0.35, bus: musicBus }));
    },
    // Deep rumble for the sea monster.
    rumble(intensity = 1) {
      noiseHit({ freq: 120, peak: 0.5 * intensity, attack: 0.6, decay: 2.5 });
      tone({ freq: 42, to: 30, type: 'sine', peak: 0.5 * intensity, attack: 0.5, decay: 2.5 });
      tone({ freq: 63, to: 47, type: 'triangle', peak: 0.15 * intensity, attack: 0.8, decay: 2, vibrato: 3 });
    },
    // Eerie choir for ghosts and the ghost ship.
    spooky() {
      [57, 60, 63].forEach((n, i) => tone({ freq: midi(n), type: 'sine', peak: 0.07, attack: 1.2, decay: 3, delay: i * 0.25, vibrato: 4, bus: musicBus }));
    },
    giggle() {
      [0, 0.12, 0.24].forEach((d, i) => tone({ freq: 900 + i * 120, to: 1300 + i * 120, type: 'sine', peak: 0.08, attack: 0.01, decay: 0.09, delay: d }));
    },
    // A wordless, wavering siren song.
    sirenSong() {
      [69, 72, 76, 74, 72].forEach((n, i) => tone({ freq: midi(n), type: 'sine', peak: 0.08, attack: 0.25, decay: 0.7, delay: i * 0.45, vibrato: 8, bus: musicBus }));
    },
    // Crackly radio when a boat calls for backup.
    radio() {
      noiseHit({ type: 'bandpass', freq: 1800, q: 4, peak: 0.25, attack: 0.02, decay: 0.6 });
      [0, 0.2, 0.4].forEach((d) => tone({ freq: 1200, type: 'square', peak: 0.05, decay: 0.08, delay: d }));
    },
    fanfare() {
      [60, 64, 67, 72, 67, 72].forEach((n, i) => tone({ freq: midi(n), type: 'square', peak: 0.08, decay: 0.3, delay: i * 0.13, bus: musicBus }));
    },
  };
}
