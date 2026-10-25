import * as THREE from 'three';
import { fishGeometry, fishMaterial, createGull } from './models.js';
import { WORLD_HALF } from './world.js';

const SCHOOLS = 12;
const FISH_PER_SCHOOL = 36;
const NEAR = 260; // keep a few schools within this distance of the player
const GULLS_PER_SCHOOL = 3;
const EAT_RADIUS = 3;

const rand = (a, b) => a + Math.random() * (b - a);

// Bait-ball schools the orca can eat to recover health and energy, with seagulls
// circling above them as a hint of where food is.
export function createFish(game) {
  const { scene, controller, waves } = game;
  const geometry = fishGeometry();
  const material = fishMaterial();
  const dummy = new THREE.Object3D();
  const mouth = new THREE.Vector3();
  const schools = [];

  for (let i = 0; i < SCHOOLS; i++) {
    const mesh = new THREE.InstancedMesh(geometry, material, FISH_PER_SCHOOL);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const fish = Array.from({ length: FISH_PER_SCHOOL }, () => ({
      alive: true,
      // Each fish orbits the ball centre on its own tilted circle.
      radius: rand(0.8, 3.2),
      speed: rand(0.9, 1.6) * (Math.random() < 0.5 ? 1 : -1),
      phase: rand(0, Math.PI * 2),
      tilt: rand(-0.7, 0.7),
      yOff: rand(-1.2, 1.2),
    }));
    const gulls = Array.from({ length: GULLS_PER_SCHOOL }, () => {
      const g = createGull();
      g.scale.setScalar(1.7);
      g.visible = false;
      scene.add(g);
      return { mesh: g, phase: rand(0, Math.PI * 2), radius: rand(5, 10), height: rand(7, 12), speed: rand(0.4, 0.7) };
    });
    schools.push({
      mesh,
      fish,
      gulls,
      center: new THREE.Vector3(),
      heading: rand(0, Math.PI * 2),
      depth: rand(1.2, 2.5), // shallow enough to catch without diving
      alive: FISH_PER_SCHOOL,
      respawn: 0,
      flee: 0,
      boil: Math.random() * 2,
    });
  }

  function placeSchool(s, near) {
    let x;
    let z;
    if (near) {
      // Somewhere ahead-ish of the orca, not right on top of it.
      const a = controller.yaw + rand(-1.4, 1.4);
      const d = rand(90, NEAR);
      x = controller.position.x + Math.sin(a) * d;
      z = controller.position.z + Math.cos(a) * d;
    } else {
      x = rand(-WORLD_HALF, WORLD_HALF) * 0.9;
      z = rand(-WORLD_HALF, WORLD_HALF) * 0.9;
    }
    x = THREE.MathUtils.clamp(x, -WORLD_HALF * 0.95, WORLD_HALF * 0.95);
    z = THREE.MathUtils.clamp(z, -WORLD_HALF * 0.95, WORLD_HALF * 0.95);
    s.center.set(x, -s.depth, z);
    s.alive = FISH_PER_SCHOOL;
    s.fish.forEach((f) => (f.alive = true));
    s.respawn = 0;
  }

  schools.forEach((s, i) => placeSchool(s, i < 3));

  function update(dt) {
    const t = game.time;
    const p = controller.position;
    mouth.copy(p).addScaledVector(controller.forward, 3.3);
    let nearCount = 0;

    for (const s of schools) {
      const dist = Math.hypot(s.center.x - p.x, s.center.z - p.z);
      if (s.alive < 6) {
        s.respawn += dt;
        s.mesh.visible = false;
        s.gulls.forEach((g) => (g.mesh.visible = false));
        if (s.respawn > 15) placeSchool(s, nearCount < 3);
        continue;
      }
      if (dist < NEAR) nearCount++;
      if (dist > 700 && nearCount < 3 && Math.random() < dt * 0.3) placeSchool(s, true);

      // Wander slowly, bolt away from the orca when it gets close.
      const away = Math.atan2(s.center.x - p.x, s.center.z - p.z);
      if (dist < 8) s.flee = 1.5;
      s.flee = Math.max(0, s.flee - dt);
      if (s.flee > 0) s.heading += Math.atan2(Math.sin(away - s.heading), Math.cos(away - s.heading)) * Math.min(1, dt * 4);
      else s.heading += Math.sin(t * 0.3 + s.depth) * dt * 0.3;
      const speed = s.flee > 0 ? 2.5 : 0.8; // slower than a swimming orca, so a chase pays off
      s.center.x += Math.sin(s.heading) * speed * dt;
      s.center.z += Math.cos(s.heading) * speed * dt;
      s.center.x = THREE.MathUtils.clamp(s.center.x, -WORLD_HALF, WORLD_HALF);
      s.center.z = THREE.MathUtils.clamp(s.center.z, -WORLD_HALF, WORLD_HALF);
      const surface = waves.heightAt(s.center.x, s.center.z);
      s.center.y = surface - s.depth;

      // Feeding fish make the surface boil: another hint of where food is.
      s.boil -= dt;
      if (s.boil <= 0 && dist < 220) {
        game.ocean.addWake(s.center.x + rand(-2, 2), s.center.z + rand(-2, 2), 0.45);
        s.boil = 1.6;
      }

      const visible = dist < 450;
      s.mesh.visible = visible;
      if (visible) {
        const squeeze = s.flee > 0 ? 0.6 : 1;
        for (let i = 0; i < FISH_PER_SCHOOL; i++) {
          const f = s.fish[i];
          if (!f.alive) {
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            s.mesh.setMatrixAt(i, dummy.matrix);
            continue;
          }
          const a = f.phase + t * f.speed;
          const r = f.radius * squeeze;
          const x = Math.cos(a) * r;
          const z = Math.sin(a) * r;
          const y = f.yOff * squeeze + Math.sin(a) * f.tilt * r * 0.4;
          dummy.position.set(s.center.x + x, Math.min(s.center.y + y, surface - 0.3), s.center.z + z);
          // Face along the orbit.
          dummy.rotation.set(0, Math.atan2(-Math.sin(a) * Math.sign(f.speed), Math.cos(a) * Math.sign(f.speed)), 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          s.mesh.setMatrixAt(i, dummy.matrix);

          // Eaten when the orca's mouth sweeps through.
          if (dist < 20 && controller.relSpeed > 1) {
            const dx = dummy.position.x - mouth.x;
            const dy = dummy.position.y - mouth.y;
            const dz = dummy.position.z - mouth.z;
            if (dx * dx + dy * dy + dz * dz < EAT_RADIUS * EAT_RADIUS) {
              f.alive = false;
              s.alive--;
              controller.heal(2.5, 6);
              game.spray.emit(dummy.position.x, dummy.position.y, dummy.position.z, 0, 0.6, 0, { size: 0.2, life: 0.5, gravity: -0.2, opacity: 0.5 });
              game.onEat?.();
              game.discover?.('herring');
            }
          }
        }
        s.mesh.instanceMatrix.needsUpdate = true;
      }

      // Gulls circle over schools that are close to the player.
      const showGulls = dist < 500;
      if (dist < 45) game.discover?.('gull');
      for (const g of s.gulls) {
        g.mesh.visible = showGulls;
        if (!showGulls) continue;
        const a = g.phase + t * g.speed;
        g.mesh.position.set(s.center.x + Math.cos(a) * g.radius, surface + g.height + Math.sin(t * 0.7 + g.phase) * 0.8, s.center.z + Math.sin(a) * g.radius);
        g.mesh.rotation.set(0, -a, -0.35);
        const flap = Math.sin(t * 7 + g.phase) * 0.55;
        g.mesh.userData.wings[0].rotation.z = flap;
        g.mesh.userData.wings[1].rotation.z = -flap;
      }
    }
  }

  game.fishTarget = () => {
    const p = controller.position;
    let best = null;
    let bestD = Infinity;
    for (const s of schools) {
      const d = Math.hypot(s.center.x - p.x, s.center.z - p.z);
      if (s.alive >= 6 && d < bestD) {
        bestD = d;
        best = s.center;
      }
    }
    return best;
  };

  return {
    update,
    markers(out) {
      for (const s of schools) if (s.alive >= 6) out.push({ x: s.center.x, z: s.center.z, type: 'animal' });
    },
    nearestDistance() {
      const p = controller.position;
      return Math.min(...schools.filter((s) => s.alive >= 6).map((s) => Math.hypot(s.center.x - p.x, s.center.z - p.z)));
    },
  };
}
