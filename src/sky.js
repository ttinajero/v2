import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pin to the far plane
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uSunColor;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uDeep;
  uniform float uNight;
  uniform float uTime;

  varying vec3 vDir;

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, max(h, 0.0)));
    // Below the horizon this is what shows through the water: the dark deep.
    col = mix(uDeep * 0.55, col, smoothstep(-0.12, 0.0, h));

    // Sun disk, halo and a warm band along the horizon on its side.
    float sd = max(dot(d, uSunDir), 0.0);
    float sunUp = smoothstep(-0.15, 0.05, uSunDir.y);
    col += uSunColor * smoothstep(0.9993, 0.9996, sd) * 6.0 * sunUp;
    col += uSunColor * pow(sd, 48.0) * 0.6 * sunUp;
    col += uSunColor * pow(sd, 5.0) * (1.0 - smoothstep(0.0, 0.35, h)) * 0.35 * sunUp;

    // Moon and stars fade in at night.
    float md = dot(d, uMoonDir);
    col += vec3(0.92, 0.96, 1.0) * smoothstep(0.9978, 0.9983, md) * 2.2 * uNight;
    col += vec3(0.5, 0.6, 0.8) * pow(max(md, 0.0), 60.0) * 0.45 * uNight;

    vec3 cell = floor(d * 280.0);
    float star = step(0.9965, hash3(cell));
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash3(cell + 7.0) * 40.0);
    col += vec3(0.9, 0.95, 1.0) * star * twinkle * uNight * smoothstep(0.02, 0.25, h);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky() {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunColor: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() },
    uDeep: { value: new THREE.Color() },
    uNight: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms };
}
