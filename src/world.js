import * as THREE from 'three';

// Square map, metres from the centre to each edge.
export const WORLD_HALF = 1500;

export const POINTS = [
  { name: 'Lighthouse Buoy', x: 0, z: -260 },
  { name: 'North Current', x: 380, z: -900 },
  { name: 'Ghost Shoal', x: -720, z: -540 },
  { name: 'East Passage', x: 1050, z: -120 },
  { name: 'Western Trench', x: -1180, z: 420 },
  { name: 'South Reef', x: 260, z: 980 },
  { name: "Fisherman's Mark", x: -350, z: 1240 },
];

const LIGHT_OFF = new THREE.Color(0xffb347);
const LIGHT_ON = new THREE.Color(0x6dffb0);

function createBuoy() {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xa8322b, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });

  const float = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.2, 16), red);
  float.position.y = 0.2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.3, 16), white);
  band.position.y = 0.55;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), dark);
  mast.position.y = 2.0;
  const cage = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4, 1, true), red);
  cage.position.y = 2.6;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: LIGHT_OFF }));
  lamp.position.y = 3.4;
  group.add(float, band, mast, cage, lamp);
  return { group, lamp };
}

// Buoys marking points of interest; each floats on the real wave surface.
export function createWorld(scene, waves) {
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tilt = new THREE.Quaternion();

  const buoys = POINTS.map((point) => {
    const { group, lamp } = createBuoy();
    scene.add(group);
    return { ...point, group, lamp, visited: false };
  });

  function update(time, orcaPos, onVisit) {
    for (const b of buoys) {
      const h = waves.heightAt(b.x, b.z, normal);
      b.group.position.set(b.x, h - 0.35, b.z);
      tilt.setFromUnitVectors(up, normal);
      b.group.quaternion.slerp(tilt, 0.15);
      const blink = 0.55 + 0.45 * Math.sin(time * 3 + b.x);
      b.lamp.material.color.copy(b.visited ? LIGHT_ON : LIGHT_OFF).multiplyScalar(0.6 + blink * 0.8);

      if (!b.visited && Math.hypot(orcaPos.x - b.x, orcaPos.z - b.z) < 18) {
        b.visited = true;
        onVisit(b, buoys.filter((x) => x.visited).length, buoys.length);
      }
    }
  }

  return { buoys, update };
}
