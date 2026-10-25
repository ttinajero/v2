import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { underwaterMaterial, paintGeometry } from './materials.js';
import { createNet } from './models.js';
import { WORLD_HALF } from './world.js';

const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ORCA_R = 1.1;

const TYPES = {
  trawler: { length: 12, width: 4, height: 2.2, speed: 3, turn: 0.25, hull: 0x9a3b2e, stripe: 0xe8e0cc, cabin: 0xe8e0cc, net: true, label: 'Fishing boat' },
  speedboat: { length: 7, width: 2.4, height: 1.2, speed: 9, turn: 0.7, hull: 0x23272b, stripe: 0xd23c2c, cabin: 0x3a4148, throwsNets: true, label: 'Speedboat' },
  coastguard: { length: 14, width: 4.5, height: 2.4, speed: 0, turn: 0.2, hull: 0xeef0f0, stripe: 0xe8752c, cabin: 0xeef0f0, friendly: true, label: 'Coast guard' },
  whaler: { length: 22, width: 6, height: 3.2, speed: 2.4, turn: 0.15, hull: 0x2f3438, stripe: 0x8a2a22, cabin: 0x9aa0a4, crane: true, net: true, label: 'Whaling ship' },
};

function hullGeometry({ length: L, width: W, height: H, hull, stripe }) {
  const g = new THREE.BoxGeometry(W, H, L, 4, 3, 10);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (z + L / 2) / L;
    if (t > 0.65) x *= 1 - ((t - 0.65) / 0.35) ** 1.4 * 0.9; // pointed bow
    if (y < 0) x *= 0.5 + 0.5 * ((y + H / 2) / (H / 2)); // V-shaped bottom
    const lift = t > 0.7 ? ((t - 0.7) / 0.3) ** 2 * H * 0.35 : 0; // bow rises
    pos.setXYZ(i, x, y + (y > 0 ? lift : lift * 0.3), z);
  }
  g.computeVertexNormals();
  const a = new THREE.Color(hull);
  const b = new THREE.Color(stripe);
  const red = new THREE.Color(0x7a2620);
  paintGeometry(g, (x, y, z, c) => c.copy(y < -H * 0.15 ? red : y > H * 0.28 && y < H * 0.42 ? b : a));
  return g;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  return paintGeometry(g, (px, py, pz, c) => c.set(color));
}

function cyl(r, h, color, x, y, z, rx = 0) {
  const g = new THREE.CylinderGeometry(r, r, h, 8).rotateX(rx).translate(x, y, z);
  return paintGeometry(g, (px, py, pz, c) => c.set(color));
}

const boatMaterial = underwaterMaterial({ vertexColors: true, roughness: 0.6 });

function prep(g) {
  const out = g.index ? g.toNonIndexed() : g;
  if (out.attributes.uv) out.deleteAttribute('uv');
  return out;
}

function createBoatModel(type, spec) {
  const { length: L, width: W, height: H, cabin } = spec;
  const parts = [hullGeometry(spec), box(W * 0.92, 0.12, L * 0.8, 0x6b5a48, 0, H / 2, -L * 0.05)];
  if (type === 'speedboat') {
    parts.push(box(W * 0.7, 0.5, 1.2, cabin, 0, H / 2 + 0.3, 0.6), box(W * 0.68, 0.45, 0.08, 0x9fd0e0, 0, H / 2 + 0.75, 1.15));
    parts.push(box(0.5, 0.7, 0.5, 0x15181a, 0, H / 2 - 0.2, -L / 2 - 0.2)); // outboard motor
  } else {
    parts.push(box(W * 0.6, H * 0.9, L * 0.22, cabin, 0, H / 2 + H * 0.45, L * 0.08));
    parts.push(box(W * 0.62, 0.15, L * 0.24, 0x3a4148, 0, H / 2 + H * 0.92, L * 0.08));
    parts.push(box(W * 0.58, H * 0.25, 0.05, 0x9fd0e0, 0, H / 2 + H * 0.6, L * 0.19 + 0.01));
    parts.push(cyl(0.12, H * 2.2, 0x3a3a3a, 0, H / 2 + H * 1.5, L * 0.0));
    if (type === 'coastguard') {
      parts.push(box(0.6, 0.25, 0.6, 0x2c6fd6, 0, H / 2 + H * 1.05, L * 0.08)); // light bar
    }
  }
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(mergeGeometries(parts.map(prep)), boatMaterial);
  mesh.position.y = -H * 0.2; // sit in the water with a draft
  group.add(mesh);

  let crane = null;
  if (spec.crane) {
    crane = new THREE.Group();
    crane.position.set(0, H * 0.8, -L * 0.3);
    const arm = new THREE.Mesh(prep(mergeGeometries([cyl(0.25, 2.5, 0xd8a020, 0, 1.25, 0), cyl(0.18, 9, 0xd8a020, 0, 2.4, 4.2, Math.PI / 2 - 0.35)].map(prep))), boatMaterial);
    crane.add(arm);
    group.add(crane);
  }
  return { group, crane };
}

