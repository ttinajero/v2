import * as THREE from 'three';
import { createChest } from '../props.js';
import { createSharkPack } from './sharks.js';
import { rand, dist2d, pointNearOrca, canvasSprite, disposeObject } from './common.js';

const REVEAL_RADIUS = 35;
const LIFETIME = 180;

function questionMark() {
  return canvasSprite(
    (ctx, n) => {
      const g = ctx.createRadialGradient(n / 2, n / 2, 4, n / 2, n / 2, n / 2);
      g.addColorStop(0, 'rgba(200,160,255,0.95)');
      g.addColorStop(0.55, 'rgba(140,90,255,0.55)');
      g.addColorStop(1, 'rgba(140,90,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${n * 0.6}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', n / 2, n / 2 + n * 0.03);
    },
    { scale: 6 },
  );
}

// --- Outcomes ---

function prize(game, spot) {
  const chest = createChest();
  chest.scale.setScalar(1.2);
  const glow = canvasSprite(
    (ctx, n) => {
      const g = ctx.createRadialGradient(n / 2, n / 2, 2, n / 2, n / 2, n / 2);
      g.addColorStop(0, 'rgba(255,230,120,0.9)');
      g.addColorStop(1, 'rgba(255,200,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, n, n);
    },
    { scale: 5 },
  );
  game.scene.add(chest, glow);
  game.hud.showToast('A treasure chest is floating here! Grab it!');
  let time = 0;
  return {
    update(dt) {
      time += dt;
      const y = game.waves.heightAt(spot.x, spot.z);
      chest.position.set(spot.x, y - 0.2, spot.z);
      chest.rotation.y += dt * 0.5;
      glow.position.set(spot.x, y + 0.6, spot.z);
      glow.material.opacity = 0.6 + Math.sin(time * 4) * 0.3;
      if (dist2d(game.controller.position, spot) < 5 && game.controller.depth < 3) {
        const points = Math.round(rand(75, 150) / 5) * 5;
        game.save.points += points;
        game.save.totalPoints += points;
        game.persist();
        game.hud.showToast(`Treasure! +${points} points`);
        game.audio?.success();
        this.done = true;
      }
      if (time > 90) this.done = true;
    },
    markers(out) {
      out.push({ x: spot.x, z: spot.z, type: 'target', label: 'Treasure' });
    },
    dispose() {
      game.scene.remove(chest, glow);
      disposeObject(chest);
      disposeObject(glow);
    },
  };
}

// The best prize: two minutes as a super whale.
function superWhale(game) {
  game.controller.startSuper(120);
  game.hud.showToast('SUPER WHALE! For 2 minutes you jump super high and swim super fast!', 5);
  game.audio?.fanfare();
  return { update() { this.done = true; } };
}

function bigSchool(game, spot) {
  game.fish?.gather(spot.x, spot.z, 3);
  game.hud.showToast('A giant school of fish! Time for a feast!');
  return { update() { this.done = true; } };
}

// Night only: dozens of softly glowing jellyfish drifting in the water.
function jellyfish(game, spot) {
  const COUNT = 70;
  const bell = new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  // Bioluminescence: drawn after the water and without depth testing, so the glow shows
  // through the surface; deeper jellies are simply dimmer.
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(bell, material, COUNT);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const palette = [0x30d8ff, 0xb040ff, 0xff30b8, 0x30ff98];
  const jellies = Array.from({ length: COUNT }, (_, i) => {
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * 30;
    const depth = rand(0.6, 6);
    mesh.setColorAt(i, new THREE.Color(palette[i % palette.length]).multiplyScalar(1.1 - depth / 8));
    return { x: spot.x + Math.cos(a) * r, z: spot.z + Math.sin(a) * r, depth, phase: rand(0, 10), size: rand(0.6, 1.4) };
  });
  game.scene.add(mesh);
  game.hud.showToast('Glowing jellyfish! Swim closer to see them.');
  const dummy = new THREE.Object3D();
  let time = 0;
  let seen = false;
  const LIFE = 70;
  return {
    update(dt) {
      time += dt;
      const fade = Math.min(1, time / 3) * Math.min(1, (LIFE - time) / 5);
      material.opacity = 0.8 * Math.max(0, fade);
      jellies.forEach((j, i) => {
        const pulse = 1 + Math.sin(game.time * 2 + j.phase) * 0.18;
        j.x += Math.sin(game.time * 0.2 + j.phase) * 0.15 * dt;
        j.z += Math.cos(game.time * 0.17 + j.phase) * 0.15 * dt;
        dummy.position.set(j.x, game.waves.heightAt(j.x, j.z) - j.depth + Math.sin(game.time + j.phase) * 0.3, j.z);
        dummy.scale.set(j.size * pulse, j.size / pulse, j.size * pulse);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (!seen && dist2d(game.controller.position, spot) < 30) {
        seen = true;
        game.discover?.('jellyfish');
        game.save.points += 30;
        game.save.totalPoints += 30;
        game.persist();
        game.hud.showToast('What a magical sight! +30 points');
      }
      if (time > LIFE) this.done = true;
    },
    dispose() {
      game.scene.remove(mesh);
      bell.dispose();
      material.dispose();
    },
  };
}

// A whirlpool that drags the orca round and in; sprint to escape, the middle hurts.
function whirlpool(game, spot) {
  const R = 45;
  const LIFE = 50;
  const funnel = new THREE.Mesh(
    new THREE.ConeGeometry(R * 0.7, 14, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x062028, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  funnel.rotation.x = Math.PI; // point down
  funnel.renderOrder = -1;
  game.scene.add(funnel);
  game.hud.showToast('A whirlpool! Sprint away from the middle!');
  game.audio?.danger();
  let time = 0;
  let caught = false;
  let wakeTimer = 0;
  return {
    update(dt) {
      time += dt;
      const strength = Math.min(1, time / 4) * Math.min(1, (LIFE - time) / 6);
      const y = game.waves.heightAt(spot.x, spot.z);
      funnel.position.set(spot.x, y - 7, spot.z);
      funnel.rotation.y += dt * 1.5;
      funnel.material.opacity = 0.55 * Math.max(0, strength);
      // Foam spiralling in.
      wakeTimer -= dt;
      if (wakeTimer <= 0) {
        wakeTimer = 0.15;
        const a = time * 3;
        for (const r of [R * 0.85, R * 0.55, R * 0.25]) {
          game.ocean.addWake(spot.x + Math.cos(a + r) * r, spot.z + Math.sin(a + r) * r, 0.7 * strength);
        }
      }
      const c = game.controller;
      const dx = c.position.x - spot.x;
      const dz = c.position.z - spot.z;
      const d = Math.hypot(dx, dz);
      if (d < R && strength > 0.1) {
        caught = true;
        const pull = (1 - d / R) * strength;
        // Swirl (tangent) plus a pull toward the middle.
        c.velocity.x += ((-dz / d) * 7 - (dx / d) * 4) * pull * dt;
        c.velocity.z += ((dx / d) * 7 - (dz / d) * 4) * pull * dt;
        if (d < 7) c.damage(5, 'whirlpool');
      } else if (caught && d > R + 10) {
        caught = false;
        game.save.points += 40;
        game.save.totalPoints += 40;
        game.persist();
        game.hud.showToast('You escaped the whirlpool! +40 points');
        time = Math.max(time, LIFE - 6); // it calms down
      }
      if (time > LIFE) this.done = true;
    },
    alerts(out) {
      if (caught) out.push('Whirlpool! Sprint to escape!');
    },
    markers(out) {
      out.push({ x: spot.x, z: spot.z, type: 'danger', label: 'Whirlpool' });
    },
    dispose() {
      game.scene.remove(funnel);
      disposeObject(funnel);
    },
  };
}

// A "?" on the map: you only find out what it is when you get close.
export function createMystery(game) {
  const spot = pointNearOrca(game, 150, 420);
  const sprite = questionMark();
  game.scene.add(sprite);
  let time = 0;
  let outcome = null;

  function reveal() {
    game.scene.remove(sprite);
    const night = game.isNight;
    const dangerWeight = night ? 0.5 : 0.32;
    const r = Math.random();
    if (r < 0.14) outcome = superWhale(game);
    else if (r < 0.36) outcome = prize(game, spot);
    else if (r < 1 - dangerWeight) outcome = night ? jellyfish(game, spot) : bigSchool(game, spot);
    else outcome = Math.random() < 0.5 ? createSharkPack(game, spot) : whirlpool(game, spot);
  }

  return {
    update(dt) {
      time += dt;
      if (outcome) {
        outcome.update(dt);
        if (outcome.done) this.done = true;
        return;
      }
      sprite.position.set(spot.x, game.waves.heightAt(spot.x, spot.z) + 5 + Math.sin(time * 2) * 0.6, spot.z);
      if (dist2d(game.controller.position, spot) < REVEAL_RADIUS) reveal();
      else if (time > LIFETIME) this.done = true;
    },
    onEvent(e) {
      outcome?.onEvent?.(e);
    },
    alerts(out) {
      outcome?.alerts?.(out);
    },
    markers(out) {
      if (outcome) outcome.markers?.(out);
      else out.push({ x: spot.x, z: spot.z, type: 'mystery', label: 'Mystery' });
    },
    dispose() {
      game.scene.remove(sprite);
      disposeObject(sprite);
      outcome?.dispose?.();
    },
  };
}
