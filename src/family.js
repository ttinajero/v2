import * as THREE from 'three';
import { createOrca } from './orca.js';
import { water } from './materials.js';

// The orca's family: found in the "Find Your Family" mission, then they swim along.
export const FAMILY = [
  { id: 'grandma', name: 'Grandma Tika', scale: 1.15, spot: { x: -1150, z: -950 }, offset: [-9, -8] },
  { id: 'mom', name: 'Mom Luna', scale: 1.05, spot: { x: 1150, z: -300 }, offset: [9, -8] },
  { id: 'sister', name: 'Little Pip', scale: 0.7, spot: { x: 300, z: 1250 }, offset: [-4, -14] },
];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class FamilyOrca {
  constructor(game, member) {
    this.game = game;
    this.member = member;
    const { group, uniforms } = createOrca();
    group.scale.setScalar(member.scale);
    this.group = group;
    this.uniforms = uniforms;
    this.position = new THREE.Vector3(member.spot.x, -0.8, member.spot.z);
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.phase = Math.random() * 10;
    this.pitch = 0;
    this.leap = 0;
    this.jump = 0;
    game.scene.add(group);
  }

  update(dt, target, speed) {
    const p = this.position;
    if (target) {
      const want = Math.atan2(target.x - p.x, target.z - p.z);
      this.heading += THREE.MathUtils.clamp(wrap(want - this.heading), -1.6 * dt, 1.6 * dt);
    } else {
      this.heading += Math.sin(this.game.time * 0.2 + this.phase) * 0.3 * dt; // idle circling
    }
    this.speed = THREE.MathUtils.lerp(this.speed, speed, 1 - Math.exp(-1.5 * dt));
    p.x += Math.sin(this.heading) * this.speed * dt;
    p.z += Math.cos(this.heading) * this.speed * dt;
    this.jump = Math.max(0, this.jump - dt * 0.8);
    this.leap = Math.sin((1 - this.jump) * Math.PI) * (this.jump > 0 ? 4 : 0);
    const surface = this.game.waves.heightAt(p.x, p.z);
    const prevY = p.y;
    p.y = surface - 0.8 * this.member.scale + this.leap;
    const vy = (p.y - prevY) / Math.max(dt, 1e-3);
    this.pitch = THREE.MathUtils.lerp(this.pitch, Math.atan2(vy, Math.max(this.speed, 1)) * 0.9, 1 - Math.exp(-5 * dt));
    this.group.position.copy(p);
    this.group.rotation.set(-this.pitch, this.heading, 0);
    this.phase += dt * (1.5 + this.speed * 0.6);
    this.uniforms.uSwimPhase.value = this.phase;
    this.uniforms.uSwimAmp.value = 0.06 + Math.min(this.speed / 12, 1) * 0.18;
    this.uniforms.uSurfaceY.value = surface;
    this.uniforms.uWaterColor.value.copy(water.uWaterColor.value);
  }
}

// Waiting family members sit at their spots; found ones follow in formation.
export function createFamily(game) {
  const { controller, save } = game;
  const members = FAMILY.map((m) => new FamilyOrca(game, m));
  const found = (id) => save.family.includes(id);

  return {
    members,
    found,
    join(id) {
      if (found(id)) return;
      save.family.push(id);
      game.persist();
    },
    update(dt) {
      const orca = controller.position;
      for (const fo of members) {
        const visible = found(fo.member.id) || game.missions?.active?.def.id === 'find-family' || Math.hypot(fo.position.x - orca.x, fo.position.z - orca.z) < 700;
        fo.group.visible = visible;
        if (!found(fo.member.id)) {
          fo.update(dt, null, 1.2);
          continue;
        }
        const yaw = controller.yaw;
        const [ox, oz] = fo.member.offset;
        const tx = orca.x + Math.cos(yaw) * ox + Math.sin(yaw) * oz;
        const tz = orca.z - Math.sin(yaw) * ox + Math.cos(yaw) * oz;
        const dist = Math.hypot(tx - fo.position.x, tz - fo.position.z);
        if (dist > 150) fo.position.set(tx, fo.position.y, tz); // after a respawn
        fo.update(dt, { x: tx, z: tz }, THREE.MathUtils.clamp(controller.speed + dist * 0.35 - 0.5, 0.6, 14));
      }
    },
    onEvent(e) {
      if (e.type === 'breach') members.forEach((fo, i) => found(fo.member.id) && setTimeout(() => (fo.jump = 1), 200 + i * 250));
    },
    markers(out) {
      for (const fo of members) if (found(fo.member.id)) out.push({ x: fo.position.x, z: fo.position.z, type: 'friend' });
    },
    jumpAll() {
      members.forEach((fo, i) => found(fo.member.id) && setTimeout(() => (fo.jump = 1), i * 200));
    },
  };
}
