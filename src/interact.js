import * as THREE from 'three';

// Contextual "Action": systems offer interactables each frame ({ x, y, z, radius, label, onAction }),
// the closest one in reach of the orca's head wins and is shown on the button / prompt.
export function createInteract(game) {
  const head = new THREE.Vector3();
  let current = null;
  let cooldown = 0;

  return {
    get label() {
      return current?.label || '';
    },
    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      const c = game.controller;
      head.copy(c.position).addScaledVector(c.forward, 2.8);
      const offers = [];
      for (const s of game.systems) s.interactables?.(offers);
      current = null;
      let best = Infinity;
      for (const o of offers) {
        const d = Math.hypot(head.x - o.x, (head.y - (o.y ?? head.y)) * 0.6, head.z - o.z);
        if (d < o.radius && d < best) {
          best = d;
          current = o;
        }
      }
      if (current && cooldown === 0 && game.input.pressed('action')) {
        cooldown = current.cooldown ?? 0.25;
        current.onAction();
      }
    },
  };
}
