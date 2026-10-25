import * as THREE from 'three';
import { WAVES } from './waves.js';

export const TRAIL_SIZE = 40;

const vertexShader = /* glsl */ `
  #define NUM_WAVES ${WAVES.length}

  uniform float uTime;
  uniform float uChop;
  uniform float uScale;
  uniform vec4 uWaves[NUM_WAVES]; // dir.xy, steepness, wavelength

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vCrest;
  varying float vHeight;

  void main() {
    vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 disp = vec3(0.0);
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);
    float crest = 0.0;
    float camDist = length(p.xz - cameraPosition.xz);

    for (int i = 0; i < NUM_WAVES; i++) {
      vec4 w = uWaves[i];
      float L = w.w * uScale;
      // Fade short waves out in the distance where the grid can't resolve them.
      float fade = 1.0 - smoothstep(L * 25.0, L * 90.0, camDist);
      float steep = w.z * uChop * fade;
      float k = 6.2831853 / L;
      float c = sqrt(9.8 / k);
      vec2 d = w.xy;
      float f = k * (dot(d, p.xz) - c * uTime);
      float a = steep / k;
      float s = sin(f);
      float co = cos(f);

      disp += vec3(d.x * a * co, a * s, d.y * a * co);
      tangent += vec3(-d.x * d.x * steep * s, d.x * steep * co, -d.x * d.y * steep * s);
      binormal += vec3(-d.x * d.y * steep * s, d.y * steep * co, -d.y * d.y * steep * s);
      crest += steep * s;
    }

    p += disp;
    vWorldPos = p;
    vNormal = normalize(cross(binormal, tangent));
    vCrest = crest;
    vHeight = disp.y / uScale;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWind;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform float uLightIntensity;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyZenith;
  uniform vec3 uFoamColor;
  uniform float uFoamAmount;
  uniform float uRipples;
  uniform float uHorizonDist;
  uniform float uClock;
  uniform vec4 uTrail[${TRAIL_SIZE}]; // x, z, birth time, strength

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vCrest;
  varying float vHeight;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  // Rotate into wind space: x along the wind, y across it.
  vec2 windSpace(vec2 p) {
    return vec2(dot(p, uWind), dot(p, vec2(-uWind.y, uWind.x)));
  }

  // Two layers of soft drifting noise for small surface ripples.
  float ripples(vec2 p) {
    vec2 q = windSpace(p);
    return fbm(q * vec2(0.12, 0.2) - vec2(uTime * 0.12, 0.0)) * 0.65
         + fbm(q * vec2(0.3, 0.45) + vec2(uTime * 0.05, uTime * 0.09) + 13.7) * 0.35;
  }

  // Lacy foam texture, stretched across the wind like streaks on the water.
  float foamTexture(vec2 p) {
    vec2 q = windSpace(p);
    float a = fbm(q * vec2(0.35, 0.9) - vec2(uTime * 0.25, 0.0));
    float b = fbm(q * vec2(0.9, 1.6) + vec2(uTime * 0.1, -uTime * 0.15) + 5.3);
    return a * 0.65 + b * 0.35;
  }

  // Reflections lean toward the zenith so the water keeps its own hue at dusk.
  vec3 skyColor(vec3 dir) {
    float h = clamp(dir.y, 0.0, 1.0);
    return mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.3, h));
  }

  void main() {
    vec3 toCam = cameraPosition - vWorldPos;
    float dist = length(toCam);
    vec3 V = toCam / dist;
    vec2 xz = vWorldPos.xz;

    // Detail normal from ripple noise, faded out with distance to avoid shimmer.
    float detail = uRipples * (1.0 - smoothstep(60.0, 600.0, dist));
    float e = 0.4;
    float r0 = ripples(xz);
    float rx = ripples(xz + vec2(e, 0.0));
    float rz = ripples(xz + vec2(0.0, e));
    vec3 N = normalize(vNormal + vec3(r0 - rx, 0.0, r0 - rz) / e * 0.6 * detail);

    vec3 L = normalize(uLightDir);
    vec3 lightCol = uLightColor * uLightIntensity;
    float ndl = max(dot(N, L), 0.0);
    // Two soft bands instead of a smooth gradient: a painted, toon-ish read.
    float diffuse = mix(0.55, 1.0, smoothstep(0.25, 0.45, ndl));

    float hN = clamp(vHeight * 0.4 + 0.5, 0.0, 1.0);
    vec3 base = mix(uDeepColor, uShallowColor, smoothstep(0.2, 1.0, hN) * 0.7 + 0.15);

    vec3 ambient = mix(uSkyHorizon, uSkyZenith, 0.5) * 0.45;
    vec3 water = base * (ambient + lightCol * diffuse * 0.6);

    // Light glowing through the thin tops of waves when looking toward the light.
    float sss = pow(clamp(dot(V, -L) * 0.5 + 0.5, 0.0, 1.0), 4.0) * smoothstep(0.5, 1.0, hN);
    water += uShallowColor * lightCol * sss * 0.8;

    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    fresnel = smoothstep(0.0, 1.0, fresnel) * 0.7;
    vec3 col = mix(water, skyColor(R), fresnel);

    // Hard-edged glints plus a soft path of light toward the sun or moon.
    float rl = max(dot(R, L), 0.0);
    float glint = smoothstep(0.5, 0.55, pow(rl, 300.0)) * 1.6
                + smoothstep(0.35, 0.45, pow(rl, 30.0)) * 0.18
                + pow(rl, 8.0) * 0.08;
    col += lightCol * glint;

    // Foam: crisp lacy patches that grow out of the crests.
    float tex = foamTexture(xz);
    float crestMask = smoothstep(0.72 - uFoamAmount * 0.55, 0.95 - uFoamAmount * 0.5, vCrest);
    float cap = smoothstep(0.0, 0.03, tex - (1.0 - crestMask) * 0.9 - 0.08);
    // Faint streaks that linger on the open water between crests.
    float streak = smoothstep(0.63, 0.66, tex) * smoothstep(-0.2, 0.3, vCrest) * uFoamAmount;
    streak *= 1.0 - smoothstep(60.0, 300.0, dist);
    // Wake left by whatever swims through the surface: blobs that spread and fade.
    float wake = 0.0;
    for (int i = 0; i < ${TRAIL_SIZE}; i++) {
      vec4 t = uTrail[i];
      float age = uClock - t.z;
      if (t.w <= 0.0 || age < 0.0 || age > 9.0) continue;
      float radius = (1.0 + age * 0.7) * (0.6 + 0.5 * min(t.w, 2.5));
      float d = length(xz - t.xy);
      wake = max(wake, (1.0 - smoothstep(radius * 0.4, radius, d)) * (1.0 - age / 9.0) * min(t.w, 1.0));
    }
    float wakeFoam = smoothstep(0.0, 0.03, tex - 0.66 + wake * 0.2) * step(0.02, wake);
    float foam = max(max(cap * step(0.001, uFoamAmount), streak * 0.55), wakeFoam);
    vec3 foamLit = uFoamColor * (ambient * 1.4 + lightCol * (0.55 + 0.45 * ndl));
    col = mix(col, foamLit, foam);

    // Blend into the horizon so the edge of the mesh disappears.
    float horizon = smoothstep(uHorizonDist * 0.35, uHorizonDist, dist);
    col = mix(col, uSkyHorizon, horizon);

    // Slightly see-through when looking down, so a diving animal stays visible.
    float alpha = clamp(0.62 + fresnel * 0.8 + foam + horizon, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Radial grid: dense near the camera, coarse toward the horizon.
function createRadialGrid(rings, segments, baseStep, growth) {
  const positions = [0, 0, 0];
  const indices = [];
  let r = 0;
  let step = baseStep;
  for (let i = 1; i <= rings; i++) {
    r += step;
    step *= growth;
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  for (let j = 0; j < segments; j++) {
    indices.push(0, 1 + ((j + 1) % segments), 1 + j);
  }
  for (let i = 0; i < rings - 1; i++) {
    const inner = 1 + i * segments;
    const outer = inner + segments;
    for (let j = 0; j < segments; j++) {
      const jn = (j + 1) % segments;
      indices.push(inner + j, inner + jn, outer + j);
      indices.push(inner + jn, outer + jn, outer + j);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return { geometry, radius: r };
}

// Ring growth chosen so every detail level still reaches ~7 km to the horizon.
function oceanGrid(rings, segments) {
  const growth = 1 + 0.02 * (320 / rings) ** 0.85;
  return createRadialGrid(rings, segments, 0.25 * (320 / rings), growth);
}

export function createOcean() {
  const { geometry, radius } = oceanGrid(320, 512);

  const uniforms = {
    uTime: { value: 0 },
    uChop: { value: 0.85 },
    uScale: { value: 1 },
    uWaves: { value: WAVES.map(() => new THREE.Vector4()) },
    uWind: { value: new THREE.Vector2(1, 0) },
    uLightDir: { value: new THREE.Vector3(0, 1, 0) },
    uLightColor: { value: new THREE.Color() },
    uLightIntensity: { value: 1 },
    uDeepColor: { value: new THREE.Color() },
    uShallowColor: { value: new THREE.Color() },
    uSkyHorizon: { value: new THREE.Color() },
    uSkyZenith: { value: new THREE.Color() },
    uFoamColor: { value: new THREE.Color() },
    uFoamAmount: { value: 0.5 },
    uRipples: { value: 1 },
    uHorizonDist: { value: radius * 0.9 },
    uClock: { value: 0 },
    uTrail: { value: Array.from({ length: TRAIL_SIZE }, () => new THREE.Vector4()) },
  };

  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  let trailIndex = 0;
  function addWake(x, z, strength) {
    uniforms.uTrail.value[trailIndex].set(x, z, uniforms.uClock.value, strength);
    trailIndex = (trailIndex + 1) % TRAIL_SIZE;
  }

  function setDetail(rings, segments) {
    const grid = oceanGrid(rings, segments);
    mesh.geometry.dispose();
    mesh.geometry = grid.geometry;
    uniforms.uHorizonDist.value = grid.radius * 0.9;
  }

  return { mesh, uniforms, addWake, setDetail, radius };
}
