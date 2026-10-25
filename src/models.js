import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { underwaterMaterial, paintGeometry } from './materials.js';

// Procedural low-poly creatures in the same style as the orca. Bodies are lathes
// with the nose toward +z; fins are thin extruded shapes.

function profileFn(profile) {
  return (t) => {
    for (let i = 1; i < profile.length; i++) {
      const [t1, r1] = profile[i];
      if (t <= t1) {
        const [t0, r0] = profile[i - 1];
        return r0 + (r1 - r0) * THREE.MathUtils.smoothstep(t, t0, t1);
      }
    }
    return 0;
  };
}

function lathe(profile, length, { segments = 18, sx = 1, sy = 1, steps = 36 } = {}) {
  const r = profileFn(profile);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector2(Math.max(r(t), 0.0001), t * length - length / 2));
  }
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateX(Math.PI / 2);
  g.scale(sx, sy, 1);
  g.computeVertexNormals();
  return { geometry: g, radius: r };
}

// Fin from a polygon in (u, v). vertical: u backward, v up. horizontal: u sideways, v backward.
function fin(points, { depth = 0.04, vertical = true } = {}) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  if (vertical) g.rotateY(Math.PI / 2);
  else g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function solid(geometry, color) {
  return paintGeometry(geometry, (x, y, z, c) => c.set(color));
}

function prep(g) {
  const out = g.index ? g.toNonIndexed() : g;
  if (out.attributes.uv) out.deleteAttribute('uv');
  return out;
}

function merged(list) {
  return mergeGeometries(list.map(prep));
}

const sharedMaterial = underwaterMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide }); // mirrored fins need both sides

function mesh(geometry) {
  const m = new THREE.Mesh(geometry, sharedMaterial);
  m.frustumCulled = true;
  return m;
}

// Two-tone counter-shading: dark back, pale belly.
function countershade(top, belly, line = -0.15) {
  const a = new THREE.Color(top);
  const b = new THREE.Color(belly);
  return (radius, length) => (x, y, z, c) => {
    const r = Math.max(radius((z + length / 2) / length), 0.001);
    c.copy(y / r < line ? b : a);
  };
}

// ---------- Fish (instanced in schools) ----------
export function fishGeometry() {
  const { geometry, radius } = lathe([[0, 0.01], [0.2, 0.05], [0.55, 0.08], [0.85, 0.06], [1, 0]], 0.55, { segments: 8, sx: 0.55, steps: 10 });
  paintGeometry(geometry, (x, y, z, c) => {
    const r = Math.max(radius((z + 0.275) / 0.55), 0.001);
    c.set(y / r > 0.1 ? 0x3d5f78 : 0xdfe8ee);
  });
  const tail = solid(fin([[0, 0], [0.16, 0.1], [0.12, 0], [0.16, -0.1]], { depth: 0.01 }), 0x3d5f78);
  tail.translate(0, 0, -0.24);
  return merged([geometry, tail]);
}

export function fishMaterial() {
  return underwaterMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.3 });
}

// ---------- Seagull ----------
export function createGull() {
  const group = new THREE.Group();
  const body = solid(new THREE.SphereGeometry(0.18, 8, 6).scale(0.8, 0.8, 2), 0xf2f2ee);
  const head = solid(new THREE.SphereGeometry(0.11, 8, 6), 0xf2f2ee).translate(0, 0.08, 0.32);
  const beak = solid(new THREE.ConeGeometry(0.03, 0.12, 5).rotateX(Math.PI / 2), 0xf0b030).translate(0, 0.06, 0.45);
  group.add(mesh(merged([body, head, beak])));
  const wingGeom = (side) => {
    const g = solid(new THREE.BoxGeometry(0.6, 0.02, 0.2), 0x9aa4ab).translate(side * 0.3, 0, 0);
    const tip = solid(new THREE.BoxGeometry(0.15, 0.021, 0.2), 0x222222).translate(side * 0.62, 0, 0);
    return merged([g, tip]);
  };
  const left = new THREE.Group();
  left.add(mesh(wingGeom(1)));
  const right = new THREE.Group();
  right.add(mesh(wingGeom(-1)));
  left.position.x = 0.1;
  right.position.x = -0.1;
  group.add(left, right);
  group.userData.wings = [left, right];
  return group;
}

