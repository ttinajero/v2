import { createMystery } from './events/mystery.js';
import { createSharkStream } from './events/sharks.js';
import { createGreatWhite } from './events/greatWhite.js';
import { createApparition, createMonster } from './events/night.js';

// Event types. danger: counts toward the "one big danger at a time" limit and is more
// likely at night. calm: may still start during a mission. night: only after dark.
const TYPES = {
  mystery: { create: createMystery, max: 2, calm: true },
  sharkStream: { create: createSharkStream, max: 1, danger: true },
  greatWhite: { create: createGreatWhite, max: 1, danger: true },
  apparition: { create: createApparition, max: 1, calm: true, night: true },
  monster: { create: createMonster, max: 1, calm: true, night: true },
};

const DEFAULT_WEIGHTS = { mystery: 1, sharkStream: 0.45, greatWhite: 0.3, apparition: 0.7, monster: 0.06 };
const NOTHING_WEIGHT = 0.8; // sometimes nothing happens, so events stay special

const rand = (a, b) => a + Math.random() * (b - a);

// Random world events: mystery spots, shark swarms, great whites and night apparitions.
// Odds come from content.json (re-read every 10 minutes), so they can change without an update.
export function createEvents(game) {
  const active = [];
  let timer = rand(25, 40);

  function weights() {
    const w = { ...DEFAULT_WEIGHTS, ...(game.content?.events || {}) };
    const nightMultiplier = game.content?.nightDangerMultiplier ?? 2;
    const dangerActive = active.some((e) => TYPES[e.type].danger);
    for (const [id, type] of Object.entries(TYPES)) {
      const count = active.filter((e) => e.type === id).length;
      if ((type.night && !game.isNight) || count >= type.max) w[id] = 0;
      if (type.danger && (dangerActive || game.missions?.active)) w[id] = 0;
      if (type.danger && game.isNight) w[id] *= nightMultiplier;
      if (game.tutorial?.active) w[id] = 0;
    }
    return w;
  }

  function start(type, options) {
    const instance = TYPES[type].create(game, options);
    instance.type = type;
    active.push(instance);
    return instance;
  }

  function pick() {
    const w = weights();
    const total = Object.values(w).reduce((a, b) => a + b, 0) + NOTHING_WEIGHT;
    let r = Math.random() * total;
    for (const [id, weight] of Object.entries(w)) {
      if ((r -= weight) < 0) return id;
    }
    return null;
  }

  return {
    active,
    start,
    update(dt) {
      if (!game.started) return;
      timer -= dt;
      if (timer <= 0) {
        timer = rand(40, 90);
        const type = pick();
        if (type) start(type);
      }
      for (const e of [...active]) {
        e.update(dt);
        if (e.done) {
          e.dispose?.();
          active.splice(active.indexOf(e), 1);
        }
      }
    },
    onEvent(event) {
      for (const e of active) e.onEvent?.(event);
      if (event.type === 'faint') for (const e of active) e.onFaint?.();
    },
    markers(out) {
      for (const e of active) e.markers?.(out);
    },
    interactables(out) {
      for (const e of active) e.interactables?.(out);
    },
    alerts(out) {
      for (const e of active) e.alerts?.(out);
    },
    bossBar() {
      for (const e of active) {
        const b = e.bossBar?.();
        if (b) return b;
      }
      return null;
    },
  };
}
