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

// Waiting family members sit at their spots; found ones follow in formation unless
// the player sent them to rest (then they swim home and wait to be called again).
// The rest list also holds 'dolphins' for the rescued dolphin friends.
export function createFamily(game) {
  const { controller, save } = game;
  const members = FAMILY.map((m) => new FamilyOrca(game, m));
  const found = (id) => save.family.includes(id);
  const resting = (id) => save.resting.includes(id);
  const following = (id) => (id === 'dolphins' ? save.friends > 0 : found(id)) && !resting(id);

  function rest(id) {
    if (resting(id)) return;
    save.resting.push(id);
    game.persist();
  }

  function wake(id) {
    if (!resting(id)) return;
    save.resting.splice(save.resting.indexOf(id), 1);
    game.persist();
  }

  return {
    members,
    found,
    following,
    resting,
    join(id) {
      wake(id);
      if (found(id)) return;
      save.family.push(id);
      game.persist();
    },
    // Companions the player has: found family members plus the dolphin friends.
    companions() {
      const list = FAMILY.filter((m) => found(m.id)).map((m) => ({ id: m.id, name: m.name }));
      if (save.friends > 0) list.push({ id: 'dolphins', name: `Dolphin friends (${Math.min(save.friends, 4)})` });
      return list;
    },
    rest(id) {
      rest(id);
      const name = id === 'dolphins' ? 'Your dolphin friends' : FAMILY.find((m) => m.id === id)?.name;
      game.hud.showToast(`${name} ${id === 'dolphins' ? 'swim' : 'swims'} off to rest. Call them when you miss them!`);
    },
    wake(id) {
      wake(id);
    },
    restAll() {
      this.companions().forEach((c) => rest(c.id));
      game.hud.showToast('You are swimming alone now. Your pod is resting.');
    },
    callAll() {
      [...save.resting].forEach(wake);
      game.hud.showToast('Your pod is coming back to you!');
      game.audio?.orcaCall();
    },
    update(dt) {
      const orca = controller.position;
      for (const fo of members) {
        const id = fo.member.id;
        const near = Math.hypot(fo.position.x - orca.x, fo.position.z - orca.z) < 700;
        fo.group.visible = following(id) || near || game.missions?.active?.def.id === 'find-family';
        if (!found(id)) {
          fo.update(dt, null, 1.2);
          continue;
        }
        if (resting(id)) {
          // Swim back home, then circle there.
          const home = fo.member.spot;
          const far = Math.hypot(home.x - fo.position.x, home.z - fo.position.z) > 40;
          fo.update(dt, far ? home : null, far ? 6 : 1.2);
          continue;
        }
        const yaw = controller.yaw;
        const [ox, oz] = fo.member.offset;
        const tx = orca.x + Math.cos(yaw) * ox + Math.sin(yaw) * oz;
        const tz = orca.z - Math.sin(yaw) * ox + Math.cos(yaw) * oz;
        const dist = Math.hypot(tx - fo.position.x, tz - fo.position.z);
        if (dist > 150) fo.position.set(tx, fo.position.y, tz); // after a respawn or a recall
        fo.update(dt, { x: tx, z: tz }, THREE.MathUtils.clamp(controller.speed + dist * 0.35 - 0.5, 0.6, 14));
      }
    },
    onEvent(e) {
      if (e.type === 'breach') members.forEach((fo, i) => following(fo.member.id) && setTimeout(() => (fo.jump = 1), 200 + i * 250));
      // Calling near a resting family member brings them back.
      if (e.type === 'call') {
        const orca = controller.position;
        for (const fo of members) {
          if (found(fo.member.id) && resting(fo.member.id) && Math.hypot(fo.position.x - orca.x, fo.position.z - orca.z) < 50) {
            wake(fo.member.id);
            game.hud.showToast(`${fo.member.name} is swimming with you again!`);
          }
        }
      }
    },
    markers(out) {
      for (const fo of members) {
        if (following(fo.member.id)) out.push({ x: fo.position.x, z: fo.position.z, type: 'friend' });
        else if (found(fo.member.id)) out.push({ x: fo.position.x, z: fo.position.z, type: 'animal', color: '#6dffb0', label: `${fo.member.name} (resting)` });
      }
    },
    jumpAll() {
      members.forEach((fo, i) => following(fo.member.id) && setTimeout(() => (fo.jump = 1), i * 200));
    },
  };
}
