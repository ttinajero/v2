import * as THREE from 'three';
import { createDolphin, createShark, createTurtle, createSeal, createWhale, animateCreature } from './models.js';
import { WORLD_HALF } from './world.js';
import { createDangerIcon, updateDangerIcon, attackDepth } from './events/common.js';

const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const UPDATE_RANGE = 650; // animate and show only nearby animals

// One swimming animal: heading, speed and a target depth, plus helpers to steer.
export class Creature {
  constructor(game, model, { x, z, depth = 1, speed = 1, turnRate = 1 }) {
    this.game = game;
    this.model = model;
    this.position = new THREE.Vector3(x, -depth, z);
    this.heading = rand(0, Math.PI * 2);
    this.pitch = 0;
    this.roll = 0;
    this.speed = speed;
    this.targetSpeed = speed;
    this.depth = depth;
    this.targetDepth = depth;
    this.turnRate = turnRate;
    this.phase = rand(0, 10);
    this.leap = 0; // extra height for jumps
    this.home = { x, z, radius: 400 };
    game.scene.add(model);
  }

  distanceTo(p) {
    return Math.hypot(this.position.x - p.x, this.position.z - p.z);
  }

  steerTo(x, z, dt, rate = this.turnRate) {
    const want = Math.atan2(x - this.position.x, z - this.position.z);
    const diff = wrap(want - this.heading);
    this.heading += THREE.MathUtils.clamp(diff, -rate * dt, rate * dt);
    return diff;
  }

  steerAway(x, z, dt, rate = this.turnRate) {
    this.steerTo(this.position.x * 2 - x, this.position.z * 2 - z, dt, rate);
  }

  wander(dt) {
    this.heading += Math.sin(this.game.time * 0.25 + this.phase) * 0.35 * dt;
    if (Math.hypot(this.position.x - this.home.x, this.position.z - this.home.z) > this.home.radius) {
      this.steerTo(this.home.x, this.home.z, dt, this.turnRate * 0.6);
    }
  }

  move(dt, effort = 0.4) {
    this.speed = THREE.MathUtils.lerp(this.speed, this.targetSpeed, 1 - Math.exp(-2 * dt));
    this.depth = THREE.MathUtils.lerp(this.depth, this.targetDepth, 1 - Math.exp(-1 * dt));
    const p = this.position;
    p.x = THREE.MathUtils.clamp(p.x + Math.sin(this.heading) * this.speed * dt, -WORLD_HALF, WORLD_HALF);
    p.z = THREE.MathUtils.clamp(p.z + Math.cos(this.heading) * this.speed * dt, -WORLD_HALF, WORLD_HALF);
    const surface = this.game.waves.heightAt(p.x, p.z);
    const prevY = p.y;
    p.y = surface - this.depth + this.leap;
    const vy = (p.y - prevY) / Math.max(dt, 1e-3);
    this.pitch = THREE.MathUtils.lerp(this.pitch, Math.atan2(vy, Math.max(this.speed, 0.5)) * 0.8, 1 - Math.exp(-6 * dt));

    const m = this.model;
    m.position.copy(p);
    m.rotation.set(-this.pitch, this.heading, this.roll, 'YXZ');
    animateCreature(m, this.game.time, effort, this.phase);
    return surface;
  }

  set visible(v) {
    this.model.visible = v;
  }
}

