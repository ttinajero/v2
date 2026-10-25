import * as THREE from 'three';

// Base wave set: [angle offset from wind (rad), steepness, wavelength (m)].
// Steepness sums below 1 so Gerstner crests never loop over themselves.
export const WAVES = [
  [0.0, 0.17, 62],
  [0.35, 0.15, 39],
  [-0.45, 0.13, 24],
  [0.95, 0.11, 15.5],
  [-1.15, 0.1, 9.8],
  [1.7, 0.08, 6.4],
  [-2.1, 0.07, 4.3],
  [2.5, 0.06, 2.9],
];

const G = 9.8;
const TAU = Math.PI * 2;

function smoothstep(x, a, b) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

// CPU mirror of the ocean vertex shader, so things can float on the exact surface that is drawn.
export class Waves {
  constructor() {
    this.time = 0;
    this.chop = 0.85;
    this.scale = 1;
    this.dirs = WAVES.map(() => new THREE.Vector2());
    this.fadeOrigin = new THREE.Vector3(); // camera position: far short waves fade like on the GPU
    this._disp = new THREE.Vector3();
    this._tan = new THREE.Vector3();
    this._bin = new THREE.Vector3();
    this.setWind(0);
  }

  setWind(angle) {
    WAVES.forEach(([offset], i) => this.dirs[i].set(Math.cos(angle + offset), Math.sin(angle + offset)));
  }

  _wave(i, x, z) {
    const [, steepness, wavelength] = WAVES[i];
    const L = wavelength * this.scale;
    const camDist = Math.hypot(x - this.fadeOrigin.x, z - this.fadeOrigin.z);
    const steep = steepness * this.chop * (1 - smoothstep(camDist, L * 25, L * 90));
    const k = TAU / L;
    const c = Math.sqrt(G / k);
    const d = this.dirs[i];
    const f = k * (d.x * x + d.y * z - c * this.time);
    return { d, steep, k, c, f };
  }

  // Displacement (and optionally normal) of the surface point that rests at (x, z).
  displace(x, z, out, normalOut) {
    out.set(0, 0, 0);
    const t = this._tan.set(1, 0, 0);
    const b = this._bin.set(0, 0, 1);
    for (let i = 0; i < WAVES.length; i++) {
      const { d, steep, k, f } = this._wave(i, x, z);
      const a = steep / k;
      const s = Math.sin(f);
      const co = Math.cos(f);
      out.x += d.x * a * co;
      out.y += a * s;
      out.z += d.y * a * co;
      if (normalOut) {
        t.x -= d.x * d.x * steep * s;
        t.y += d.x * steep * co;
        t.z -= d.x * d.y * steep * s;
        b.x -= d.x * d.y * steep * s;
        b.y += d.y * steep * co;
        b.z -= d.y * d.y * steep * s;
      }
    }
    if (normalOut) normalOut.crossVectors(b, t).normalize();
    return out;
  }

  // Surface height at world (x, z). Gerstner waves move points sideways, so the
  // rest position that ends up above (x, z) is found by a few fixed-point steps.
  heightAt(x, z, normalOut) {
    const d = this._disp;
    let px = x;
    let pz = z;
    for (let i = 0; i < 4; i++) {
      this.displace(px, pz, d);
      px -= px + d.x - x;
      pz -= pz + d.z - z;
    }
    this.displace(px, pz, d, normalOut);
    return d.y;
  }

  // Orbital velocity of the water at (x, z), `depth` metres below the surface.
  velocityAt(x, z, depth, out) {
    out.set(0, 0, 0);
    for (let i = 0; i < WAVES.length; i++) {
      const { d, steep, k, c, f } = this._wave(i, x, z);
      const v = steep * c * Math.exp(-k * Math.max(depth, 0));
      const s = Math.sin(f);
      out.x += d.x * v * s;
      out.y -= v * Math.cos(f);
      out.z += d.y * v * s;
    }
    return out;
  }

  writeUniforms(uniforms) {
    uniforms.uTime.value = this.time;
    uniforms.uChop.value = this.chop;
    uniforms.uScale.value = this.scale;
    WAVES.forEach(([, steepness, wavelength], i) => {
      uniforms.uWaves.value[i].set(this.dirs[i].x, this.dirs[i].y, steepness, wavelength);
    });
    uniforms.uWind.value.copy(this.dirs[0]);
  }
}
