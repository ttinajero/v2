import * as THREE from 'three';
import { Creature } from '../animals.js';
import { createShark } from '../models.js';
import { rand, dist2d, distanceToSegment, pointNearOrca, createDangerIcon, updateDangerIcon, attackDepth } from './common.js';

// A shark that hunts the orca: chases inside its aggro range, bites with a cooldown,
// and runs off for a while when scared by a tail slap.
export class HostileShark {
  constructor(game, x, z, { scale = 1, damage = 7, speed = 5.5 } = {}) {
    this.game = game;
    const model = createShark();
    model.scale.setScalar(scale);
    this.creature = new Creature(game, model, { x, z, depth: 1.5, speed: 3, turnRate: 1.6 });
    this.damage = damage;
    this.chaseSpeed = speed;
    this.scared = 0;
    this.cooldown = rand(0, 1.5);
    this.icon = createDangerIcon();
    game.scene.add(this.icon);
  }

  get position() {
    return this.creature.position;
  }

  scare(seconds = 10) {
    this.scared = seconds;
  }

  // home: where to swim when not chasing. Returns true while chasing the orca.
  update(dt, { home, aggro = 30, mayChase = true }) {
    const c = this.game.controller;
    const orca = c.position;
    const s = this.creature;
    const d = s.distanceTo(orca);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.scared = Math.max(0, this.scared - dt);
    let chasing = false;
    if (this.scared > 0) {
      s.steerAway(orca.x, orca.z, dt, 3);
      s.targetSpeed = 7;
    } else if (mayChase && d < aggro && !c.inAir && c.depth < 8) {
      chasing = true;
      s.steerTo(orca.x, orca.z, dt, 1.9);
      s.targetSpeed = d < 8 ? 3.5 : this.chaseSpeed;
      s.targetDepth = attackDepth(c);
      if (d < 4.5 && this.cooldown === 0) {
        c.damage(this.damage, 'shark');
        this.cooldown = 2.5;
        s.heading += Math.PI * 0.6;
      }
    } else if (home) {
      s.steerTo(home.x, home.z, dt, 1.4);
      s.targetSpeed = 4.5;
      s.targetDepth = 1.5;
    }
    s.move(dt, chasing ? 0.9 : 0.5);
    updateDangerIcon(this.game, this.icon, s.position, chasing && d < 70);
    return chasing;
  }

  dispose() {
    this.game.scene.remove(this.icon);
    this.icon.material.map.dispose();
    this.icon.material.dispose();
    this.game.scene.remove(this.creature.model);
    this.creature.model.traverse((o) => o.geometry?.dispose());
  }
}

// Scares sharks near the orca when it tail-slaps.
function scareNearby(game, sharks, radius, seconds) {
  let any = false;
  for (const s of sharks) {
    if (dist2d(s.position, game.controller.position) < radius && s.scared === 0) {
      s.scare(seconds);
      any = true;
    }
  }
  if (any) game.hud.showToast('Your tail slap scattered the sharks!');
}

// A pack that appears around a spot and hunts the orca for a while (mystery outcome).
export function createSharkPack(game, spot) {
  const sharks = Array.from({ length: 4 }, (_, i) => {
    const a = (i / 4) * Math.PI * 2;
    return new HostileShark(game, spot.x + Math.cos(a) * 40, spot.z + Math.sin(a) * 40, { damage: 6 });
  });
  let time = 0;
  const DURATION = 40;
  game.hud.showToast('It was a shark pack! Tail slap to scare them off!');
  game.audio?.danger();
  return {
    update(dt) {
      time += dt;
      const leaving = time > DURATION;
      for (const s of sharks) s.update(dt, { home: leaving ? { x: spot.x + 600, z: spot.z + 600 } : spot, aggro: 60, mayChase: !leaving });
      if (time > DURATION + 12) this.done = true;
    },
    onEvent(e) {
      if (e.type === 'tailslap') scareNearby(game, sharks, 25, 10);
    },
    alerts(out) {
      if (time < DURATION && sharks.some((s) => dist2d(s.position, game.controller.position) < 70)) out.push('Shark pack! Tail slap to scare them off');
    },
    markers(out) {
      for (const s of sharks) out.push({ x: s.position.x, z: s.position.z, type: 'danger' });
    },
    dispose() {
      sharks.forEach((s) => s.dispose());
    },
  };
}

// The red stripe: a corridor a big swarm of sharks will swim along after a warning.
export function createSharkStream(game) {
  const orca = game.controller.position;
  const mid = pointNearOrca(game, 60, 160, Math.PI);
  const angle = rand(0, Math.PI * 2);
  const HALF = 280;
  const WIDTH = 50;
  const a = { x: mid.x - Math.sin(angle) * HALF, z: mid.z - Math.cos(angle) * HALF };
  const b = { x: mid.x + Math.sin(angle) * HALF, z: mid.z + Math.cos(angle) * HALF };
  const dir = { x: Math.sin(angle), z: Math.cos(angle) };
  const side = { x: Math.cos(angle), z: -Math.sin(angle) };
  const WARNING = 25;
  const SPEED = 5;
  let time = 0;
  let sharks = null;
  let progress = 0; // metres travelled along the corridor
  game.hud.showToast('A shark swarm is coming! Stay out of the red zone.', 5);
  game.audio?.danger();

  const center = () => ({ x: a.x + dir.x * progress, z: a.z + dir.z * progress });
  const orcaInStripe = () => distanceToSegment(orca, a, b).d < WIDTH / 2 + 10;

  return {
    update(dt) {
      time += dt;
      if (time < WARNING) return;
      if (!sharks) {
        sharks = Array.from({ length: 10 }, () => {
          const s = new HostileShark(game, a.x + side.x * rand(-20, 20) - dir.x * rand(0, 40), a.z + side.z * rand(-20, 20) - dir.z * rand(0, 40), { damage: 7, speed: 6 });
          s.offset = { lat: rand(-WIDTH / 2.5, WIDTH / 2.5), lon: rand(-35, 35) };
          return s;
        });
      }
      progress += SPEED * dt;
      const c = center();
      const inside = orcaInStripe();
      for (const s of sharks) {
        const home = { x: c.x + side.x * s.offset.lat + dir.x * (s.offset.lon + 15), z: c.z + side.z * s.offset.lat + dir.z * (s.offset.lon + 15) };
        s.update(dt, { home, aggro: 28, mayChase: inside });
      }
      if (progress > HALF * 2 + 60) this.done = true;
    },
    onEvent(e) {
      if (e.type === 'tailslap' && sharks) scareNearby(game, sharks, 25, 8);
    },
    alerts(out) {
      const near = distanceToSegment(orca, a, b).d < WIDTH / 2 + 60;
      if (!near) return;
      out.push(time < WARNING ? `Shark swarm in ${Math.ceil(WARNING - time)}s! Leave the red zone` : 'Shark swarm! Get out of the red zone');
    },
    markers(out) {
      out.push({ type: 'stripe', x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: WIDTH, x: mid.x, z: mid.z });
      if (sharks) {
        const c = center();
        out.push({ x: c.x, z: c.z, type: 'danger', label: 'Shark swarm' });
      }
    },
    dispose() {
      sharks?.forEach((s) => s.dispose());
    },
  };
}