// Dolphins, turtles, seals, a humpback mother and calf, and sharks, each with simple
// behaviours that react to the orca. Also reports first sightings for the album.
export function createAnimals(game) {
  const { controller, spray, save } = game;
  const orca = controller.position;
  const all = [];

  // --- Dolphin pods: wander, porpoise, jump when the orca jumps nearby ---
  const pods = [
    { x: -150, z: -320 },
    { x: 520, z: 180 },
    { x: -620, z: 760 },
  ].map(({ x, z }) => {
    const members = Array.from({ length: 4 }, (_, i) => {
      const d = new Creature(game, createDolphin(), { x: x + i * 4, z: z + rand(-4, 4), depth: 1, speed: 3.5, turnRate: 1.2 });
      d.offset = new THREE.Vector2(rand(-6, 6), rand(-6, 4));
      return d;
    });
    members[0].home.radius = 500;
    all.push(...members);
    return { members, jumpTimer: 0, leader: members[0] };
  });

  // Friendly dolphins rescued in missions swim with the orca.
  const friends = Array.from({ length: 4 }, (_, i) => {
    const d = new Creature(game, createDolphin(), { x: orca.x + 10, z: orca.z + 10, depth: 1, speed: 4, turnRate: 2.5 });
    d.offset = new THREE.Vector2([-5, 5, -8, 8][i], [-2, -2, -7, -7][i]);
    d.visible = false;
    return d;
  });

  // --- Turtles: slow wanderers ---
  const turtles = Array.from({ length: 6 }, () => {
    const t = new Creature(game, createTurtle(), { x: rand(-1200, 1200), z: rand(-1200, 1200), depth: rand(1.5, 4), speed: 0.8, turnRate: 0.5 });
    t.home.radius = 250;
    all.push(t);
    return t;
  });

  // --- Seals: play at the surface around a favourite spot, scatter from the orca ---
  const sealSpots = [
    { x: -300, z: -420 },
    { x: 460, z: -660 },
  ];
  const seals = sealSpots.flatMap((spot) =>
    Array.from({ length: 4 }, () => {
      const s = new Creature(game, createSeal(), { x: spot.x + rand(-15, 15), z: spot.z + rand(-15, 15), depth: 0.25, speed: 1.2, turnRate: 2 });
      s.home.radius = 30;
      s.spot = spot;
      s.hop = 0;
      all.push(s);
      return s;
    }),
  );

  // --- Humpback mother and calf on a slow loop around the map ---
  const route = [
    [-900, -900],
    [900, -800],
    [1000, 700],
    [-200, 1100],
    [-1100, 300],
  ];
  const mother = new Creature(game, createWhale(), { x: route[0][0], z: route[0][1], depth: 2.5, speed: 1.6, turnRate: 0.15 });
  const calfModel = createWhale();
  calfModel.scale.setScalar(0.4);
  const calf = new Creature(game, calfModel, { x: route[0][0] + 10, z: route[0][1], depth: 1.2, speed: 1.6, turnRate: 0.6 });
  all.push(mother, calf);
  let routeIndex = 1;
  let blowTimer = 8;

  // --- Sharks: patrol a zone and bite intruders; a tail slap or a ram scares them off ---
  const sharkZones = [
    { x: -560, z: 340, radius: 70 },
    { x: 640, z: 760, radius: 70 },
  ];
  const sharks = sharkZones.flatMap((zone) =>
    Array.from({ length: 2 }, (_, i) => {
      const s = new Creature(game, createShark(), { x: zone.x + (i ? 20 : -20), z: zone.z, depth: 2.5, speed: 2.5, turnRate: 1.4 });
      s.zone = zone;
      s.icon = createDangerIcon();
      game.scene.add(s.icon);
      s.state = 'patrol';
      s.scared = 0;
      s.biteCooldown = 0;
      all.push(s);
      return s;
    }),
  );

  // --- Album: first sightings ---
  function sight(id, creature, range) {
    if (save.album[id] || creature.distanceTo(orca) > range) return;
    game.discover?.(id);
  }

  function updatePods(dt) {
    for (const pod of pods) {
      const leader = pod.leader;
      const near = leader.distanceTo(orca) < UPDATE_RANGE;
      pod.members.forEach((d) => (d.visible = near));
      if (!near) {
        leader.wander(dt);
        leader.move(dt);
        pod.members.slice(1).forEach((d) => d.position.copy(leader.position));
        continue;
      }
      leader.wander(dt);
      pod.jumpTimer -= dt;
      for (const d of pod.members) {
        if (d !== leader) {
          const tx = leader.position.x + Math.cos(leader.heading) * d.offset.x + Math.sin(leader.heading) * d.offset.y;
          const tz = leader.position.z - Math.sin(leader.heading) * d.offset.x + Math.cos(leader.heading) * d.offset.y;
          d.steerTo(tx, tz, dt, 2);
          const dist = Math.hypot(tx - d.position.x, tz - d.position.z);
          d.targetSpeed = THREE.MathUtils.clamp(leader.speed + dist * 0.3 - 1, 1, 7);
        }
        // Porpoising arcs; bigger leaps right after the orca jumps nearby.
        const big = pod.jumpTimer > 0;
        const cycle = Math.sin(game.time * (big ? 2.2 : 1.4) + d.phase);
        d.leap = Math.max(0, cycle) * (big ? 3.2 : 0.9) - 0.2;
        if (big && cycle > 0.97 && Math.random() < 0.05) spray.breach(d.position.x, d.position.y, d.position.z, { x: 0, z: 0 }, 2);
        d.move(dt, 0.6);
      }
      sight('dolphin', leader, 40);
    }
  }

  function updateFriends(dt) {
    const count = Math.min(save.friends || 0, friends.length);
    friends.forEach((d, i) => {
      d.visible = i < count;
      if (i >= count) return;
      const yaw = controller.yaw;
      const tx = orca.x + Math.cos(yaw) * d.offset.x + Math.sin(yaw) * d.offset.y;
      const tz = orca.z - Math.sin(yaw) * d.offset.x + Math.cos(yaw) * d.offset.y;
      const dist = Math.hypot(tx - d.position.x, tz - d.position.z);
      if (dist > 120) {
        d.position.set(tx, orca.y, tz); // caught up after a teleport or respawn
      }
      d.steerTo(tx, tz, dt, 3);
      d.targetSpeed = THREE.MathUtils.clamp(controller.speed + dist * 0.4 - 0.5, 0.8, 14);
      d.targetDepth = THREE.MathUtils.clamp(-controller.position.y + controller.surfaceY, 0.6, 30);
      d.leap = d.jump > 0 ? Math.max(0, Math.sin((1 - d.jump) * Math.PI)) * 3 : 0;
      d.jump = Math.max(0, (d.jump || 0) - dt);
      d.move(dt, 0.6);
    });
  }

  function updateTurtles(dt) {
    for (const t of turtles) {
      const near = t.distanceTo(orca) < UPDATE_RANGE;
      t.visible = near;
      t.wander(dt);
      // Come up to breathe now and then.
      t.targetDepth = Math.sin(game.time * 0.05 + t.phase) > 0.8 ? 0.4 : 2.5;
      if (near) {
        t.move(dt, 0.3);
        sight('turtle', t, 30);
      } else {
        t.move(dt);
      }
    }
  }

  function updateSeals(dt) {
    for (const s of seals) {
      const dist = s.distanceTo(orca);
      const near = dist < UPDATE_RANGE;
      s.visible = near;
      if (!near) continue;
      if (dist < 12) {
        s.steerAway(orca.x, orca.z, dt, 4);
        s.targetSpeed = 4.5;
        s.targetDepth = 0.6;
      } else {
        s.wander(dt);
        s.targetSpeed = 1 + Math.sin(game.time * 0.5 + s.phase) * 0.6;
        s.targetDepth = 0.25;
      }
      // Being touched by the orca: a startled hop (used by the seal tag mission).
      if (dist < 3.5 && s.hop <= 0) {
        s.hop = 1;
        game.emit?.({ type: 'sealTag', seal: s });
      }
      s.hop = Math.max(0, s.hop - dt * 1.5);
      s.leap = Math.sin(s.hop * Math.PI) * 1.2;
      s.roll = Math.sin(game.time * 1.3 + s.phase) * 0.4;
      s.move(dt, dist < 12 ? 0.9 : 0.3);
      sight('seal', s, 35);
    }
  }

  function updateWhales(dt) {
    const [wx, wz] = route[routeIndex];
    mother.steerTo(wx, wz, dt);
    if (Math.hypot(wx - mother.position.x, wz - mother.position.z) < 40) routeIndex = (routeIndex + 1) % route.length;
    // Surface to breathe every so often, with a tall blow.
    blowTimer -= dt;
    mother.targetDepth = blowTimer < 6 ? 0.9 : 3;
    const near = mother.distanceTo(orca) < UPDATE_RANGE + 200;
    mother.visible = near;
    calf.visible = near;
    mother.move(dt, 0.25);
    if (blowTimer <= 0) {
      if (near) {
        const head = 4.5;
        const bx = mother.position.x + Math.sin(mother.heading) * head;
        const bz = mother.position.z + Math.cos(mother.heading) * head;
        spray.spout(bx, game.waves.heightAt(bx, bz) + 0.3, bz, 1.6);
      }
      blowTimer = 22 + rand(0, 10);
    }
    const tx = mother.position.x + Math.cos(mother.heading) * 6 - Math.sin(mother.heading) * 2;
    const tz = mother.position.z - Math.sin(mother.heading) * 6 - Math.cos(mother.heading) * 2;
    calf.steerTo(tx, tz, dt, 1);
    calf.targetSpeed = THREE.MathUtils.clamp(Math.hypot(tx - calf.position.x, tz - calf.position.z) * 0.4 + 1, 1, 4);
    calf.targetDepth = mother.targetDepth * 0.6;
    calf.move(dt, 0.5);
    sight('humpback', mother, 70);
  }

  let danger = false;
  function updateSharks(dt) {
    danger = false;
    for (const s of sharks) {
      const dist = s.distanceTo(orca);
      const near = dist < UPDATE_RANGE;
      s.visible = near;
      s.biteCooldown = Math.max(0, s.biteCooldown - dt);
      s.scared = Math.max(0, s.scared - dt);
      const orcaInZone = Math.hypot(orca.x - s.zone.x, orca.z - s.zone.z) < s.zone.radius + 25;
      const inWater = !controller.inAir && controller.depth < 8;

      if (s.scared > 0) {
        s.state = 'flee';
        s.steerAway(orca.x, orca.z, dt, 3);
        s.targetSpeed = 7;
      } else if (orcaInZone && inWater) {
        s.state = 'chase';
        s.steerTo(orca.x, orca.z, dt, 1.8);
        s.targetSpeed = dist < 8 ? 3 : 5.5;
        s.targetDepth = attackDepth(controller);
        if (dist < 4.5 && s.biteCooldown === 0) {
          if (controller.damage(8, 'shark')) game.hud.showToast('A shark bit you! Tail slap to scare it away');
          s.biteCooldown = 3;
          s.heading += Math.PI * 0.6; // swing away after the bite
        }
        if (dist < 60) danger = true;
      } else {
        s.state = 'patrol';
        s.steerTo(s.zone.x + Math.sin(game.time * 0.2 + s.phase) * s.zone.radius, s.zone.z + Math.cos(game.time * 0.2 + s.phase) * s.zone.radius, dt);
        s.targetSpeed = 2.5;
        s.targetDepth = 2.5;
      }
      // Ramming at speed also sends a shark running.
      if (dist < 5 && controller.relSpeed > 6 && s.scared === 0) {
        s.scared = 20;
        game.hud.showToast('The shark swims away!');
        game.emit?.({ type: 'sharkScared', shark: s });
      }
      updateDangerIcon(game, s.icon, s.position, s.state === 'chase' && dist < 70);
      if (near) {
        s.move(dt, s.state === 'patrol' ? 0.4 : 0.9);
        sight('shark', s, 35);
      } else {
        s.move(dt);
      }
    }
    game.dangerNear = danger;
  }

  return {
    sharks,
    seals,
    pods,
    mother,
    update(dt) {
      updatePods(dt);
      updateFriends(dt);
      updateTurtles(dt);
      updateSeals(dt);
      updateWhales(dt);
      updateSharks(dt);
    },
    onEvent(e) {
      if (e.type === 'breach') {
        // Dolphins love to join in.
        for (const pod of pods) {
          if (pod.leader.distanceTo(orca) < 40) {
            pod.jumpTimer = 4;
            game.audio?.dolphinWhistle(pod.leader.position);
          }
        }
        friends.forEach((d, i) => setTimeout(() => (d.jump = 1), i * 150));
      }
      if (e.type === 'slap' || e.type === 'tailslap') {
        for (const s of sharks) {
          if (s.distanceTo(orca) < 28 && s.scared === 0) {
            s.scared = 20;
            game.hud.showToast('Your tail slap scared the shark away!');
            game.emit?.({ type: 'sharkScared', shark: s });
          }
        }
      }
    },
    markers(out) {
      for (const pod of pods) out.push({ x: pod.leader.position.x, z: pod.leader.position.z, type: 'animal' });
      out.push({ x: mother.position.x, z: mother.position.z, type: 'animal' });
      for (const z of sharkZones) {
        if (Math.hypot(z.x - orca.x, z.z - orca.z) < 400) out.push({ x: z.x, z: z.z, type: 'boat', label: 'Shark zone', color: '#c06070' });
      }
      for (const d of friends) if (d.model.visible) out.push({ x: d.position.x, z: d.position.z, type: 'friend' });
    },
  };
}
