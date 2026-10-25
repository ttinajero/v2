import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Procedural orca, ~7 m long, nose toward +z. Body is a lathe; fins are extruded shapes.
export const ORCA_LENGTH = 7;
const HALF = ORCA_LENGTH / 2;

// Body radius along its length (t = 0 tail, 1 nose).
const PROFILE = [
  [0, 0.06], [0.08, 0.15], [0.2, 0.3], [0.35, 0.58], [0.5, 0.8],
  [0.65, 0.85], [0.78, 0.78], [0.88, 0.62], [0.95, 0.42], [0.99, 0.18], [1, 0],
];

function radiusAt(t) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [t1, r1] = PROFILE[i];
    if (t <= t1) {
      const [t0, r0] = PROFILE[i - 1];
      const k = THREE.MathUtils.smoothstep(t, t0, t1);
      return r0 + (r1 - r0) * k;
    }
  }
  return 0;
}

const BLACK = new THREE.Color(0x0b0c0f);
const WHITE = new THREE.Color(0xe9eef0);
const SADDLE = new THREE.Color(0x5a6168);

function paint(geometry, colorFn) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    colorFn(pos.getX(i), pos.getY(i), pos.getZ(i), c, i);
    c.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// Part ids read by the vertex shader: 0 body, 1 dorsal fin, 2 flukes, 3 left flipper, 4 right flipper.
function prepare(geometry, part) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(part), 1));
  return g;
}

function bodyGeometry() {
  const points = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(new THREE.Vector2(Math.max(radiusAt(t), 0.0001), t * ORCA_LENGTH - HALF));
  }
  const g = new THREE.LatheGeometry(points, 56);
  g.rotateX(Math.PI / 2); // lathe axis y → body axis z
  g.scale(0.9, 1, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0) pos.setY(i, pos.getY(i) * 0.88); // flatter belly
  }
  g.computeVertexNormals();

  paint(g, (x, y, z, c) => {
    const t = (z + HALF) / ORCA_LENGTH;
    const r = Math.max(radiusAt(t), 0.01);
    const yn = y / r;
    const xn = Math.abs(x) / r;
    c.copy(BLACK);
    // Belly, with the white flank patch sweeping up behind the dorsal fin.
    const flank = 0.42 * Math.exp(-(((t - 0.36) / 0.08) ** 2));
    const bellyLine = -0.32 + flank;
    if (t > 0.18 && t < 0.97 && yn < bellyLine) c.copy(WHITE);
    if (t > 0.86 && yn < -0.05) c.copy(WHITE); // chin
    // Eye patch.
    const eye = ((t - 0.8) / 0.065) ** 2 + ((yn - 0.32) / 0.16) ** 2;
    if (eye < 1 && xn > 0.45) c.copy(WHITE);
    // Grey saddle behind the dorsal fin.
    const saddle = ((t - 0.47) / 0.07) ** 2 + ((yn - 1) / 0.35) ** 2;
    if (saddle < 1) c.lerp(SADDLE, 0.85);
  });
  return prepare(g, 0);
}

function dorsalGeometry() {
  // u points backward, v up.
  const s = new THREE.Shape();
  s.moveTo(-0.55, 0);
  s.quadraticCurveTo(-0.2, 0.9, 0.05, 1.75);
  s.quadraticCurveTo(0.05, 0.7, 0.75, 0);
  s.lineTo(-0.55, 0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 14,
  });
  g.translate(0, 0, -0.06);
  g.rotateY(Math.PI / 2);
  g.translate(0, 0.62, 0.35);
  paint(g, (x, y, z, c) => c.copy(BLACK));
  return prepare(g, 1);
}

function flukesGeometry() {
  // u spans sideways, v points backward.
  const s = new THREE.Shape();
  s.moveTo(0, -0.15);
  s.quadraticCurveTo(0.6, -0.05, 1.35, 0.85);
  s.quadraticCurveTo(0.8, 0.75, 0, 0.5);
  s.quadraticCurveTo(-0.8, 0.75, -1.35, 0.85);
  s.quadraticCurveTo(-0.6, -0.05, 0, -0.15);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 14,
  });
  g.translate(0, 0, -0.03);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -3.3);
  paint(g, (x, y, z, c) => c.copy(y < 0 ? SADDLE : BLACK));
  return prepare(g, 2);
}

function pectoralGeometry(side) {
  const g = new THREE.SphereGeometry(1, 18, 12);
  g.scale(0.42, 0.07, 0.75);
  g.translate(0, 0, -0.6);
  g.rotateY(-side * 0.55);
  g.rotateZ(-side * 0.45);
  g.translate(side * 0.6, -0.42, 1.5);
  paint(g, (x, y, z, c) => c.copy(BLACK));
  return prepare(g, side > 0 ? 3 : 4);
}