// ---------- Dolphin (~2.6 m) ----------
export function createDolphin() {
  const L = 2.6;
  const { geometry, radius } = lathe([[0, 0.04], [0.15, 0.1], [0.45, 0.26], [0.7, 0.27], [0.86, 0.2], [0.9, 0.08], [0.98, 0.06], [1, 0]], L, { sx: 0.85 });
  paintGeometry(geometry, countershade(0x5b6d7a, 0xd9e1e6, -0.2)(radius, L));
  const dorsal = solid(fin([[-0.15, 0], [0.12, 0.38], [0.25, 0.36], [0.25, 0]]), 0x4c5d69).translate(0, 0.2, 0);
  const pecs = [1, -1].map((s) => solid(new THREE.SphereGeometry(1, 8, 6).scale(0.18, 0.025, 0.3).rotateZ(-s * 0.5).rotateY(-s * 0.4), 0x4c5d69).translate(s * 0.22, -0.12, 0.55));
  const body = mesh(merged([geometry, dorsal, ...pecs]));
  const tail = new THREE.Group();
  tail.position.z = -L / 2 + 0.1;
  tail.add(mesh(solid(fin([[0, 0], [0.45, 0.35], [0.3, 0.12], [0, 0.22], [-0.3, 0.12], [-0.45, 0.35]], { vertical: false, depth: 0.03 }), 0x4c5d69)));
  const group = new THREE.Group();
  group.add(body, tail);
  group.userData = { tail, tailAxis: 'x', length: L };
  return group;
}

// ---------- Shark (~3.6 m) ----------
export function createShark() {
  const L = 3.6;
  const { geometry, radius } = lathe([[0, 0.04], [0.12, 0.09], [0.45, 0.36], [0.68, 0.38], [0.86, 0.3], [0.96, 0.16], [1, 0]], L, { sx: 0.85 });
  paintGeometry(geometry, countershade(0x6b7a84, 0xe4e8ea, -0.25)(radius, L));
  const dorsal = solid(fin([[-0.3, 0], [0.05, 0.62], [0.3, 0.55], [0.35, 0]]), 0x5f6d77).translate(0, 0.28, 0.25);
  const pecs = [1, -1].map((s) => solid(fin([[0, 0], [0.55, 0.15], [0.5, 0.3], [0, 0.28]], { vertical: false, depth: 0.03 }), 0x5f6d77).scale(s, 1, 1).rotateZ(-s * 0.25).translate(s * 0.25, -0.2, 0.75));
  const body = mesh(merged([geometry, dorsal, ...pecs]));
  const tail = new THREE.Group();
  tail.position.z = -L / 2 + 0.15;
  tail.add(mesh(solid(fin([[0, 0], [0.55, 0.75], [0.4, 0.05], [0.45, -0.4], [0, -0.05]], { depth: 0.04 }), 0x5f6d77)));
  const group = new THREE.Group();
  group.add(body, tail);
  group.userData = { tail, tailAxis: 'y', length: L };
  return group;
}

