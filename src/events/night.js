import * as THREE from 'three';
import { boatModel } from '../boats.js';
import { rand, dist2d, pointNearOrca, canvasSprite, disposeObject } from './common.js';

// Fade in, hold, fade out. Returns 0..1.
function lifeFade(time, life, fadeIn = 3, fadeOut = 4) {
  return Math.max(0, Math.min(1, time / fadeIn, (life - time) / fadeOut));
}

function ghostSprite() {
  return canvasSprite(
    (ctx, n) => {
      ctx.shadowColor = 'rgba(120,255,240,0.9)';
      ctx.shadowBlur = n * 0.12;
      ctx.fillStyle = 'rgba(220,255,250,0.85)';
      // Rounded head, body and a wavy hem.
      ctx.beginPath();
      ctx.moveTo(n * 0.25, n * 0.85);
      ctx.lineTo(n * 0.25, n * 0.45);
      ctx.arc(n * 0.5, n * 0.45, n * 0.25, Math.PI, 0);
      ctx.lineTo(n * 0.75, n * 0.85);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(n * (0.6875 - i * 0.125), n * 0.95, n * (0.625 - i * 0.125), n * 0.85);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(10,30,40,0.9)';
      ctx.beginPath();
      ctx.ellipse(n * 0.42, n * 0.45, n * 0.04, n * 0.06, 0, 0, Math.PI * 2);
      ctx.ellipse(n * 0.58, n * 0.45, n * 0.04, n * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    },
    { scale: 5 },
  );
}

function sirenSprite() {
  return canvasSprite(
    (ctx, n) => {
      ctx.shadowColor = 'rgba(255,140,240,0.95)';
      ctx.shadowBlur = n * 0.1;
      ctx.fillStyle = 'rgba(255,215,250,0.85)';
      // Head, long hair, body and a curled tail, sitting on the water.
      ctx.beginPath();
      ctx.arc(n * 0.45, n * 0.25, n * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(n * 0.37, n * 0.24);
      ctx.quadraticCurveTo(n * 0.3, n * 0.5, n * 0.36, n * 0.55);
      ctx.lineTo(n * 0.42, n * 0.34);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(n * 0.4, n * 0.33);
      ctx.quadraticCurveTo(n * 0.55, n * 0.45, n * 0.5, n * 0.62);
      ctx.quadraticCurveTo(n * 0.6, n * 0.8, n * 0.8, n * 0.72);
      ctx.lineTo(n * 0.88, n * 0.62);
      ctx.lineTo(n * 0.84, n * 0.8);
      ctx.quadraticCurveTo(n * 0.55, n * 0.92, n * 0.42, n * 0.66);
      ctx.quadraticCurveTo(n * 0.36, n * 0.5, n * 0.4, n * 0.33);
      ctx.fill();
    },
    { scale: 6.5 },
  );
}

// Ghostly lights shaped like little ghosts, floating over the water.
function ghosts(game) {
  const center = pointNearOrca(game, 70, 130);
  const list = Array.from({ length: 3 }, (_, i) => ({ sprite: ghostSprite(), phase: i * 2.1, r: rand(6, 12) }));
  list.forEach((g) => game.scene.add(g.sprite));
  const LIFE = 28;
  let time = 0;
  let vanish = 1;
  let seen = false;
  game.hud.showToast('Something is glowing over the water…');
  game.audio?.spooky();
  return {
    update(dt) {
      time += dt;
      const near = dist2d(game.controller.position, center) < 25;
      if (near && vanish === 1) game.audio?.giggle();
      if (near) vanish = Math.max(0, vanish - dt * 1.5); // they flee when you get close
      const fade = lifeFade(time, LIFE) * vanish;
      for (const g of list) {
        const a = g.phase + time * 0.4;
        g.sprite.position.set(center.x + Math.cos(a) * g.r, game.waves.heightAt(center.x, center.z) + 3 + Math.sin(time * 1.3 + g.phase) * 1.2, center.z + Math.sin(a) * g.r);
        g.sprite.material.opacity = fade * (0.7 + Math.sin(time * 5 + g.phase) * 0.2);
      }
      if (!seen && fade > 0.5 && dist2d(game.controller.position, center) < 150) {
        seen = true;
        game.discover?.('ghost');
      }
      if (time > LIFE || vanish === 0) this.done = true;
    },
    dispose() {
      list.forEach((g) => {
        game.scene.remove(g.sprite);
        disposeObject(g.sprite);
      });
    },
  };
}

// A see-through glowing pirate ship sails past and fades away.
function ghostShip(game) {
  const c = game.controller;
  const side = Math.random() < 0.5 ? 1 : -1;
  const heading = c.yaw + rand(-0.3, 0.3);
  const sx = Math.cos(heading) * side;
  const sz = -Math.sin(heading) * side;
  const start = { x: c.position.x + sx * 90 - Math.sin(heading) * 120, z: c.position.z + sz * 90 - Math.cos(heading) * 120 };
  const ship = boatModel('whaler');
  const material = new THREE.MeshBasicMaterial({ color: 0x3dffc4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  ship.traverse((o) => {
    if (o.isMesh) o.material = material;
  });
  ship.scale.setScalar(0.9);
  game.scene.add(ship);
  const LIFE = 42;
  let time = 0;
  let seen = false;
  game.hud.showToast('A ghostly ship is sailing out of the mist…', 4);
  game.audio?.spooky();
  return {
    update(dt) {
      time += dt;
      const t = time * 5;
      const x = start.x + Math.sin(heading) * t;
      const z = start.z + Math.cos(heading) * t;
      ship.position.set(x, game.waves.heightAt(x, z) + 0.3, z);
      ship.rotation.set(Math.sin(time * 0.8) * 0.05, heading, Math.sin(time * 0.6) * 0.08);
      material.opacity = lifeFade(time, LIFE, 4, 6) * (0.42 + Math.sin(time * 3) * 0.1);
      if (!seen && material.opacity > 0.2 && dist2d(c.position, ship.position) < 160) {
        seen = true;
        game.discover?.('ghostship');
      }
      if (time > LIFE) this.done = true;
    },
    dispose() {
      game.scene.remove(ship);
      ship.traverse((o) => o.geometry?.dispose());
      material.dispose();
    },
  };
}

// Glowing sirens sit on the water and sing, then slip under when you come close.
function sirens(game) {
  const center = pointNearOrca(game, 60, 110);
  const list = Array.from({ length: 3 }, (_, i) => {
    const a = (i / 3) * Math.PI * 2;
    return { sprite: sirenSprite(), x: center.x + Math.cos(a) * 12, z: center.z + Math.sin(a) * 12, sink: 0, phase: i };
  });
  list.forEach((s) => game.scene.add(s.sprite));
  const LIFE = 36;
  let time = 0;
  let song = 1;
  let seen = false;
  game.hud.showToast('You hear singing across the water…', 4);
  return {
    update(dt) {
      time += dt;
      song -= dt;
      if (song <= 0 && time < LIFE - 5) {
        game.audio?.sirenSong();
        song = 6;
      }
      const fade = lifeFade(time, LIFE);
      for (const s of list) {
        if (dist2d(game.controller.position, s) < 30 && s.sink === 0) {
          s.sink = 0.01;
          game.spray.splash(s.x, game.waves.heightAt(s.x, s.z), s.z, 1);
        }
        if (s.sink > 0) s.sink += dt;
        const y = game.waves.heightAt(s.x, s.z);
        s.sprite.position.set(s.x, y + 2.2 - s.sink * 3, s.z);
        s.sprite.material.opacity = fade * Math.max(0, 1 - s.sink) * (0.75 + Math.sin(time * 2 + s.phase) * 0.15);
      }
      if (!seen && fade > 0.5 && dist2d(game.controller.position, center) < 140) {
        seen = true;
        game.discover?.('siren');
      }
      if (time > LIFE || list.every((s) => s.sink > 1)) this.done = true;
    },
    dispose() {
      list.forEach((s) => {
        game.scene.remove(s.sprite);
        disposeObject(s.sprite);
      });
    },
  };
}

// Night only, rare: ghosts, a ghost ship or sirens.
export function createApparition(game) {
  const r = Math.random();
  return r < 0.4 ? ghosts(game) : r < 0.7 ? ghostShip(game) : sirens(game);
}

// Night only, very rare: a gigantic shadow passes deep below, shaking the sea.
export function createMonster(game) {
  const c = game.controller;
  const heading = rand(0, Math.PI * 2);
  const dir = { x: Math.sin(heading), z: Math.cos(heading) };
  const side = { x: Math.cos(heading), z: -Math.sin(heading) };
  const offset = rand(-25, 25);
  const start = { x: c.position.x - dir.x * 160 + side.x * offset, z: c.position.z - dir.z * 160 + side.z * offset };
  const SEGMENTS = 30;
  const SPACING = 2.8;
  const SPEED = 10;
  const LENGTH = 320;
  const body = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x010407, transparent: true, opacity: 0, depthWrite: false }),
    SEGMENTS,
  );
  body.renderOrder = -1; // drawn before the water: a dark shadow seen through it
  body.frustumCulled = false;
  const eyes = [0, 1].map(() => {
    const e = canvasSprite(
      (ctx, n) => {
        const g = ctx.createRadialGradient(n / 2, n / 2, 1, n / 2, n / 2, n / 2);
        g.addColorStop(0, 'rgba(255,220,120,1)');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, n, n);
      },
      { scale: 2.2 },
    );
    e.renderOrder = -1;
    return e;
  });
  game.scene.add(body, ...eyes);
  const dummy = new THREE.Object3D();
  let travelled = 0;
  let time = 0;
  let seen = false;
  let foam = 0;
  game.hud.showToast('Something enormous is moving in the deep…', 5);
  game.audio?.rumble(1);

  return {
    update(dt) {
      time += dt;
      travelled += SPEED * dt;
      const fade = Math.min(1, time / 3) * Math.min(1, (LENGTH - travelled) / 30);
      body.material.opacity = 0.75 * Math.max(0, fade);
      const head = { x: start.x + dir.x * travelled, z: start.z + dir.z * travelled };
      for (let i = 0; i < SEGMENTS; i++) {
        const back = i * SPACING;
        const sway = Math.sin(time * 1.6 - i * 0.35) * (2 + i * 0.12);
        const x = head.x - dir.x * back + side.x * sway;
        const z = head.z - dir.z * back + side.z * sway;
        const r = THREE.MathUtils.lerp(3.6, 0.7, i / (SEGMENTS - 1));
        dummy.position.set(x, -20 + Math.sin(time * 0.8 - i * 0.2) * 1.5, z);
        dummy.scale.setScalar(r);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
      }
      body.instanceMatrix.needsUpdate = true;
      eyes.forEach((e, k) => {
        e.position.set(head.x + side.x * (k ? 1.4 : -1.4) + dir.x * 2.5, -18.5, head.z + side.z * (k ? 1.4 : -1.4) + dir.z * 2.5);
        e.material.opacity = Math.max(0, fade) * (0.6 + Math.sin(time * 3) * 0.3);
      });

      // The sea reacts: bigger waves, foam boiling above, the camera trembles, it gets darker.
      const d = dist2d(c.position, head);
      const near = Math.max(0, 1 - d / 140) * Math.max(0, fade);
      game.extraChop = 0.32 * near;
      game.gloom = Math.max(0, fade) * 0.6;
      if (near > 0.3) game.chase.addShake(dt * 1.2 * near);
      foam -= dt;
      if (foam <= 0 && fade > 0.3) {
        foam = 0.4;
        game.ocean.addWake(head.x + rand(-6, 6), head.z + rand(-6, 6), 1.4);
        if (Math.random() < 0.4) game.spray.splash(head.x, game.waves.heightAt(head.x, head.z), head.z, 2);
      }
      if (Math.floor(time / 7) !== Math.floor((time - dt) / 7)) game.audio?.rumble(0.5 + near);
      if (!seen && d < 80) {
        seen = true;
        game.discover?.('monster');
      }
      if (travelled > LENGTH) this.done = true;
    },
    dispose() {
      game.extraChop = 0;
      game.gloom = 0;
      game.scene.remove(body, ...eyes);
      disposeObject(body);
      eyes.forEach(disposeObject);
    },
  };
}
