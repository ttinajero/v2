import * as THREE from 'three';
import { underwaterMaterial } from './materials.js';

// Simple mission props. Everything uses the water-tinted material so it fades with depth.
const mat = (color, extra = {}) => underwaterMaterial({ color, roughness: 0.6, ...extra });

export function createRing(color = 0xffd25c) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.28, 10, 32), mat(color, { emissive: color, emissiveIntensity: 0.6 }));
  return ring;
}

export function createBottle() {
  const g = new THREE.Group();
  const glass = mat(0x7fd3a8, { transparent: true, opacity: 0.85, roughness: 0.15 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 10), glass);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.25, 8), glass);
  neck.position.y = 0.42;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 6), mat(0x9a6b3e));
  cork.position.y = 0.58;
  const note = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 6), mat(0xf0e6c8));
  g.add(body, neck, cork, note);
  g.rotation.z = Math.PI / 2.3;
  g.scale.setScalar(1.6);
  return g;
}

export function createTrash(kind = Math.floor(Math.random() * 3)) {
  if (kind === 0) {
    // Plastic bag.
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5).scale(1, 0.4, 1.2), mat(0xeef3f5, { transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    return m;
  }
  if (kind === 1) {
    // Plastic bottle.
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8).rotateZ(Math.PI / 2), mat(0x4aa3df, { transparent: true, opacity: 0.85 }));
    return m;
  }
  // Tangle of ghost net.
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.8, 0)), new THREE.LineBasicMaterial({ color: 0x9fd060 }));
  return lines;
}

export function createShipwreck() {
  const g = new THREE.Group();
  const wood = mat(0x4a3a2a);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 18, 2, 2, 6), wood);
  // Taper the bow and break the hull open.
  const p = hull.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) > 4) p.setX(i, p.getX(i) * (1 - (p.getZ(i) - 4) / 6));
    if (p.getY(i) > 0 && p.getZ(i) < -3) p.setY(i, p.getY(i) - 1.5);
  }
  hull.geometry.computeVertexNormals();
  hull.rotation.z = 0.35;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 16, 8), wood);
  mast.position.set(0.5, 7, 2);
  mast.rotation.z = 0.35;
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), wood);
  yard.position.set(-1.2, 11, 2);
  yard.rotation.z = Math.PI / 2 + 0.35;
  g.add(hull, mast, yard);
  return g;
}

export function createKelpForest(count = 40, radius = 25) {
  const g = new THREE.Group();
  const kelp = mat(0x3f6b2a, { side: THREE.DoubleSide });
  const blade = new THREE.PlaneGeometry(0.6, 14, 1, 8).translate(0, 7, 0);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(blade, kelp);
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    m.position.set(Math.cos(a) * r, -16, Math.sin(a) * r);
    m.rotation.y = Math.random() * Math.PI;
    m.scale.y = 0.7 + Math.random() * 0.4;
    m.userData.sway = Math.random() * 10;
    g.add(m);
  }
  g.userData.animate = (t) => g.children.forEach((m) => (m.rotation.z = Math.sin(t * 0.8 + m.userData.sway) * 0.12));
  return g;
}

export function createChest() {
  const g = new THREE.Group();
  const wood = mat(0x7a4a22);
  const gold = mat(0xe8b830, { metalness: 0.6, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1), wood);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), wood);
  lid.position.y = 0.45;
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 1.05), gold);
  band.position.y = 0.2;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.1), gold);
  lock.position.set(0, 0.4, 0.52);
  g.add(base, lid, band, lock);
  g.userData.lid = lid;
  return g;
}

export function createPearl() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1), mat(0xd8b0c0, { side: THREE.DoubleSide }));
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe8ff, emissiveIntensity: 0.9, roughness: 0.1 }));
  pearl.position.y = 0.25;
  g.add(shell, pearl);
  g.userData.pearl = pearl;
  return g;
}

// Light sandy shallows seen through the water.
export function createSandbar(radius = 30) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8c690, roughness: 1 }));
  m.position.y = -1.6;
  return m;
}

// Ice floe for the family wave practice.
export function createIceFloe() {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 0.8, 7), new THREE.MeshStandardMaterial({ color: 0xf2f8fb, roughness: 0.5 }));
  return g;
}
