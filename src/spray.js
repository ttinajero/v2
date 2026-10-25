import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelScale / -mv.z;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.15, 0.5, d)) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const rand = (a, b) => a + Math.random() * (b - a);

// Pooled water droplets and mist: breaches, splashes, bow spray and the blow.
export class Spray {
  constructor(max = 3000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.opacity = new Float32Array(max);
    this.sizes = new Float32Array(max);
    this.alphas = new Float32Array(max);
    this.cursor = 0;
    this.density = 1; // fraction of requested particles actually spawned (quality setting)
    this._disp = new THREE.Vector3();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = {
      uColor: { value: new THREE.Color(1, 1, 1) },
      uPixelScale: { value: 500 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2; // after the water so droplets above it stay visible
  }

  emit(x, y, z, vx, vy, vz, { size = 0.5, life = 1.2, gravity = 1, drag = 0.4, opacity = 0.85 } = {}) {
    if (this.density < 1 && Math.random() > this.density) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseSize[i] = size;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.opacity[i] = opacity;
  }

  breach(x, y, z, vel, strength) {
    const n = Math.min(80 + strength * 18, 260);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(0.5, 3.5);
      this.emit(x + Math.cos(a) * rand(0, 1.5), y, z + Math.sin(a) * rand(0, 1.5),
        vel.x * 0.4 + Math.cos(a) * r, rand(2, 4 + strength * 0.6), vel.z * 0.4 + Math.sin(a) * r,
        { size: rand(0.12, 0.42), life: rand(0.9, 1.8), opacity: 0.75 });
    }
  }

  splash(x, y, z, strength) {
    const n = Math.min(100 + strength * 30, 500);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(1, 2.5 + strength * 0.5);
      this.emit(x + Math.cos(a) * rand(0.5, 2.5), y, z + Math.sin(a) * rand(0.5, 2.5),
        Math.cos(a) * r, rand(2, 3 + strength * 0.9), Math.sin(a) * r,
        { size: rand(0.14, 0.5), life: rand(1, 2.2), opacity: 0.75 });
    }
    // A low curtain of mist that hangs over the impact.
    for (let i = 0; i < 12 + strength * 3; i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(x, y + 0.5, z, Math.cos(a) * rand(1, 3), rand(0.5, 2), Math.sin(a) * rand(1, 3),
        { size: rand(0.8, 1.6), life: rand(1.2, 2), gravity: 0.1, drag: 1.5, opacity: 0.12 });
    }
  }

  spout(x, y, z, strength = 1) {
    for (let i = 0; i < 140 * strength; i++) {
      this.emit(x + rand(-0.15, 0.15), y, z + rand(-0.15, 0.15),
        rand(-0.6, 0.6), rand(5, 9) * strength, rand(-0.6, 0.6),
        { size: rand(0.25, 0.8), life: rand(1.2, 2.4), gravity: 0.3, drag: 1.2, opacity: 0.22 });
    }
  }

  bow(x, y, z, side, fwd, speed) {
    const out = rand(1, 2.5);
    this.emit(x, y, z,
      side.x * out + fwd.x * speed * 0.3, rand(1.2, 2.5 + speed * 0.12), side.z * out + fwd.z * speed * 0.3,
      { size: rand(0.2, 0.5), life: rand(0.5, 0.9) });
  }

  update(dt, waves) {
    const { pos, vel, life } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) {
        this.alphas[i] = 0;
        continue;
      }
      life[i] -= dt;
      const j = i * 3;
      const drag = Math.exp(-this.drag[i] * dt);
      vel[j + 1] -= 9.8 * this.gravity[i] * dt;
      vel[j] *= drag;
      vel[j + 1] *= drag;
      vel[j + 2] *= drag;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;
      // Droplets disappear back into the sea.
      if (vel[j + 1] < 0 && pos[j + 1] < waves.displace(pos[j], pos[j + 2], this._disp).y - 0.2) life[i] = 0;
      const t = Math.max(life[i], 0) / this.maxLife[i];
      this.alphas[i] = Math.min(t * 2.5, 1) * this.opacity[i];
      this.sizes[i] = this.baseSize[i] * (1.3 - t * 0.3);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }
}