export function createOrca() {
  const geometry = mergeGeometries([
    bodyGeometry(),
    dorsalGeometry(),
    flukesGeometry(),
    pectoralGeometry(1),
    pectoralGeometry(-1),
  ]);

  const uniforms = {
    uSwimPhase: { value: 0 },
    uSwimAmp: { value: 0.1 },
    uBend: { value: 0 },
    uArch: { value: 0 },
    uFlukeAmp: { value: 0 },
    uDorsalSway: { value: 0 },
    uPecL: { value: new THREE.Vector2() }, // flap, angle of attack
    uPecR: { value: new THREE.Vector2() },
    uSurfaceY: { value: 0 },
    uWaterColor: { value: new THREE.Color() },
    // Skin colours replace the painted black / grey / white (see setSkin).
    uSkinDark: { value: new THREE.Color(0x0b0c0f) },
    uSkinMid: { value: new THREE.Color(0x5a6168) },
    uSkinLight: { value: new THREE.Color(0xe9eef0) },
  };

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSwimPhase;
        uniform float uSwimAmp;
        uniform float uBend;
        uniform float uArch;
        uniform float uFlukeAmp;
        uniform float uDorsalSway;
        uniform vec2 uPecL;
        uniform vec2 uPecR;
        attribute float aPart;
        varying float vOrcaWorldY;

        mat2 rot2(float a) {
          return mat2(cos(a), sin(a), -sin(a), cos(a));
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float zn = transformed.z / 3.5;

        // Flippers pivot at the root: flap about the body axis, angle of attack about the span.
        if (aPart > 2.5) {
          float side = aPart > 3.5 ? -1.0 : 1.0;
          vec2 pec = side > 0.0 ? uPecL : uPecR;
          vec3 pivot = vec3(side * 0.6, -0.42, 1.5);
          vec3 q = transformed - pivot;
          q.yz = rot2(pec.y) * q.yz;
          q.xy = rot2(pec.x * side) * q.xy;
          transformed = pivot + q;
        }

        // Flukes pitch about the tail stock, a quarter cycle ahead of the heave,
        // so they bite the water on both the up- and the downstroke.
        if (aPart > 1.5 && aPart < 2.5) {
          vec3 pivot = vec3(0.0, 0.0, -3.2);
          vec3 q = transformed - pivot;
          q.yz = rot2(-uFlukeAmp * cos(uSwimPhase - 2.9)) * q.yz;
          transformed = pivot + q;
        }

        // The tall dorsal fin flexes sideways, more toward its tip.
        if (aPart > 0.5 && aPart < 1.5) {
          float hgt = max(transformed.y - 0.7, 0.0);
          transformed.x += uDorsalSway * hgt * hgt;
        }

        // Up-and-down stroke travelling toward the flukes.
        float tailW = 1.0 - smoothstep(-3.9, 0.8, transformed.z);
        tailW *= tailW;
        transformed.y += uSwimAmp * tailW * sin(transformed.z * 0.9 + uSwimPhase);
        transformed.y -= uSwimAmp * 0.12 * sin(uSwimPhase + 1.2) * (1.0 - tailW); // head counter-bob

        // The whole body arcs into turns and pitch changes.
        transformed.x -= uBend * zn * zn * 1.5;
        transformed.y += uArch * zn * zn;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vOrcaWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSurfaceY;
        uniform vec3 uWaterColor;
        uniform vec3 uSkinDark;
        uniform vec3 uSkinMid;
        uniform vec3 uSkinLight;
        varying float vOrcaWorldY;`,
      )
      .replace(
        '#include <color_fragment>',
        `#ifdef USE_COLOR
          // Painted colours are black, saddle grey or white: map each to the current skin.
          float lum = dot(vColor.rgb, vec3(0.3333));
          vec3 skin = lum < 0.05 ? uSkinDark : lum < 0.4 ? uSkinMid : uSkinLight;
          diffuseColor.rgb *= skin;
        #endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        // Light dies off with depth: the deeper, the more it melts into the water.
        float murk = clamp((uSurfaceY - 0.3 - vOrcaWorldY) / 16.0, 0.0, 1.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uWaterColor, sqrt(murk) * 0.92);`,
      );
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  group.add(mesh);
  function setSkin({ dark, mid, light }) {
    uniforms.uSkinDark.value.set(dark);
    uniforms.uSkinMid.value.set(mid);
    uniforms.uSkinLight.value.set(light);
  }

  return { group, uniforms, setSkin };
}