// ---------- Sea turtle (~1.3 m) ----------
export function createTurtle() {
  const group = new THREE.Group();
  const shell = paintGeometry(new THREE.SphereGeometry(1, 14, 8).scale(0.5, 0.2, 0.62), (x, y, z, c) => {
    const tile = (Math.floor(x * 5 + 10) + Math.floor(z * 4 + 10)) % 2;
    c.set(y < -0.02 ? 0xd8c890 : tile ? 0x5e6b33 : 0x4a5628);
  });
  const head = solid(new THREE.SphereGeometry(0.15, 8, 6).scale(1, 0.85, 1.3), 0x7c8a4e).translate(0, 0.02, 0.72);
  group.add(mesh(merged([shell, head])));
  const flippers = [];
  for (const [s, front] of [[1, 1], [-1, 1], [1, 0], [-1, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.38, -0.02, front ? 0.32 : -0.38);
    const len = front ? 0.5 : 0.25;
    pivot.add(mesh(solid(new THREE.SphereGeometry(1, 8, 4).scale(len, 0.03, front ? 0.14 : 0.12).translate(s * len * 0.9, 0, front ? -0.05 : -0.04).rotateY(front ? -s * 0.4 : s * 0.5), 0x7c8a4e)));
    group.add(pivot);
    flippers.push({ pivot, side: s, front });
  }
  group.userData = { flippers, length: 1.3 };
  return group;
}

// ---------- Harbour seal (~1.7 m) ----------
export function createSeal() {
  const L = 1.7;
  const { geometry, radius } = lathe([[0, 0.05], [0.15, 0.14], [0.45, 0.28], [0.7, 0.26], [0.86, 0.17], [0.92, 0.15], [0.98, 0.1], [1, 0]], L, { sx: 0.95 });
  paintGeometry(geometry, (x, y, z, c) => {
    const r = Math.max(radius((z + L / 2) / L), 0.001);
    const spot = Math.sin(x * 23) * Math.sin(z * 19 + y * 7) > 0.75;
    c.set(y / r < -0.3 ? 0xb9b2a4 : spot ? 0x3e3a35 : 0x6f685f);
  });
  const eyes = [1, -1].map((s) => solid(new THREE.SphereGeometry(0.03, 6, 4), 0x0a0a0a).translate(s * 0.08, 0.07, 0.72));
  const front = [1, -1].map((s) => solid(new THREE.SphereGeometry(1, 6, 4).scale(0.14, 0.03, 0.08).rotateZ(-s * 0.6), 0x5d564e).translate(s * 0.22, -0.12, 0.35));
  const body = mesh(merged([geometry, ...eyes, ...front]));
  const tail = new THREE.Group();
  tail.position.z = -L / 2 + 0.05;
  tail.add(mesh(solid(fin([[0, 0], [0.22, 0.3], [0.05, 0.22], [0, 0.25], [-0.05, 0.22], [-0.22, 0.3]], { vertical: false, depth: 0.03 }), 0x5d564e)));
  const group = new THREE.Group();
  group.add(body, tail);
  group.userData = { tail, tailAxis: 'y', length: L };
  return group;
}

// ---------- Humpback whale (~13 m, scaled down for calves) ----------
export function createWhale() {
  const L = 13;
  const { geometry, radius } = lathe([[0, 0.15], [0.12, 0.45], [0.4, 1.35], [0.62, 1.5], [0.82, 1.3], [0.94, 0.9], [1, 0.1]], L, { sx: 0.9, segments: 22 });
  paintGeometry(geometry, (x, y, z, c) => {
    const r = Math.max(radius((z + L / 2) / L), 0.001);
    const t = (z + L / 2) / L;
    const grooves = t > 0.6 && y / r < -0.35 && Math.sin(x * 9) > 0;
    c.set(y / r < -0.35 ? (grooves ? 0xb8bcc0 : 0xd2d6d8) : 0x2c3238);
  });
  const dorsal = solid(fin([[-0.4, 0], [0.2, 0.35], [0.5, 0]]), 0x2c3238).translate(0, 1.05, -2.3);
  const pecs = [1, -1].map((s) =>
    paintGeometry(new THREE.SphereGeometry(1, 10, 6).scale(2.2, 0.12, 0.45).translate(s * 2, 0, 0).rotateZ(-s * 0.45).rotateY(-s * 0.35), (x, y, z, c) => c.set(y > 0 ? 0x3a4148 : 0xe6e8ea)).translate(s * 1.1, -0.7, 2.4),
  );
  const body = mesh(merged([geometry, dorsal, ...pecs]));
  const tail = new THREE.Group();
  tail.position.z = -L / 2 + 0.3;
  tail.add(mesh(paintGeometry(fin([[0, 0], [1.9, 1.2], [1.2, 1.25], [0, 0.85], [-1.2, 1.25], [-1.9, 1.2]], { vertical: false, depth: 0.12 }), (x, y, z, c) => c.set(y < 0 ? 0xe2e4e6 : 0x2c3238))));
  const group = new THREE.Group();
  group.add(body, tail);
  group.userData = { tail, tailAxis: 'x', length: L };
  return group;
}

// ---------- Fishing net (ball of mesh with floats) ----------
export function createNet(radius = 1.5) {
  const group = new THREE.Group();
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(radius, 1)),
    new THREE.LineBasicMaterial({ color: 0xd8c9a0, transparent: true, opacity: 0.9 }),
  );
  group.add(lines);
  const floatMat = new THREE.MeshStandardMaterial({ color: 0xff7a30, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), floatMat);
    f.position.set(Math.cos(a) * radius * 0.9, radius * 0.55, Math.sin(a) * radius * 0.9);
    group.add(f);
  }
  return group;
}

// Swims a creature's tail / flippers. `effort` 0..1 scales speed and amplitude.
export function animateCreature(group, t, effort = 0.5, phase = 0) {
  const ud = group.userData;
  if (ud.tail) {
    const amp = 0.18 + effort * 0.35;
    ud.tail.rotation[ud.tailAxis] = Math.sin(t * (3 + effort * 6) + phase) * amp;
  }
  if (ud.flippers) {
    for (const f of ud.flippers) {
      const speed = f.front ? 2.2 + effort * 3 : 3 + effort * 3;
      f.pivot.rotation.z = Math.sin(t * speed + phase + (f.front ? 0 : 1.5)) * (f.front ? 0.6 : 0.3) * f.side;
    }
  }
  if (ud.wings) {
    const flap = Math.sin(t * 7 + phase) * 0.55;
    ud.wings[0].rotation.z = flap;
    ud.wings[1].rotation.z = -flap;
  }
}