class Boat {
  constructor(system, type, opts = {}) {
    const spec = TYPES[type];
    this.system = system;
    this.game = system.game;
    this.type = type;
    this.spec = { ...spec, ...opts.spec };
    const model = createBoatModel(type, this.spec);
    this.model = model.group;
    this.crane = model.crane;
    this.craneHealth = model.crane ? opts.craneHealth || 3 : 0;
    this.position = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
    this.heading = opts.heading ?? rand(0, Math.PI * 2);
    this.speed = 0;
    this.velocity = new THREE.Vector2(); // extra push from rams
    this.fear = 0;
    this.fleeing = false;
    this.fleeTime = 0;
    this.removed = false;
    this.route = opts.route || null;
    this.routeIndex = 0;
    this.target = opts.target || null; // { position } to chase
    this.capture = 0; // seconds spent right next to the target
    this.netCooldown = 4;
    this.wakeTimer = 0;
    this.pitch = 0;
    this.roll = 0;
    this.rollKick = 0;
    this.lastHit = -10;
    this.onScared = opts.onScared;
    this.game.scene.add(this.model);

    if (this.spec.net && opts.net !== false) this._makeNet();
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  _makeNet() {
    const group = new THREE.Group();
    const panel = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.PlaneGeometry(10, 6, 10, 6).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: 0xd8c9a0, transparent: true, opacity: 0.85 }),
    );
    group.add(panel);
    const floatMat = new THREE.MeshStandardMaterial({ color: 0xff7a30 });
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), floatMat);
      f.position.set(-5 + i * 2, 0.1, 3);
      group.add(f);
    }
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3a2e22 });
    const cables = [0, 1, 2].map(() => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const l = new THREE.Line(geo, lineMat);
      l.frustumCulled = false;
      this.game.scene.add(l);
      return l;
    });
    this.game.scene.add(group);
    this.net = { group, panel, cables, cut: [false, false, false], released: false, sink: 0, pos: new THREE.Vector3() };
  }

  scare(amount, reason) {
    if (this.spec.friendly || this.fleeing) return;
    // Bosses resist fear, and can be kept from fleeing until their last phase.
    this.fear = Math.min(this.lockFear ? 90 : 100, this.fear + amount * (this.spec.fearResist ?? 1));
    this.system.onFear?.(this, reason);
    if (this.fear >= 100) {
      this.fleeing = true;
      this.game.hud.showToast(`The ${this.spec.label.toLowerCase()} is running away!`);
      this.onScared?.(this);
      this.system.onBoatScared?.(this);
      if (this.net && !this.net.released) this.releaseNet();
    }
  }

  releaseNet() {
    if (!this.net || this.net.released) return;
    this.net.released = true;
    this.net.cables.forEach((c) => (c.visible = false));
    this.system.onNetReleased?.(this);
  }

  cutLine(i) {
    if (!this.net || this.net.cut[i]) return;
    this.net.cut[i] = true;
    this.net.cables[i].visible = false;
    this.game.spray.splash(this.net.pos.x, this.game.waves.heightAt(this.net.pos.x, this.net.pos.z), this.net.pos.z, 1.5);
    this.game.onBite?.();
    if (this.net.cut.every(Boolean)) {
      this.game.hud.showToast('Net cut loose!');
      this.releaseNet();
      this.scare(30, 'net');
    } else {
      this.game.hud.showToast(`Line cut! ${this.net.cut.filter((c) => !c).length} left`);
    }
  }

  hitCrane() {
    if (!this.crane || this.craneHealth <= 0) return;
    this.craneHealth--;
    this.craneSwing = 1;
    this.game.chase.addShake(0.5);
    if (this.craneHealth <= 0) {
      this.game.hud.showToast('The crane is broken!');
      this.system.onCraneBroken?.(this);
      this.scare(35, 'crane');
    } else {
      this.game.hud.showToast(`Crane hit! ${this.craneHealth} more`);
    }
  }

  update(dt) {
    const game = this.game;
    const orca = game.controller.position;
    const spec = this.spec;
    const f = this.forward;

    // --- Steering ---
    let targetSpeed = spec.speed;
    if (this.fleeing) {
      this.fleeTime += dt;
      // Head for the nearest map edge at full speed.
      const ex = Math.abs(this.position.x) > Math.abs(this.position.z) ? Math.sign(this.position.x) * 2000 : this.position.x;
      const ez = Math.abs(this.position.x) > Math.abs(this.position.z) ? this.position.z : Math.sign(this.position.z || 1) * 2000;
      this._steer(ex, ez, dt, spec.turn * 2);
      targetSpeed = Math.max(spec.speed * 2.2, 7);
      if (this.fleeTime > 35 || Math.max(Math.abs(this.position.x), Math.abs(this.position.z)) > WORLD_HALF + 150) this.system.remove(this);
    } else if (this.target) {
      const t = this.target.position;
      const dist = Math.hypot(t.x - this.position.x, t.z - this.position.z);
      this._steer(t.x, t.z, dt, spec.turn);
      targetSpeed = dist < 15 ? spec.speed * 0.5 : spec.speed;
      this.capture = dist < 14 ? this.capture + dt : Math.max(0, this.capture - dt * 0.5);
    } else if (this.route) {
      const [rx, rz] = this.route[this.routeIndex];
      this._steer(rx, rz, dt, spec.turn);
      if (Math.hypot(rx - this.position.x, rz - this.position.z) < 25) this.routeIndex = (this.routeIndex + 1) % this.route.length;
    }
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, 1 - Math.exp(-0.8 * dt));
    this.velocity.multiplyScalar(Math.exp(-1.5 * dt));
    this.position.x += (f.x * this.speed + this.velocity.x) * dt;
    this.position.z += (f.z * this.speed + this.velocity.y) * dt;
    if (!this.fleeing) {
      this.position.x = THREE.MathUtils.clamp(this.position.x, -WORLD_HALF, WORLD_HALF);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -WORLD_HALF, WORLD_HALF);
    }
    this.fear = Math.max(0, this.fear - dt * (this.fleeing ? 0 : 0.8));

    // --- Float on the waves: height from the centre, tilt from bow/stern and both sides ---
    const w = game.waves;
    const half = spec.length * 0.4;
    const hC = w.heightAt(this.position.x, this.position.z);
    const hB = w.heightAt(this.position.x + f.x * half, this.position.z + f.z * half);
    const hS = w.heightAt(this.position.x - f.x * half, this.position.z - f.z * half);
    const sx = Math.cos(this.heading);
    const sz = -Math.sin(this.heading);
    const hL = w.heightAt(this.position.x + sx * spec.width * 0.5, this.position.z + sz * spec.width * 0.5);
    const hR = w.heightAt(this.position.x - sx * spec.width * 0.5, this.position.z - sz * spec.width * 0.5);
    this.position.y = THREE.MathUtils.lerp(this.position.y, (hC * 2 + hB + hS) / 4, 1 - Math.exp(-6 * dt));
    this.pitch = THREE.MathUtils.lerp(this.pitch, Math.atan2(hB - hS, half * 2) + this.speed * 0.008, 1 - Math.exp(-4 * dt));
    this.rollKick *= Math.exp(-2 * dt);
    this.roll = THREE.MathUtils.lerp(this.roll, Math.atan2(hL - hR, spec.width) * 0.8 + Math.sin(game.time * 3) * this.rollKick, 1 - Math.exp(-4 * dt));
    this.model.position.copy(this.position);
    this.model.rotation.set(-this.pitch, this.heading, this.roll, 'YXZ');

    if (this.crane) {
      this.craneSwing = Math.max(0, (this.craneSwing || 0) - dt);
      this.crane.rotation.y = Math.sin(game.time * 0.4) * 0.6 + Math.sin(game.time * 20) * this.craneSwing * 0.3;
      if (this.craneHealth <= 0) this.crane.rotation.z = THREE.MathUtils.lerp(this.crane.rotation.z, 1.2, dt * 2);
    }

    // --- Wake and bow spray ---
    this.wakeTimer -= dt;
    if (this.speed > 1 && this.wakeTimer <= 0) {
      game.ocean.addWake(this.position.x - f.x * spec.length * 0.5, this.position.z - f.z * spec.length * 0.5, THREE.MathUtils.clamp(this.speed / 6, 0.4, 1.3));
      this.wakeTimer = 0.35;
    }
    if (this.speed > 4 && Math.random() < dt * this.speed * 3) {
      const bx = this.position.x + f.x * spec.length * 0.5;
      const bz = this.position.z + f.z * spec.length * 0.5;
      const side = Math.random() < 0.5 ? 1 : -1;
      game.spray.bow(bx, hB, bz, { x: sx * side, z: sz * side }, { x: f.x, z: f.z }, this.speed);
    }

    this._updateNet(dt);
    this._collide(dt, orca);
    if (spec.throwsNets && !this.fleeing) this._throwNets(dt, orca);
  }

  _steer(x, z, dt, rate) {
    const want = Math.atan2(x - this.position.x, z - this.position.z);
    this.heading += THREE.MathUtils.clamp(wrap(want - this.heading), -rate * dt, rate * dt);
  }

  _updateNet(dt) {
    const net = this.net;
    if (!net) return;
    const f = this.forward;
    const w = this.game.waves;
    if (!net.released) {
      const back = this.spec.length * 0.5 + 16;
      net.pos.set(this.position.x - f.x * back, 0, this.position.z - f.z * back);
      net.pos.y = w.heightAt(net.pos.x, net.pos.z) - 0.2;
      net.group.position.copy(net.pos);
      net.group.rotation.y = this.heading;
      // Three cables from the stern corners to the net.
      const sx = Math.cos(this.heading);
      const sz = -Math.sin(this.heading);
      const sternX = this.position.x - f.x * this.spec.length * 0.5;
      const sternZ = this.position.z - f.z * this.spec.length * 0.5;
      [-1, 0, 1].forEach((k, i) => {
        const a = new THREE.Vector3(sternX + sx * k * 1.2, this.position.y + 0.8, sternZ + sz * k * 1.2);
        const b = new THREE.Vector3(net.pos.x + sx * k * 4.5 + f.x * 3, net.pos.y, net.pos.z + sz * k * 4.5 + f.z * 3);
        const attr = net.cables[i].geometry.attributes.position;
        attr.setXYZ(0, a.x, a.y, a.z);
        attr.setXYZ(1, b.x, b.y, b.z);
        attr.needsUpdate = true;
      });
    } else {
      net.sink += dt;
      net.group.position.y -= dt * 0.8;
      net.panel.material.opacity = Math.max(0, 0.85 - net.sink * 0.2);
      if (net.sink > 5) net.group.visible = false;
    }
  }

  // Where each cable can be bitten (its middle).
  cutPoints() {
    const net = this.net;
    if (!net || net.released) return [];
    return net.cables
      .map((c, i) => {
        if (net.cut[i]) return null;
        const a = c.geometry.attributes.position;
        return { i, x: (a.getX(0) + a.getX(1)) / 2, y: (a.getY(0) + a.getY(1)) / 2 - 0.5, z: (a.getZ(0) + a.getZ(1)) / 2 };
      })
      .filter(Boolean);
  }

  _collide(dt, orca) {
    const c = this.game.controller;
    const spec = this.spec;
    const f = this.forward;
    const dx = orca.x - this.position.x;
    const dz = orca.z - this.position.z;
    const lz = dx * f.x + dz * f.z; // along the boat
    const lx = dx * Math.cos(this.heading) - dz * Math.sin(this.heading); // across
    const hl = spec.length / 2;
    const hw = spec.width / 2;
    const nearSurface = c.depth < spec.height + 1.2 && !c.inAir;

    // Propeller: just behind the stern.
    if (nearSurface && this.speed > 1 && lz < -hl && lz > -hl - 4 && Math.abs(lx) < 1.8) {
      if (c.damage(7, 'propeller')) {
        this.game.hud.showToast('Ouch! Stay away from the propeller!');
        c.velocity.x -= f.x * 4;
        c.velocity.z -= f.z * 4;
      }
    }

    if (!nearSurface || Math.abs(lz) > hl + ORCA_R || Math.abs(lx) > hw + ORCA_R) return;
    // Push the orca out across the shallowest side.
    const penX = hw + ORCA_R - Math.abs(lx);
    const penZ = hl + ORCA_R - Math.abs(lz);
    let nx;
    let nz;
    if (penX < penZ) {
      const s = Math.sign(lx) || 1;
      nx = Math.cos(this.heading) * s;
      nz = -Math.sin(this.heading) * s;
      orca.x += nx * penX;
      orca.z += nz * penX;
    } else {
      const s = Math.sign(lz) || 1;
      nx = f.x * s;
      nz = f.z * s;
      orca.x += nx * penZ;
      orca.z += nz * penZ;
    }
    // Relative speed into the boat.
    const bvx = f.x * this.speed + this.velocity.x;
    const bvz = f.z * this.speed + this.velocity.y;
    const impact = -((c.velocity.x - bvx) * nx + (c.velocity.z - bvz) * nz);
    if (impact <= 0) return;
    c.velocity.x += nx * impact * 1.2;
    c.velocity.z += nz * impact * 1.2;
    if (this.game.time - this.lastHit < 0.8 || impact < 2.5) return;
    this.lastHit = this.game.time;

    const headOn = c.forward.x * -nx + c.forward.z * -nz > 0.6; // orca nose into the boat
    const bowHit = lz > hl * 0.4 && this.speed > 3; // the boat ran into the orca
    this.game.spray.splash(orca.x, this.position.y, orca.z, Math.min(impact, 6));
    this.game.chase.addShake(0.6);
    if (bowHit) {
      c.damage(15, 'boat');
      this.game.hud.showToast('The boat crashed into you!');
    } else if (headOn && impact > 4.5) {
      // A proper ram: rocks the boat and scares the crew, but bumps the orca's head a bit.
      this.velocity.x -= nx * impact * 0.4;
      this.velocity.y -= nz * impact * 0.4;
      this.rollKick = 0.25;
      this.scare(22 * c.strength, 'ram');
      c.damage(Math.max(1, 5 - c.upgrades.strength * 1.5), 'boat');
      this.game.onRam?.(this);
    } else {
      c.damage(4, 'boat');
    }
  }

  _throwNets(dt, orca) {
    const c = this.game.controller;
    this.netCooldown -= dt;
    const dist = Math.hypot(orca.x - this.position.x, orca.z - this.position.z);
    if (this.netCooldown > 0 || dist > 20 || dist < 5 || c.inAir || c.depth > 3) return;
    this.netCooldown = rand(7, 10);
    this.system.throwNet(this, orca);
  }

  dispose() {
    this.game.scene.remove(this.model);
    this.model.traverse((o) => o.geometry?.dispose());
    if (this.net) {
      this.game.scene.remove(this.net.group);
      this.net.cables.forEach((l) => this.game.scene.remove(l));
    }
  }
}

// All boats: poachers that roam or are spawned by missions, and the friendly coast guard.
export function createBoats(game) {
  const boats = [];
  const projectiles = [];
  const system = {
    game,
    boats,
    spawn(type, opts) {
      const b = new Boat(system, type, opts);
      boats.push(b);
      return b;
    },
    remove(b) {
      if (b.removed) return;
      b.removed = true;
      b.dispose();
      boats.splice(boats.indexOf(b), 1);
    },
    throwNet(boat, orca) {
      const mesh = createNet(1.4);
      mesh.scale.setScalar(0.8);
      game.scene.add(mesh);
      const from = boat.position.clone().setY(boat.position.y + 2);
      // Aim a little ahead of the orca.
      const c = game.controller;
      const to = new THREE.Vector3(orca.x + c.velocity.x * 0.9, 0, orca.z + c.velocity.z * 0.9);
      projectiles.push({ mesh, from, to, t: 0, duration: 0.9 });
      game.hud.showToast('Watch out, they threw a net!');
    },
    update(dt) {
      for (const b of [...boats]) b.update(dt);
      for (const p of [...projectiles]) {
        p.t += dt / p.duration;
        const k = Math.min(p.t, 1);
        p.mesh.position.lerpVectors(p.from, p.to, k);
        p.mesh.position.y = THREE.MathUtils.lerp(p.from.y, game.waves.heightAt(p.to.x, p.to.z), k) + Math.sin(k * Math.PI) * 5;
        p.mesh.rotation.y += dt * 4;
        if (p.t >= 1) {
          const orca = game.controller.position;
          if (!p.stuck && Math.hypot(orca.x - p.to.x, orca.z - p.to.z) < 4.5 && game.controller.depth < 3) {
            game.controller.trapped = 4;
            game.hud.showToast('Caught! Tap Action again and again to break free');
            p.stuck = true;
          }
          if (!p.stuck || game.controller.trapped <= 0) {
            game.scene.remove(p.mesh);
            projectiles.splice(projectiles.indexOf(p), 1);
          } else {
            p.mesh.position.copy(orca);
          }
        }
      }
    },
    onEvent(e) {
      const orca = game.controller.position;
      const strength = game.controller.strength;
      for (const b of boats) {
        const d = Math.hypot(orca.x - b.position.x, orca.z - b.position.z);
        if (e.type === 'breach' && d < 16) {
          b.scare(25 * strength, 'jump');
          if (b.crane && d < 14) b.hitCrane();
        }
        if (e.type === 'tailslap' && d < 15) b.scare(18 * strength, 'slap');
      }
    },
    interactables(out) {
      const c = game.controller;
      if (c.trapped > 0) {
        out.push({ x: c.position.x, y: c.position.y, z: c.position.z, radius: 20, label: 'Break free', cooldown: 0.1, onAction: () => (c.trapped = Math.max(0, c.trapped - 0.7)) });
        return;
      }
      for (const b of boats) {
        if (b.spec.friendly) {
          out.push({ x: b.position.x, z: b.position.z, radius: 14, label: b.talkLabel || 'Talk', onAction: () => b.onTalk?.() });
          continue;
        }
        for (const p of b.cutPoints()) out.push({ x: p.x, y: p.y, z: p.z, radius: 5, label: 'Bite line', cooldown: 0.4, onAction: () => b.cutLine(p.i) });
      }
    },
    markers(out) {
      for (const b of boats) out.push({ x: b.position.x, z: b.position.z, type: b.spec.friendly ? 'hub' : 'boat', label: b.spec.label });
    },
    nearestThreat() {
      const orca = game.controller.position;
      let best = Infinity;
      for (const b of boats) if (!b.spec.friendly) best = Math.min(best, Math.hypot(orca.x - b.position.x, orca.z - b.position.z));
      return best;
    },
  };
  return system;
}
